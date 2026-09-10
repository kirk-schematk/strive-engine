// ============================================================================
// ENDPOINT  course/check_completions   (NEW)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: GET   Auth: user (848600)
// Purpose: the member's knowledge-check history, so the course page restores
//          passed checks on any device instead of relying on localStorage.
// Input:   course_id (optional) — omit for every course (dashboard use).
// Response: {items:[{course_id, module_index, module_title, score, total,
//            helped, attempts, passed, completed_at}], passed_modules:[int]}
//            passed_modules is only meaningful when course_id is given.
// ============================================================================
query course/check_completions verb=GET {
  auth = "user"

  input {
    text course_id filters=trim
  }

  stack {
    db.query course_check_completions {
      where = $db.course_check_completions.user_id == $auth.id
      sort = {course_check_completions.module_index: "asc"}
      return = {type: "list"}
    } as $rows

    var $items { value = [] }
    var $passed_modules { value = [] }
    var $filtering { value = ($input.course_id|is_empty) == false }

    foreach ($rows) {
      each as $r {
        conditional {
          if (`$filtering == true && $r.course_id != $input.course_id`) {
            continue
          }
        }

        array.push $items {
          value = {
            course_id: $r.course_id,
            module_index: $r.module_index,
            module_title: $r.module_title,
            score: $r.score,
            total: $r.total,
            helped: $r.helped,
            attempts: $r.attempts,
            passed: $r.passed,
            completed_at: $r.completed_at
          }
        }

        conditional {
          if (`$r.passed == true`) {
            array.push $passed_modules { value = $r.module_index }
          }
        }
      }
    }
  }

  response = {items: $items, passed_modules: $passed_modules}
}
