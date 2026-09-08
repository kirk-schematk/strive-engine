// ============================================================================
// ENDPOINT  goals   (NEW)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: POST   Auth: user (848600)
// Purpose: replace ALL of the user's active goals with the given list
//          (done/dropped goals are left alone). Each goal:
//          {title, description?, metric?:{type:"lessons"|"manual", slugs?, count?},
//           target_count?, due_date?:"YYYY-MM-DD"}
//          target_count defaults to metric.count, then slugs.length, then 1.
// Response: {goals:[... decorated with progress]}
// ============================================================================
query goals verb=POST {
  auth = "user"

  input {
    json goals
  }

  stack {
    precondition ($input.goals != null && ($input.goals|is_array)) {
      error_type = "inputerror"
      error = "goals must be an array"
    }

    db.get user_roadmaps {
      field_name = "user_id"
      field_value = $auth.id
      output = ["id"]
    } as $roadmap_row
    var $roadmap_id { value = ($roadmap_row == null) ? 0 : $roadmap_row.id }

    // ------------------------------------------------------------------
    // 1. Remove the current active goals
    // ------------------------------------------------------------------
    db.query user_goals {
      where = $db.user_goals.user_id == $auth.id && $db.user_goals.status == "active"
      return = {type: "list"}
      output = ["id"]
    } as $old
    foreach ($old) {
      each as $g {
        db.del user_goals {
          field_name = "id"
          field_value = $g.id
        }
      }
    }

    // ------------------------------------------------------------------
    // 2. Insert the new ones
    // ------------------------------------------------------------------
    var $sort { value = 0 }
    foreach ($input.goals) {
      each as $g {
        var $title { value = ($g|get:"title"|first_notempty:"")|trim }
        conditional {
          if (`$title|is_empty`) {
            continue
          }
        }
        var $metric { value = $g|get:"metric"|first_notempty:{type: "manual"} }
        conditional {
          if (`($metric|get:"type"|first_notempty:"") == ""`) {
            var.update $metric { value = $metric|set:"type":"manual" }
          }
        }
        var $slugs { value = $metric|get:"slugs"|first_notempty:[] }
        var $target {
          value = (($g|get:"target_count"|first_notempty:0) > 0) ? ($g|get:"target_count"|first_notempty:0) : ((($metric|get:"count"|first_notempty:0) > 0) ? ($metric|get:"count"|first_notempty:0) : ((($slugs|count) > 0) ? ($slugs|count) : 1))
        }
        var $due { value = $g|get:"due_date"|first_notempty:null }
        conditional {
          if (`$due|is_empty`) {
            var.update $due { value = null }
          }
        }
        db.add user_goals {
          data = {
            created_at: "now",
            user_id: $auth.id,
            roadmap_id: $roadmap_id,
            title: $title,
            description: ($g|get:"description"|first_notempty:""),
            metric_json: $metric,
            target_count: $target,
            due_date: $due,
            status: "active",
            sort_order: $sort,
            completed_at: null
          }
        } as $added
        var.update $sort { value = $sort + 1 }
      }
    }

    // ------------------------------------------------------------------
    // 3. Return decorated
    // ------------------------------------------------------------------
    db.query user_goals {
      where = $db.user_goals.user_id == $auth.id && $db.user_goals.status != "dropped"
      sort = {user_goals.sort_order: "asc"}
      return = {type: "list"}
    } as $goal_rows

    function.run roadmap_progress {
      input = {
        user_id: $auth.id,
        roadmap: null,
        goals: $goal_rows,
        remediation_slug: "",
        remediation_done: false
      }
    } as $prog
  }

  response = {goals: $prog.goals}
}
