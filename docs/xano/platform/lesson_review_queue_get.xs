// ============================================================================
// ENDPOINT  lesson_review_queue   (NEW)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: GET   Auth: user (848600)
// Purpose: every draft mini-lesson waiting for an approver, oldest first.
//          Only users with role "admin" may call it.
// Response: [{slug, skill_id, title, competency_id, phase, lesson_type,
//             lesson_level, objective, fact_check_status, review, version}]
// ============================================================================
query lesson_review_queue verb=GET {
  auth = "user"

  input {
  }

  stack {
    db.get user {
      field_name = "id"
      field_value = $auth.id
    } as $me

    precondition ($me != null && $me.role == "admin") {
      error_type = "accessdenied"
      error = "Approvers only"
    }

    db.query mini_lessons {
      where = $db.mini_lessons.status == "draft"
      sort = {mini_lessons.id: "asc"}
      return = {type: "list"}
      output = ["slug", "skill_id", "title", "competency_id", "phase", "lesson_type", "lesson_level", "objective", "fact_check_status", "review", "version"]
    } as $queue
  }

  response = $queue
}
