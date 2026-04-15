/**
 * Public routes — no authentication required.
 * Used by mobile devices before VPN/registration.
 */
import { Router, type IRouter } from "express";
import { createHmac, randomUUID } from "crypto";
import { execSync } from "node:child_process";
import { db } from "@workspace/db";
import { devicesTable, networksTable, auditLogsTable, endDeviceSessionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

function normaliseMac(mac: string): string {
  return mac.toUpperCase().replace(/-/g, ":");
}

function clientIp(req: import("express").Request): string {
  const raw = req.ip ?? "";
  return raw.startsWith("::ffff:") ? raw.slice(7) : raw;
}

function generateDeviceSignature(mac: string, ip: string, hostname: string): string {
  const seed = process.env["DEVICE_SIGN_SEED"] ?? "omg-default-seed";
  const payload = `${mac.toUpperCase()}|${ip}|${hostname.toLowerCase()}`;
  return createHmac("sha256", seed).update(payload).digest("hex");
}

/** ARP lookup — works on Windows and Linux when phone is on same LAN */
function getMacFromArp(ip: string): string | null {
  try {
    const out = execSync(`arp -a ${ip}`, { encoding: "utf8", timeout: 3000 });
    const match = out.match(/([0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2})/i);
    return match ? normaliseMac(match[1]) : null;
  } catch { return null; }
}

/** Reverse DNS lookup for hostname */
function getHostname(ip: string): string {
  try {
    const out = execSync(`nslookup ${ip}`, { encoding: "utf8", timeout: 3000 });
    const match = out.match(/Name:\s+(.+)/);
    if (match) return match[1].trim().split(".")[0] ?? ip;
  } catch {}
  // Fallback: derive from user-agent
  return ip;
}

function hostnameFromUa(ua: string): string {
  if (/android/i.test(ua)) return "android-device";
  if (/iphone|ipad/i.test(ua)) return "ios-device";
  if (/windows/i.test(ua)) return "windows-device";
  if (/linux/i.test(ua)) return "linux-device";
  if (/mac/i.test(ua)) return "mac-device";
  return "unknown-device";
}

// ─── GET /api/public/ping ─────────────────────────────────────────────────────

router.get("/ping", (_req, res) => {
  res.json({ status: "ok", server: "oh-my-guard", lan_ip: process.env["LAN_IP"] ?? null });
});

// ─── GET /api/public/device/fingerprint ──────────────────────────────────────
// Server-side ARP lookup to get MAC — no browser permission needed.

router.get("/device/fingerprint", (req, res) => {
  const ip = clientIp(req);
  const ua = req.headers["user-agent"] ?? "";
  const mac = getMacFromArp(ip);
  const hostname = mac ? getHostname(ip) : hostnameFromUa(ua);
  return res.json({ ip, mac, hostname, user_agent: ua });
});

// ─── GET /api/public/networks ─────────────────────────────────────────────────

router.get("/networks", async (req, res) => {
  try {
    const networks = await db.select({ id: networksTable.id, name: networksTable.name }).from(networksTable);
    return res.json(networks);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to list networks" });
  }
});

// ─── GET /api/public/device/status/:mac ──────────────────────────────────────

router.get("/device/status/:mac", async (req, res) => {
  try {
    const mac = normaliseMac(req.params.mac ?? "");
    if (!MAC_RE.test(mac)) return res.status(400).json({ error: "Invalid MAC address" });

    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.mac, mac));
    if (!device) return res.status(404).json({ error: "Device not found" });

    const approved = device.status === "active" || device.status === "vpn_issued" || device.status === "approved_awaiting_setup";
    const fullyActive = device.status === "active" || device.status === "vpn_issued";

    return res.json({
      device_id: device.id,
      mac: device.mac,
      ip: device.ip,
      hostname: device.hostname,
      status: device.status,
      approved,
      needs_setup: device.status === "approved_awaiting_setup",
      signature: fullyActive ? generateDeviceSignature(mac, device.ip, device.hostname) : null,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to get device status" });
  }
});

// ─── POST /api/public/device/register ────────────────────────────────────────

const registerBodySchema = z.object({
  mac: z.string().regex(MAC_RE, "Invalid MAC address format (AA:BB:CC:DD:EE:FF)"),
  label: z.string().min(1).max(128),
  network_id: z.number().int().positive(),
});

router.post("/device/register", async (req, res) => {
  try {
    const parsed = registerBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });

    const { label, network_id } = parsed.data;
    const mac = normaliseMac(parsed.data.mac);
    const ip = clientIp(req);

    const [network] = await db.select().from(networksTable).where(eq(networksTable.id, network_id));
    if (!network) return res.status(404).json({ error: "Network not found" });

    // Idempotent
    const [existing] = await db.select().from(devicesTable).where(and(eq(devicesTable.mac, mac), eq(devicesTable.networkId, network_id)));
    if (existing) {
      const approved = ["active", "vpn_issued", "approved_awaiting_setup"].includes(existing.status);
      return res.json({
        device_id: existing.id, mac: existing.mac, ip: existing.ip,
        hostname: existing.hostname, status: existing.status, approved,
        needs_setup: existing.status === "approved_awaiting_setup",
        signature: (existing.status === "active" || existing.status === "vpn_issued")
          ? generateDeviceSignature(mac, existing.ip, existing.hostname) : null,
      });
    }

    const signature = generateDeviceSignature(mac, ip, label);
    const [device] = await db.insert(devicesTable).values({
      hostname: label, mac, ip, staticIp: ip, label,
      certFingerprint: signature, networkId: network_id,
      status: "pending_approval", platform: "mobile",
    }).returning();

    await db.insert(auditLogsTable).values({
      eventId: randomUUID(), deviceId: device.id,
      eventType: "device.registration_requested",
      details: `Device '${label}' (${mac}) from ${ip} requested registration to network '${network.name}'`,
      ipAddress: ip, macAddress: mac, severity: "info",
    });

    return res.status(201).json({
      device_id: device.id, mac: device.mac, ip, hostname: label,
      status: device.status, approved: false, needs_setup: false, signature: null,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Registration failed" });
  }
});

// ─── POST /api/public/device/setup-credentials ───────────────────────────────
// Called after admin approves. Device sets username + password.

const setupSchema = z.object({
  device_id: z.number().int().positive(),
  mac: z.string().regex(MAC_RE),
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/, "Username: letters, numbers, _ - only"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

router.post("/device/setup-credentials", async (req, res) => {
  try {
    const parsed = setupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid" });

    const { device_id, mac, username, password } = parsed.data;
    const normMac = normaliseMac(mac);

    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, device_id));
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (device.mac !== normMac) return res.status(401).json({ error: "MAC mismatch" });
    if (device.status !== "approved_awaiting_setup") return res.status(409).json({ error: `Device status is '${device.status}', expected 'approved_awaiting_setup'` });

    // Check username not taken
    const [taken] = await db.select({ id: devicesTable.id }).from(devicesTable).where(eq(devicesTable.username as any, username));
    if (taken && taken.id !== device_id) return res.status(409).json({ error: "Username already taken" });

    const passwordHash = await bcrypt.hash(password, 12);
    // Set status to active immediately — passkey is optional and set separately
    await db.update(devicesTable).set({ username, passwordHash, status: "active" }).where(eq(devicesTable.id, device_id));

    return res.json({ success: true, next_step: "register_passkey" });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Setup failed" });
  }
});

// ─── POST /api/public/device/passkey/register/begin ──────────────────────────
// Returns a WebAuthn challenge for the device to sign with biometrics.

router.post("/device/passkey/register/begin", async (req, res) => {
  try {
    const { device_id, mac } = req.body as { device_id?: number; mac?: string };
    if (!device_id || !mac) return res.status(400).json({ error: "device_id and mac required" });

    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, device_id));
    if (!device || device.mac !== normaliseMac(mac)) return res.status(401).json({ error: "Device not found or MAC mismatch" });
    if (!device.username) return res.status(409).json({ error: "Set credentials first" });

    // Generate a random challenge
    const challenge = randomUUID().replace(/-/g, "");
    await db.update(devicesTable).set({ passkeyChallenge: challenge }).where(eq(devicesTable.id, device_id));

    const rpId = process.env["LAN_IP"] ?? "localhost";

    // Return WebAuthn PublicKeyCredentialCreationOptions
    return res.json({
      challenge,
      rp: { name: "Oh-My-Guard!", id: rpId },
      user: {
        id: Buffer.from(String(device_id)).toString("base64"),
        name: device.username,
        displayName: device.label ?? device.hostname,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 },  // RS256
      ],
      timeout: 60000,
      attestation: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to begin passkey registration" });
  }
});

