// ============================================================================
// ENDPOINT  onboarding_lesson_done   (NEW)
// Group: Onboarding (api:m2bNDxnv, id 428916)   Verb: POST   Auth: none
// Purpose: the anonymous visitor passed the inline remediation lesson's quiz.
//          Sets remediation_done=true when slug matches the stored pick so the
//          roadmap can mark that item done after signup.
// Response: {ok:true, matched:bool}
// ============================================================================
query onboarding_lesson_done verb=POST {
  input {
    text session_token
    text slug filters=trim
  }

  stack {
    db.get onboarding_sessions {
      field_name = "session_token"
      field_value = $input.session_token
    } as $session

    precondition ($session != null) {
      error_type = "notfound"
      error = "Unknown session_token"
    }

    var $matched { value = ($input.slug|is_empty) == false && $session.remediation_slug == $input.slug }

    conditional {
      if (`$matched == true`) {
        db.edit onboarding_sessions {
          field_name = "id"
          field_value = $session.id
          data = {remediation_done: true}
        } as $saved
      }
    }
  }

  response = {ok: true, matched: $matched}
}
