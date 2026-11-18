import os
import sys
import tempfile
from pathlib import Path

test_database = Path(tempfile.mkdtemp(prefix="vitabridge-test-")) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{test_database.as_posix()}"
os.environ["JWT_SECRET"] = "vitabridge-test-secret"
os.environ["OPENAI_API_KEY"] = ""
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