// ─── POST /api/public/device/passkey/register/complete ───────────────────────
// Stores the public key. Sets status = active.

router.post("/device/passkey/register/complete", async (req, res) => {
  try {
    const { device_id, mac, credential } = req.body as {
      device_id?: number; mac?: string;
      credential?: { id: string; rawId: string; response: { clientDataJSON: string; attestationObject: string }; type: string };
    };
    if (!device_id || !mac || !credential) return res.status(400).json({ error: "device_id, mac, credential required" });

    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, device_id));
    if (!device || device.mac !== normaliseMac(mac)) return res.status(401).json({ error: "Device not found or MAC mismatch" });

    // Verify the challenge was ours
    if (!device.passkeyChallenge) return res.status(409).json({ error: "No pending challenge — call begin first" });

    // Decode clientDataJSON and verify challenge
    const clientData = JSON.parse(Buffer.from(credential.response.clientDataJSON, "base64").toString("utf8"));
    const receivedChallenge = Buffer.from(clientData.challenge, "base64").toString("hex").replace(/-/g, "");
    const storedChallenge = device.passkeyChallenge.replace(/-/g, "");

    if (receivedChallenge !== storedChallenge) {
      return res.status(401).json({ error: "Challenge mismatch — possible replay attack" });
    }

    // Store credential ID and public key (from attestationObject — simplified storage)
    // We store the full attestationObject as the public key for later verification
    await db.update(devicesTable).set({
      passkeyCredentialId: credential.id,
      passkeyPublicKey: credential.response.attestationObject,
      passkeyCounter: 0,
      passkeyChallenge: null,
      status: "active",
    }).where(eq(devicesTable.id, device_id));

    await db.insert(auditLogsTable).values({
      eventId: randomUUID(), deviceId: device_id,
      eventType: "device.passkey_registered",
      details: `Passkey registered for device '${device.hostname}' (${device.mac})`,
      ipAddress: clientIp(req), macAddress: device.mac, severity: "info",
    });

    return res.json({ success: true, status: "active" });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to complete passkey registration" });
  }
});

