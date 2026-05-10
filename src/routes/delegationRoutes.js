import express from "express";
const router = express.Router();

import { 
  getAllDelegations, 
  getDelegationById, 
  createDelegation,
  revokeDelegation,
  getDelegationsByUser 
} from "../controllers/delegationController.js";

import auth from "../middleware/auth.js";
import authorize from "../middleware/roleCheck.js";

// Todas las rutas requieren estar logueado
router.use(auth);
router.get("/", getAllDelegations);
router.get("/user/:userId", getDelegationsByUser);
router.get("/:id", getDelegationById);
router.post("/", authorize("manager", "admin"), createDelegation);
router.delete("/:id", authorize("manager", "admin"), revokeDelegation);

export default router;