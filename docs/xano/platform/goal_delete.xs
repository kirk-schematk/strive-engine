// ============================================================================
// ENDPOINT  goal   (NEW)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: DELETE   Auth: user (848600)
// Purpose: delete one of the user's goals.
// Response: {ok:true}
// ============================================================================
query goal verb=DELETE {
  auth = "user"

  input {
    int id
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

    db.del user_goals {
      field_name = "id"
      field_value = $goal.id
    }
  }

  response = {ok: true}
}
