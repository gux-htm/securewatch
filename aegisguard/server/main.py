"""
AegisGuard – FastAPI Application Entry Point
Mounts all routers, WebSocket handler, HTMX dashboard, and startup hooks.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from loguru import logger

from server.config import settings
from server.routers import (
    auth_router,
    devices_router,
    networks_router,
    firewall_router,
    ids_router,
    files_router,
    audit_router,
    policies_router,
    dashboard_router,
    vpn_router,
    websocket_router,
)
from server.services.startup import initialize_superadmin, preload_ids_signatures


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    logger.info("AegisGuard starting up...")
    await initialize_superadmin()
    await preload_ids_signatures()
    logger.info("AegisGuard ready.")
    yield
    logger.info("AegisGuard shutting down.")


app = FastAPI(
    title="AegisGuard Security Platform",
    description="Unified enterprise security: IPS/IDS, Firewall, VPN, File Monitor, Audit.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ─── Middleware ───────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Restrict in production to known origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Add security headers to every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"]    = "nosniff"
    response.headers["X-Frame-Options"]           = "DENY"
    response.headers["X-XSS-Protection"]          = "1; mode=block"
    response.headers["Referrer-Policy"]            = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"]  = "max-age=63072000; includeSubDomains"
    return response


# ─── API Routers (prefixed /api) ──────────────────────────────────────────────

API_PREFIX = "/api/v1"

app.include_router(auth_router,      prefix=f"{API_PREFIX}/auth",      tags=["auth"])
app.include_router(devices_router,   prefix=f"{API_PREFIX}/devices",   tags=["devices"])
app.include_router(networks_router,  prefix=f"{API_PREFIX}/networks",  tags=["networks"])
app.include_router(firewall_router,  prefix=f"{API_PREFIX}/firewall",  tags=["firewall"])
app.include_router(ids_router,       prefix=f"{API_PREFIX}/ids",       tags=["ids"])
app.include_router(files_router,     prefix=f"{API_PREFIX}/files",     tags=["files"])
app.include_router(audit_router,     prefix=f"{API_PREFIX}/audit",     tags=["audit"])
app.include_router(policies_router,  prefix=f"{API_PREFIX}/policies",  tags=["policies"])
app.include_router(dashboard_router, prefix=f"{API_PREFIX}/dashboard", tags=["dashboard"])
app.include_router(vpn_router,       prefix=f"{API_PREFIX}/vpn",       tags=["vpn"])
app.include_router(websocket_router,                                    tags=["realtime"])

# ─── HTMX Dashboard (static + templates) ─────────────────────────────────────

_static_dir    = os.path.join(os.path.dirname(__file__), "../dashboard/static")
_template_dir  = os.path.join(os.path.dirname(__file__), "../dashboard/templates")

if os.path.isdir(_static_dir):
    app.mount("/static", StaticFiles(directory=_static_dir), name="static")

templates = Jinja2Templates(directory=_template_dir)


@app.get("/", include_in_schema=False)
async def dashboard_root(request: Request):
    """Serve the HTMX dashboard root (redirects to login if unauthenticated)."""
    return templates.TemplateResponse("index.html", {"request": request})


# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/healthz", tags=["health"])
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ─── Global error handler ─────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.url}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
