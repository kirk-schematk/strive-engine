// ============================================================================
// ENDPOINT  roadmap   (NEW)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: PATCH   Auth: user (848600)
// Purpose: confirm the roadmap and/or accept client edits.
//          - status: "confirmed" | "proposed"
//          - inputs: merged into roadmap_json.inputs (current_role, target_role,
//            weekly_minutes, focus_domains) WITHOUT regenerating (use
//            POST /roadmap_generate to regenerate)
//          - milestones: replaces the milestone array. Client may only remove
//            items and reorder milestones; every item is re-validated against
//            the slugs already in the stored roadmap (unknown slugs dropped).
// Response: same shape as GET /roadmap (incl. goals_suggested)
// ============================================================================
query roadmap verb=PATCH {
  auth = "user"

  input {
    text status?
    json inputs?
    json milestones?
  }

  stack {
    db.get user_roadmaps {
      field_name = "user_id"
      field_value = $auth.id
    } as $row

    precondition ($row != null) {
      error_type = "notfound"
      error = "No roadmap yet - call roadmap_generate first"
    }

    var $rj { value = $row.roadmap_json }

    // ------------------------------------------------------------------
    // 1. milestones: validate against the stored items (slug + type)
    // ------------------------------------------------------------------
    conditional {
      if (`$input.milestones != null`) {
        var $known { value = [] }
        var $known_items { value = {} }
        foreach ($rj.milestones) {
          each as $ms {
            foreach ($ms.items) {
              each as $it {
                var $k { value = $it.type|concat:":"|concat:$it.slug }
                array.push $known { value = $k }
                var.update $known_items { value = $known_items|set:$k:$it }
              }
            }
          }
        }

        var $clean { value = [] }
        var $seen { value = [] }
        foreach ($input.milestones) {
          each as $cm {
            var $items { value = [] }
            var $cm_items { value = ($cm.items == null) ? [] : $cm.items }
            foreach ($cm_items) {
              each as $ci {
                var $k { value = ($ci.type|first_notempty:"lesson")|concat:":"|concat:$ci.slug }
                conditional {
                  if (`($k|in:$known) && ($k|in:$seen) == false`) {
                    // take the server copy of the item so titles/minutes cannot be tampered with
                    array.push $items { value = ($known_items|get:$k|first_notempty:$ci)|set:"done":false }
                    array.push $seen { value = $k }
                  }
                }
              }
            }
            conditional {
              if (`($items|count) == 0`) {
                continue
              }
            }
            array.push $clean {
              value = {
                id: $cm.id,
                title: $cm.title,
                why: ($cm|get:"why"|first_notempty:""),
                phase: ($cm|get:"phase"|first_notempty:$rj.placement_phase),
                domain: ($cm|get:"domain"|first_notempty:null),
                deferred: ($cm|get:"deferred"|first_notempty:false) == true,
                items: $items
              }
            }
          }
        }
        precondition (($clean|count) > 0) {
          error_type = "inputerror"
          error = "milestones must keep at least one known item"
        }
        // recompute totals (non-deferred)
        var $t_items { value = 0 }
        var $t_min { value = 0 }
        foreach ($clean) {
          each as $ms {
            conditional {
              if (`$ms.deferred == true`) {
                continue
              }
            }
            var.update $t_items { value = $t_items + ($ms.items|count) }
            foreach ($ms.items) {
              each as $it {
                var.update $t_min { value = $t_min + $it.minutes }
              }
            }
          }
        }
        var.update $rj {
          value = $rj|set:"milestones":$clean|set:"totals":{items: $t_items, minutes: $t_min, done: 0}
        }
      }
    }

    // ------------------------------------------------------------------
    // 2. inputs: shallow merge
    // ------------------------------------------------------------------
    conditional {
      if (`$input.inputs != null`) {
        var $merged { value = ($rj|get:"inputs"|first_notempty:{})|merge:$input.inputs }
        var.update $rj { value = $rj|set:"inputs":$merged }
      }
    }

    // ------------------------------------------------------------------
    // 3. status
    // ------------------------------------------------------------------
    var $status { value = $row.status }
    var $confirmed_at { value = $row.confirmed_at }
    conditional {
      if (`$input.status == "confirmed"`) {
        var.update $status { value = "confirmed" }
        var.update $confirmed_at { value = "now" }
      }
      elseif (`$input.status == "proposed"`) {
        var.update $status { value = "proposed" }
        var.update $confirmed_at { value = null }
      }
    }

    db.edit user_roadmaps {
      field_name = "id"
      field_value = $row.id
      data = {
        roadmap_json: $rj,
        status: $status,
        confirmed_at: $confirmed_at,
        updated_at: "now"
      }
    } as $saved

    // ------------------------------------------------------------------
    // 4. Same response as GET /roadmap
    // ------------------------------------------------------------------
    db.get user {
      field_name = "id"
      field_value = $auth.id
      output = ["id", "onboarding_session_id"]
    } as $user
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
        roadmap: $saved.roadmap_json,
        goals: $goal_rows,
        remediation_slug: $rem_slug,
        remediation_done: $rem_done
      }
    } as $prog
  }

  response = {
    roadmap: $prog.roadmap,
    goals: $prog.goals,
    goals_suggested: ($saved.roadmap_json|get:"goals_suggested"|first_notempty:[]),
    next_item: $prog.next_item,
    stats: $prog.stats,
    status: $saved.status,
    version: $saved.version,
    confirmed_at: $saved.confirmed_at
  }
}
