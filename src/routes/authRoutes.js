// src/routes/authRoutes.js
import express from "express";

// Importar controladores de autenticació
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  checkUserPermission,
} from "../controllers/authController.js";

// Importar validadors i middlewares
import {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  handleValidationErrors,
} from "../middleware/validators/authValidators.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/* ------------------------------------------------------------
   RUTES PÚBLIQUES
------------------------------------------------------------ */

// Registrar nou usuari
router.post(
  "/register",
  registerValidation,
  handleValidationErrors,
  register
);

// Iniciar sessió
router.post(
  "/login",
  loginValidation,
  handleValidationErrors,
  login
);

/* ------------------------------------------------------------
   RUTES PROTEGIDES (Requereixen Token)
------------------------------------------------------------ */

// Obtenir perfil de l'usuari actual
router.get("/me", auth, getMe);

// Actualitzar perfil (nom, email, etc.)
router.put(
  "/profile",
  auth,
  updateProfileValidation,
  handleValidationErrors,
  updateProfile
);

// Canviar contrasenya
router.put(
  "/change-password",
  auth,
  changePasswordValidation,
  handleValidationErrors,
  changePassword
);

/* ------------------------------------------------------------
   VERIFICACIÓ DE SEGURETAT PER AL FRONTEND
------------------------------------------------------------ */

/**
 * Verifica si l'usuari té un permís específic.
 * Útil per mostrar/amagar botons o seccions a la interfície.
 * Body: { "permission": "tasks:delete" }
 */
router.post("/check-permission", auth, checkUserPermission);

export default router;