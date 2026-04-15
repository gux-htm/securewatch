import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface DevicePayload {
  device_id: number;
  mac: string;
  ip: string;
  network_id: number | null;
}

/**
 * Middleware: verifies the JWT issued by POST /api/public/device/verify.
 * Attaches req.device for downstream handlers.
 * Replaces requireVpnSubnet for the end-device portal routes.
 */
export function requireDeviceToken(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

  if (!token) {
    res.status(401).json({ error: "No token — register and verify your device first" });
    return;
  }

  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    res.status(500).json({ error: "Server misconfiguration: JWT_SECRET not set" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as DevicePayload;
    (req as Request & { device: DevicePayload }).device = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token — please re-verify your device" });
  }
}
