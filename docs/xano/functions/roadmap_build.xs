// ============================================================================
// CUSTOM FUNCTION  roadmap_build
// Where: Xano > Library > Functions > "+ Add function" > paste as XanoScript
// Called by: onboarding_claim (Onboarding group) and roadmap_generate (Platform)
// Purpose: builds the roadmap JSON from placement/goal/discipline + assessment
//          gaps (spec section 2 "Generation rules"), upserts user_roadmaps,
//          returns {roadmap, goals_suggested, roadmap_id}.
// Notes:   goals_suggested is ALSO stored inside roadmap_json.goals_suggested so
//          an idempotent re-claim can return it without regenerating.
// ============================================================================
function roadmap_build {
  description = "Generate + upsert a users learning roadmap (spec: docs/onboarding-roadmap-spec.md section 2)."

  input {
    int user_id
    text source?
    int placement_phase?
    int? placement_override
    text goal?
    text discipline?
    json wrong_skill_ids?
    json domain_stats?
    int weekly_minutes?
    json focus_domains?
    text archetype?
    int? onboarding_session_id
    text current_role?
    text target_role?
  }

  stack {
    // ------------------------------------------------------------------
    // 0. Constants
    // ------------------------------------------------------------------
    var $phase_labels {
      // NOTE: a literal {"1": …} becomes a 0-based LIST in Xano (off-by-one lookups); build maps with |set.
      value = {}|set:"1":"Student"|set:"2":"Modeler"|set:"3":"Coordinator"|set:"4":"Project BIM Manager"|set:"5":"Director"
    }
    var $archetypes {
      value = {}|set:"1":"Explorer"|set:"2":"Builder"|set:"3":"Orchestrator"|set:"4":"Strategist"|set:"5":"Visionary"
    }
    // Discipline nudge: competencies listed first inside a domain (rule 2)
    var $nudge_map {
      value = {
        "Architecture": ["Model Authoring", "Data Enrichment"],
        "Engineering": ["Model Authoring", "Data Enrichment"],
        "Construction": ["Clash Resolution", "BEP Compliance", "Model Federation & Validation"],
        "Operations & FM": ["Delivery & Handover", "Information Specification", "CDE Utilization"],
        "Client/Owner": ["Information Specification", "Strategic Planning", "Capability Assessment"],
        "Other": []
      }
    }

    // ------------------------------------------------------------------
    // 1. Normalise inputs
    // ------------------------------------------------------------------
    var $source {
      value = ($input.source|is_empty) ? "assessment" : $input.source
    }
    var $goal {
      value = ($input.goal|is_empty) ? "Level up in my current role" : $input.goal
    }
    var $discipline {
      value = ($input.discipline|is_empty) ? "Other" : $input.discipline
    }
    var $weekly {
      value = ($input.weekly_minutes == null || $input.weekly_minutes < 15) ? 60 : $input.weekly_minutes
    }
    var $focus {
      value = ($input.focus_domains == null || ($input.focus_domains|count) == 0) ? [1, 2, 3, 4, 5] : $input.focus_domains
    }
    var $wrong_ids {
      value = ($input.wrong_skill_ids == null) ? [] : $input.wrong_skill_ids
    }
    var $domain_stats {
      value = ($input.domain_stats == null) ? [] : $input.domain_stats
    }

    // P: override wins; clamp to 1..5
    var $P {
      value = ($input.placement_override != null && $input.placement_override > 0) ? $input.placement_override : $input.placement_phase
    }
    conditional {
      if (`$P == null || $P < 1`) {
        var.update $P { value = 1 }
      }
      elseif (`$P > 5`) {
        var.update $P { value = 5 }
      }
    }
    var $P_key { value = $P|to_text }
    var $archetype {
      value = ($input.archetype|is_empty) ? ($archetypes|get:$P_key|first_notempty:"Builder") : $input.archetype
    }

    // ------------------------------------------------------------------
    // 2. Goal rules -> target phase T, domain weights, extra phases (rule 1)
    // ------------------------------------------------------------------
    var $T { value = $P }
    var $weights { value = {}|set:"1":1|set:"2":1|set:"3":1|set:"4":1|set:"5":1 }
    var $weak_first { value = false }
    var $team_extra_phase { value = 0 }

    conditional {
      if (`$goal == "Step up to the next role"`) {
        var.update $T { value = ($P + 1)|min:5 }
      }
      elseif (`$goal == "Move into BIM/digital"`) {
        var.update $T { value = $P|max:2 }
        var.update $weights { value = {}|set:"1":2|set:"2":2|set:"3":1.5|set:"4":1|set:"5":1 }
      }
      elseif (`$goal == "Keep my team current"`) {
        var.update $weights { value = {}|set:"1":1|set:"2":1|set:"3":1|set:"4":2|set:"5":2 }
        var.update $team_extra_phase { value = ($P + 1)|min:5 }
      }
      else {
        // "Level up in my current role" (and unknown goals)
        var.update $weak_first { value = true }
      }
    }
    var $T_key { value = $T|to_text }

    // ------------------------------------------------------------------
    // 3. Load reference data
    // ------------------------------------------------------------------
    db.query domains {
      sort = {domains.id: "asc"}
      return = {type: "list"}
    } as $domains

    db.query competencies {
      sort = {competencies.name: "asc"}
      return = {type: "list"}
    } as $competencies

    db.query mini_lessons {
      where = $db.mini_lessons.status == "published"
      sort = {mini_lessons.id: "asc"}
      return = {type: "list"}
      output = ["id", "slug", "skill_id", "title", "competency_id", "est_minutes", "phase"]
    } as $lessons_raw

    db.query courses {
      where = $db.courses.status == "published"
      sort = {courses.id: "asc"}
      return = {type: "list"}
      output = ["id", "slug", "title", "competency_id", "level", "duration"]
    } as $courses

    // Decorate lessons with domain / competency name / numeric skill.
    // (array.find instead of index_by|get so the key-type question never arises.)
    var $lessons { value = [] }
    foreach ($lessons_raw) {
      each as $l {
        array.find ($competencies) if (`$this.id == $l.competency_id`) as $c
        conditional {
          if (`$c == null`) {
            continue
          }
        }
        var $decorated {
          value = {
            type: "lesson",
            slug: $l.slug,
            title: $l.title,
            minutes: ($l.est_minutes|is_empty) ? 6 : $l.est_minutes,
            competency: $c.name,
            competency_id: $l.competency_id,
            domain: $c.domain_id,
            phase: $l.phase,
            skill_id: $l.skill_id,
            skill_num: ($l.skill_id|replace:"SKL-":""|to_int),
            done: false
          }
        }
        array.push $lessons { value = $decorated }
      }
    }

    // Short domain names: strip "Domain n: "
    var $domain_short { value = {} }
    foreach ($domains) {
      each as $d {
        var.update $domain_short {
          value = $domain_short|set:($d.id|to_text):($d.name|split:": "|last)
        }
      }
    }

    // Wrong/asked count per domain (from domain_stats)
    var $wrong_by_domain { value = {}|set:"1":0|set:"2":0|set:"3":0|set:"4":0|set:"5":0 }
    foreach ($domain_stats) {
      each as $ds {
        var.update $wrong_by_domain {
          value = $wrong_by_domain|set:($ds.domain|to_text):$ds.wrong
        }
      }
    }

    // ------------------------------------------------------------------
    // 4. Domain order: weight desc, then (level-up) wrong desc, then domain asc
    //    Implemented with a single numeric sort key so we only rely on the
    //    documented numeric |sort filter (no object sort needed).
    // ------------------------------------------------------------------
    var $domain_keys { value = [] }
    for (`5`) {
      each as $i {
        var $dnum { value = $i + 1 }
        var $dkey { value = $dnum|to_text }
        var $w { value = $weights|get:$dkey|first_notempty:1 }
        var $wr { value = $weak_first ? ($wrong_by_domain|get:$dkey|first_notempty:0) : 0 }
        // key = weight*100000 + wrong*100 + (9 - domain) -> unique per domain, sorted desc below
        var $key { value = (($w * 100000) + ($wr * 100) + (9 - $dnum))|to_int }
        array.push $domain_keys { value = $key }
      }
    }
    var $domain_keys_sorted { value = $domain_keys|sort|reverse }
    var $ordered_domains { value = [] }
    foreach ($domain_keys_sorted) {
      each as $k {
        // position of this key in the unsorted list = domain number - 1
        array.find_index ($domain_keys) if (`$this == $k`) as $k_idx
        array.push $ordered_domains { value = $k_idx + 1 }
      }
    }

    // Competency order inside a domain: nudge names first (in nudge order), then the rest by name asc
    var $nudge { value = $nudge_map|get:$discipline|first_notempty:[] }
    var $ordered_comps_by_domain { value = {} }
    foreach ($domains) {
      each as $d {
        var $comps_in_domain { value = [] }
        array.filter ($competencies) if (`$this.domain_id == $d.id`) as $comps_here
        foreach ($nudge) {
          each as $n {
            array.find ($comps_here) if (`$this.name == $n`) as $found
            conditional {
              if (`$found != null`) {
                array.push $comps_in_domain { value = $found }
              }
            }
          }
        }
        // then the rest ($competencies already sorted by name asc)
        foreach ($comps_here) {
          each as $c2 {
            conditional {
              if (`($c2.name|in:$nudge) == false`) {
                array.push $comps_in_domain { value = $c2 }
              }
            }
          }
        }
        var.update $ordered_comps_by_domain {
          value = $ordered_comps_by_domain|set:($d.id|to_text):$comps_in_domain
        }
      }
    }

    // ------------------------------------------------------------------
    // 5. Milestone m1: close the gaps (rule 3)
    // ------------------------------------------------------------------
    var $milestones { value = [] }
    var $used_slugs { value = [] }
    var $m1_slugs { value = [] }
    var $lesson_count { value = 0 }

    conditional {
      if (`($wrong_ids|count) > 0`) {
        array.filter ($lessons) if (`$this.skill_id|in:$wrong_ids`) as $gap_unsorted
        // sort by numeric SKL-n: sort the unique numbers, then take every lesson carrying that number
        var $gap_nums { value = [] }
        foreach ($gap_unsorted) {
          each as $gu {
            array.push $gap_nums { value = $gu.skill_num }
          }
        }
        var $gap_nums_sorted { value = $gap_nums|unique|sort }
        var $gap_items { value = [] }
        foreach ($gap_nums_sorted) {
          each as $num {
            array.filter ($gap_unsorted) if (`$this.skill_num == $num`) as $gls
            foreach ($gls) {
              each as $gl {
                array.push $gap_items { value = $gl|unset:"skill_num"|unset:"competency_id" }
                array.push $used_slugs { value = $gl.slug }
                array.push $m1_slugs { value = $gl.slug }
              }
            }
          }
        }
        conditional {
          if (`($gap_items|count) > 0`) {
            array.push $milestones {
              value = {
                id: "m1",
                title: "Close the gaps from your assessment",
                why: "These are the skills behind the questions you missed. Fixing them first makes everything after easier.",
                phase: $P,
                domain: null,
                deferred: false,
                items: $gap_items
              }
            }
            var.update $lesson_count { value = $gap_items|count }
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 6. Phase x domain milestones (rule 4) + soft cap / focus (rule 6)
    // ------------------------------------------------------------------
    // Phases to walk: P..T, plus team_extra_phase (domains 4,5 only)
    var $phases { value = [] }
    var $p_cursor { value = $P }
    while (`$p_cursor <= $T`) {
      each {
        array.push $phases { value = $p_cursor }
        var.update $p_cursor { value = $p_cursor + 1 }
      }
    }
    conditional {
      if (`$team_extra_phase > 0 && ($team_extra_phase|in:$phases) == false`) {
        array.push $phases { value = $team_extra_phase }
      }
    }

    // Non-gap milestone ids always start at "m2" ("m1" is reserved for the gaps milestone,
    // whether or not it exists): id = "m" + (milestones so far + offset).
    var $id_offset { value = 2 - ($milestones|count) }
    var $milestone_comp_names { value = [] }

    foreach ($phases) {
      each as $p {
        var $p_label { value = $phase_labels|get:($p|to_text)|first_notempty:"" }
        foreach ($ordered_domains) {
          each as $dom {
            // the extra team phase only applies to domains 4 and 5
            conditional {
              if (`$p > $T && $dom < 4`) {
                continue
              }
            }
            var $dom_key { value = $dom|to_text }
            var $comps { value = $ordered_comps_by_domain|get:$dom_key|first_notempty:[] }
            var $items { value = [] }
            foreach ($comps) {
              each as $c {
                array.filter ($lessons) if (`$this.phase == $p && $this.competency_id == $c.id && ($this.slug|in:$used_slugs) == false`) as $cl
                var $cl_nums { value = [] }
                foreach ($cl) {
                  each as $cl_one {
                    array.push $cl_nums { value = $cl_one.skill_num }
                  }
                }
                var $cl_nums_sorted { value = $cl_nums|unique|sort }
                foreach ($cl_nums_sorted) {
                  each as $num {
                    array.filter ($cl) if (`$this.skill_num == $num`) as $ones
                    foreach ($ones) {
                      each as $one {
                        array.push $items { value = $one|unset:"skill_num"|unset:"competency_id" }
                        array.push $used_slugs { value = $one.slug }
                        conditional {
                          if (`($c.name|in:$milestone_comp_names) == false`) {
                            array.push $milestone_comp_names { value = $c.name }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            conditional {
              if (`($items|count) == 0`) {
                continue
              }
            }
            var $in_focus { value = $dom|in:$focus }
            var $deferred {
              value = ($lesson_count >= 40) || ($in_focus == false)
            }
            array.push $milestones {
              value = {
                id: ("m"|concat:((($milestones|count) + $id_offset)|to_text)),
                title: ($p_label|concat:": "|concat:($domain_short|get:$dom_key|first_notempty:"")),
                why: ("Builds "|concat:($domain_short|get:$dom_key|first_notempty:"")|concat:" skills at "|concat:$p_label|concat:" level."),
                phase: $p,
                domain: $dom,
                deferred: $deferred,
                items: $items
              }
            }
            // milestones parked by focus_domains do not eat into the 40-lesson soft cap
            conditional {
              if (`$in_focus == true`) {
                var.update $lesson_count { value = $lesson_count + ($items|count) }
              }
            }
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 7. Courses (rule 5): appended as the last item of the first milestone
    //    (not m1) that carries the course's competency, when the course level
    //    overlaps P..T (Beginner 1-2, Intermediate 3, Advanced/"Advances" 4-5).
    // ------------------------------------------------------------------
    foreach ($courses) {
      each as $course {
        // competency name derived from competency_id (does not depend on a text column on courses)
        array.find ($competencies) if (`$this.id == $course.competency_id`) as $course_comp
        var $course_comp_name { value = ($course_comp == null) ? "" : $course_comp.name }
        conditional {
          if (`($course_comp_name|in:$milestone_comp_names) == false`) {
            continue
          }
        }
        var $lvl { value = $course.level|to_lower }
        var $lvl_min { value = 1 }
        var $lvl_max { value = 2 }
        conditional {
          if (`$lvl|starts_with:"inter"`) {
            var.update $lvl_min { value = 3 }
            var.update $lvl_max { value = 3 }
          }
          elseif (`$lvl|starts_with:"adv"`) {
            var.update $lvl_min { value = 4 }
            var.update $lvl_max { value = 5 }
          }
        }
        conditional {
          if (`$lvl_max < $P || $lvl_min > $T`) {
            continue
          }
        }
        // minutes parsed from "~2h 00m" / "45m"
        var $dur { value = $course.duration|replace:"~":""|trim }
        var $minutes { value = 60 }
        conditional {
          if (`$dur|contains:"h"`) {
            var $parts { value = $dur|split:"h" }
            var $h { value = $parts.0|trim|to_int }
            var $m { value = (($parts|count) > 1) ? ($parts.1|replace:"m":""|trim|to_int) : 0 }
            var.update $minutes { value = ($h * 60) + $m }
          }
          elseif (`$dur|contains:"m"`) {
            var.update $minutes { value = $dur|replace:"m":""|trim|to_int }
          }
        }
        var $course_item {
          value = {
            type: "course",
            slug: $course.slug,
            title: $course.title,
            minutes: $minutes,
            competency: $course_comp_name,
            level: $course.level,
            done: false
          }
        }
        var $new_milestones { value = [] }
        var $placed { value = false }
        foreach ($milestones) {
          each as $ms {
            var $take { value = false }
            conditional {
              if (`$placed == false && $ms.id != "m1"`) {
                array.has ($ms.items) if (`$this.type == "lesson" && $this.competency == $course_comp_name`) as $has_comp
                conditional {
                  if (`$has_comp == true`) {
                    var.update $take { value = true }
                  }
                }
              }
            }
            conditional {
              if (`$take == true`) {
                var.update $placed { value = true }
                array.push $new_milestones { value = $ms|set:"items":($ms.items|push:$course_item) }
              }
              else {
                array.push $new_milestones { value = $ms }
              }
            }
          }
        }
        var.update $milestones { value = $new_milestones }
      }
    }

    // ------------------------------------------------------------------
    // 8. Totals (non-deferred milestones), weak domains, summary (rule 7)
    // ------------------------------------------------------------------
    var $total_items { value = 0 }
    var $total_minutes { value = 0 }
    var $domain_names_used { value = [] }
    foreach ($milestones) {
      each as $ms {
        conditional {
          if (`$ms.deferred == true`) {
            continue
          }
        }
        var.update $total_items { value = $total_items + ($ms.items|count) }
        foreach ($ms.items) {
          each as $it {
            var.update $total_minutes { value = $total_minutes + $it.minutes }
          }
        }
        conditional {
          if (`$ms.domain != null`) {
            var $dn { value = $domain_short|get:($ms.domain|to_text)|first_notempty:"" }
            conditional {
              if (`($dn|in:$domain_names_used) == false`) {
                array.push $domain_names_used { value = $dn }
              }
            }
          }
        }
      }
    }

    var $weak_domains { value = [] }
    foreach ($domain_stats) {
      each as $ds {
        conditional {
          if (`$ds.wrong > 0`) {
            array.push $weak_domains {
              value = {
                domain: $ds.domain,
                name: ($domain_short|get:($ds.domain|to_text)|first_notempty:""),
                asked: $ds.asked,
                wrong: $ds.wrong
              }
            }
          }
        }
      }
    }

    var $hours { value = ($total_minutes / 60)|round:1 }
    var $weeks { value = (($total_minutes / $weekly)|ceil)|max:1 }
    var $gap_count { value = $m1_slugs|count }
    var $P_label { value = $phase_labels|get:$P_key|first_notempty:"" }
    var $T_label { value = $phase_labels|get:$T_key|first_notempty:"" }
    var $summary_mid {
      value = ($gap_count > 0) ? ("It starts by closing "|concat:($gap_count|to_text)|concat:" gaps from your assessment, then works through ") : "It works through "
    }
    // `~` is the documented text-concatenation operator (Xano expression docs: `a ~ b`).
    var $summary {
      value = "You placed at " ~ $P_label ~ " (" ~ $archetype ~ "). Your goal is '" ~ $goal ~ "', so this plan takes you to " ~ $T_label ~ ". " ~ $summary_mid ~ ($domain_names_used|join:", ") ~ " at " ~ $P_label ~ " level. About " ~ ($hours|to_text) ~ "h of lessons at " ~ ($weekly|to_text) ~ " min/week - roughly " ~ ($weeks|to_text) ~ " weeks."
    }

    // ------------------------------------------------------------------
    // 9. goals_suggested (rule 8)
    // ------------------------------------------------------------------
    // transform_timestamp:"+N days":"UTC" and format_timestamp:"Y-m-d":"UTC" are documented
    // (filter-reference/timestamp). REVIEW: only the text "now" as input to |to_timestamp is
    // undocumented - if $now_ts comes back null/0, replace `"now"|to_timestamp:"UTC"` with the
    // `now` expression variable (or read created_at back from a freshly added row).
    var $now_ts { value = "now"|to_timestamp:"UTC" }
    var $goals_suggested { value = [] }

    conditional {
      if (`$gap_count > 0`) {
        array.push $goals_suggested {
          value = {
            title: "Close my assessment gaps",
            description: ("Finish the "|concat:($gap_count|to_text)|concat:" lessons behind the questions I missed."),
            metric: {type: "lessons", slugs: $m1_slugs},
            target_count: $gap_count,
            due_date: $now_ts|transform_timestamp:"+14 days":"UTC"|format_timestamp:"Y-m-d":"UTC"
          }
        }
      }
    }

    // "Finish {first non-gap milestone title}"
    array.find ($milestones) if (`$this.id != "m1" && $this.deferred == false`) as $first_ms
    conditional {
      if (`$first_ms != null`) {
        array.filter ($first_ms.items) if (`$this.type == "lesson"`) as $first_ms_lessons
        var $first_ms_slugs { value = [] }
        foreach ($first_ms_lessons) {
          each as $fml {
            array.push $first_ms_slugs { value = $fml.slug }
          }
        }
        var $first_ms_minutes { value = 0 }
        foreach ($first_ms.items) {
          each as $it {
            var.update $first_ms_minutes { value = $first_ms_minutes + $it.minutes }
          }
        }
        var $first_weeks { value = (($first_ms_minutes / $weekly)|ceil)|max:2 }
        array.push $goals_suggested {
          value = {
            title: ("Finish "|concat:$first_ms.title),
            description: ("Complete every lesson in the '"|concat:$first_ms.title|concat:"' milestone."),
            metric: {type: "lessons", slugs: $first_ms_slugs},
            target_count: $first_ms_slugs|count,
            due_date: $now_ts|transform_timestamp:("+"|concat:($first_weeks|to_text)|concat:" weeks"):"UTC"|format_timestamp:"Y-m-d":"UTC"
          }
        }
      }
    }

    // all non-deferred lesson slugs (+ domain-5 slugs for the team variant)
    var $all_slugs { value = [] }
    var $d5_slugs { value = [] }
    foreach ($milestones) {
      each as $ms {
        conditional {
          if (`$ms.deferred == true`) {
            continue
          }
        }
        foreach ($ms.items) {
          each as $it {
            conditional {
              if (`$it.type == "lesson"`) {
                array.push $all_slugs { value = $it.slug }
                conditional {
                  if (`$it.domain == 5`) {
                    array.push $d5_slugs { value = $it.slug }
                  }
                }
              }
            }
          }
        }
      }
    }
    conditional {
      if (`$goal == "Keep my team current"`) {
        array.push $goals_suggested {
          value = {
            title: "Complete 3 leadership & communication lessons and share one with my team",
            description: "Three Domain 5 lessons from the plan, and pass one on to the team.",
            metric: {type: "lessons", slugs: $d5_slugs, count: 3},
            target_count: 3,
            due_date: $now_ts|transform_timestamp:("+"|concat:($weeks|to_text)|concat:" weeks"):"UTC"|format_timestamp:"Y-m-d":"UTC"
          }
        }
      }
      else {
        array.push $goals_suggested {
          value = {
            title: (($T == $P) ? ("Master the "|concat:$T_label|concat:" level") : ("Reach "|concat:$T_label|concat:" level")),
            description: "Work through every non-deferred lesson in the roadmap.",
            metric: {type: "lessons", slugs: $all_slugs},
            target_count: $all_slugs|count,
            due_date: $now_ts|transform_timestamp:("+"|concat:($weeks|to_text)|concat:" weeks"):"UTC"|format_timestamp:"Y-m-d":"UTC"
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 10. Assemble roadmap JSON + upsert user_roadmaps
    // ------------------------------------------------------------------
    var $inputs {
      value = {
        current_role: ($input.current_role|is_empty) ? "" : $input.current_role,
        target_role: ($input.target_role|is_empty) ? "" : $input.target_role,
        weekly_minutes: $weekly,
        focus_domains: $focus
      }
    }

    db.get user_roadmaps {
      field_name = "user_id"
      field_value = $input.user_id
    } as $existing

    var $version { value = ($existing == null) ? 1 : ($existing.version + 1) }

    var $roadmap {
      value = {
        version: $version,
        generated_at: ($now_ts|format_timestamp:"c":"UTC"),
        source: $source,
        placement_phase: $P,
        target_phase: $T,
        phase_labels: $phase_labels,
        archetype: $archetype,
        goal: $goal,
        discipline: $discipline,
        inputs: $inputs,
        summary: $summary,
        weak_domains: $weak_domains,
        milestones: $milestones,
        totals: {items: $total_items, minutes: $total_minutes, done: 0},
        goals_suggested: $goals_suggested
      }
    }

    var $inputs_json {
      value = {
        source: $source,
        placement_phase: $input.placement_phase,
        placement_override: $input.placement_override,
        goal: $goal,
        discipline: $discipline,
        wrong_skill_ids: $wrong_ids,
        domain_stats: $domain_stats,
        weekly_minutes: $weekly,
        focus_domains: $focus,
        archetype: $archetype,
        current_role: $inputs.current_role,
        target_role: $inputs.target_role
      }
    }

    // db.add / db.edit require `data` to be an inline object literal (a $var or
    // filtered expression is rejected: "Invalid kind for data - assign:var"),
    // so the row is written out twice.
    var $stored_placement {
      value = ($input.placement_phase == null) ? $P : $input.placement_phase
    }

    conditional {
      if (`$existing == null`) {
        db.add user_roadmaps {
          data = {
            created_at: "now",
            user_id: $input.user_id,
            onboarding_session_id: $input.onboarding_session_id,
            source: $source,
            placement_phase: $stored_placement,
            placement_override: $input.placement_override,
            target_phase: $T,
            goal: $goal,
            discipline: $discipline,
            inputs_json: $inputs_json,
            roadmap_json: $roadmap,
            status: "proposed",
            confirmed_at: null,
            version: $version,
            updated_at: "now"
          }
        } as $saved
      }
      else {
        db.edit user_roadmaps {
          field_name = "id"
          field_value = $existing.id
          data = {
            user_id: $input.user_id,
            onboarding_session_id: $input.onboarding_session_id,
            source: $source,
            placement_phase: $stored_placement,
            placement_override: $input.placement_override,
            target_phase: $T,
            goal: $goal,
            discipline: $discipline,
            inputs_json: $inputs_json,
            roadmap_json: $roadmap,
            status: "proposed",
            confirmed_at: null,
            version: $version,
            updated_at: "now"
          }
        } as $saved
      }
    }
  }

  response = {roadmap: $roadmap, goals_suggested: $goals_suggested, roadmap_id: $saved.id}

  tags = ["roadmap"]
}
