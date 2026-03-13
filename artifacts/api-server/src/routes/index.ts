import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import profileRouter from "./profile.js";
import servicesRouter from "./services.js";
import ordersRouter from "./orders.js";
import walletRouter from "./wallet.js";
import ticketsRouter from "./tickets.js";
import dashboardRouter from "./dashboard.js";
import miscRouter from "./misc.js";
import adminRouter from "./admin.js";
import apiv2Router from "./apiv2.js";
import sepayRouter from "./sepay.js";
import subdomainsRouter from "./subdomains.js";

const router = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/profile", profileRouter);
router.use("/", servicesRouter);
router.use("/orders", ordersRouter);
router.use("/wallet", walletRouter);
router.use("/tickets", ticketsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/", miscRouter);
router.use("/admin", adminRouter);
router.use("/v2", apiv2Router);
router.use("/webhooks", sepayRouter);
router.use("/subdomains", subdomainsRouter);

export default router;
