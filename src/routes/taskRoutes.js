// src/routes/taskRoutes.js
import express from "express";
import {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTaskStats, // Nueva función de estadísticas
} from "../controllers/taskController.js";

// IMPORTAR MIDDLEWARE DE AUTENTICACIÓN
import auth from "../middleware/auth.js";

const router = express.Router();

/** PROTEGER TODAS LAS RUTAS */
router.use(auth); // Aplica auth a todas las rutas siguientes

/** RUTAS DE TAREAS (Todas protegidas)*/

/**
 * @route   GET /api/tasks/stats
 * @desc    Obtener estadísticas de tareas del usuario
 * @access  Private
 * @note    Esta ruta debe ir ANTES de "/:id" para evitar conflictos
 */
router.get("/stats", getTaskStats);

/**
 * @route   POST /api/tasks
 * @desc    Crear nueva tarea
 * @access  Private
 * Body: { title, description, cost, hours_estimated, image }
 */
router.post("/", createTask);

/**
 * @route   GET /api/tasks
 * @desc    Obtener todas las tareas del usuario autenticado
 * @access  Private
 */
router.get("/", getAllTasks);

/**
 * @route   GET /api/tasks/:id
 * @desc    Obtener tarea por ID (solo si pertenece al usuario)
 * @access  Private
 */
router.get("/:id", getTaskById);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Actualizar tarea por ID (solo si pertenece al usuario)
 * @access  Private
 * Body: { title, description, cost, hours_estimated, completed }
 */
router.put("/:id", updateTask);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Eliminar tarea por ID (solo si pertenece al usuario)
 * @access  Private
 */
router.delete("/:id", deleteTask);

export default router;