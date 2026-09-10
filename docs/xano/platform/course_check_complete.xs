// ============================================================================
// ENDPOINT  course/check_complete   (NEW)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: POST   Auth: user (848600)
// Purpose: record a module knowledge check. The client sends the option index
//          it chose per question; the SERVER re-grades those answers against
//          the check stored in courses.course_json. The client's own verdict is
//          never trusted (same rule as the mini-lesson quiz).
// Input:   {course_id, module_index, answers:[int], helped:int}
//          answers[i] = index into questions[i].options, -1 / missing = unanswered.
//          helped = how many mini-lessons the learner opened (formative signal).
// Writes:  course_check_completions (888032), one row per (user, course, module).
//          Re-submitting edits that row: attempts +1, passed is sticky, and
//          completed_at keeps the FIRST pass.
// Response: {ok:true, passed, score, total, module_index, course_id}
// NOTE: a bare `||` inside a db.edit object literal does NOT evaluate as a
//       boolean OR on this instance (it silently yields false) - compute the
//       value into a var with a one-line ternary first. Verified 2026-09-09.
// ============================================================================
query course/check_complete verb=POST {
  auth = "user"

  input {
    text course_id filters=trim
    int module_index
    json answers
    int helped
  }

  stack {
    precondition (($input.course_id|is_empty) == false) {
      error_type = "inputerror"
      error = "course_id is required"
    }

    db.get courses {
      field_name = "course_id"
      field_value = $input.course_id
    } as $course

    precondition ($course != null) {
      error_type = "notfound"
      error = "Unknown course_id"
    }

    var $modules { value = $course.course_json|get:"modules"|first_notempty:[] }

    // ------------------------------------------------------------------
    // 1. Locate the module (list index, so walk it with a counter)
    // ------------------------------------------------------------------
    var $module { value = null }
    var $mi { value = 0 }
    foreach ($modules) {
      each as $m {
        conditional {
          if (`$mi == $input.module_index`) {
            var.update $module { value = $m }
          }
        }
        var.update $mi { value = $mi + 1 }
      }
    }

    precondition ($module != null) {
      error_type = "notfound"
      error = "No module at that index"
    }

    var $check { value = $module|get:"check"|first_notempty:null }

    precondition ($check != null) {
      error_type = "inputerror"
      error = "That module has no knowledge check"
    }

    var $questions { value = $check|get:"questions"|first_notempty:[] }
    var $total { value = $questions|count }

    precondition ($total > 0) {
      error_type = "inputerror"
      error = "That check has no questions"
    }

    // ------------------------------------------------------------------
    // 2. Re-grade the submitted answers against the stored check
    // ------------------------------------------------------------------
    var $answers { value = ($input.answers == null) ? [] : $input.answers }
    var $score { value = 0 }
    var $qi { value = 0 }
    var $sel { value = -1 }
    var $ai { value = 0 }
    var $opts { value = [] }
    var $oi { value = 0 }

    foreach ($questions) {
      each as $q {
        var.update $sel { value = -1 }
        var.update $ai { value = 0 }
        foreach ($answers) {
          each as $a {
            conditional {
              if (`$ai == $qi`) {
                var.update $sel { value = $a }
              }
            }
            var.update $ai { value = $ai + 1 }
          }
        }

        var.update $opts { value = $q|get:"options"|first_notempty:[] }
        var.update $oi { value = 0 }
        foreach ($opts) {
          each as $o {
            conditional {
              if (`$oi == $sel && ($o|get:"correct") == true`) {
                var.update $score { value = $score + 1 }
              }
            }
            var.update $oi { value = $oi + 1 }
          }
        }

        var.update $qi { value = $qi + 1 }
      }
    }

    var $passed { value = ($score == $total) }
    var $helped { value = ($input.helped == null || $input.helped < 0) ? 0 : $input.helped }
    var $module_title { value = $module|get:"title"|first_notempty:"" }
    var $now { value = "now"|to_timestamp:"UTC" }

    // ------------------------------------------------------------------
    // 3. Upsert the completion row
    // ------------------------------------------------------------------
    db.query course_check_completions {
      where = $db.course_check_completions.user_id == $auth.id && $db.course_check_completions.course_id == $input.course_id && $db.course_check_completions.module_index == $input.module_index
      return = {type: "list"}
    } as $rows

    var $row { value = (($rows|count) > 0) ? ($rows|first) : null }

    conditional {
      if (`$row == null`) {
        db.add course_check_completions {
          data = {
            created_at: "now",
            user_id: $auth.id,
            course_row_id: $course.id,
            course_id: $input.course_id,
            module_index: $input.module_index,
            module_title: $module_title,
            score: $score,
            total: $total,
            helped: $helped,
            attempts: 1,
            passed: $passed,
            completed_at: ($passed == true) ? $now : null
          }
        } as $added
      }
    }

    conditional {
      if (`$row != null`) {
        var $sticky { value = ($row.passed == true) ? true : $passed }

        db.edit course_check_completions {
          field_name = "id"
          field_value = $row.id
          data = {
            module_title: $module_title,
            score: $score,
            total: $total,
            helped: $helped,
            attempts: ($row.attempts + 1),
            passed: $sticky,
            completed_at: ($row.completed_at != null) ? $row.completed_at : (($passed == true) ? $now : null)
          }
        } as $edited
      }
    }
  }

  response = {ok: true, passed: $passed, score: $score, total: $total, module_index: $input.module_index, course_id: $input.course_id}
}
