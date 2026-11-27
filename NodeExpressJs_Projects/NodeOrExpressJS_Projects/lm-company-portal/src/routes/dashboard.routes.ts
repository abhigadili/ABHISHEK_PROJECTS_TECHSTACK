import { Router, RequestHandler } from 'express';
import os from 'os';
import { mongodbController } from '../controllers/mongodb.controller';
import { authenticate } from '../middlewares/authenticate.middleware';

const router = Router();
router.use(authenticate as RequestHandler);

router.get('/stats',  mongodbController.dashboardStats as RequestHandler);

router.get('/system', (_req, res) => {
  res.json({
    success: true,
    data: {
      platform:     os.platform(),
      arch:         os.arch(),
      cpus:         os.cpus().length,
      totalMem:     `${Math.round(os.totalmem() / 1024 / 1024)} MB`,
      freeMem:      `${Math.round(os.freemem() / 1024 / 1024)} MB`,
      uptime:       `${Math.floor(os.uptime() / 3600)}h`,
      nodeVersion:  process.version,
      processUptime:`${Math.floor(process.uptime())}s`,
      pid:          process.pid,
    }
  });
});

export default router;
