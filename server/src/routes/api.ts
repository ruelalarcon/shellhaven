import { Router, Request, Response } from "express";
import {
  startService,
  stopService,
  restartService,
  startAll,
  stopAll,
  getServiceStates,
} from "../services/serviceManager";

const router = Router();

router.get("/services", (req: Request, res: Response) => {
  res.json(getServiceStates());
});

router.post("/services/start-all", (req: Request, res: Response) => {
  startAll();
  res.json({ ok: true });
});

router.post("/services/stop-all", (req: Request, res: Response) => {
  stopAll();
  res.json({ ok: true });
});

router.post("/services/:id/start", (req: Request, res: Response) => {
  const ok = startService(req.params.id);
  res.json({ ok });
});

router.post("/services/:id/stop", (req: Request, res: Response) => {
  const ok = stopService(req.params.id);
  res.json({ ok });
});

router.post("/services/:id/restart", (req: Request, res: Response) => {
  const ok = restartService(req.params.id);
  res.json({ ok });
});

export default router;