// ─── POST /api/public/device/passkey/login/begin ─────────────────────────────

router.post("/device/passkey/login/begin", async (req, res) => {
  try {
    const { username } = req.body as { username?: string };
    if (!username) return res.status(400).json({ error: "username required" });

    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.username as any, username));
    if (!device || !device.passkeyCredentialId) return res.status(404).json({ error: "No passkey registered for this username" });

    const challenge = randomUUID().replace(/-/g, "");
    await db.update(devicesTable).set({ passkeyChallenge: challenge }).where(eq(devicesTable.id, device.id));

    const rpId = process.env["LAN_IP"] ?? "localhost";

    return res.json({
      challenge,
      rpId,
      timeout: 60000,
      userVerification: "required",
      allowCredentials: [{ type: "public-key", id: device.passkeyCredentialId }],
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to begin passkey login" });
  }
});

// ─── POST /api/public/device/passkey/login/complete ──────────────────────────

router.post("/device/passkey/login/complete", async (req, res) => {
  try {
    const { username, credential } = req.body as {
      username?: string;
      credential?: { id: string; response: { clientDataJSON: string; authenticatorData: string; signature: string }; type: string };
    };
    if (!username || !credential) return res.status(400).json({ error: "username and credential required" });

    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.username as any, username));
    if (!device || !device.passkeyChallenge) return res.status(401).json({ error: "No pending challenge" });
    if (device.status !== "active") return res.status(401).json({ error: "Device not active" });

    // Verify challenge
    const clientData = JSON.parse(Buffer.from(credential.response.clientDataJSON, "base64").toString("utf8"));
    const receivedChallenge = Buffer.from(clientData.challenge, "base64").toString("hex").replace(/-/g, "");
    const storedChallenge = device.passkeyChallenge.replace(/-/g, "");

    if (receivedChallenge !== storedChallenge) {
      await db.insert(auditLogsTable).values({
        eventId: randomUUID(), deviceId: device.id,
        eventType: "device.passkey_challenge_mismatch",
        details: `Passkey challenge mismatch for ${username}`,
        ipAddress: clientIp(req), macAddress: device.mac, severity: "critical",
      });
      return res.status(401).json({ error: "Challenge mismatch" });
    }

    // Verify MAC matches connecting device
    const ip = clientIp(req);
    const currentMac = getMacFromArp(ip);
    if (currentMac && currentMac !== device.mac) {
      await db.insert(auditLogsTable).values({
        eventId: randomUUID(), deviceId: device.id,
        eventType: "device.mac_mismatch_on_login",
        details: `MAC mismatch on passkey login: registered ${device.mac}, connecting ${currentMac} from ${ip}`,
        ipAddress: ip, macAddress: currentMac, severity: "critical",
      });
      return res.status(401).json({ error: "MAC mismatch — login rejected" });
    }

    // Clear challenge, update counter
    await db.update(devicesTable).set({
      passkeyChallenge: null,
      passkeyCounter: (device.passkeyCounter ?? 0) + 1,
      lastSeen: new Date(),
    }).where(eq(devicesTable.id, device.id));

    const jwtSecret = process.env["JWT_SECRET"];
    if (!jwtSecret) throw new Error("JWT_SECRET not configured");

    const token = jwt.sign(
      { device_id: device.id, mac: device.mac, ip, network_id: device.networkId },
      jwtSecret, { expiresIn: "8h" }
    );

    await db.insert(endDeviceSessionsTable).values({
      deviceId: device.id, sessionId: randomUUID(), deviceIp: ip,
    });

    await db.insert(auditLogsTable).values({
      eventId: randomUUID(), deviceId: device.id,
      eventType: "device.passkey_login_success",
      details: `Passkey login successful for ${username} from ${ip}`,
      ipAddress: ip, macAddress: device.mac, severity: "info",
    });

    return res.json({ token, device_id: device.id });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Passkey login failed" });
  }
});

