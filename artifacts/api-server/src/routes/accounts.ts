import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { accountsTable, insertAccountSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { createHmac } from "crypto";
import bcrypt from "bcrypt";

const router: IRouter = Router();

async function hashPassword(pwd: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(pwd, saltRounds);
}

router.get("/", async (req, res) => {
  try {
    const accounts = await db.select({
      id: accountsTable.id,
      username: accountsTable.username,
      email: accountsTable.email,
      role: accountsTable.role,
      status: accountsTable.status,
      mfaEnabled: accountsTable.mfaEnabled,
      failedLoginCount: accountsTable.failedLoginCount,
      lastLogin: accountsTable.lastLogin,
      createdAt: accountsTable.createdAt,
    }).from(accountsTable);
    res.json(accounts);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list accounts" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    if (!password) return res.status(400).json({ error: "password is required" });
    const data = { ...rest, passwordHash: await hashPassword(password) };
    const parsed = insertAccountSchema.safeParse(data);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [account] = await db.insert(accountsTable).values(parsed.data).returning({
      id: accountsTable.id,
      username: accountsTable.username,
      email: accountsTable.email,
      role: accountsTable.role,
      status: accountsTable.status,
      mfaEnabled: accountsTable.mfaEnabled,
      createdAt: accountsTable.createdAt,
    });
    res.status(201).json(account);
  } catch (err: any) {
    req.log.error(err);
    if (err.code === "23505") return res.status(409).json({ error: "Username or email already exists" });
    res.status(500).json({ error: "Failed to create account" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const allowed = ["email", "role"];
    const updates: any = {};
    for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    const [account] = await db.update(accountsTable).set(updates).where(eq(accountsTable.id, Number(req.params.id))).returning();
    if (!account) return res.status(404).json({ error: "Account not found" });
    res.json(account);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update account" });
  }
});

router.post("/:id/suspend", async (req, res) => {
  try {
    const [account] = await db.update(accountsTable).set({ status: "suspended" }).where(eq(accountsTable.id, Number(req.params.id))).returning();
    if (!account) return res.status(404).json({ error: "Account not found" });
    res.json(account);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to suspend account" });
  }
});

router.post("/:id/reactivate", async (req, res) => {
  try {
    const [account] = await db.update(accountsTable).set({ status: "active", failedLoginCount: 0 }).where(eq(accountsTable.id, Number(req.params.id))).returning();
    if (!account) return res.status(404).json({ error: "Account not found" });
    res.json(account);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to reactivate account" });
  }
});

router.post("/:id/revoke", async (req, res) => {
  try {
    const [account] = await db.update(accountsTable).set({ status: "revoked" }).where(eq(accountsTable.id, Number(req.params.id))).returning();
    if (!account) return res.status(404).json({ error: "Account not found" });
    res.json(account);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to revoke account" });
  }
});

export default router;
