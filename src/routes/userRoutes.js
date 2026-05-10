import express from "express";
const router = express.Router();

import { 
  getUserById, 
  getAllUsers, 
  updateUser, 
  getUserPermissions, // <-- Verifica que esté importado
  deleteUser 
} from "../controllers/adminController.js";

import auth from "../middleware/auth.js"; 
import authorize from "../middleware/roleCheck.js"; 

// IMPORTANTE: Definir las rutas específicas ANTES que las genéricas si fuera necesario
router.get("/:id/permissions", auth, authorize("admin", "manager"), getUserPermissions);
router.get("/:id", auth, authorize("admin", "manager"), getUserById);
router.put("/:id", auth, authorize("admin"), updateUser);
router.delete("/:id", auth, authorize("admin"), deleteUser);

export default router;