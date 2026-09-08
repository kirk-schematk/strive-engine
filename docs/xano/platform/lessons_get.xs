// ============================================================================
// ENDPOINT  lessons   (REPLACES the existing endpoint - adds `phase`)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: GET   Auth: none
// Purpose: library list of published mini-lessons. Preserves the live shape:
//   [{slug, skill_id, title, status, competency_id, est_minutes, phase,
//     _competency:{slug, name, domain_id, _domain:{slug, name}}}]
// Built in-memory (no addons) so the file is self-contained.
// ============================================================================
query lessons verb=GET {
  input {
  }

  stack {
    db.query mini_lessons {
      where = $db.mini_lessons.status == "published"
      sort = {mini_lessons.id: "asc"}
      return = {type: "list"}
      output = ["slug", "skill_id", "title", "status", "competency_id", "est_minutes", "phase"]
    } as $lessons

    db.query competencies {
      return = {type: "list"}
      output = ["id", "slug", "name", "domain_id"]
    } as $competencies

    db.query domains {
      return = {type: "list"}
      output = ["id", "slug", "name"]
    } as $domains

    var $out { value = [] }
    foreach ($lessons) {
      each as $l {
        // array.find instead of index_by|get (15 competencies / 5 domains - cost is negligible)
        array.find ($competencies) if (`$this.id == $l.competency_id`) as $c
        var $comp_out { value = null }
        conditional {
          if (`$c != null`) {
            array.find ($domains) if (`$this.id == $c.domain_id`) as $d
            var.update $comp_out {
              value = {
                slug: $c.slug,
                name: $c.name,
                domain_id: $c.domain_id,
                _domain: ($d == null) ? null : {slug: $d.slug, name: $d.name}
              }
            }
          }
        }
        array.push $out {
          value = {
            slug: $l.slug,
            skill_id: $l.skill_id,
            title: $l.title,
            status: $l.status,
            competency_id: $l.competency_id,
            est_minutes: $l.est_minutes,
            phase: $l.phase,
            _competency: $comp_out
          }
        }
      }
    }
  }

  response = $out
}
