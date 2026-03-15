from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import admin_router, public_router, site_router
from app.config import Settings
from app.openapi import get_openapi

settings = Settings()

app = FastAPI(title="Mockingbird", version=settings.app_version)

static_dir = Path(__file__).resolve().parents[1] / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

app.include_router(site_router, tags=["public"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
app.include_router(public_router, prefix="/api", tags=["mock"])

# Override OpenAPI generator to use dynamic definitions.
# Keep a reference to the original generator to avoid recursion.
_original_get_openapi = app.openapi
app.openapi = lambda: get_openapi(app, settings, _original_get_openapi)
