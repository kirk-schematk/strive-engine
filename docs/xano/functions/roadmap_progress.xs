// ============================================================================
// CUSTOM FUNCTION  roadmap_progress
// Where: Xano > Library > Functions > "+ Add function" > paste as XanoScript
// Called by: GET /roadmap, PATCH /roadmap, GET /dashboard, POST /goals,
//            PATCH /goal, onboarding_claim (Platform + Onboarding groups)
// Purpose: decorates a stored roadmap JSON with per-item `done` flags, totals,
//          `next_item`, `stats`, and decorates the user's goals with progress.
//          `done` comes from mini_lesson_completions (passed=true) plus the
//          onboarding session's remediation_done slug.
//          Goals with metric.type "lessons" that reach their target are
//          persisted as status "done" (completed_at = now).
// Returns: {roadmap, next_item, stats, goals}
// ============================================================================
function roadmap_progress {
  description = "Decorate a roadmap + goals with completion state for one user."

  input {
    int user_id
    json roadmap?
    json goals?
    text remediation_slug?
    bool remediation_done?
  }

  stack {
    // ------------------------------------------------------------------
    // 1. Completed slugs for this user
    // ------------------------------------------------------------------
    db.query mini_lesson_completions {
      where = $db.mini_lesson_completions.user_id == $input.user_id && $db.mini_lesson_completions.passed == true
      sort = {mini_lesson_completions.completed_at: "desc"}
      return = {type: "list"}
      output = ["slug", "completed_at", "mini_lesson_id"]
    } as $completions

    // NOTE: array.map is a no-op in this Xano build — foreach + push instead.
    var $done_slugs { value = [] }
    foreach ($completions) {
      each as $cmp {
        array.push $done_slugs { value = $cmp.slug }
      }
    }
    conditional {
      if (`$input.remediation_done == true && ($input.remediation_slug|is_empty) == false`) {
        conditional {
          if (`($input.remediation_slug|in:$done_slugs) == false`) {
            array.push $done_slugs { value = $input.remediation_slug }
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 2. Decorate roadmap milestones/items
    // ------------------------------------------------------------------
    var $roadmap { value = $input.roadmap }
    var $next_item { value = null }
    var $items_total { value = 0 }
    var $items_done { value = 0 }
    var $minutes_total { value = 0 }
    var $minutes_done { value = 0 }

    conditional {
      if (`$roadmap != null`) {
        var $new_milestones { value = [] }
        var $src_milestones { value = ($roadmap.milestones == null) ? [] : $roadmap.milestones }
        foreach ($src_milestones) {
          each as $ms {
            var $new_items { value = [] }
            var $ms_done { value = 0 }
            var $ms_items { value = ($ms.items == null) ? [] : $ms.items }
            foreach ($ms_items) {
              each as $it {
                // courses have no completion source yet -> done:false
                var $is_done {
                  value = ($it.type == "lesson") ? ($it.slug|in:$done_slugs) : false
                }
                var $decorated { value = $it|set:"done":$is_done }
                array.push $new_items { value = $decorated }
                conditional {
                  if (`$ms.deferred != true`) {
                    var.update $items_total { value = $items_total + 1 }
                    var.update $minutes_total { value = $minutes_total + $it.minutes }
                    conditional {
                      if (`$is_done == true`) {
                        var.update $items_done { value = $items_done + 1 }
                        var.update $minutes_done { value = $minutes_done + $it.minutes }
                        var.update $ms_done { value = $ms_done + 1 }
                      }
                      elseif (`$next_item == null && $it.type == "lesson"`) {
                        var.update $next_item {
                          value = $decorated|set:"milestone_id":$ms.id|set:"milestone_title":$ms.title
                        }
                      }
                    }
                  }
                }
              }
            }
            array.push $new_milestones {
              value = $ms|set:"items":$new_items|set:"items_total":($new_items|count)|set:"items_done":$ms_done
            }
          }
        }
        var.update $roadmap {
          value = $roadmap|set:"milestones":$new_milestones|set:"totals":{items: $items_total, minutes: $minutes_total, done: $items_done}
        }
      }
    }

    var $percent {
      value = ($items_total > 0) ? ((($items_done * 100) / $items_total)|round:0) : 0
    }
    var $stats {
      value = {
        items_total: $items_total,
        items_done: $items_done,
        minutes_total: $minutes_total,
        minutes_done: $minutes_done,
        percent: $percent,
        completions: $completions|count
      }
    }

    // ------------------------------------------------------------------
    // 3. Decorate goals with progress; auto-complete "lessons" goals
    // ------------------------------------------------------------------
    var $today { value = "now"|to_timestamp:"UTC"|format_timestamp:"Y-m-d":"UTC" }
    var $goals_out { value = [] }
    var $src_goals { value = ($input.goals == null) ? [] : $input.goals }
    foreach ($src_goals) {
      each as $g {
        var $metric { value = ($g.metric_json == null) ? {type: "manual"} : $g.metric_json }
        var $metric_type { value = $metric|get:"type"|first_notempty:"manual" }
        var $slugs { value = $metric|get:"slugs"|first_notempty:[] }
        var $target {
          value = ($g.target_count > 0) ? $g.target_count : (($metric|get:"count"|first_notempty:0) > 0 ? ($metric|get:"count"|first_notempty:0) : ($slugs|count))
        }
        var $done_count { value = 0 }
        var $status { value = $g.status }
        var $completed_at { value = $g.completed_at }
        conditional {
          if (`$metric_type == "lessons"`) {
            array.filter_count ($slugs) if (`$this|in:$done_slugs`) as $done_count_calc
            var.update $done_count { value = $done_count_calc }
            // auto-done when the target is reached (persist so the dashboard agrees)
            conditional {
              if (`$status == "active" && $target > 0 && $done_count >= $target`) {
                var.update $status { value = "done" }
                db.edit user_goals {
                  field_name = "id"
                  field_value = $g.id
                  data = {status: "done", completed_at: "now"}
                } as $g_saved
                var.update $completed_at { value = $g_saved.completed_at }
              }
            }
          }
          elseif (`$status == "done"`) {
            var.update $done_count { value = ($target > 0) ? $target : 1 }
          }
        }
        conditional {
          if (`$metric_type != "lessons" && $target == 0`) {
            var.update $target { value = 1 }
          }
        }
        var $g_percent {
          value = ($target > 0) ? (((($done_count|min:$target) * 100) / $target)|round:0) : 0
        }
        // REVIEW: due_date is a Xano `date` column; comparing as "Y-m-d" text works
        // if the API returns it as "2026-09-16". If it returns a timestamp, format it first.
        var $due_text { value = ($g.due_date == null) ? "" : ($g.due_date|to_text) }
        var $overdue {
          value = ($status == "active") && ($due_text != "") && ($due_text < $today)
        }
        array.push $goals_out {
          value = {
            id: $g.id,
            title: $g.title,
            description: $g.description,
            metric: $metric,
            target_count: $target,
            due_date: $g.due_date,
            status: $status,
            sort_order: $g.sort_order,
            completed_at: $completed_at,
            progress: {done: $done_count, target: $target, percent: $g_percent},
            overdue: $overdue
          }
        }
      }
    }
  }

  response = {roadmap: $roadmap, next_item: $next_item, stats: $stats, goals: $goals_out}

  tags = ["roadmap"]
}
