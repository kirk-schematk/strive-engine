// ============================================================================
// ENDPOINT  waitlist_apply   (NEW)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: POST   Auth: user (848600)
// Purpose: launch day. A member who joined the pre-launch waitlist signs up
//          with the same email; this copies the picks they made on the home
//          page (discipline, goal) onto their user row when those are still
//          blank, stamps the waitlist row as applied, and returns the picks so
//          the welcome-onboard engine can pre-select them. Idempotent: calling
//          it again returns the same picks and changes nothing else.
// Input:   none (the member comes from the bearer token)
// Response: {applied:bool, discipline, goal, level, level_name}
//          applied=false when the email is not on the waitlist.
// ============================================================================
query waitlist_apply verb=POST {
  auth = "user"

  input {
  }

  stack {
    db.get user {
      field_name = "id"
      field_value = $auth.id
    } as $u

    precondition ($u != null) {
      error_type = "notfound"
      error = "Unknown user"
    }

    var $email { value = ($u.email|first_notempty:"")|trim|lower }
    var $row { value = null }
    conditional {
      if (`($email|is_empty) == false`) {
        db.get waitlist {
          field_name = "email"
          field_value = $email
        } as $found
        var.update $row { value = $found }
      }
    }

    var $out { value = {applied: false, discipline: "", goal: "", level: 0, level_name: ""} }
    conditional {
      if (`$row != null`) {
        var $disc { value = (($u.discipline|first_notempty:"") == "") ? ($row.discipline|first_notempty:"") : $u.discipline }
        var $goal { value = (($u.goal|first_notempty:"") == "") ? ($row.goal|first_notempty:"") : $u.goal }
        db.edit user {
          field_name = "id"
          field_value = $auth.id
          data = {discipline: $disc, goal: $goal}
        } as $u2
        db.edit waitlist {
          field_name = "id"
          field_value = $row.id
          data = {applied_user_id: $auth.id, applied_at: "now"}
        } as $w2
        var.update $out {
          value = {applied: true, discipline: ($row.discipline|first_notempty:""), goal: ($row.goal|first_notempty:""), level: ($row.level|first_notempty:0), level_name: ($row.level_name|first_notempty:"")}
        }
      }
    }
  }

  response = $out
}
