import { Router, type IRouter } from "express";
import healthRouter from "./health";
import devicesRouter from "./devices";
import networksRouter from "./networks";
import firewallRouter from "./firewall";
import idsRouter from "./ids";
import filesRouter from "./files";
import auditRouter from "./audit";
import policiesRouter from "./policies";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/devices", devicesRouter);
router.use("/networks", networksRouter);
router.use("/firewall", firewallRouter);
router.use("/ids", idsRouter);
router.use("/files", filesRouter);
router.use("/audit", auditRouter);
router.use("/policies", policiesRouter);
router.use("/dashboard", dashboardRouter);

export default router;
