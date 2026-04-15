import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { networkZonesTable, insertNetworkZoneSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const zones = await db.select().from(networkZonesTable).orderBy(networkZonesTable.name);
    return res.json(zones);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to list network zones" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertNetworkZoneSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [zone] = await db.insert(networkZonesTable).values(parsed.data).returning();
    return res.status(201).json(zone);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to create network zone" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(networkZonesTable).where(eq(networkZonesTable.id, Number(req.params.id)));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to delete network zone" });
  }
});

router.post("/check-ip", async (req, res) => {
  try {
    const { ip } = req.body as { ip?: string };
    if (!ip) return res.status(400).json({ error: "ip is required" });

    const zones = await db.select().from(networkZonesTable);

    function ipToInt(addr: string): number {
      return addr.split(".").reduce((acc, oct) => (acc << 8) | parseInt(oct, 10), 0) >>> 0;
    }

    function cidrMatch(addr: string, cidr: string): boolean {
      const [base, prefix] = cidr.split("/");
      if (!base) return false;
      const mask = prefix ? (~((1 << (32 - parseInt(prefix, 10))) - 1)) >>> 0 : 0xFFFFFFFF;
      return (ipToInt(addr) & mask) === (ipToInt(base) & mask);
    }

    const matchedZone = zones.find(z => {
      try { return cidrMatch(ip, z.cidr); } catch { return false; }
    });

    return res.json({ allowed: !!matchedZone, zone: matchedZone ?? null });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to check IP against zones" });
  }
});

export default router;
