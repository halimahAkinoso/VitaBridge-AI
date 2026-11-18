# API
POST /api/auth/register (adult and parent accounts)
POST /api/auth/login
GET /api/auth/me
POST /api/auth/admin/create-doctor (administrator only)
GET /api/screening/instruments (authenticated, pathway-restricted)
POST /api/screening/child (optional submission_id makes retries idempotent)
PUT /api/screening/adult/profile (preferred language: en or ar)
POST /api/screening/adult
GET /api/screening/adult/history (authenticated adult account)
POST /api/screening/adult/baseline
POST /api/screening/adult/hearing-vision
GET /api/agent/overview (adult prevention journey)
GET /api/agent/results (clinician-entered result or pending-review state)
GET /api/agent/plan (exactly one next action)
POST /api/agent/check-in (self-reported sleep hours and/or mood 1–5)
GET /api/agent/check-ins (authenticated adult account)
POST /api/agent/chat (bounded, non-diagnostic Nura guidance)
POST /api/agent/nudge (barrier-support prompt; no booking)
POST /api/agent/proactive-check
POST /api/agent/monitoring-plan
GET /api/doctor/dashboard
GET /api/screening/clinician/adult-queue (clinician only)
POST /api/screening/clinician/adult-review/{person_id} (clinician-only status, risk, and action)
GET /api/notifications/{person_id} (account-owned person only)
GET /api/passport/{person_id}
GET /api/passport/family/me (account-linked profiles only)
See /docs (Swagger) when backend runs.

The cognitive screening endpoint remains unavailable until an approved
instrument, authorized materials, and clinical governance are configured.
Clinical review decisions and risk labels are clinician-entered; the API does
not calculate or fabricate cognitive scores or diagnoses.
