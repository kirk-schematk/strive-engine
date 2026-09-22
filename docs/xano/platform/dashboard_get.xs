// ============================================================================
// ENDPOINT  dashboard   (NEW)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: GET   Auth: user (848600)
// Purpose: one call for the /dashboard page.
// Response: {user:{first_name,last_name,email,location,company,industry,
//            current_role,desired_role,profile_photo,discipline,goal,
//            placement_phase,phase_label,archetype},
//            roadmap_summary:{status,target_phase,placement_phase,version,
//              totals:{items,minutes,done},
//              milestones:[{id,title,phase,domain,deferred,items_total,items_done,
//                items:[{type,slug,title,minutes,competency,domain,phase,skill_id,done}]}]}|null,
//            next_item:{...item, milestone_id, milestone_title}|null,
//            goals:[...with progress],
//            recent_completions:[{slug,title,completed_at}],
//            stats:{items_total,items_done,minutes_total,minutes_done,percent,completions,
//                   lessons_this_week,lessons_done,minutes_learned,goals_done}}
// ============================================================================
query dashboard verb=GET {
  auth = "user"

  input {
  }

  stack {
    var $phase_labels {
      // NOTE: a literal {"1": …} becomes a 0-based LIST in Xano (off-by-one lookups); build maps with |set.
      value = {}|set:"1":"Foundations"|set:"2":"Production"|set:"3":"Coordination"|set:"4":"Management"|set:"5":"Strategy"
    }
    var $archetypes {
      value = {}|set:"1":"Explorer"|set:"2":"Builder"|set:"3":"Orchestrator"|set:"4":"Strategist"|set:"5":"Visionary"
    }

    db.get user {
      field_name = "id"
      field_value = $auth.id
    } as $u

    precondition ($u != null) {
      error_type = "unauthorized"
      error = "Sign in required"
    }

    db.get user_roadmaps {
      field_name = "user_id"
      field_value = $auth.id
    } as $row

    // placement: roadmap wins (override applied), then user row
    var $placement {
      value = ($row != null && $row.roadmap_json != null) ? ($row.roadmap_json|get:"placement_phase"|first_notempty:$u.placement_phase) : $u.placement_phase
    }
    conditional {
      if (`$placement == null || $placement < 1`) {
        var.update $placement { value = 0 }
      }
    }
    var $pkey { value = $placement|to_text }
    var $archetype {
      value = ($row != null && $row.roadmap_json != null) ? ($row.roadmap_json|get:"archetype"|first_notempty:"") : ""
    }
    conditional {
      if (`($archetype|is_empty) && $placement > 0`) {
        var.update $archetype { value = $archetypes|get:$pkey|first_notempty:"" }
      }
    }

    // remediation lesson from the claimed session
    var $rem_slug { value = "" }
    var $rem_done { value = false }
    conditional {
      if (`$u.onboarding_session_id > 0`) {
        db.get onboarding_sessions {
          field_name = "id"
          field_value = $u.onboarding_session_id
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

    // ------------------------------------------------------------------
    // roadmap_summary
    // ------------------------------------------------------------------
    var $roadmap_summary { value = null }
    conditional {
      if (`$row != null && $prog.roadmap != null`) {
        var $ms_summary { value = [] }
        foreach ($prog.roadmap.milestones) {
          each as $ms {
            array.push $ms_summary {
              value = {
                id: $ms.id,
                title: $ms.title,
                phase: $ms.phase,
                domain: $ms.domain,
                why: ($ms|get:"why"|first_notempty:""),
                deferred: $ms.deferred,
                items_total: $ms.items_total,
                items_done: $ms.items_done,
                items: $ms.items
              }
            }
          }
        }
        var.update $roadmap_summary {
          value = {
            status: $row.status,
            target_phase: $prog.roadmap.target_phase,
            placement_phase: $prog.roadmap.placement_phase,
            version: $row.version,
            summary: $prog.roadmap.summary,
            phase_labels: $prog.roadmap.phase_labels,
            totals: ($prog.roadmap.totals|set:"minutes_done":$prog.stats.minutes_done),
            milestones: $ms_summary
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // recent completions (last 5)
    // ------------------------------------------------------------------
    db.query mini_lesson_completions {
      where = $db.mini_lesson_completions.user_id == $auth.id && $db.mini_lesson_completions.passed == true
      sort = {mini_lesson_completions.completed_at: "desc"}
      return = {type: "list", paging: {page: 1, per_page: 5}}
      output = ["items.slug", "items.completed_at", "items.mini_lesson_id"]
    } as $recent_page
    // Paged list results are wrapped: records live under .items (documented) - `has` guard kept for safety.
    var $recent_rows { value = ($recent_page|has:"items") ? $recent_page.items : $recent_page }
    var $recent { value = [] }
    foreach ($recent_rows) {
      each as $c {
        db.get mini_lessons {
          field_name = "id"
          field_value = $c.mini_lesson_id
          output = ["title", "est_minutes"]
        } as $ml
        array.push $recent {
          value = {
            type: "lesson",
            slug: $c.slug,
            title: ($ml == null) ? $c.slug : $ml.title,
            minutes: ($ml == null) ? null : $ml.est_minutes,
            completed_at: $c.completed_at
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // lessons completed in the last 7 days
    // ------------------------------------------------------------------
    // REVIEW: same as roadmap_build - only the text "now" into |to_timestamp is undocumented.
    var $week_ago { value = "now"|to_timestamp:"UTC"|transform_timestamp:"-7 days":"UTC" }
    db.query mini_lesson_completions {
      where = $db.mini_lesson_completions.user_id == $auth.id && $db.mini_lesson_completions.passed == true && $db.mini_lesson_completions.completed_at >= $week_ago
      return = {type: "count"}
    } as $week_count
    // stats: roadmap_progress shape + the aliases strive-dashboard.js reads
    // (lessons_done = passed completions, minutes_learned = roadmap minutes done, goals_done)
    array.filter_count ($prog.goals) if (`$this.status == "done"`) as $goals_done
    var $stats_out {
      value = $prog.stats|set:"lessons_this_week":$week_count|set:"lessons_done":$prog.stats.completions|set:"minutes_learned":$prog.stats.minutes_done|set:"goals_done":$goals_done
    }

    var $user_out {
      value = {
        first_name: $u.first_name,
        last_name: $u.last_name,
        email: $u.email,
        location: $u.location,
        company: $u.company,
        industry: $u.industry,
        current_role: $u.current_role,
        desired_role: $u.desired_role,
        profile_photo: $u.profile_photo,
        bio: ($u|get:"bio"|first_notempty:""),
        discipline: $u.discipline,
        goal: $u.goal,
        placement_phase: ($placement > 0) ? $placement : null,
        phase_label: ($placement > 0) ? ($phase_labels|get:$pkey|first_notempty:"") : "",
        archetype: $archetype
      }
    }
  }

  response = {
    user: $user_out,
    roadmap_summary: $roadmap_summary,
    next_item: ($row == null) ? null : $prog.next_item,
    goals: $prog.goals,
    recent_completions: $recent,
    stats: $stats_out
  }
}
