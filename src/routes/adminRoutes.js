// src/routes/adminRoutes.js
import express from "express";
import User from "../models/User.js";
import Role from "../models/Role.js";

import {
  getAllUsers,
  getAllTasks,
  deleteUser,
  changeUserRole,
  getSystemStats,
} from "../controllers/adminController.js";

import {
  createPermission,
  getAllPermissions,
  getCategories,
  updatePermission,
  deletePermission,
} from "../controllers/permissionController.js";

import {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
  addPermissionToRole,
  removePermissionFromRole,
} from "../controllers/roleController.js";

import {
  getAuditLogs,
  getAuditLogById,
  getUserAuditLogs,
  getAuditStats,
} from "../controllers/auditController.js";

import auth from "../middleware/auth.js";
import roleCheck from "../middleware/roleCheck.js";
import checkPermission from "../middleware/checkPermission.js";

const router = express.Router();

// PROTECCIÓ GLOBAL
router.use(auth);

/* ------------------------------------------------------------
   RUTES D'ADMINISTRACIÓ D'USUARIS (Legacy / Compatibilitat)
------------------------------------------------------------ */

// Obtenir tots els usuaris
router.get("/users", roleCheck(["admin"]), getAllUsers);

// Obtenir totes les tasques
router.get("/tasks", roleCheck(["admin"]), getAllTasks);

// Estadístiques generals del sistema
router.get("/stats", roleCheck(["admin"]), getSystemStats);

// Eliminar usuari i les seves tasques
router.delete("/users/:id", roleCheck(["admin"]), deleteUser);

// Canviar rol d'un usuari (Camp 'role' antic)
router.put("/users/:id/role", roleCheck(["admin"]), changeUserRole);

/* ------------------------------------------------------------
   GESTIÓ DE ROLS PER A USUARIS
------------------------------------------------------------ */

// Assignar un rol a un usuari
router.post(
  "/users/:userId/roles",
  checkPermission("users:manage"),
  (req, res) => {
    const { userId } = req.params;
    const { roleId } = req.body;
    let userFound;

    Role.findById(roleId)
      .then((role) => {
        if (!role) {
          return res.status(404).json({ success: false, message: "Rol no trobat" });
        }
        return User.findById(userId);
      })
      .then((user) => {
        if (!user) {
          return res.status(404).json({ success: false, message: "Usuari no trobat" });
        }
        userFound = user;
        return user.addRole(roleId);
      })
      .then(() => {
        return User.findById(userFound._id).populate("roles");
      })
      .then((updatedUser) => {
        if (!updatedUser) return;
        res.json({
          success: true,
          message: "Rol assignat correctament",
          data: {
            userId: updatedUser._id,
            roles: updatedUser.roles.map((r) => ({ id: r._id, name: r.name })),
          },
        });
      })
      .catch((error) => {
        res.status(500).json({ success: false, message: "Error al assignar rol", error: error.message });
      });
  }
);

// Eliminar un rol d'un usuari
router.delete(
  "/users/:userId/roles/:roleId",
  checkPermission("users:manage"),
  (req, res) => {
    const { userId, roleId } = req.params;
    let userFound;

    User.findById(userId)
      .populate("roles")
      .then((user) => {
        if (!user) {
          return res.status(404).json({ success: false, message: "Usuari no trobat" });
        }
        if (user.roles.length <= 1) {
          return res.status(400).json({ success: false, message: "L'usuari ha de tenir almenys un rol" });
        }
        userFound = user;
        return user.removeRole(roleId);
      })
      .then(() => {
        return User.findById(userFound._id).populate("roles");
      })
      .then((updatedUser) => {
        if (!updatedUser) return;
        res.json({
          success: true,
          message: "Rol eliminat correctament",
          data: {
            userId: updatedUser._id,
            roles: updatedUser.roles.map((r) => ({ id: r._id, name: r.name })),
          },
        });
      })
      .catch((error) => {
        res.status(500).json({ success: false, message: "Error al eliminar rol", error: error.message });
      });
  }
);

// Obtenir tots els permisos efectius d'un usuari
router.get(
  "/users/:userId/permissions",
  checkPermission("users:read"),
  (req, res) => {
    const { userId } = req.params;

    User.findById(userId)
      .populate({
        path: "roles",
        populate: { path: "permissions" },
      })
      .then((user) => {
        if (!user) {
          return res.status(404).json({ success: false, message: "Usuari no trobat" });
        }
        const permissions = user.getEffectivePermissions();
        res.json({
          success: true,
          data: { userId: user._id, userName: user.name, permissions },
        });
      })
      .catch((error) => {
        res.status(500).json({ success: false, message: "Error al obtenir permisos", error: error.message });
      });
  }
);

/* ------------------------------------------------------------
   GESTIÓ DE PERMISOS
------------------------------------------------------------ */

// Crear nou permís
router.post("/permissions", checkPermission("permissions:manage"), createPermission);

// Obtenir tots els permisos
router.get("/permissions", checkPermission("permissions:read"), getAllPermissions);

// Obtenir categories de permisos
router.get("/permissions/categories", checkPermission("permissions:read"), getCategories);

// Actualitzar permís
router.put("/permissions/:id", checkPermission("permissions:manage"), updatePermission);

// Eliminar permís
router.delete("/permissions/:id", checkPermission("permissions:manage"), deletePermission);

/* ------------------------------------------------------------
   GESTIÓ DE ROLS
------------------------------------------------------------ */

// Crear nou rol
router.post("/roles", checkPermission("roles:manage"), createRole);

// Obtenir tots els rols
router.get("/roles", roleCheck(["admin"]), getAllRoles);

// Obtenir rol específic
router.get("/roles/:id", checkPermission("roles:read"), getRoleById);

// Actualitzar rol
router.put("/roles/:id", checkPermission("roles:manage"), updateRole);

// Eliminar rol
router.delete("/roles/:id", checkPermission("roles:manage"), deleteRole);

// Afegir permís a rol
router.post("/roles/:id/permissions", checkPermission("roles:manage"), addPermissionToRole);

// Eliminar permís de rol
router.delete("/roles/:id/permissions/:permissionId", checkPermission("roles:manage"), removePermissionFromRole);

/* ------------------------------------------------------------
   AUDITORIA I LOGS
------------------------------------------------------------ */

// Obtenir logs d'auditoria
router.get("/audit-logs", checkPermission("audit:read"), getAuditLogs);

// Estadístiques d'auditoria (Abans de :id)
router.get("/audit-logs/stats", checkPermission("audit:read"), getAuditStats);

// Obtenir log específic
router.get("/audit-logs/:id", checkPermission("audit:read"), getAuditLogById);

// Obtenir logs d'un usuari
router.get("/audit-logs/user/:userId", checkPermission("audit:read"), getUserAuditLogs);

export default router;