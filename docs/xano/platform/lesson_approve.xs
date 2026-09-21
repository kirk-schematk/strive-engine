// ============================================================================
// ENDPOINT  lesson_approve   (NEW)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: POST   Auth: user (848600)
// Purpose: an approver publishes a draft mini-lesson. Refuses unless the
//          independent fact check is recorded as verified. Stamps who approved
//          it, when, and when its sources are due for re-verification
//          (12 months; pass review_months = 6 for software-version lessons).
// Response: {slug, status, approved_by, approved_at, review_due}
// ============================================================================
query lesson_approve verb=POST {
  auth = "user"

  input {
    text slug
    int review_months?
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
      output = ["id", "slug", "status", "fact_check_status"]
    } as $lesson

    precondition ($lesson != null) {
      error_type = "notfound"
      error = "Unknown lesson"
    }
    precondition ($lesson.fact_check_status == "verified") {
      error_type = "inputerror"
      error = "Fact check is not verified; this lesson cannot be published"
    }

    var $months {
      value = ($input.review_months == null || $input.review_months < 1) ? 12 : $input.review_months
    }
    var $offset {
      value = "+" ~ $months ~ " months"
    }
    var $today {
      value = "now"|to_timestamp:"UTC"|format_timestamp:"Y-m-d":"UTC"
    }
    var $due {
      value = "now"|to_timestamp:"UTC"|transform_timestamp:$offset:"UTC"|format_timestamp:"Y-m-d":"UTC"
    }

    db.edit mini_lessons {
      field_name = "id"
      field_value = $lesson.id
      data = {
        status: "published",
        approved_by: $me.email,
        approved_at: $today,
        review_due: $due
      }
    } as $saved
  }

  response = {
    slug: $saved.slug,
    status: $saved.status,
    approved_by: $saved.approved_by,
    approved_at: $saved.approved_at,
    review_due: $saved.review_due
  }
}
