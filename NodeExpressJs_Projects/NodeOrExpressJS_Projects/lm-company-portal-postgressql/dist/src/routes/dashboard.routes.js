"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const os_1 = __importDefault(require("os"));
const postgresql_controller_1 = require("../controllers/postgresql.controller");
const authenticate_middleware_1 = require("../middlewares/authenticate.middleware");
const router = (0, express_1.Router)();
router.use(authenticate_middleware_1.authenticate);
router.get('/stats', postgresql_controller_1.postgresqlController.dashboardStats);
router.get('/system', (_req, res) => {
    res.json({
        success: true,
        data: {
            platform: os_1.default.platform(),
            arch: os_1.default.arch(),
            cpus: os_1.default.cpus().length,
            totalMem: `${Math.round(os_1.default.totalmem() / 1024 / 1024)} MB`,
            freeMem: `${Math.round(os_1.default.freemem() / 1024 / 1024)} MB`,
            uptime: `${Math.floor(os_1.default.uptime() / 3600)}h`,
            nodeVersion: process.version,
            processUptime: `${Math.floor(process.uptime())}s`,
            pid: process.pid,
        }
    });
});
exports.default = router;
