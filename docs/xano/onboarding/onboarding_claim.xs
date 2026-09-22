// ============================================================================
// ENDPOINT  onboarding_claim   (REPLACES the existing endpoint)
// Group: Onboarding (api:m2bNDxnv, id 428916)   Verb: POST
// Auth: REQUIRED - set "Authentication" to the `user` table (848600) in the
//       endpoint settings (auth = "user" below). The front end sends the same
//       Bearer token it gets from POST /memberstack_auth on the Platform group.
// Purpose: link an anonymous assessment session to the signed-in user, write
//          placement onto the user, generate the roadmap (roadmap_build,
//          source "assessment") and return full results + roadmap + suggested
//          goals. Idempotent for the same user; 403 if claimed by someone else.
// Response: {results:{archetype, placement_phase, phase_label, discipline, goal,
//            headline, accuracy, questions_answered, questions_correct,
//            phase_correct_counts, domains:[{domain,name,asked,correct}],
//            review:[{question_id, stem, options, answer_index, correct_index,
//            correct, feedback, skill_id, lesson_slug, lesson_title}]},
//            roadmap, goals_suggested, next_item, stats, remediation:{slug,reason,done}}
// ============================================================================
query onboarding_claim verb=POST {
  auth = "user"

  input {
    text session_token
  }

  stack {
    var $phase_labels {
      // NOTE: a literal {"1": …} becomes a 0-based LIST in Xano (off-by-one lookups); build maps with |set.
      value = {}|set:"1":"Foundations"|set:"2":"Production"|set:"3":"Coordination"|set:"4":"Management"|set:"5":"Strategy"
    }
    var $archetypes {
      value = {}|set:"1":"Explorer"|set:"2":"Builder"|set:"3":"Orchestrator"|set:"4":"Strategist"|set:"5":"Visionary"
    }

    // ------------------------------------------------------------------
    // 1. Load + guard
    // ------------------------------------------------------------------
    db.get onboarding_sessions {
      field_name = "session_token"
      field_value = $input.session_token
    } as $session

    precondition ($session != null) {
      error_type = "notfound"
      error = "Unknown session_token"
    }
    precondition ($session.status != "in_progress") {
      error_type = "badrequest"
      error = "Finish the assessment before claiming it"
    }
    precondition ($session.status != "claimed" || $session.user_id == $auth.id) {
      error_type = "accessdenied"
      error = "This assessment belongs to another account"
    }

    var $already_mine { value = $session.status == "claimed" && $session.user_id == $auth.id }

    // ------------------------------------------------------------------
    // 2. Derive results from questions_served
    // ------------------------------------------------------------------
    var $served { value = ($session.questions_served == null) ? [] : $session.questions_served }
    var $answered { value = $served|count }
    array.filter_count ($served) if (`$this.correct == true`) as $n_correct
    var $accuracy { value = ($answered > 0) ? ((($n_correct * 100) / $answered)|round:0) : 0 }
    var $placement { value = ($session.placement_phase == null || $session.placement_phase < 1) ? 1 : $session.placement_phase }
    var $placement_key { value = $placement|to_text }
    var $phase_label { value = $phase_labels|get:$placement_key|first_notempty:"Foundations" }
    var $archetype {
      value = ($session.archetype|is_empty) ? ($archetypes|get:$placement_key|first_notempty:"Explorer") : $session.archetype
    }
    var $headline {
      value = "You are a " ~ $archetype ~ " - placed at " ~ $phase_label ~ " with " ~ ($accuracy|to_text) ~ "% accuracy."
    }

    db.query domains {
      sort = {domains.id: "asc"}
      return = {type: "list"}
    } as $domain_rows

    // per-domain asked/correct + wrong skill ids + domain_stats for roadmap_build
    var $domains_out { value = [] }
    var $domain_stats { value = [] }
    foreach ($domain_rows) {
      each as $d {
        array.filter_count ($served) if (`$this.domain == $d.id`) as $asked
        array.filter_count ($served) if (`$this.domain == $d.id && $this.correct == true`) as $ok
        array.push $domains_out {
          value = {
            domain: $d.id,
            name: ($d.name|split:": "|last),
            asked: $asked,
            correct: $ok
          }
        }
        conditional {
          if (`$asked > 0`) {
            array.push $domain_stats { value = {domain: $d.id, asked: $asked, wrong: $asked - $ok} }
          }
        }
      }
    }

    array.filter ($served) if (`$this.correct == false`) as $wrong_entries
    // NOTE: array.map is a no-op in this Xano build — foreach + push instead.
    var $wrong_skill_ids { value = [] }
    foreach ($wrong_entries) {
      each as $we {
        array.push $wrong_skill_ids { value = $we.skill_id }
      }
    }

    // question review (safe post-signup): stem, options, chosen, correct, feedback, lesson link
    var $review { value = [] }
    foreach ($served) {
      each as $s {
        db.get assessment_questions {
          field_name = "id"
          field_value = $s.question_id
        } as $q
        conditional {
          if (`$q == null`) {
            continue
          }
        }
        var $opts { value = $q.question_json.options }
        var $opt_texts { value = [] }
        foreach ($opts) {
          each as $op {
            array.push $opt_texts { value = $op.text }
          }
        }
        array.find_index ($opts) if (`$this.correct == true`) as $correct_index
        var $lesson_slug { value = $q.question_json.source.lesson_slug }
        var $lesson_title { value = "" }
        conditional {
          if (`($lesson_slug|is_empty) == false`) {
            db.query mini_lessons {
              where = $db.mini_lessons.slug == $lesson_slug
              return = {type: "single"}
              output = ["title"]
            } as $ml
            conditional {
              if (`$ml != null`) {
                var.update $lesson_title { value = $ml.title }
              }
            }
          }
        }
        array.push $review {
          value = {
            question_id: $q.id,
            stem: $q.question_json.stem,
            options: $opt_texts,
            answer_index: $s.answer_index,
            correct_index: $correct_index,
            correct: $s.correct,
            feedback: ($s.correct == true) ? $q.question_json.feedback.correct : $q.question_json.feedback.incorrect,
            skill_id: $q.skill_id,
            phase: $q.phase,
            domain: $q.domain,
            lesson_slug: $lesson_slug,
            lesson_title: $lesson_title
          }
        }
      }
    }

    var $results {
      value = {
        archetype: $archetype,
        placement_phase: $placement,
        phase_label: $phase_label,
        discipline: $session.discipline,
        goal: $session.goal,
        headline: $headline,
        accuracy: $accuracy,
        questions_answered: $answered,
        questions_correct: $n_correct,
        phase_correct_counts: ($session.phase_correct_counts == null) ? {} : $session.phase_correct_counts,
        domains: $domains_out,
        review: $review
      }
    }

    // ------------------------------------------------------------------
    // 3. Claim (first time) -> link session, write user, build roadmap
    // ------------------------------------------------------------------
    db.get user_roadmaps {
      field_name = "user_id"
      field_value = $auth.id
    } as $existing_roadmap

    conditional {
      if (`$already_mine == true && $existing_roadmap != null`) {
        // idempotent: return what we have
        var $roadmap_json { value = $existing_roadmap.roadmap_json }
        var $goals_suggested { value = $roadmap_json|get:"goals_suggested"|first_notempty:[] }
      }
      else {
        db.edit onboarding_sessions {
          field_name = "id"
          field_value = $session.id
          data = {
            user_id: $auth.id,
            status: "claimed",
            claimed_at: "now"
          }
        } as $claimed

        db.edit user {
          field_name = "id"
          field_value = $auth.id
          data = {
            discipline: $session.discipline,
            goal: $session.goal,
            placement_phase: $placement,
            onboarding_session_id: $session.id
          }
        } as $user_saved

        function.run roadmap_build {
          input = {
            user_id: $auth.id,
            source: "assessment",
            placement_phase: $placement,
            placement_override: null,
            goal: $session.goal,
            discipline: $session.discipline,
            wrong_skill_ids: $wrong_skill_ids,
            domain_stats: $domain_stats,
            weekly_minutes: 60,
            focus_domains: [1, 2, 3, 4, 5],
            archetype: $archetype,
            onboarding_session_id: $session.id,
            current_role: "",
            target_role: ""
          }
        } as $built
        var $roadmap_json { value = $built.roadmap }
        var $goals_suggested { value = $built.goals_suggested }
      }
    }

    // ------------------------------------------------------------------
    // 4. Decorate with progress (remediation lesson counts as done)
    // ------------------------------------------------------------------
    function.run roadmap_progress {
      input = {
        user_id: $auth.id,
        roadmap: $roadmap_json,
        goals: [],
        remediation_slug: $session.remediation_slug,
        remediation_done: $session.remediation_done
      }
    } as $prog
  }

  response = {
    results: $results,
    roadmap: $prog.roadmap,
    goals_suggested: $goals_suggested,
    next_item: $prog.next_item,
    stats: $prog.stats,
    remediation: {slug: $session.remediation_slug, reason: $session.remediation_reason, done: $session.remediation_done}
  }
}
