import express from "express";
const router = express.Router();

import { 
  getAllRoles, 
  getRoleById, 
  createRole, 
  updateRole, 
  getRoleHierarchy, 
  getRolePermissions, 
  deleteRole 
} from "../controllers/roleController.js";

import auth from "../middleware/auth.js"; 
import authorize from "../middleware/roleCheck.js";

// Aplicar auth a todas las rutas de este router
router.use(auth);

router.get("/", authorize("admin", "manager"), getAllRoles);
router.get("/:id", authorize("admin", "manager"), getRoleById);
router.get("/:id/hierarchy", authorize("admin", "manager"), getRoleHierarchy);
router.get("/:id/permissions", authorize("admin", "manager"), getRolePermissions);
router.post("/", authorize("admin"), createRole);
router.put("/:id", authorize("admin"), updateRole);
router.delete("/:id", authorize("admin"), deleteRole);

export default router;