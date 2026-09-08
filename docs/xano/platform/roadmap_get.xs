// ============================================================================
// ENDPOINT  roadmap   (NEW)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: GET   Auth: user (848600)
// Purpose: return the user's roadmap decorated with `done` flags, their goals
//          with progress, the next item and stats. `roadmap` is null when the
//          user has not generated one yet (front end shows the quick-start card).
// Response: {roadmap|null, goals:[...], goals_suggested:[...], next_item|null,
//            stats|null, status, version, confirmed_at}
//            (goals_suggested is read by strive-roadmap.js on a #roadmap deep link)
// ============================================================================
query roadmap verb=GET {
  auth = "user"

  input {
  }

  stack {
    db.get user_roadmaps {
      field_name = "user_id"
      field_value = $auth.id
    } as $row

    db.get user {
      field_name = "id"
      field_value = $auth.id
      output = ["id", "onboarding_session_id"]
    } as $user

    // remediation lesson (done pre-signup) counts toward completion
    var $rem_slug { value = "" }
    var $rem_done { value = false }
    conditional {
      if (`$user != null && $user.onboarding_session_id > 0`) {
        db.get onboarding_sessions {
          field_name = "id"
          field_value = $user.onboarding_session_id
          output = ["remediation_slug", "remediation_done"]
        } as $session
        conditional {
          if (`$session != null`) {
            var.update $rem_slug { value = $session.remediation_slug }
            var.update $rem_done { value = $session.remediation_done }
          }
        }
      }
    }

    db.query user_goals {
      where = $db.user_goals.user_id == $auth.id && $db.user_goals.status != "dropped"
      sort = {user_goals.sort_order: "asc"}
      return = {type: "list"}
    } as $goal_rows

    function.run roadmap_progress {
      input = {
        user_id: $auth.id,
        roadmap: ($row == null) ? null : $row.roadmap_json,
        goals: $goal_rows,
        remediation_slug: $rem_slug,
        remediation_done: $rem_done
      }
    } as $prog

    var $out {
      value = {
        roadmap: ($row == null) ? null : $prog.roadmap,
        goals: $prog.goals,
        goals_suggested: ($row == null) ? [] : ($row.roadmap_json|get:"goals_suggested"|first_notempty:[]),
        next_item: ($row == null) ? null : $prog.next_item,
        stats: ($row == null) ? null : $prog.stats,
        status: ($row == null) ? null : $row.status,
        version: ($row == null) ? null : $row.version,
        confirmed_at: ($row == null) ? null : $row.confirmed_at
      }
    }
  }

  response = $out
}
