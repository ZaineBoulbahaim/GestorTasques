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
import authRoutes from "./src/routes/authRoutes.js";     // ⬅️ NUEVO
import adminRoutes from "./src/routes/adminRoutes.js";   // ⬅️ NUEVO

// IMPORTAR MIDDLEWARE DE ERRORES

import { errorHandler } from "./src/utils/errorResponse.js"; // ⬅️ NUEVO

// Cargar variables de entorno
dotenv.config();

// Conectar a MongoDB
connectDB();

// Crear aplicación Express
const app = express();

/** MIDDLEWARES GLOBALES */

// CORS - Permitir peticiones desde otros orígenes
app.use(cors());

// Parser de JSON - Permite leer req.body
app.use(express.json());

// Servir archivos estáticos (imágenes subidas localmente)
app.use("/uploads", express.static(path.join(path.resolve(), "uploads")));

/** RUTAS DE LA API
  ORDEN IMPORTANTE:
 1. Rutas públicas primero (auth)
 2. Rutas protegidas después (tasks, upload)
 3. Rutas de admin al final */

// Ruta de bienvenida (opcional)
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🚀 API del Gestor de Tareas funcionando correctamente",
    version: "2.0.0",
    endpoints: {
      auth: "/api/auth",
      tasks: "/api/tasks",
      upload: "/api/upload",
      admin: "/api/admin",
    },
  });
});

// RUTAS DE AUTENTICACIÓN (públicas)
app.use("/api/auth", authRoutes);

// Rutas de subida de imágenes (ahora protegidas con auth dentro de taskRoutes)
app.use("/api/upload", uploadRoutes);

// RUTAS DE TAREAS (protegidas con auth)
app.use("/api/tasks", taskRoutes);

// RUTAS DE ADMINISTRACIÓN (protegidas con auth + roleCheck)
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

/** INICIAR SERVIDOR*/
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📚 Documentación de rutas:`);
  console.log(`   - Auth: http://localhost:${PORT}/api/auth`);
  console.log(`   - Tasks: http://localhost:${PORT}/api/tasks`);
  console.log(`   - Upload: http://localhost:${PORT}/api/upload`);
  console.log(`   - Admin: http://localhost:${PORT}/api/admin`);
});