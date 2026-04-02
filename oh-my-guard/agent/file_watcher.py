"""
Oh-My-Guard! – Lightweight File Watcher for Windows Dev Environment
Watches registered resources from the API and posts file events back.
No mTLS required — talks directly to the Express API on localhost:3001.

Usage:
    python file_watcher.py [--api http://localhost:3001] [--device-id 1] [--user-id 1]

The watcher:
  1. Fetches all registered resources from GET /api/resources
  2. Watches each resource path with watchdog
  3. On any change: computes SHA-256, posts to POST /api/files/events
  4. Polls for new resources every 60s so newly registered ones are picked up
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import platform
import socket
import time
import uuid
from pathlib import Path
from typing import Any

import httpx
from loguru import logger
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

# ── Helpers ───────────────────────────────────────────────────────────────────

def sha256_file(path: str) -> str | None:
    try:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    except OSError:
        return None


def get_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def get_mac() -> str:
    mac = uuid.getnode()
    return ":".join(f"{mac:012X}"[i:i+2] for i in range(0, 12, 2))


# ── File Event Handler ────────────────────────────────────────────────────────

class ResourceEventHandler(FileSystemEventHandler):
    ACTION_MAP = {
        "created":  "create",
        "modified": "edit",
        "deleted":  "delete",
        "moved":    "rename",
    }

    def __init__(self, queue: asyncio.Queue, device_id: int, user_id: int):
        self.queue = queue
        self.device_id = device_id
        self.user_id = user_id
        # Cache last known hash per path to compute before/after
        self._hash_cache: dict[str, str | None] = {}

    def _post_event(self, path: str, action: str):
        hash_before = self._hash_cache.get(path)
        hash_after = sha256_file(path) if action != "delete" else None
        self._hash_cache[path] = hash_after

        payload = {
            "deviceId":       self.device_id,
            "userId":         self.user_id,
            "filePath":       path,
            "action":         action,
            "hashBefore":     hash_before,
            "hashAfter":      hash_after,
            "privilegesUsed": "write" if action in ("edit", "create", "delete", "rename") else "read",
        }
        try:
            self.queue.put_nowait(payload)
        except asyncio.QueueFull:
            logger.warning(f"Queue full, dropping event for {path}")

    def on_created(self, event: FileSystemEvent):
        if not event.is_directory:
            self._post_event(str(event.src_path), "create")

    def on_modified(self, event: FileSystemEvent):
        if not event.is_directory:
            self._post_event(str(event.src_path), "edit")

    def on_deleted(self, event: FileSystemEvent):
        if not event.is_directory:
            self._post_event(str(event.src_path), "delete")

    def on_moved(self, event: FileSystemEvent):
        dest = str(getattr(event, "dest_path", event.src_path))
        self._post_event(dest, "rename")


# ── Access Time Poller (detects file opens/views) ────────────────────────────

async def access_time_poller(
    api_url: str,
    device_id: int,
    user_id: int,
    watched_paths: set[str],
    poll_interval: float = 3.0,
):
    """
    Detect file opens/views using Windows ReadDirectoryChangesW with
    FILE_NOTIFY_CHANGE_LAST_ACCESS flag. Runs in a thread pool to avoid
    blocking the event loop.
    """
    import threading
    import concurrent.futures

    FILE_NOTIFY_CHANGE_LAST_ACCESS = 0x00000020
    FILE_NOTIFY_CHANGE_FILE_NAME   = 0x00000001
    FILE_LIST_DIRECTORY            = 0x0001
    FILE_SHARE_READ                = 0x00000001
    FILE_SHARE_WRITE               = 0x00000002
    FILE_SHARE_DELETE              = 0x00000004
    OPEN_EXISTING                  = 3
    FILE_FLAG_BACKUP_SEMANTICS     = 0x02000000

    view_queue: asyncio.Queue = asyncio.Queue()

    def watch_directory(dir_path: str):
        """Run in a thread — blocks on ReadDirectoryChangesW."""
        try:
            import win32file
            import win32con
            import pywintypes

            handle = win32file.CreateFile(
                dir_path,
                FILE_LIST_DIRECTORY,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                None,
                OPEN_EXISTING,
                FILE_FLAG_BACKUP_SEMANTICS,
                None,
            )

            while True:
                try:
                    results = win32file.ReadDirectoryChangesW(
                        handle,
                        65536,
                        False,  # not recursive
                        FILE_NOTIFY_CHANGE_LAST_ACCESS | FILE_NOTIFY_CHANGE_FILE_NAME,
                        None,
                        None,
                    )
                    for action_code, filename in results:
                        # action_code 5 = renamed new, but we care about access
                        full_path = os.path.join(dir_path, filename)
                        # Only report if it's a registered file
                        if full_path in watched_paths or full_path.lower() in {p.lower() for p in watched_paths}:
                            try:
                                view_queue.put_nowait(full_path)
                            except asyncio.QueueFull:
                                pass
                except Exception:
                    break
        except Exception as e:
            logger.debug(f"Win32 watcher error for {dir_path}: {e}")

    # Start a thread per unique directory
    dirs_watched: set[str] = set()
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=8)

    async with httpx.AsyncClient(base_url=api_url, timeout=10.0) as client:
        while True:
            # Start watchers for new directories
            for path in list(watched_paths):
                dir_path = str(Path(path).parent) if os.path.isfile(path) else path
                if dir_path not in dirs_watched:
                    dirs_watched.add(dir_path)
                    asyncio.get_event_loop().run_in_executor(executor, watch_directory, dir_path)
                    logger.info(f"[VIEW WATCHER] Monitoring access on: {dir_path}")

            # Drain the view queue
            while not view_queue.empty():
                try:
                    file_path = view_queue.get_nowait()
                    current_hash = sha256_file(file_path)
                    payload = {
                        "deviceId":       device_id,
                        "userId":         user_id,
                        "filePath":       file_path,
                        "action":         "view",
                        "hashBefore":     None,
                        "hashAfter":      current_hash,
                        "privilegesUsed": "read",
                    }
                    resp = await client.post("/api/files/events", json=payload)
                    if resp.status_code in (200, 201):
                        logger.info(f"[VIEW] {file_path}")
                except Exception as e:
                    logger.error(f"Failed to post view event: {e}")

            await asyncio.sleep(poll_interval)


# ── Event Sender ─────────────────────────────────────────────────────────────

async def event_sender(api_url: str, queue: asyncio.Queue):
    async with httpx.AsyncClient(base_url=api_url, timeout=10.0) as client:
        while True:
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=2.0)
            except asyncio.TimeoutError:
                continue

            try:
                resp = await client.post("/api/files/events", json=payload)
                if resp.status_code in (200, 201):
                    logger.info(
                        f"[{payload['action'].upper()}] {payload['filePath']} "
                        f"→ hash={str(payload.get('hashAfter') or '')[:12]}…"
                    )
                else:
                    logger.warning(f"API rejected event: {resp.status_code} {resp.text[:200]}")
            except Exception as e:
                logger.error(f"Failed to send event: {e}")
                await queue.put(payload)
                await asyncio.sleep(3)
            finally:
                queue.task_done()


# ── Resource Poller ───────────────────────────────────────────────────────────

async def resource_poller(
    api_url: str,
    observer: Observer,
    handler: ResourceEventHandler,
    file_paths: set[str],
    poll_interval: int = 30,
):
    """Fetch registered resources and add new ones to the watchdog observer."""
    watched: set[str] = set()

    async with httpx.AsyncClient(base_url=api_url, timeout=10.0) as client:
        while True:
            try:
                resp = await client.get("/api/resources")
                if resp.status_code == 200:
                    resources = resp.json()
                    if isinstance(resources, list):
                        for r in resources:
                            path = r.get("path") or r.get("name", "")
                            if not path or path in watched:
                                continue
                            abs_path = str(Path(path).resolve())
                            parent = str(Path(abs_path).parent) if not Path(abs_path).is_dir() else abs_path
                            if os.path.exists(parent):
                                observer.schedule(handler, parent, recursive=False)
                                watched.add(path)
                                if os.path.isfile(abs_path):
                                    handler._hash_cache[abs_path] = sha256_file(abs_path)
                                    file_paths.add(abs_path)  # register for access-time polling
                                elif os.path.isdir(abs_path):
                                    # Register all existing files in the directory
                                    for f in Path(abs_path).iterdir():
                                        if f.is_file():
                                            handler._hash_cache[str(f)] = sha256_file(str(f))
                                            file_paths.add(str(f))
                                logger.info(f"Watching resource: {abs_path}")
                            else:
                                logger.warning(f"Resource path not found: {abs_path}")
            except Exception as e:
                logger.error(f"Resource poll error: {e}")

            await asyncio.sleep(poll_interval)


# ── Main ─────────────────────────────────────────────────────────────────────

async def run(api_url: str, device_id: int, user_id: int):
    logger.info(f"Oh-My-Guard! File Watcher starting")
    logger.info(f"  API:       {api_url}")
    logger.info(f"  Device ID: {device_id}")
    logger.info(f"  User ID:   {user_id}")
    logger.info(f"  Host IP:   {get_ip()}")
    logger.info(f"  Host MAC:  {get_mac()}")

    queue: asyncio.Queue = asyncio.Queue(maxsize=5000)
    handler = ResourceEventHandler(queue, device_id, user_id)
    observer = Observer()
    observer.start()
    file_paths: set[str] = set()  # shared set for access-time poller

    try:
        await asyncio.gather(
            event_sender(api_url, queue),
            resource_poller(api_url, observer, handler, file_paths, poll_interval=30),
            access_time_poller(api_url, device_id, user_id, file_paths, poll_interval=3.0),
        )
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        observer.stop()
        observer.join()
        logger.info("File watcher stopped.")


def main():
    parser = argparse.ArgumentParser(description="Oh-My-Guard! File Watcher")
    parser.add_argument("--api",       default=os.environ.get("AEGIS_API_URL", "http://localhost:3001"))
    parser.add_argument("--device-id", type=int, default=int(os.environ.get("AEGIS_DEVICE_ID", "0")))
    parser.add_argument("--user-id",   type=int, default=int(os.environ.get("AEGIS_USER_ID", "0")))
    args = parser.parse_args()

    asyncio.run(run(args.api, args.device_id, args.user_id))


if __name__ == "__main__":
    main()
