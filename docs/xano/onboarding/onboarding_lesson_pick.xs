// ============================================================================
// ENDPOINT  onboarding_lesson_pick   (NEW)
// Group: Onboarding (api:m2bNDxnv, id 428916)   Verb: POST   Auth: none
// Purpose: pick the one remediation mini-lesson to render inline after the
//          teaser. Rule: first wrong answer's skill_id -> that lesson
//          (reason "remediation"); no wrong answers -> a phase-5 lesson in a
//          domain the session never asked about (reason "stretch").
//          Persists remediation_slug / remediation_reason on the session.
//          Idempotent: a second call returns the same pick.
// Response: {slug, title, est_minutes, competency, domain, phase,
//            reason:"remediation"|"stretch", question_stem|null, message}
// ============================================================================
query onboarding_lesson_pick verb=POST {
  input {
    text session_token
  }

  stack {
    db.get onboarding_sessions {
      field_name = "session_token"
      field_value = $input.session_token
    } as $session

    precondition ($session != null) {
      error_type = "notfound"
      error = "Unknown session_token"
    }
    precondition ($session.status == "completed" || $session.status == "claimed") {
      error_type = "badrequest"
      error = "Finish the assessment first"
    }

    var $served { value = ($session.questions_served == null) ? [] : $session.questions_served }
    var $lesson { value = null }
    var $reason { value = "" }
    var $question_stem { value = null }

    // ------------------------------------------------------------------
    // 0. Idempotent: reuse the stored pick
    // ------------------------------------------------------------------
    conditional {
      if (`($session.remediation_slug|is_empty) == false`) {
        db.query mini_lessons {
          where = $db.mini_lessons.slug == $session.remediation_slug
          return = {type: "single"}
          output = ["id", "slug", "skill_id", "title", "competency_id", "est_minutes", "phase"]
        } as $stored
        conditional {
          if (`$stored != null`) {
            var.update $lesson { value = $stored }
            var.update $reason { value = $session.remediation_reason }
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 1. Remediation: first wrong answer's skill
    // ------------------------------------------------------------------
    conditional {
      if (`$lesson == null`) {
        array.find ($served) if (`$this.correct == false`) as $first_wrong
        conditional {
          if (`$first_wrong != null`) {
            db.query mini_lessons {
              where = $db.mini_lessons.skill_id == $first_wrong.skill_id && $db.mini_lessons.status == "published"
              return = {type: "single"}
              output = ["id", "slug", "skill_id", "title", "competency_id", "est_minutes", "phase"]
            } as $rem
            conditional {
              if (`$rem != null`) {
                var.update $lesson { value = $rem }
                var.update $reason { value = "remediation" }
              }
            }
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 2. Stretch: phase-5 lesson in a domain the session never asked about
    // ------------------------------------------------------------------
    conditional {
      if (`$lesson == null`) {
        // NOTE: array.map is a no-op in this Xano build — foreach + push instead.
        var $asked_domains { value = [] }
        foreach ($served) {
          each as $sv {
            array.push $asked_domains { value = $sv.domain }
          }
        }
        var $target_domain { value = 0 }
        for (`5`) {
          each as $i {
            var $dnum { value = $i + 1 }
            conditional {
              if (`$target_domain == 0 && ($dnum|in:$asked_domains) == false`) {
                var.update $target_domain { value = $dnum }
              }
            }
          }
        }
        // every domain was asked -> fall back to domain 5 (leadership) for a stretch
        conditional {
          if (`$target_domain == 0`) {
            var.update $target_domain { value = 5 }
          }
        }
        db.query competencies {
          where = $db.competencies.domain_id == $target_domain
          return = {type: "list"}
          output = ["id"]
        } as $comps
        var $comp_ids { value = [] }
        foreach ($comps) {
          each as $cp {
            array.push $comp_ids { value = $cp.id }
          }
        }

        db.query mini_lessons {
          where = $db.mini_lessons.status == "published" && $db.mini_lessons.phase == 5
          sort = {mini_lessons.id: "asc"}
          return = {type: "list"}
          output = ["id", "slug", "skill_id", "title", "competency_id", "est_minutes", "phase"]
        } as $p5
        array.find ($p5) if (`$this.competency_id|in:$comp_ids`) as $stretch
        conditional {
          if (`$stretch == null && ($p5|count) > 0`) {
            var.update $stretch { value = $p5|first }
          }
        }
        conditional {
          if (`$stretch != null`) {
            var.update $lesson { value = $stretch }
            var.update $reason { value = "stretch" }
          }
        }
      }
    }

    // last resort: any published lesson (should not happen once phases are synced)
    conditional {
      if (`$lesson == null`) {
        db.query mini_lessons {
          where = $db.mini_lessons.status == "published"
          sort = {mini_lessons.id: "asc"}
          return = {type: "single"}
          output = ["id", "slug", "skill_id", "title", "competency_id", "est_minutes", "phase"]
        } as $any
        var.update $lesson { value = $any }
        var.update $reason { value = "stretch" }
      }
    }

    precondition ($lesson != null) {
      error_type = "notfound"
      error = "No published lesson available"
    }

    // ------------------------------------------------------------------
    // 3. Decorate: competency + domain, question stem for remediation
    // ------------------------------------------------------------------
    db.get competencies {
      field_name = "id"
      field_value = $lesson.competency_id
    } as $comp
    var $domain_id { value = ($comp == null) ? 0 : $comp.domain_id }
    db.get domains {
      field_name = "id"
      field_value = $domain_id
    } as $dom
    var $domain_short {
      value = ($dom == null) ? "" : ($dom.name|split:": "|last)
    }

    conditional {
      if (`$reason == "remediation"`) {
        array.find ($served) if (`$this.correct == false`) as $fw
        conditional {
          if (`$fw != null`) {
            db.get assessment_questions {
              field_name = "id"
              field_value = $fw.question_id
            } as $fq
            conditional {
              if (`$fq != null`) {
                var.update $question_stem { value = $fq.question_json.stem }
              }
            }
          }
        }
      }
    }

    var $est { value = ($lesson.est_minutes|is_empty) ? 6 : $lesson.est_minutes }
    var $message {
      value = ($reason == "remediation") ? ("Fix your weakest answer in ~"|concat:($est|to_text)|concat:" minutes") : ("You aced it - try a "|concat:($est|to_text)|concat:"-minute stretch lesson in "|concat:$domain_short)
    }

    // persist the pick (only when not already stored)
    conditional {
      if (`$session.remediation_slug != $lesson.slug`) {
        db.edit onboarding_sessions {
          field_name = "id"
          field_value = $session.id
          data = {
            remediation_slug: $lesson.slug,
            remediation_reason: $reason,
            remediation_done: false
          }
        } as $saved
      }
    }
  }

  response = {
    slug: $lesson.slug,
    title: $lesson.title,
    est_minutes: $est,
    competency: ($comp == null) ? "" : $comp.name,
    domain: $domain_id,
    phase: $lesson.phase,
    reason: $reason,
    question_stem: $question_stem,
    message: $message
  }
}
