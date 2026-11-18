
"""
VitaBridge AI Backend
Protecting Brain Health Earlier
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import models before creating database tables
from app import models
from app.core.database import engine, Base, ensure_screening_submission_id

# Import application routers
from app.routers import (
    auth,
    users,
    screening,
    agents,
    doctor,
    notifications,
    passport,
)

# Create database tables
Base.metadata.create_all(bind=engine)
ensure_screening_submission_id()

# Initialize FastAPI
app = FastAPI(
    title="VitaBridge AI API",
    version="1.0.0",
    description=(
        "Protecting Brain Health Earlier — "
        "International Preventive Brain Health Platform"
    ),
)

# Development CORS configuration
# Restrict allowed origins before production deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(
    passport.router,
    prefix="/api/passport",
    tags=["Family Health Passport"],
)
app.include_router(
    screening.router,
    prefix="/api/screening",
    tags=["Screening"],
)
app.include_router(
    agents.router,
    prefix="/api/agent",
    tags=["AI Agent"],
)
app.include_router(
    doctor.router,
    prefix="/api/doctor",
    tags=["Doctor Dashboard"],
)
app.include_router(
    notifications.router,
    prefix="/api/notifications",
    tags=["Notifications"],
)


@app.get("/")
def root():
    return {
        "message": "VitaBridge AI — Protecting Brain Health Earlier",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "app": "VitaBridge AI",
        "version": "1.0.0",
        "agents": [
            "ChildDevelopmentAgent",
            "AdultBrainHealthAgent",
            "TriageAgent",
        ],
    }
