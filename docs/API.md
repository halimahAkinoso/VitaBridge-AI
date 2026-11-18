# API
POST /api/auth/register (adult and parent accounts)
POST /api/auth/login
GET /api/auth/me
POST /api/auth/admin/create-doctor (administrator only)
GET /api/screening/instruments (authenticated, pathway-restricted)
POST /api/screening/child (optional submission_id makes retries idempotent)
PUT /api/screening/adult/profile (preferred language: en or ar)
POST /api/screening/adult
POST /api/agent/chat
POST /api/agent/nudge
GET /api/doctor/dashboard
GET /api/passport/{person_id}
See /docs (Swagger) when backend runs.
