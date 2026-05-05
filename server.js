// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Importar configuración de base de datos
import connectDB from "./src/config/db.js";

// IMPORTAR RUTAS
import taskRoutes from "./src/routes/taskRoutes.js";
import uploadRoutes from "./src/routes/uploadRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";

// IMPORTAR MIDDLEWARE DE ERRORES
import { errorHandler } from "./src/utils/errorResponse.js";

// ← NOU: IMPORTAR MIDDLEWARE D'AUDITORIA
import auditMiddleware from "./src/middleware/auditMiddleware.js";

// ← NOU: IMPORTAR SEEDS
import seedPermissions from "./src/utils/seedPermissions.js";
import seedRoles from "./src/utils/seedRoles.js";

// Cargar variables de entorno
dotenv.config();

// Conectar a MongoDB
connectDB();

// ← NOU: EJECUTAR SEEDS después de conectar a MongoDB
// Los seeds crean automáticamente los permisos y roles del sistema
// si no existen todavía
connectDB().then(async () => {
  // Primero crear permisos (los roles dependen de los permisos)
  await seedPermissions();
  // Luego crear roles con los permisos asignados
  await seedRoles();
});

// Crear aplicación Express
const app = express();

/** MIDDLEWARES GLOBALES */

// CORS - Permitir peticiones desde otros orígenes
app.use(cors());

// Parser de JSON - Permite leer req.body
app.use(express.json());

// Servir archivos estáticos (imágenes subidas localmente)
app.use("/uploads", express.static(path.join(path.resolve(), "uploads")));

// ← NOU: MIDDLEWARE D'AUDITORIA GLOBAL
// IMPORTANTE: Debe ir ANTES de las rutas para interceptar las respuestas
// Este middleware registra automáticamente todas las acciones importantes
app.use(auditMiddleware);

/** RUTAS DE LA API
  ORDEN IMPORTANTE:
 1. Middleware globales (CORS, JSON, Auditoria)
 2. Rutas públicas (auth)
 3. Rutas protegidas (tasks, upload, admin)
 4. Middleware de errores (al final)
*/

// Ruta de bienvenida (opcional)
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🚀 API del Gestor de Tareas funcionando correctamente",
    version: "3.0.0",                    // ← MODIFICAT: Nueva versión
    endpoints: {
      auth: "/api/auth",
      tasks: "/api/tasks",
      upload: "/api/upload",
      admin: "/api/admin",
      // ← NOU: Documentar nuevos endpoints
      permissions: "/api/admin/permissions",
      roles: "/api/admin/roles",
      auditLogs: "/api/admin/audit-logs",
    },
  });
});

// RUTAS DE AUTENTICACIÓN (públicas)
app.use("/api/auth", authRoutes);

// Rutas de subida de imágenes (protegidas con auth)
app.use("/api/upload", uploadRoutes);

// RUTAS DE TAREAS (protegidas con auth + checkPermission)
app.use("/api/tasks", taskRoutes);

// RUTAS DE ADMINISTRACIÓN (protegidas con auth + checkPermission)
app.use("/api/admin", adminRoutes);

/**
MANEJO DE RUTAS NO ENCONTRADAS (404)
Este middleware captura cualquier ruta que no coincida
con las rutas definidas arriba */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`,
  });
});

/**
MIDDLEWARE DE MANEJO DE ERRORES
IMPORTANTE: Debe ir AL FINAL, después de todas las rutas
Captura todos los errores que ocurran en la aplicación */
app.use(errorHandler);

/** INICIAR SERVIDOR */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📚 Documentación de rutas:`);
  console.log(`   - Auth: http://localhost:${PORT}/api/auth`);
  console.log(`   - Tasks: http://localhost:${PORT}/api/tasks`);
  console.log(`   - Upload: http://localhost:${PORT}/api/upload`);
  console.log(`   - Admin: http://localhost:${PORT}/api/admin`);
  console.log(`   - Permissions: http://localhost:${PORT}/api/admin/permissions`);  // ← NOU
  console.log(`   - Roles: http://localhost:${PORT}/api/admin/roles`);              // ← NOU
  console.log(`   - Audit Logs: http://localhost:${PORT}/api/admin/audit-logs`);    // ← NOU
});