// Importamos las funciones de validación de express-validator
import { body, validationResult } from "express-validator";

/**
 * VALIDACIÓN PARA REGISTRO DE USUARIO
 * Valida: email, password y name (opcional)
 */
export const registerValidation = [
  // Email: debe ser válido y obligatorio
  body("email")
    .isEmail().withMessage("Email no válido")
    .normalizeEmail(), // Convierte a minúsculas y limpia

  // Contraseña: mínimo 6 caracteres
  body("password")
    .isLength({ min: 6 }).withMessage("La contraseña debe tener mínimo 6 caracteres")
    .trim(),

  // Nombre: opcional, pero si se envía debe tener mínimo 2 caracteres
  body("name")
    .optional()
    .isLength({ min: 2 }).withMessage("El nombre debe tener mínimo 2 caracteres")
    .trim(),
];

/**
 * VALIDACIÓN PARA LOGIN
 * Valida: email y password obligatorios
 */
export const loginValidation = [
  // Email: debe ser válido y no estar vacío
  body("email")
    .notEmpty().withMessage("El email es obligatorio")
    .isEmail().withMessage("Email no válido")
    .normalizeEmail(),

  // Contraseña: no puede estar vacía
  body("password")
    .notEmpty().withMessage("La contraseña es obligatoria")
    .trim(),
];

/**
 * VALIDACIÓN PARA CAMBIAR CONTRASEÑA
 * Valida: currentPassword y newPassword
 */
export const changePasswordValidation = [
  // Contraseña actual: obligatoria
  body("currentPassword")
    .notEmpty().withMessage("La contraseña actual es obligatoria")
    .trim(),

  // Nueva contraseña: mínimo 6 caracteres
  body("newPassword")
    .isLength({ min: 6 }).withMessage("La nueva contraseña debe tener mínimo 6 caracteres")
    .trim(),
];

/**
 * VALIDACIÓN PARA ACTUALIZAR PERFIL
 * Valida: email y name (ambos opcionales)
 */
export const updateProfileValidation = [
  // Email: si se envía, debe ser válido
  body("email")
    .optional()
    .isEmail().withMessage("Email no válido")
    .normalizeEmail(),

  // Nombre: si se envía, mínimo 2 caracteres
  body("name")
    .optional()
    .isLength({ min: 2 }).withMessage("El nombre debe tener mínimo 2 caracteres")
    .trim(),
];

/**
 * MIDDLEWARE PARA MANEJAR ERRORES DE VALIDACIÓN
 * Se ejecuta después de las validaciones
 * Si hay errores, los devuelve en formato JSON
 */
export const handleValidationErrors = (req, res, next) => {
  // Obtener errores de validación
  const errors = validationResult(req);

  // Si hay errores, devolver respuesta con los errores
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }

  // Si no hay errores, continuar
  next();
};