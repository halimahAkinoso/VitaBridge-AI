# VitaBridge AI Architecture

## Current implementation

- Expo React Native/web client calls the FastAPI API.
- SQLAlchemy persists account-owned profiles, screening history, wellbeing
  check-ins, referrals, and clinician reviews in the configured database.
- JWT authentication and role checks protect adult, parent, and clinician
  workflows. Passport and notification lookups are scoped to the signed-in
  account.
- The adult prevention overview derives its next step from saved profile,
  self-reported assessments, check-ins, referrals, and clinician reviews.
- Adult Results are pending until an authorized clinician records a status
  and risk. The Plan endpoint returns one action, prioritizing the clinician's
  recommendation. Nura's result explanation reads those same account-scoped
  tools so its response matches the Results and Plan screens.
- Nura currently uses bounded local response templates. Health context is not
  sent to an external AI provider. Check-ins and trend summaries are
  self-reported and are not clinical scores or diagnoses.
- Clinicians record adult review decisions and risk labels; only a
  clinician-entered `REFER` decision creates a referral record.
- A family passport aggregates only profiles already linked to the account.

## Not yet integrated

- Approved cognitive screening instruments and administration materials.
- Laboratory, genomic, wearable, and external clinical-record systems.
- Appointment availability, booking, push delivery, or automated follow-up
  scheduling.
- Cross-account household linking and a production clinical audit/consent
  service.
- Background scheduling for proactive checks; the current endpoint is
  request-driven and does not send notifications by itself.

These are explicit integration and governance prerequisites, not simulated
capabilities. Configure production secrets, database, CORS allow-list,
clinical governance, and applicable privacy controls before deployment.
