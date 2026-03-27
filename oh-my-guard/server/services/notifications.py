"""
Oh-My-Guard! – Notification Service
Delivers real-time alerts via:
  1. WebSocket broadcast (in-app)
  2. Email (SMTP)
  3. Slack webhook (optional)
  4. Microsoft Teams webhook (optional)
"""
from __future__ import annotations

import json
from typing import Any

import httpx
from loguru import logger

from server.config import settings

# Registry of connected WebSocket clients (populated by ws.py)
_ws_clients: set = set()


def register_ws_client(ws) -> None:
    _ws_clients.add(ws)


def unregister_ws_client(ws) -> None:
    _ws_clients.discard(ws)


async def broadcast_ws(message: dict) -> None:
    """Push message to all connected WebSocket clients."""
    dead = set()
    for ws in _ws_clients:
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            dead.add(ws)
    _ws_clients.difference_update(dead)


async def notify_alert(
    title: str,
    message: str,
    severity: str = "info",
    extra: dict[str, Any] | None = None,
) -> None:
    """Send alert to all configured notification channels."""
    payload = {"type": "alert", "title": title, "message": message, "severity": severity, **(extra or {})}

    # 1. WebSocket (in-app)
    await broadcast_ws(payload)

    # 2. Email
    if settings.smtp_host:
        await _send_email(title, message, severity)

    # 3. Slack
    if settings.slack_webhook_url:
        await _send_slack(title, message, severity)

    # 4. Teams
    if settings.teams_webhook_url:
        await _send_teams(title, message, severity)


async def _send_email(subject: str, body: str, severity: str) -> None:
    try:
        import aiosmtplib
        from email.message import EmailMessage
        msg = EmailMessage()
        msg["Subject"] = f"[Oh-My-Guard! {severity.upper()}] {subject}"
        msg["From"]    = settings.smtp_from
        msg["To"]      = settings.smtp_from  # In prod: configurable admin emails
        msg.set_content(body)
        await aiosmtplib.send(msg, hostname=settings.smtp_host, port=settings.smtp_port,
                               username=settings.smtp_user, password=settings.smtp_pass,
                               start_tls=True)
    except Exception as e:
        logger.error(f"Email notification failed: {e}")


async def _send_slack(title: str, message: str, severity: str) -> None:
    emoji = {"critical": "🚨", "high": "⚠️", "medium": "⚡", "low": "ℹ️"}.get(severity, "ℹ️")
    payload = {"text": f"{emoji} *{title}*\n{message}"}
    try:
        async with httpx.AsyncClient() as client:
            await client.post(settings.slack_webhook_url, json=payload, timeout=5)
    except Exception as e:
        logger.error(f"Slack notification failed: {e}")


async def _send_teams(title: str, message: str, severity: str) -> None:
    payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "summary": title,
        "themeColor": {"critical": "FF0000", "high": "FF6600"}.get(severity, "0078D7"),
        "title": f"Oh-My-Guard! Alert: {title}",
        "text": message,
    }
    try:
        async with httpx.AsyncClient() as client:
            await client.post(settings.teams_webhook_url, json=payload, timeout=5)
    except Exception as e:
        logger.error(f"Teams notification failed: {e}")
