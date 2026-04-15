import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { networksTable, devicesTable, insertNetworkSchema } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const networks = await db.select().from(networksTable);
    const withCount = await Promise.all(
      networks.map(async (n) => {
        const [{ value }] = await db.select({ value: count() }).from(devicesTable).where(eq(devicesTable.networkId, n.id));
        return { ...n, deviceCount: Number(value) };
      })
    );
    return res.json(withCount);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to list networks" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertNetworkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [network] = await db.insert(networksTable).values(parsed.data).returning();
    return res.status(201).json({ ...network, deviceCount: 0 });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to create network" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [network] = await db.select().from(networksTable).where(eq(networksTable.id, Number(req.params.id)));
    if (!network) return res.status(404).json({ error: "Network not found" });
    const [{ value }] = await db.select({ value: count() }).from(devicesTable).where(eq(devicesTable.networkId, network.id));
    return res.json({ ...network, deviceCount: Number(value) });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to get network" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const networkId = Number(req.params.id);
    await db.update(devicesTable).set({ networkId: null }).where(eq(devicesTable.networkId, networkId));
    await db.delete(networksTable).where(eq(networksTable.id, networkId));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to delete network" });
  }
});

router.post("/:id/generate-ovpn", async (req, res) => {
  try {
    const [network] = await db.select().from(networksTable).where(eq(networksTable.id, Number(req.params.id)));
    if (!network) return res.status(404).json({ error: "Network not found" });

    const { deviceId, commonName } = req.body as { deviceId?: number; commonName?: string };
    const now = new Date();

    const ovpnConfig = `# Oh-My-Guard! Generated OVPN Configuration
# Network: ${network.name}
# Device: ${commonName}
# Generated: ${now.toISOString()}
client
dev tun
proto ${network.protocol}
remote vpn.oh-my-guard.internal ${network.port}
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
cipher AES-256-GCM
auth SHA256
tls-version-min 1.3
verb 3
`;

    return res.json({
      deviceId,
      networkId: network.id,
      commonName,
      config: ovpnConfig,
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to generate OVPN config" });
  }
});

export default router;
