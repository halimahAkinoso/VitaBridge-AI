
"""
VitaBridge AI Backend
Protecting Brain Health Earlier
"""

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

# Import models before creating database tables
from app import models
from app.core.database import engine, Base, ensure_screening_submission_id

# Import application routers
from app.routers import (
    ai,
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

default_cors_origins = (
    "http://localhost:8081,"
    "http://127.0.0.1:8081,"
    "http://localhost:8082,"
    "http://127.0.0.1:8082,"
    "http://localhost:19006,"
    "http://127.0.0.1:19006"
)
cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", default_cors_origins).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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
app.include_router(
    ai.router,
    prefix="/api",
    tags=["Clinical AI decision support"],
)
WEB_ROOT = Path(__file__).resolve().parents[1] / "web-dist"


@app.get("/")
def root():
    index = WEB_ROOT / "index.html"
    if WEB_ROOT.is_dir() and index.is_file():
        return FileResponse(index)
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


@app.get("/{full_path:path}", include_in_schema=False)
def serve_web_app(full_path: str):
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found.")

    web_root = WEB_ROOT.resolve()
    if not web_root.is_dir():
        raise HTTPException(status_code=404, detail="Not found.")

    requested = (web_root / full_path).resolve()
    if not requested.is_relative_to(web_root):
        raise HTTPException(status_code=404, detail="Not found.")
    if requested.is_file():
        return FileResponse(requested)

    index = web_root / "index.html"
    if not Path(full_path).suffix and index.is_file():
        return FileResponse(index)

    raise HTTPException(status_code=404, detail="Not found.")
