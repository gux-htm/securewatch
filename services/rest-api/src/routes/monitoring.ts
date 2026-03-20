import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryOne } from '../db/mysql';
import { authenticate } from '../middleware/authenticate';

interface AlertCounts { critical: number; high: number; medium: number; low: number; info: number; unacknowledged: number; }
interface SessionCount { active: number; }
interface DeviceCounts { trusted: number; untrusted: number; pending: number; }

export async function monitoringRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/monitoring/summary', { preHandler: authenticate }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user;
    if (!user) return reply.status(401).send({ error: 'Access Denied' });
    const [alerts, sessions, devices] = await Promise.all([
      queryOne<AlertCounts>(`SELECT SUM(severity='CRITICAL') AS critical, SUM(severity='HIGH') AS high, SUM(severity='MEDIUM') AS medium, SUM(severity='LOW') AS low, SUM(severity='INFO') AS info, SUM(acknowledged_at IS NULL) AS unacknowledged FROM alerts WHERE tenant_id = ?`, [user.tenantId]),
      queryOne<SessionCount>(`SELECT COUNT(*) AS active FROM active_sessions WHERE tenant_id = ? AND ended_at IS NULL`, [user.tenantId]),
      queryOne<DeviceCounts>(`SELECT SUM(status='TRUSTED') AS trusted, SUM(status='UNTRUSTED') AS untrusted, SUM(status='PENDING') AS pending FROM devices WHERE tenant_id = ?`, [user.tenantId]),
    ]);
    return reply.send({
      alerts: { critical: Number(alerts?.critical ?? 0), high: Number(alerts?.high ?? 0), medium: Number(alerts?.medium ?? 0), low: Number(alerts?.low ?? 0), info: Number(alerts?.info ?? 0), unacknowledged: Number(alerts?.unacknowledged ?? 0) },
      sessions: { active: Number(sessions?.active ?? 0) },
      devices: { trusted: Number(devices?.trusted ?? 0), untrusted: Number(devices?.untrusted ?? 0), pending: Number(devices?.pending ?? 0) },
    });
  });
}
