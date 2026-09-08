// ============================================================================
// ENDPOINT  roadmap_generate   (NEW)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: POST   Auth: user (848600)
// Purpose: (re)generate the signed-in user's roadmap. All inputs optional;
//          anything missing falls back to the existing roadmap, then the user
//          row, then defaults. When the user has a claimed assessment session
//          (user.onboarding_session_id) the wrong skills / domain stats are
//          re-derived from it unless source is "self".
//          Upserts user_roadmaps (status proposed, version+1).
// Response: {roadmap, goals_suggested, next_item, stats}
// ============================================================================
query roadmap_generate verb=POST {
  auth = "user"

  input {
    text source?
    int placement_phase?
    int? placement_override
    text goal?
    text discipline?
    text current_role?
    text target_role?
    int weekly_minutes?
    int[] focus_domains?
  }

  stack {
    db.get user {
      field_name = "id"
      field_value = $auth.id
    } as $user

    precondition ($user != null) {
      error_type = "unauthorized"
      error = "Sign in required"
    }

    db.get user_roadmaps {
      field_name = "user_id"
      field_value = $auth.id
    } as $existing

    var $ex_inputs {
      value = ($existing == null || $existing.roadmap_json == null) ? {} : ($existing.roadmap_json|get:"inputs"|first_notempty:{})
    }

    // ------------------------------------------------------------------
    // 1. Resolve inputs: request -> existing roadmap -> user -> default
    // ------------------------------------------------------------------
    var $source {
      value = ($input.source|is_empty) == false ? $input.source : (($existing != null) ? $existing.source : (($user.onboarding_session_id > 0) ? "assessment" : "self"))
    }
    var $placement {
      value = ($input.placement_phase > 0) ? $input.placement_phase : (($existing != null && $existing.placement_phase > 0) ? $existing.placement_phase : (($user.placement_phase > 0) ? $user.placement_phase : 2))
    }
    // `int? placement_override` = nullable (not marked optional - the front end always sends the
    // key, using an explicit null for "accept the current placement", which keeps the existing override).
    var $override {
      value = ($input.placement_override != null) ? $input.placement_override : (($existing != null) ? $existing.placement_override : null)
    }
    var $goal {
      value = ($input.goal|is_empty) == false ? $input.goal : (($existing != null && ($existing.goal|is_empty) == false) ? $existing.goal : $user.goal)
    }
    var $discipline {
      value = ($input.discipline|is_empty) == false ? $input.discipline : (($existing != null && ($existing.discipline|is_empty) == false) ? $existing.discipline : $user.discipline)
    }
    var $current_role {
      value = ($input.current_role|is_empty) == false ? $input.current_role : ($ex_inputs|get:"current_role"|first_notempty:$user.current_role)
    }
    var $target_role {
      value = ($input.target_role|is_empty) == false ? $input.target_role : ($ex_inputs|get:"target_role"|first_notempty:$user.desired_role)
    }
    var $weekly {
      value = ($input.weekly_minutes > 0) ? $input.weekly_minutes : ($ex_inputs|get:"weekly_minutes"|first_notempty:60)
    }
    var $focus {
      value = ($input.focus_domains != null && ($input.focus_domains|count) > 0) ? $input.focus_domains : ($ex_inputs|get:"focus_domains"|first_notempty:[1, 2, 3, 4, 5])
    }

    // ------------------------------------------------------------------
    // 2. Assessment gaps from the claimed session (if any)
    // ------------------------------------------------------------------
    var $wrong_skill_ids { value = [] }
    var $domain_stats { value = [] }
    var $session_id { value = null }
    var $archetype { value = "" }

    conditional {
      if (`$source == "assessment" && $user.onboarding_session_id > 0`) {
        db.get onboarding_sessions {
          field_name = "id"
          field_value = $user.onboarding_session_id
        } as $session
        conditional {
          if (`$session != null && $session.user_id == $auth.id`) {
            var.update $session_id { value = $session.id }
            var.update $archetype { value = $session.archetype }
            var $served { value = ($session.questions_served == null) ? [] : $session.questions_served }
            array.filter ($served) if (`$this.correct == false`) as $wrong_entries
            // NOTE: array.map is a no-op in this Xano build — foreach + push instead.
            var $wrong_ids_calc { value = [] }
            foreach ($wrong_entries) {
              each as $we {
                array.push $wrong_ids_calc { value = $we.skill_id }
              }
            }
            var.update $wrong_skill_ids { value = $wrong_ids_calc }
            for (`5`) {
              each as $i {
                var $dnum { value = $i + 1 }
                array.filter_count ($served) if (`$this.domain == $dnum`) as $asked
                array.filter_count ($served) if (`$this.domain == $dnum && $this.correct == false`) as $wrong
                conditional {
                  if (`$asked > 0`) {
                    array.push $domain_stats { value = {domain: $dnum, asked: $asked, wrong: $wrong} }
                  }
                }
              }
            }
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 3. Build + persist, keep the user row in sync
    // ------------------------------------------------------------------
    function.run roadmap_build {
      input = {
        user_id: $auth.id,
        source: $source,
        placement_phase: $placement,
        placement_override: $override,
        goal: $goal,
        discipline: $discipline,
        wrong_skill_ids: $wrong_skill_ids,
        domain_stats: $domain_stats,
        weekly_minutes: $weekly,
        focus_domains: $focus,
        archetype: $archetype,
        onboarding_session_id: $session_id,
        current_role: $current_role,
        target_role: $target_role
      }
    } as $built

    db.edit user {
      field_name = "id"
      field_value = $auth.id
      data = {
        goal: $goal,
        discipline: $discipline,
        placement_phase: $built.roadmap.placement_phase,
        current_role: ($current_role|is_empty) ? $user.current_role : $current_role,
        desired_role: ($target_role|is_empty) ? $user.desired_role : $target_role
      }
    } as $user_saved

    db.query user_goals {
      where = $db.user_goals.user_id == $auth.id && $db.user_goals.status != "dropped"
      sort = {user_goals.sort_order: "asc"}
      return = {type: "list"}
    } as $goal_rows

    function.run roadmap_progress {
      input = {
        user_id: $auth.id,
        roadmap: $built.roadmap,
        goals: $goal_rows,
        remediation_slug: "",
        remediation_done: false
      }
    } as $prog
  }

  response = {roadmap: $prog.roadmap, goals_suggested: $built.goals_suggested, next_item: $prog.next_item, stats: $prog.stats}
}
