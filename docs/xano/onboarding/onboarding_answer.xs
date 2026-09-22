// ============================================================================
// ENDPOINT  onboarding_answer   (REPLACES the existing endpoint)
// Group: Onboarding (api:m2bNDxnv, id 428916)   Verb: POST   Auth: none
// Purpose: grade one answer, advance the adaptive ladder (ADR DEC-9) and serve
//          the next question. FIX: never re-serves a question already in
//          questions_served; if the target phase's pool is exhausted, tries the
//          adjacent phases; if nothing is left, ends the session (done:true).
// Response (continue): {correct, feedback, done:false,
//                       next_question:{question_id, stem, options:[text]},
//                       progress:{answered, max:8}}
// Response (finished): {correct, feedback, done:true, session_token, progress}
// ============================================================================
query onboarding_answer verb=POST {
  input {
    text session_token
    int question_id
    int answer_index
  }

  stack {
    var $MAX_Q { value = 8 }
    var $phase_labels {
      // NOTE: a literal {"1": …} becomes a 0-based LIST in Xano (off-by-one lookups); build maps with |set.
      value = {}|set:"1":"Foundations"|set:"2":"Production"|set:"3":"Coordination"|set:"4":"Management"|set:"5":"Strategy"
    }
    var $archetypes {
      value = {}|set:"1":"Explorer"|set:"2":"Builder"|set:"3":"Orchestrator"|set:"4":"Strategist"|set:"5":"Visionary"
    }

    // ------------------------------------------------------------------
    // 1. Load + validate session and question
    // ------------------------------------------------------------------
    db.get onboarding_sessions {
      field_name = "session_token"
      field_value = $input.session_token
    } as $session

    precondition ($session != null) {
      error_type = "notfound"
      error = "Unknown session_token"
    }
    precondition ($session.status == "in_progress") {
      error_type = "badrequest"
      error = "This assessment is already finished"
    }

    db.get assessment_questions {
      field_name = "id"
      field_value = $input.question_id
    } as $question

    precondition ($question != null) {
      error_type = "notfound"
      error = "Unknown question_id"
    }

    var $served { value = ($session.questions_served == null) ? [] : $session.questions_served }
    // NOTE: array.map is a no-op in this Xano build (returns the input unchanged) — use foreach + push.
    var $served_ids { value = [] }
    foreach ($served) {
      each as $sv {
        array.push $served_ids { value = $sv.question_id }
      }
    }

    precondition (($input.question_id|in:$served_ids) == false) {
      error_type = "badrequest"
      error = "This question was already answered in this session"
    }

    var $options { value = $question.question_json.options }
    precondition ($input.answer_index >= 0 && $input.answer_index < ($options|count)) {
      error_type = "inputerror"
      error = "answer_index out of range"
    }

    // ------------------------------------------------------------------
    // 2. Grade
    // ------------------------------------------------------------------
    // |slice:offset:length|first is documented; bracket access $options[$input.answer_index]
    // is also documented in the expression reference - either form works.
    var $chosen { value = $options|slice:$input.answer_index:1|first }
    var $correct { value = $chosen.correct == true }
    var $feedback {
      value = $correct ? $question.question_json.feedback.correct : $question.question_json.feedback.incorrect
    }

    // phase the question belongs to (ladder state is tracked per question phase)
    var $q_phase { value = $question.phase }
    var $q_phase_key { value = $q_phase|to_text }

    var $counts { value = ($session.phase_correct_counts == null) ? {} : $session.phase_correct_counts }
    conditional {
      if (`$correct == true`) {
        // NOTE: arithmetic used directly as a filter argument evaluates to null in this
        // Xano build — compute the new count in a variable first, then |set it.
        var $new_count { value = ($counts|get:$q_phase_key|first_notempty:0) + 1 }
        var.update $counts {
          value = $counts|set:$q_phase_key:$new_count
        }
      }
    }

    array.push $served {
      value = {
        question_id: $question.id,
        skill_id: $question.skill_id,
        phase: $q_phase,
        domain: $question.domain,
        answer_index: $input.answer_index,
        correct: $correct,
        answered_at: "now"
      }
    }
    array.push $served_ids { value = $question.id }
    var $answered { value = $served|count }

    // ------------------------------------------------------------------
    // 3. Ladder (ADR DEC-9)
    //    - two correct at a phase -> move up (cap 5)
    //    - a wrong answer -> move down (floor 1) and KEEP GOING: the ladder
    //      never ends on a wrong answer (2026-09-17: the old "stable" early
    //      stop ended the session on the first miss after a climb, which felt
    //      like failing; the visitor should keep progressing until 8 questions).
    //    - stop at 8 questions or when no unserved question is left.
    // ------------------------------------------------------------------
    var $next_phase { value = $q_phase }
    conditional {
      if (`$correct == true`) {
        conditional {
          if (`($counts|get:$q_phase_key|first_notempty:0) >= 2`) {
            var.update $next_phase { value = ($q_phase + 1)|min:5 }
          }
        }
      }
      else {
        var.update $next_phase { value = ($q_phase - 1)|max:1 }
      }
    }

    var $done { value = $answered >= $MAX_Q }

    // ------------------------------------------------------------------
    // 4. Pick the next question (excluding everything already served)
    // ------------------------------------------------------------------
    var $next_question { value = null }
    var $next_q_row { value = null }
    conditional {
      if (`$done == false`) {
        db.query assessment_questions {
          where = $db.assessment_questions.active == true
          return = {type: "list"}
          output = ["id", "phase", "domain", "question_json"]
        } as $pool_all

        array.filter ($pool_all) if (`($this.id|in:$served_ids) == false`) as $pool

        // candidate phases: target first, then adjacent (direction of travel first)
        var $candidates { value = [$next_phase] }
        conditional {
          if (`$next_phase > $q_phase`) {
            array.push $candidates { value = ($next_phase + 1)|min:5 }
            array.push $candidates { value = ($next_phase - 1)|max:1 }
          }
          else {
            array.push $candidates { value = ($next_phase - 1)|max:1 }
            array.push $candidates { value = ($next_phase + 1)|min:5 }
          }
        }

        foreach ($candidates) {
          each as $cp {
            conditional {
              if (`$next_q_row != null`) {
                continue
              }
            }
            array.filter ($pool) if (`$this.phase == $cp`) as $phase_pool
            conditional {
              if (`($phase_pool|count) > 0`) {
                var.update $next_q_row { value = $phase_pool|shuffle|first }
                var.update $next_phase { value = $cp }
              }
            }
          }
        }

        conditional {
          if (`$next_q_row == null`) {
            // pool exhausted -> end the session
            var.update $done { value = true }
          }
          else {
            // Ship option TEXT only (constitution: correct flags never leave the server).
            var $opt_texts { value = [] }
            foreach ($next_q_row.question_json.options) {
              each as $opt {
                array.push $opt_texts { value = $opt.text }
              }
            }
            var.update $next_question {
              value = {
                question_id: $next_q_row.id,
                stem: $next_q_row.question_json.stem,
                options: $opt_texts
              }
            }
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 5. Persist
    // ------------------------------------------------------------------
    var $progress { value = {answered: $answered, max: $MAX_Q} }

    conditional {
      if (`$done == true`) {
        // placement = highest phase with >=2 correct, else 1
        var $placement { value = 1 }
        for (`5`) {
          each as $i {
            var $pk { value = ($i + 1)|to_text }
            conditional {
              if (`($counts|get:$pk|first_notempty:0) >= 2`) {
                var.update $placement { value = $i + 1 }
              }
            }
          }
        }
        array.filter_count ($served) if (`$this.correct == true`) as $n_correct
        var $accuracy { value = (($n_correct * 100) / $answered)|round:0 }
        var $placement_key { value = $placement|to_text }
        var $archetype { value = $archetypes|get:$placement_key|first_notempty:"Explorer" }
        var $results {
          value = {
            archetype: $archetype,
            placement_phase: $placement,
            phase_label: ($phase_labels|get:$placement_key|first_notempty:"Foundations"),
            discipline: $session.discipline,
            goal: $session.goal,
            accuracy: $accuracy,
            questions_answered: $answered,
            questions_correct: $n_correct,
            phase_correct_counts: $counts,
            completed_at: "now"
          }
        }
        db.edit onboarding_sessions {
          field_name = "id"
          field_value = $session.id
          data = {
            questions_served: $served,
            phase_correct_counts: $counts,
            current_phase: $next_phase,
            placement_phase: $placement,
            archetype: $archetype,
            results_json: $results,
            status: "completed",
            completed_at: "now"
          }
        } as $saved
      }
      else {
        db.edit onboarding_sessions {
          field_name = "id"
          field_value = $session.id
          data = {
            questions_served: $served,
            phase_correct_counts: $counts,
            current_phase: $next_phase
          }
        } as $saved
      }
    }

    var $out {
      value = ($done == true) ? {correct: $correct, feedback: $feedback, done: true, session_token: $input.session_token, progress: $progress} : {correct: $correct, feedback: $feedback, done: false, next_question: $next_question, progress: $progress}
    }
  }

  response = $out
}