// ─── POST /api/public/device/login/password ──────────────────────────────────

router.post("/device/login/password", async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) return res.status(400).json({ error: "username and password required" });

    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.username as any, username));
    if (!device || !device.passwordHash) return res.status(401).json({ error: "Invalid credentials" });
    // Allow login if active OR if they skipped passkey (approved_awaiting_setup but has password)
    const loginableStatuses = ["active", "vpn_issued", "approved_awaiting_setup"];
    if (!loginableStatuses.includes(device.status)) return res.status(401).json({ error: "Device not active" });

    const ok = await bcrypt.compare(password, device.passwordHash);
    if (!ok) {
      await db.insert(auditLogsTable).values({
        eventId: randomUUID(), deviceId: device.id,
        eventType: "device.password_login_failed",
        details: `Wrong password for ${username}`,
        ipAddress: clientIp(req), macAddress: device.mac, severity: "warning",
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ip = clientIp(req);
    const currentMac = getMacFromArp(ip);
    if (currentMac && currentMac !== device.mac) {
      await db.insert(auditLogsTable).values({
        eventId: randomUUID(), deviceId: device.id,
        eventType: "device.mac_mismatch_on_login",
        details: `MAC mismatch on password login: registered ${device.mac}, connecting ${currentMac}`,
        ipAddress: ip, macAddress: currentMac, severity: "critical",
      });
      return res.status(401).json({ error: "MAC mismatch — login rejected" });
    }

    const jwtSecret = process.env["JWT_SECRET"];
    if (!jwtSecret) throw new Error("JWT_SECRET not configured");

    const token = jwt.sign(
      { device_id: device.id, mac: device.mac, ip, network_id: device.networkId },
      jwtSecret, { expiresIn: "8h" }
    );

    await db.update(devicesTable).set({ lastSeen: new Date() }).where(eq(devicesTable.id, device.id));
    await db.insert(endDeviceSessionsTable).values({ deviceId: device.id, sessionId: randomUUID(), deviceIp: ip });

    return res.json({ token, device_id: device.id });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Login failed" });
  }
});

// ─── POST /api/public/device/verify (legacy — kept for compatibility) ─────────

router.post("/device/verify", async (req, res) => {
  try {
    const { mac, signature } = req.body as { mac?: string; signature?: string };
    if (!mac || !signature) return res.status(400).json({ error: "mac and signature required" });

    const normMac = normaliseMac(mac);
    const ip = clientIp(req);

    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.mac, normMac));
    if (!device || (device.status !== "active" && device.status !== "vpn_issued")) {
      return res.status(401).json({ error: "Device not registered or not approved" });
    }

    const expectedSig = generateDeviceSignature(normMac, device.ip, device.hostname);
    if (expectedSig !== signature) {
      await db.insert(auditLogsTable).values({
        eventId: randomUUID(), deviceId: device.id,
        eventType: "device.credential_mismatch",
        details: `Signature mismatch for ${device.hostname} (${normMac}) from ${ip}`,
        ipAddress: ip, macAddress: normMac, severity: "critical",
      });
      return res.status(401).json({ error: "Signature mismatch" });
    }

    const jwtSecret = process.env["JWT_SECRET"];
    if (!jwtSecret) throw new Error("JWT_SECRET not configured");

    const token = jwt.sign(
      { device_id: device.id, mac: normMac, ip, network_id: device.networkId },
      jwtSecret, { expiresIn: "2h" }
    );

    await db.insert(endDeviceSessionsTable).values({ deviceId: device.id, sessionId: randomUUID(), deviceIp: ip });
    await db.update(devicesTable).set({ lastSeen: new Date() }).where(eq(devicesTable.id, device.id));

    return res.json({ token, device_id: device.id, signature });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Verification failed" });
  }
});

export default router;
