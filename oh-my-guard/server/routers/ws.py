"""
Oh-My-Guard! – WebSocket Router
Provides a real-time alert stream to connected dashboard clients.
Also listens on a Redis pub/sub channel for IDS/IPS engine alerts.
"""
from __future__ import annotations

import asyncio
import json

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

from server.config import settings
from server.services.notifications import register_ws_client, unregister_ws_client

router = APIRouter()


@router.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    """
    WebSocket endpoint that streams real-time security alerts to the dashboard.
    Connected clients receive alerts from:
      - IDS/IPS engine (via Redis pub/sub)
      - Zero-trust failures
      - Policy violations
      - File monitoring anomalies
    """
    await websocket.accept()
    register_ws_client(websocket)
    logger.info(f"WebSocket client connected: {websocket.client}")

    try:
        # Keep the connection open; incoming messages are ignored (read-only stream)
        while True:
            try:
                # Heartbeat ping every 30s to detect dead connections
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected: {websocket.client}")
    finally:
        unregister_ws_client(websocket)


async def redis_ids_relay():
    """
    Background task: subscribe to the Redis IDS alert channel and broadcast
    incoming IDS/IPS alerts to all connected WebSocket clients.
    Called from the lifespan startup hook in main.py.
    """
    from server.services.notifications import broadcast_ws

    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = redis.pubsub()
    await pubsub.subscribe("Oh-My-Guard!:ids:alerts")
    logger.info("Redis IDS relay started.")

    async for message in pubsub.listen():
        if message["type"] == "message":
            try:
                alert = json.loads(message["data"])
                await broadcast_ws({
                    "type":    "alert",
                    "title":   alert.get("signature_name", "IDS Alert"),
                    "message": f"{alert.get('source_ip', '?')} → {alert.get('dest_ip', '?')}:{alert.get('dest_port', '?')}",
                    "severity": alert.get("severity", "medium"),
                    "payload": alert,
                })
            except Exception as e:
                logger.error(f"Redis relay error: {e}")
