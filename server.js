import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";

// Base de dades
import connectDB from "./src/config/db.js";

// Rutes
import authRoutes from "./src/routes/authRoutes.js";
import taskRoutes from "./src/routes/taskRoutes.js";
import uploadRoutes from "./src/routes/uploadRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import roleRoutes from "./src/routes/roleRoutes.js";
import permissionRoutes from "./src/routes/permissionRoutes.js";
import delegationRoutes from "./src/routes/delegationRoutes.js";
import auditRoutes from "./src/routes/auditRoutes.js";

// Middlewares
import { errorHandler } from "./src/utils/errorResponse.js";
import auditMiddleware from "./src/middleware/auditMiddleware.js";
import { dynamicRateLimiter, authRateLimiter } from "./src/middleware/rateLimiter.js";

// Seeds
import seedPermissions from "./src/utils/seedPermissions.js";
import seedRoles from "./src/utils/seedRoles.js";

// Servei de delegació (per al cron job)
import delegationService from "./src/services/delegationService.js";

// ─── CONFIGURACIÓ ────────────────────────────────────────────────────────────
dotenv.config();

// ─── BASE DE DADES + SEEDS ────────────────────────────────────────────────────
connectDB().then(async () => {
  await seedPermissions();   // Primer permisos (els rols en depenen)
  await seedRoles();         // Després rols amb jerarquia
});

// ─── APP ──────────────────────────────────────────────────────────────────────
const app = express();

// ── Seguretat HTTP (T9 Fase 8) ────────────────────────────────────────────────
// Helmet afegeix headers de seguretat: CSP, HSTS, X-Frame-Options, etc.
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Parser JSON ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));

// ── Fitxers estàtics ──────────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(path.resolve(), "uploads")));

// ── Auditoria global ──────────────────────────────────────────────────────────
// Ha d'anar ABANS de les rutes per interceptar les respostes
app.use(auditMiddleware);


app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/delegations", delegationRoutes);
app.use("/api/audit", auditRoutes);

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ success: true, status: "OK", timestamp: new Date().toISOString() });
});

// ─── RUTA BENVINGUDA ────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🚀 Task Manager API - T9 JWT Avançat + Jerarquia de Rols",
    version: "4.0.0",
    endpoints: {
      auth:        "/api/auth",
      tasks:       "/api/tasks",
      upload:      "/api/upload",
      admin:       "/api/admin",
      permissions: "/api/admin/permissions",
      roles:       "/api/admin/roles",
      delegations: "/api/admin/delegations",
      auditLogs:   "/api/admin/audit-logs",
    },
  });
});

// ─── RUTES ───────────────────────────────────────────────────────────────────
//
// ORDRE IMPORTANT:
//   1. Rate limiter d'auth ABANS de les rutes d'autenticació
//   2. Rate limiter dinàmic (per rol) DESPRÉS de les rutes d'auth
//      perquè les rutes d'auth no tenen req.user encara
//   3. Rutes públiques (auth)
//   4. Rate limiter dinàmic per a la resta de rutes protegides
//   5. Rutes protegides
//   6. 404 handler
//   7. Error handler

// Auth (rutes públiques — sense dynamicRateLimiter aquí, l'apliquem per ruta específica)
app.use("/api/auth", authRoutes);

// Rate limiting dinàmic per rol per a totes les rutes protegides
// S'aplica DESPRÉS de /api/auth perquè les rutes de login no tenen req.user
app.use("/api/tasks", dynamicRateLimiter, taskRoutes);
app.use("/api/upload", dynamicRateLimiter, uploadRoutes);
app.use("/api/admin", dynamicRateLimiter, adminRoutes);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no trobada`,
  });
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── CRON JOB: Expirar delegacions ───────────────────────────────────────────
// Comprova cada hora si hi ha delegacions que han expirat
// i les marca com 'expired' automàticament
setInterval(async () => {
  try {
    await delegationService.expireOldDelegations();
  } catch (error) {
    console.error("❌ Error en cron job de delegacions:", error.message);
  }
}, 60 * 60 * 1000); // cada hora

// ─── SERVIDOR ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n✅ Servidor T9 corrent a http://localhost:${PORT}`);
  console.log(`📚 Endpoints principals:`);
  console.log(`   🔐 Auth:        http://localhost:${PORT}/api/auth`);
  console.log(`   📋 Tasks:       http://localhost:${PORT}/api/tasks`);
  console.log(`   👥 Admin:       http://localhost:${PORT}/api/admin`);
  console.log(`   🎭 Rols:        http://localhost:${PORT}/api/admin/roles`);
  console.log(`   🔑 Permisos:    http://localhost:${PORT}/api/admin/permissions`);
  console.log(`   🤝 Delegacions: http://localhost:${PORT}/api/admin/delegations`);
  console.log(`   📊 Auditoria:   http://localhost:${PORT}/api/admin/audit-logs\n`);
});