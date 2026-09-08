// ============================================================================
// ENDPOINT  goal   (NEW)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: PATCH   Auth: user (848600)
// Purpose: edit one goal (title, description, due_date, status). Only the
//          owner may edit. status "done" stamps completed_at; "active" clears it.
// Response: {goal: {... decorated with progress}}
// ============================================================================
query goal verb=PATCH {
  auth = "user"

  input {
    int id
    text title?
    text description?
    text due_date?
    text status?
  }

  stack {
    db.get user_goals {
      field_name = "id"
      field_value = $input.id
    } as $goal

    precondition ($goal != null) {
      error_type = "notfound"
      error = "Unknown goal"
    }
    precondition ($goal.user_id == $auth.id) {
      error_type = "accessdenied"
      error = "Not your goal"
    }
    precondition ($input.status == null || ($input.status|in:["active", "done", "dropped"])) {
      error_type = "inputerror"
      error = "status must be active, done or dropped"
    }

    // db.edit requires `data` to be an inline object literal, so every column is
    // written: an omitted input keeps the stored value.
    // REVIEW: relies on omitted optional inputs arriving as null (verify once).
    var $new_title {
      value = ($input.title|is_empty) ? $goal.title : $input.title
    }
    var $new_description {
      value = ($input.description == null) ? $goal.description : $input.description
    }
    var $new_due_date {
      value = ($input.due_date == null) ? $goal.due_date : (($input.due_date|is_empty) ? null : $input.due_date)
    }
    var $new_status {
      value = ($input.status == null) ? $goal.status : $input.status
    }
    var $new_completed_at { value = $goal.completed_at }
    conditional {
      if (`$input.status == "done"`) {
        var.update $new_completed_at { value = "now" }
      }
      elseif (`$input.status != null`) {
        var.update $new_completed_at { value = null }
      }
    }

    db.edit user_goals {
      field_name = "id"
      field_value = $goal.id
      data = {
        title: $new_title,
        description: $new_description,
        due_date: $new_due_date,
        status: $new_status,
        completed_at: $new_completed_at
      }
    } as $saved

    function.run roadmap_progress {
      input = {
        user_id: $auth.id,
        roadmap: null,
        goals: [$saved],
        remediation_slug: "",
        remediation_done: false
      }
    } as $prog
  }

  response = {goal: $prog.goals|first}
}
