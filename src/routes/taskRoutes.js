// src/routes/taskRoutes.js
import express from "express";
import {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTaskStats,
} from "../controllers/taskController.js";

import auth from "../middleware/auth.js";
import checkPermission from "../middleware/checkPermission.js";

const router = express.Router();

// PROTECCIÓ GLOBAL DE RUTES
// Totes les rutes de tasques requereixen que l'usuari estigui autenticat
router.use(auth);

/* ------------------------------------------------------------
   RUTES DE TASQUES (Control d'accés granular)
------------------------------------------------------------ */

// Estadístiques de les tasques de l'usuari
// Es col·loca abans de /:id per evitar que "stats" es confongui amb un ID
router.get("/stats", checkPermission("tasks:read"), getTaskStats);

// Crear una nova tasca
router.post("/", checkPermission("tasks:create"), createTask);

// Llistar totes les tasques de l'usuari
router.get("/", checkPermission("tasks:read"), getAllTasks);

// Obtenir una tasca específica per ID
router.get("/:id", checkPermission("tasks:read"), getTaskById);

// Actualitzar una tasca existent
router.put("/:id", checkPermission("tasks:update"), updateTask);

// Eliminar una tasca
router.delete("/:id", checkPermission("tasks:delete"), deleteTask);

export default router;