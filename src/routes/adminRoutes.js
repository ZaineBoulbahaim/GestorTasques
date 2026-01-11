import express from "express";

// Importar controladores de administración
import {
  getAllUsers,
  getAllTasks,
  deleteUser,
  changeUserRole,
  getSystemStats,
} from "../controllers/adminController.js";

// Importar middlewares
import auth from "../middleware/auth.js";
import roleCheck from "../middleware/roleCheck.js";

const router = express.Router();

/** PROTEGER TODAS LAS RUTAS */

// Aplicar auth a todas las rutas
router.use(auth);

// Aplicar verificación de rol admin a todas las rutas
router.use(roleCheck(["admin"]));

/** RUTAS DE ADMINISTRACIÓN*/

/**
 * @route   GET /api/admin/users
 * @desc    Obtener todos los usuarios del sistema
 * @access  Private (Solo Admin)
 */
router.get("/users", getAllUsers);

/**
 * @route   GET /api/admin/tasks
 * @desc    Obtener todas las tareas del sistema
 * @access  Private (Solo Admin)
 */
router.get("/tasks", getAllTasks);

/**
 * @route   GET /api/admin/stats
 * @desc    Obtener estadísticas generales del sistema
 * @access  Private (Solo Admin)
 */
router.get("/stats", getSystemStats);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Eliminar usuario y sus tareas
 * @access  Private (Solo Admin)
 */
router.delete("/users/:id", deleteUser);

/**
 * @route   PUT /api/admin/users/:id/role
 * @desc    Cambiar rol de un usuario
 * @access  Private (Solo Admin)
 * Body: { role: "user" | "admin" }
 */
router.put("/users/:id/role", changeUserRole);

export default router;