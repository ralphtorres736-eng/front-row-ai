import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tracksRouter from "./tracks";
import announcerRouter from "./announcer";
import showsRouter from "./shows";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tracksRouter);
router.use(announcerRouter);
router.use(showsRouter);

export default router;
