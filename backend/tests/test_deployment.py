from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base
from app.main import app
from app.models import User
from scripts import bootstrap_demo_admin


def test_web_app_serves_assets_and_spa_routes_without_masking_api_404(
    tmp_path,
    monkeypatch,
):
    web_root = tmp_path / "web-dist"
    web_root.mkdir()
    (web_root / "index.html").write_text("<main>VitaBridge</main>")
    (web_root / "bundle.js").write_text("bundle")
    monkeypatch.setattr("app.main.WEB_ROOT", web_root)

    client = TestClient(app)
    assert client.get("/").text == "<main>VitaBridge</main>"
    assert client.get("/results").text == "<main>VitaBridge</main>"
    assert client.get("/bundle.js").text == "bundle"
    assert client.get("/api/not-a-route").status_code == 404


def test_demo_admin_bootstrap_creates_once(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{(tmp_path / 'demo.db').as_posix()}")
    session_factory = sessionmaker(bind=engine)
    monkeypatch.setattr(bootstrap_demo_admin, "engine", engine)
    monkeypatch.setattr(bootstrap_demo_admin, "SessionLocal", session_factory)
    monkeypatch.setenv("INITIAL_ADMIN_NAME", "Synthetic Demo Admin")
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", "demo-admin@example.com")
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", "Synthetic-Demo-Password-123")

    bootstrap_demo_admin.main()
    bootstrap_demo_admin.main()

    db = session_factory()
    try:
        admins = db.query(User).filter(User.role == "admin").all()
        assert len(admins) == 1
        assert admins[0].email == "demo-admin@example.com"
    finally:
        db.close()
        engine.dispose()
