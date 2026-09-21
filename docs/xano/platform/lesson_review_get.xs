// ============================================================================
// ENDPOINT  lesson_review   (NEW)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: GET   Auth: user (848600)
// Purpose: approver view of ONE mini-lesson at any status (drafts included),
//          with its review record. Only users with role "admin" may call it.
//          The public GET /mini_lesson keeps hiding drafts.
// Response: the mini_lessons row minus answer_key.
// ============================================================================
query lesson_review verb=GET {
  auth = "user"

  input {
    text slug
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
      where = $db.mini_lessons.slug == $input.slug
      return = {type: "single"}
      output = ["id", "slug", "skill_id", "title", "status", "lesson_json", "competency_id", "est_minutes", "phase", "lesson_type", "lesson_level", "objective", "prerequisite_slugs", "sources", "claims", "fact_check_status", "review", "approved_by", "approved_at", "reviewed_at", "review_due", "version"]
    } as $lesson

    precondition ($lesson != null) {
      error_type = "notfound"
      error = "Unknown lesson"
    }
  }

  response = $lesson
}
