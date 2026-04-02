"""
Oh-My-Guard! – ETW File Access Monitor (Windows, requires Administrator)
=========================================================================
Uses Windows Security Event Log (Event ID 4663 – "An attempt was made to
access an object") to detect when monitored files are opened/read.

Prerequisites (run once as Administrator):
    auditpol /set /subcategory:"File System" /success:enable /failure:enable

Then set SACL on each monitored file/folder:
    icacls <path> /grant "Everyone:(OI)(CI)(F)" /T   (or use the GUI)

Usage (must be run as Administrator):
    python etw_view_monitor.py --api http://localhost:3001 --device-id 1

How it works:
    1. Enables file system auditing via auditpol (requires admin)
    2. Sets SACL (System ACL) on monitored files so Windows logs access
    3. Tails the Security event log for Event ID 4663 matching our files
    4. POSTs a 'view' event to the API for each unique open
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx
from loguru import logger

# ── Require Admin ─────────────────────────────────────────────────────────────

def require_admin() -> None:
    import ctypes
    if not ctypes.windll.shell32.IsUserAnAdmin():
        logger.error("This script must be run as Administrator.")
        logger.error("Right-click your terminal and choose 'Run as administrator', then retry.")
        sys.exit(1)
    logger.info("Running as Administrator ✓")


# ── Enable Audit Policy ───────────────────────────────────────────────────────

def enable_file_audit_policy() -> None:
    """Enable 'File System' success auditing via auditpol."""
    try:
        result = subprocess.run(
            ["auditpol", "/set", "/subcategory:File System",
             "/success:enable", "/failure:enable"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            logger.info("File System audit policy enabled ✓")
        else:
            logger.warning(f"auditpol: {result.stderr.strip()}")
    except Exception as e:
        logger.error(f"Failed to set audit policy: {e}")


# ── Set SACL on File/Directory ────────────────────────────────────────────────

def set_sacl_for_audit(path: str) -> None:
    """
    Set a System ACL (SACL) on the file/directory so Windows generates
    Security events when it is accessed.
    Uses icacls to add audit ACE for Everyone.
    """
    try:
        # /audit:r = audit read access, /audit:w = write, /audit:x = execute
        # We want to audit read (view) access
        result = subprocess.run(
            ["icacls", path, "/grant:r", "Everyone:(OI)(CI)(R)"],
            capture_output=True, text=True
        )
        # Set audit entry via PowerShell (more reliable for SACL)
        ps_cmd = f"""
