// ============================================================================
// ENDPOINT  waitlist   (NEW)
// Group: Platform (api:fykJB1SM, id 417827)   Verb: POST   Auth: none
// Purpose: pre-launch mailing list. In waitlist mode the home hero
//          (webflow-home-waitlist-embed.html) posts the visitor's three picks,
//          the warm-up verdict and an email. One row per email: a repeat submit
//          updates the picks and bumps `submissions`. Then the "starting point"
//          report goes out through Resend when the RESEND_API_KEY environment
//          variable is set; without it the row is still stored and
//          report_sent_at stays null (nothing is lost, the email can be sent
//          later from the row).
// Input:   {email, discipline, goal, level:1..4, level_name, discipline_label,
//           goal_label, baseline_label, warmup_correct, source, page}
//          discipline/goal are the engine values (Architecture / Engineering /
//          Other; Move into BIM/digital / Step up to the next role / Level up
//          in my current role); *_label are the sentence forms shown in the
//          hero ("structures", "land a digital role", "draw in 2D").
// Response: {ok:true, level, level_name, report_sent:bool}
// Env:     RESEND_API_KEY (required for the email), WAITLIST_FROM (optional,
//          default "STRIVE <onboarding@resend.dev>"; a strivebim.com sender
//          needs the domain verified in Resend first).
// ============================================================================
query waitlist verb=POST {
  input {
    email email filters=trim|lower
    text discipline? filters=trim
    text goal? filters=trim
    int level?
    text level_name? filters=trim
    text discipline_label? filters=trim
    text goal_label? filters=trim
    text baseline_label? filters=trim
    bool warmup_correct?
    text source? filters=trim
    text page? filters=trim
  }

  stack {
    precondition (($input.email|is_empty) == false) {
      error_type = "inputerror"
      error = "email is required"
    }

    var $lvl { value = ($input.level < 1) ? 0 : (($input.level > 4) ? 0 : $input.level) }
    var $lvl_name { value = ($lvl == 1) ? "Awareness" : (($lvl == 2) ? "Working" : (($lvl == 3) ? "Advanced" : (($lvl == 4) ? "Expert" : ""))) }
    var $warm { value = ($input.warmup_correct == true) ? true : false }
    var $src { value = $input.source|first_notempty:"home" }

    // ------------------------------------------------------------------
    // 1. Upsert the row (one per email)
    // ------------------------------------------------------------------
    db.get waitlist {
      field_name = "email"
      field_value = $input.email
    } as $row

    var $saved_id { value = 0 }
    conditional {
      if (`$row == null`) {
        db.add waitlist {
          data = {
            created_at: "now",
            updated_at: "now",
            email: $input.email,
            discipline: $input.discipline,
            goal: $input.goal,
            level: $lvl,
            level_name: $lvl_name,
            discipline_label: $input.discipline_label,
            goal_label: $input.goal_label,
            baseline_label: $input.baseline_label,
            warmup_correct: $warm,
            source: $src,
            page: $input.page,
            submissions: 1,
            report_sent_at: null,
            applied_user_id: 0,
            applied_at: null
          }
        } as $added
        var.update $saved_id { value = $added.id }
      }
      else {
        var $n { value = ($row.submissions|first_notempty:0) + 1 }
        db.edit waitlist {
          field_name = "id"
          field_value = $row.id
          data = {
            updated_at: "now",
            discipline: $input.discipline,
            goal: $input.goal,
            level: $lvl,
            level_name: $lvl_name,
            discipline_label: $input.discipline_label,
            goal_label: $input.goal_label,
            baseline_label: $input.baseline_label,
            warmup_correct: $warm,
            source: $src,
            page: $input.page,
            submissions: $n
          }
        } as $edited
        var.update $saved_id { value = $row.id }
      }
    }

    // ------------------------------------------------------------------
    // 2. The "starting point" report (Resend). Skipped without a key.
    // ------------------------------------------------------------------
    var $key { value = $env.RESEND_API_KEY|first_notempty:"" }
    var $from { value = $env.WAITLIST_FROM|first_notempty:"STRIVE <onboarding@resend.dev>" }
    var $sent { value = false }

    conditional {
      if (`(($key|is_empty) == false) && ($lvl > 0)`) {
        var $what { value = ($lvl == 1) ? "You know what BIM is and why it matters. The next move is doing the everyday work inside a model instead of around it." : (($lvl == 2) ? "You produce in a model day to day. The next move is coordination: federated models, information requirements, and checking other people's work as well as your own." : (($lvl == 3) ? "You deliver coordinated, federated models. The next move is managing information across a whole project and a team, not just your own output." : "You run digital delivery. The next move is strategy: standards, capability across an organisation, and bringing the people behind you up to speed.")) }
        var $warm_line { value = ($warm == true) ? "Your warm-up answer on Level of Information Need was right: model to what the milestone needs, no more. That judgement is exactly what STRIVE builds on." : "Your warm-up answer on Level of Information Need was close: at concept stage the milestone only needs intent and arrangement, and anything more is over-modelling. That judgement is exactly what STRIVE builds, one short lesson at a time." }
        var $link { value = "https://www.strivebim.com/get-started?discipline=" ~ ($input.discipline|replace:" ":"%20"|replace:"/":"%2F") ~ "&goal=" ~ ($input.goal|replace:" ":"%20"|replace:"/":"%2F") ~ "&level=" ~ ($lvl|to_text) }

        var $meter { value = "" }
        for (`4`) {
          each as $i {
            var $on { value = (($i + 1) <= $lvl) ? "#16c4f6" : "#dfe6e9" }
            var.update $meter { value = $meter ~ "<td style='height:12px;border-radius:999px;background:" ~ $on ~ ";'></td><td style='width:8px;'></td>" }
          }
        }

        var $subject { value = "Your STRIVE starting point: " ~ $lvl_name }
        var $html {
          value = "<!doctype html><html><body style='margin:0;padding:0;background:#f3f6f7;font-family:Manrope,Segoe UI,Helvetica,Arial,sans-serif;color:#2c3d45;'><table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background:#f3f6f7;padding:32px 16px;'><tr><td align='center'><table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;'><tr><td style='background:#0c1417;padding:28px 36px;'><a href='https://www.strivebim.com' style='text-decoration:none;'><img src='https://cdn.prod.website-files.com/6a1704050c9a272f02d13182/6aab434f4aef72c2e3f14f5f_strive-logo-white.png' alt='STRIVE' height='22' style='height:22px;display:block;border:0;'></a></td></tr><tr><td style='padding:36px 36px 8px;'><p style='margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0688b0;'>Your starting point</p><h1 style='margin:0 0 16px;font-family:Sora,Manrope,Segoe UI,Helvetica,Arial,sans-serif;font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-.02em;color:#0c1417;'>Level " ~ ($lvl|to_text) ~ " of 4 &middot; " ~ $lvl_name ~ "</h1><table role='presentation' cellpadding='0' cellspacing='0' width='100%' style='max-width:320px;margin:0 0 20px;'><tr>" ~ $meter ~ "</tr></table><p style='margin:0 0 16px;font-size:17px;line-height:1.6;'>You work in <b>" ~ $input.discipline_label ~ "</b>, you want to <b>" ~ $input.goal_label ~ "</b>, and today you <b>" ~ $input.baseline_label ~ "</b>.</p><p style='margin:0 0 16px;font-size:17px;line-height:1.6;'>" ~ $what ~ "</p><p style='margin:0 0 24px;font-size:16px;line-height:1.6;color:#5a6e77;'>" ~ $warm_line ~ "</p></td></tr><tr><td style='padding:0 36px 8px;'><p style='margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0688b0;'>What happens next</p><p style='margin:0 0 10px;font-size:16px;line-height:1.6;'><b>1.</b> Your spot is held. You hear from us first when STRIVE opens.</p><p style='margin:0 0 10px;font-size:16px;line-height:1.6;'><b>2.</b> Your answers are saved. On opening day this link starts your five-minute assessment with them already filled in: <a href='" ~ $link ~ "' style='color:#0688b0;'>start my assessment</a>.</p><p style='margin:0 0 28px;font-size:16px;line-height:1.6;'><b>3.</b> The assessment gives you your exact level and the first short lesson that moves it.</p></td></tr><tr><td style='padding:0 36px 36px;'><table role='presentation' cellpadding='0' cellspacing='0'><tr><td style='border-radius:999px;background:#fc8204;'><a href='" ~ $link ~ "' style='display:inline-block;padding:16px 28px;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;'>Keep my spot</a></td></tr></table></td></tr><tr><td style='padding:20px 36px 28px;border-top:1px solid #e6ebed;font-size:13px;line-height:1.6;color:#7c8d95;'>You asked for this at strivebim.com. One more email when we open, nothing else. Not you, or changed your mind? Reply to this email and we take you off the list.</td></tr></table></td></tr></table></body></html>"
        }
        var $auth_header { value = "Authorization: Bearer " ~ $key }
        var $to { value = [$input.email] }

        api.request {
          url = "https://api.resend.com/emails"
          method = "POST"
          params = {from: $from, to: $to, subject: $subject, html: $html}
          headers = [$auth_header, "Content-Type: application/json"]
          timeout = 15
        } as $mail

        conditional {
          if (`$mail.response.status == 200`) {
            db.edit waitlist {
              field_name = "id"
              field_value = $saved_id
              data = {report_sent_at: "now"}
            } as $stamped
            var.update $sent { value = true }
          }
        }
      }
    }
  }

  response = {ok: true, level: $lvl, level_name: $lvl_name, report_sent: $sent}
}
