import express from "express";
const router = express.Router();

// Importamos los controladores que ya tienes creados
import { 
  getAuditLogs, 
  getAuditStats, 
  exportAuditLogs 
} from "../controllers/auditController.js";

// Importamos tus middlewares de seguridad
import auth from "../middleware/auth.js";
import authorize from "../middleware/roleCheck.js";

// Aplicamos seguridad: Solo los Logueados Y que sean ADMINS pueden entrar
router.use(auth, authorize("admin"));

// GET /api/audit/logs
router.get("/logs", getAuditLogs);

// GET /api/audit/stats
router.get("/stats", getAuditStats);

// GET /api/audit/export
router.get("/export", exportAuditLogs);

export default router;