$acl = Get-Acl -Path '{path}' -Audit
$rule = New-Object System.Security.AccessControl.FileSystemAuditRule(
    'Everyone',
    [System.Security.AccessControl.FileSystemRights]::ReadData,
    [System.Security.AccessControl.InheritanceFlags]'ObjectInherit,ContainerInherit',
    [System.Security.AccessControl.PropagationFlags]::None,
    [System.Security.AccessControl.AuditFlags]::Success
)
$acl.AddAuditRule($rule)
Set-Acl -Path '{path}' -AclObject $acl
"""
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            logger.info(f"SACL set on: {path} ✓")
        else:
            logger.warning(f"SACL set warning for {path}: {result.stderr.strip()[:200]}")
    except Exception as e:
        logger.error(f"Failed to set SACL on {path}: {e}")


# ── SHA-256 Helper ────────────────────────────────────────────────────────────

def sha256_file(path: str) -> str | None:
    try:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    except OSError:
        return None


# ── ETW Security Log Tailer ───────────────────────────────────────────────────

async def etw_file_access_monitor(
    api_url: str,
    device_id: int,
    user_id: int,
    monitored_paths: set[str],
    poll_interval: float = 2.0,
):
    """
    Tail the Windows Security event log for Event ID 4663.
    Event 4663 = "An attempt was made to access an object"
    Fires when a file with a SACL is opened.
    """
    import win32evtlog
    import win32evtlogutil
    import win32con
    import win32security
    import pywintypes

    SECURITY_LOG = "Security"
    EVENT_ID_FILE_ACCESS = 4663
    # Accesses that indicate a read/view (not write)
    READ_ACCESS_MASKS = {
        "0x1",       # ReadData / ListDirectory
        "0x80",      # ReadAttributes
        "0x20000",   # Synchronize
        "0x100080",  # ReadData + ReadAttributes
        "0x120089",  # Generic read
        "%%4416",    # ReadData
        "%%4419",    # ReadAttributes
    }

    # Normalise monitored paths for comparison
    norm_paths = {os.path.abspath(p).lower() for p in monitored_paths}

    # Track last record number to avoid re-processing old events
    handle = win32evtlog.OpenEventLog(None, SECURITY_LOG)
    total = win32evtlog.GetNumberOfEventLogRecords(handle)
    win32evtlog.CloseEventLog(handle)
    # We'll use FORWARDS_READ and skip old events by tracking record numbers
    last_record: int = total  # start from current end

    # Deduplicate: don't fire multiple view events for same file within 5s
    last_view: dict[str, float] = {}
    DEDUP_WINDOW = 5.0

    logger.info(f"ETW monitor active — watching Security log for Event 4663")
    logger.info(f"Monitoring {len(norm_paths)} file path(s)")

    async with httpx.AsyncClient(base_url=api_url, timeout=10.0) as client:
        while True:
            await asyncio.sleep(poll_interval)
            try:
                handle = win32evtlog.OpenEventLog(None, SECURITY_LOG)
                # Read only new records since last check using SEEK_READ
                flags = win32evtlog.EVENTLOG_FORWARDS_READ | win32evtlog.EVENTLOG_SEEK_READ
                all_new = []
                try:
                    batch = win32evtlog.ReadEventLog(handle, flags, last_record + 1)
                    while batch:
                        all_new.extend(batch)
                        batch = win32evtlog.ReadEventLog(
                            handle,
                            win32evtlog.EVENTLOG_FORWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ,
                            0
                        )
                except Exception:
                    pass  # No new records yet
                win32evtlog.CloseEventLog(handle)

                for event in all_new:
                    if event.RecordNumber <= last_record:
                        continue
                    last_record = max(last_record, event.RecordNumber)

                    if event.EventID != EVENT_ID_FILE_ACCESS:
                        continue

                    strings = event.StringInserts
                    if not strings or len(strings) < 7:
                        continue

                    # strings[6] = Object Name (file path)
                    obj_name = strings[6].strip() if len(strings) > 6 else ""
                    accesses = strings[8].strip() if len(strings) > 8 else ""

                    if not obj_name:
                        continue

                    obj_lower = obj_name.lower()

                    # Check if this file is one we're monitoring
                    matched = any(
                        obj_lower == p or obj_lower.startswith(p + os.sep)
                        for p in norm_paths
                    )
                    if not matched:
                        continue

                    # Check it's a read access (not write — those are handled by watchdog)
                    is_read = any(mask in accesses for mask in READ_ACCESS_MASKS)
                    if not is_read:
                        continue

                    # Deduplicate
                    now = time.time()
                    if now - last_view.get(obj_lower, 0) < DEDUP_WINDOW:
                        continue
                    last_view[obj_lower] = now

                    # Post view event
                    current_hash = sha256_file(obj_name)
                    payload = {
                        "deviceId":       device_id,
                        "userId":         user_id,
                        "filePath":       obj_name,
                        "action":         "view",
                        "hashBefore":     None,
                        "hashAfter":      current_hash,
                        "privilegesUsed": "read",
                    }
                    try:
                        resp = await client.post("/api/files/events", json=payload)
                        if resp.status_code in (200, 201):
                            logger.info(f"[VIEW] {obj_name}")
                        else:
                            logger.warning(f"API error: {resp.status_code}")
                    except Exception as e:
                        logger.error(f"Failed to post view event: {e}")

            except Exception as e:
                logger.debug(f"ETW poll error: {e}")

# ── Resource Fetcher ──────────────────────────────────────────────────────────

async def fetch_and_setup_resources(
    api_url: str,
    monitored_paths: set[str],
    poll_interval: int = 30,
) -> None:
    """Fetch registered resources, set SACLs, and keep the set updated."""
    setup_done: set[str] = set()

    async with httpx.AsyncClient(base_url=api_url, timeout=10.0) as client:
        while True:
            try:
                resp = await client.get("/api/resources")
                if resp.status_code == 200:
                    resources = resp.json()
                    if isinstance(resources, list):
                        for r in resources:
                            path = r.get("path") or ""
                            if not path:
                                continue
                            abs_path = os.path.abspath(path)
                            if not os.path.exists(abs_path):
                                continue
                            monitored_paths.add(abs_path)
                            if abs_path not in setup_done:
                                set_sacl_for_audit(abs_path)
                                setup_done.add(abs_path)
            except Exception as e:
                logger.error(f"Resource fetch error: {e}")
            await asyncio.sleep(poll_interval)


# ── Main ─────────────────────────────────────────────────────────────────────

async def run(api_url: str, device_id: int, user_id: int) -> None:
    require_admin()
    enable_file_audit_policy()

    logger.info(f"Oh-My-Guard! ETW View Monitor")
    logger.info(f"  API:       {api_url}")
    logger.info(f"  Device ID: {device_id}")

    monitored_paths: set[str] = set()

    await asyncio.gather(
        fetch_and_setup_resources(api_url, monitored_paths, poll_interval=30),
        etw_file_access_monitor(api_url, device_id, user_id, monitored_paths),
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Oh-My-Guard! ETW File View Monitor (requires Administrator)"
    )
    parser.add_argument("--api",       default=os.environ.get("AEGIS_API_URL", "http://localhost:3001"))
    parser.add_argument("--device-id", type=int, default=int(os.environ.get("AEGIS_DEVICE_ID", "1")))
    parser.add_argument("--user-id",   type=int, default=int(os.environ.get("AEGIS_USER_ID", "0")))
    args = parser.parse_args()

    asyncio.run(run(args.api, args.device_id, args.user_id))


if __name__ == "__main__":
    main()
