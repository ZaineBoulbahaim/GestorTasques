import express from "express";

// Importar controladores de autenticación
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
} from "../controllers/authController.js";

// Importar validadores
import {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  handleValidationErrors,
} from "../middleware/validators/authValidators.js";

// Importar middleware de autenticación
import auth from "../middleware/auth.js";

const router = express.Router();

/** RUTAS PÚBLICAS (No requieren autenticación) */

/**
 * @route   POST /api/auth/register
 * @desc    Registrar nuevo usuario
 * @access  Public
 */
router.post(
  "/register",
  registerValidation,        // Validar datos de entrada
  handleValidationErrors,    // Manejar errores de validación
  register                   // Ejecutar controlador
);

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión
 * @access  Public
 */
router.post(
  "/login",
  loginValidation,           // Validar datos de entrada
  handleValidationErrors,    // Manejar errores de validación
  login                      // Ejecutar controlador
);

/** RUTAS PROTEGIDAS (Requieren autenticación)*/

/**
 * @route   GET /api/auth/me
 * @desc    Obtener perfil del usuario actual
 * @access  Private (requiere token)
 */
router.get("/me", auth, getMe);

/**
 * @route   PUT /api/auth/profile
 * @desc    Actualizar perfil de usuario
 * @access  Private (requiere token)
 */
router.put(
  "/profile",
  auth,                      // Verificar autenticación
  updateProfileValidation,   // Validar datos
  handleValidationErrors,    // Manejar errores
  updateProfile              // Ejecutar controlador
);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Cambiar contraseña
 * @access  Private (requiere token)
 */
router.put(
  "/change-password",
  auth,                       // Verificar autenticación
  changePasswordValidation,   // Validar datos
  handleValidationErrors,     // Manejar errores
  changePassword              // Ejecutar controlador
);

export default router;