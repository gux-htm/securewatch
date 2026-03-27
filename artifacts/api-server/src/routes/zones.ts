import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { networkZonesTable, insertNetworkZoneSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const zones = await db.select().from(networkZonesTable).orderBy(networkZonesTable.name);
    res.json(zones);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list network zones" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertNetworkZoneSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [zone] = await db.insert(networkZonesTable).values(parsed.data).returning();
    res.status(201).json(zone);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create network zone" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(networkZonesTable).where(eq(networkZonesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete network zone" });
  }
});

// CIDR IP match check for auth layer 2
router.post("/check-ip", async (req, res) => {
  try {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: "ip is required" });

    const zones = await db.select().from(networkZonesTable);

    function ipToInt(ip: string): number {
      return ip.split(".").reduce((acc, oct) => (acc << 8) | parseInt(oct), 0) >>> 0;
    }

    function cidrMatch(ip: string, cidr: string): boolean {
      const [base, prefix] = cidr.split("/");
      const mask = prefix ? ~((1 << (32 - parseInt(prefix))) - 1) >>> 0 : 0xFFFFFFFF;
      return (ipToInt(ip) & mask) === (ipToInt(base) & mask);
    }

    const matchedZone = zones.find(z => {
      try { return cidrMatch(ip, z.cidr); } catch { return false; }
    });

    res.json({ allowed: !!matchedZone, zone: matchedZone || null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to check IP against zones" });
  }
});

export default router;
