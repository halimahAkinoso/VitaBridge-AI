# VitaBridge AI Architecture
Mobile (Expo RN) -> FastAPI -> PostgreSQL+pgvector + Redis
AI: OpenAI (primary) + Open-Source Clinical Model (BioBERT/MedAlpaca fallback via HF) + Scikit-learn stratification + LangChain RAG
Agents: ChildDevelopmentAgent, AdultBrainHealthAgent, TriageAgent, NudgeAgent (barrier solver)
Active Loop: Daily proactive check via /agent/proactive-check (cron / Celery in prod) — alerts, open loops, missed visits.
Doctor Dashboard: Web view in same Expo app (expo web) + FastAPI /doctor/dashboard
Security: JWT, RBAC (parent/adult/doctor/technician), audit logging, consent per person, no diagnosis by AI.
