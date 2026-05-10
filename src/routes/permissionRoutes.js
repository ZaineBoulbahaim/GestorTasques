import express from "express";
const router = express.Router();

// Importamos las funciones de tu controlador
import { 
  createPermission, 
  getAllPermissions,
  getPermissionById,
  updatePermission, 
  deletePermission,
  getCategories 
} from "../controllers/permissionController.js";

// Middlewares de seguridad
import auth from "../middleware/auth.js"; 
import authorize from "../middleware/roleCheck.js"; 

// Todas las rutas requieren estar autenticado
router.use(auth);
router.get("/", getAllPermissions);
// Obtenir categories (Extra)
router.get("/categories", getCategories);

// Nota: Tu controlador no tiene getPermissionById, usaremos una genérica o puedes añadirla
router.get("/:id", (req, res, next) => {
    // Si quieres un endpoint específico por ID rápido sin tocar el controller:
    next(); 
}, getPermissionById); 
router.post("/", authorize("admin"), createPermission);
router.put("/:id", authorize("admin"), updatePermission);
router.delete("/:id", authorize("admin"), deletePermission);

export default router;