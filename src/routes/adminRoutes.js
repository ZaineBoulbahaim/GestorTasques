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
  getRoleHierarchyEndpoint,
  getRolePermissionsEndpoint,
} from "../controllers/roleController.js";

import {
  getAuditLogs,
  getAuditLogById,
  getUserAuditLogs,
  getAuditStats,
  getUserAuditStats,
  exportAuditLogs,
} from "../controllers/auditController.js";

import {
  getAllDelegations,
  getDelegationById,
  createDelegation,
  revokeDelegation,
  getDelegationsByUser,
} from "../controllers/delegationController.js";

import auth from "../middleware/auth.js";
import roleCheck from "../middleware/roleCheck.js";
import checkPermission from "../middleware/checkPermission.js";

const router = express.Router();

// PROTECCIÓ GLOBAL: totes les rutes d'admin requereixen autenticació
router.use(auth);

/* ============================================================
   USUARIS
============================================================ */

// Llistar tots els usuaris
router.get("/users", roleCheck(["admin"]), getAllUsers);

// Totes les tasques del sistema
router.get("/tasks", roleCheck(["admin"]), getAllTasks);

// Estadístiques generals
router.get("/stats", roleCheck(["admin"]), getSystemStats);

// Eliminar usuari
router.delete("/users/:id", roleCheck(["admin"]), deleteUser);

// Canviar rol simple (camp 'role' de compatibilitat T7/T8)
router.put("/users/:id/role", roleCheck(["admin"]), changeUserRole);

// Assignar rol nou (sistema T9)
router.post("/users/:userId/roles", checkPermission("users:manage"), (req, res) => {
  const { userId } = req.params;
  const { roleId } = req.body;
  let userFound;

  Role.findById(roleId)
    .then((role) => {
      if (!role) return res.status(404).json({ success: false, message: "Rol no trobat" });
      return User.findById(userId);
    })
    .then((user) => {
      if (!user) return res.status(404).json({ success: false, message: "Usuari no trobat" });
      userFound = user;
      return user.addRole(roleId);
    })
    .then(() => User.findById(userFound._id).populate("roles"))
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
    .catch((error) =>
      res.status(500).json({ success: false, message: "Error al assignar rol", error: error.message })
    );
});

// Eliminar rol d'un usuari
router.delete("/users/:userId/roles/:roleId", checkPermission("users:manage"), (req, res) => {
  const { userId, roleId } = req.params;
  let userFound;

  User.findById(userId)
    .populate("roles")
    .then((user) => {
      if (!user) return res.status(404).json({ success: false, message: "Usuari no trobat" });
      if (user.roles.length <= 1)
        return res.status(400).json({ success: false, message: "L'usuari ha de tenir almenys un rol" });
      userFound = user;
      return user.removeRole(roleId);
    })
    .then(() => User.findById(userFound._id).populate("roles"))
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
    .catch((error) =>
      res.status(500).json({ success: false, message: "Error al eliminar rol", error: error.message })
    );
});

// Obtenir permisos efectius d'un usuari (rols + delegats)
router.get("/users/:userId/permissions", checkPermission("users:read"), (req, res) => {
  const { userId } = req.params;

  User.findById(userId)
    .populate({ path: "roles", populate: { path: "permissions" } })
    .then((user) => {
      if (!user) return res.status(404).json({ success: false, message: "Usuari no trobat" });
      const permissions = user.getEffectivePermissions();
      res.json({
        success: true,
        data: { userId: user._id, userName: user.name, permissions },
      });
    })
    .catch((error) =>
      res.status(500).json({ success: false, message: "Error al obtenir permisos", error: error.message })
    );
});

/* ============================================================
   PERMISOS
============================================================ */

router.post("/permissions", checkPermission("permissions:manage"), createPermission);
router.get("/permissions", checkPermission("permissions:read"), getAllPermissions);
router.get("/permissions/categories", checkPermission("permissions:read"), getCategories);
router.put("/permissions/:id", checkPermission("permissions:manage"), updatePermission);
router.delete("/permissions/:id", checkPermission("permissions:manage"), deletePermission);

/* ============================================================
   ROLS — ORDRE IMPORTANT: rutes estàtiques ABANS de :id
============================================================ */

router.post("/roles", checkPermission("roles:manage"), createRole);
router.get("/roles", checkPermission("roles:read"), getAllRoles);

// ── Rutes estàtiques específiques (ABANS de /:id) ─────────────────────────
// (cap ruta estàtica addicional per ara)

// ── Rutes amb paràmetre :id ────────────────────────────────────────────────
router.get("/roles/:id", checkPermission("roles:read"), getRoleById);
router.put("/roles/:id", checkPermission("roles:manage"), updateRole);
router.delete("/roles/:id", checkPermission("roles:manage"), deleteRole);

// ── Jerarquia (NOU T9) ─────────────────────────────────────────────────────
// GET /api/admin/roles/:id/hierarchy → arbre complet del rol
router.get("/roles/:id/hierarchy", checkPermission("roles:read"), getRoleHierarchyEndpoint);

// GET /api/admin/roles/:id/permissions → permisos propis + heretats
router.get("/roles/:id/permissions", checkPermission("roles:read"), getRolePermissionsEndpoint);

// ── Gestió de permisos dins d'un rol ─────────────────────────────────────
router.post("/roles/:id/permissions", checkPermission("roles:manage"), addPermissionToRole);
router.delete("/roles/:id/permissions/:permissionId", checkPermission("roles:manage"), removePermissionFromRole);

/* ============================================================
   DELEGACIÓ DE PERMISOS (NOU T9)
============================================================ */

// Llistar totes les delegacions (admin)
router.get("/delegations", checkPermission("users:manage"), getAllDelegations);

// ORDRE IMPORTANT: rutes estàtiques ABANS de /:id
// Delegacions d'un usuari concret
router.get("/delegations/user/:userId", checkPermission("users:read"), getDelegationsByUser);

// Obtenir delegació per ID
router.get("/delegations/:id", checkPermission("users:read"), getDelegationById);

// Crear nova delegació
router.post("/delegations", auth, createDelegation);

// Revocar delegació
router.delete("/delegations/:id", auth, revokeDelegation);

/* ============================================================
   AUDITORIA — ORDRE IMPORTANT: rutes estàtiques ABANS de :id
============================================================ */

// Estadístiques generals
router.get("/audit-logs/stats", checkPermission("audit:read"), getAuditStats);

// Exportació CSV (NOU T9)
router.get("/audit-logs/export", checkPermission("audit:read"), exportAuditLogs);

// Stats d'un usuari concret (NOU T9)
router.get("/audit-logs/stats/user/:userId", checkPermission("audit:read"), getUserAuditStats);

// Logs d'un usuari concret
router.get("/audit-logs/user/:userId", checkPermission("audit:read"), getUserAuditLogs);

// Logs generals amb filtres
router.get("/audit-logs", checkPermission("audit:read"), getAuditLogs);

// Log concret per ID (AL FINAL per no capturar 'stats', 'export', 'user')
router.get("/audit-logs/:id", checkPermission("audit:read"), getAuditLogById);

export default router;