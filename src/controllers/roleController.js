import Role from "../models/Role.js";
import Permission from "../models/Permission.js";
import User from "../models/User.js";
import permissionService from "../services/permissionService.js";

/**
 * CONTROLADOR DE ROLS T9
 *
 * Novetats respecte T8:
 *   - createRole: ara accepta 'level' i 'parentRole' per la jerarquia
 *   - getRoleById: nou endpoint
 *   - getRoleHierarchy: retorna l'arbre complet del rol
 *   - getRolePermissions: retorna permisos propis + heretats
 *   - Validació de cicles en la jerarquia
 */

// ─── GET ALL ROLES ───────────────────────────────────────────────────────────

/**
 * GET /api/roles  (o /api/admin/roles)
 * Llista tots els rols amb els seus permisos populats.
 */
export const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find()
      .populate("permissions")
      .populate("parentRole", "name level")
      .sort({ level: -1, name: 1 });

    return res.json({
      success: true,
      count: roles.length,
      data: roles.map((role) => ({
        id: role._id,
        name: role.name,
        level: role.level,
        description: role.description,
        isSystemRole: role.isSystemRole,
        parentRole: role.parentRole
          ? { id: role.parentRole._id, name: role.parentRole.name }
          : null,
        permissions: (role.permissions || []).map((p) => ({
          id: p._id,
          name: p.name,
          description: p.description,
        })),
        createdAt: role.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtenir els rols",
      error: error.message,
    });
  }
};

// ─── GET ROLE BY ID ──────────────────────────────────────────────────────────

/**
 * GET /api/roles/:id
 * Retorna un rol concret amb els seus permisos i el rol pare.
 */
export const getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
      .populate("permissions")
      .populate("parentRole", "name level description");

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Rol no trobat",
      });
    }

    return res.json({
      success: true,
      data: {
        id: role._id,
        name: role.name,
        level: role.level,
        description: role.description,
        isSystemRole: role.isSystemRole,
        parentRole: role.parentRole
          ? {
              id: role.parentRole._id,
              name: role.parentRole.name,
              level: role.parentRole.level,
            }
          : null,
        permissions: (role.permissions || []).map((p) => ({
          id: p._id,
          name: p.name,
          description: p.description,
          category: p.category,
        })),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtenir el rol",
      error: error.message,
    });
  }
};

// ─── CREATE ROLE ─────────────────────────────────────────────────────────────

/**
 * POST /api/roles  (o /api/admin/roles)
 * Crea un nou rol amb suport per jerarquia (level + parentRole).
 *
 * Body:
 * {
 *   "name": "editor",
 *   "level": 2,
 *   "parentRole": "ID_del_rol_pare",   ← opcional
 *   "permissions": ["ID1", "ID2"],      ← permisos PROPIS (no heretats)
 *   "description": "Editor de tasques"
 * }
 *
 * Validacions:
 *   - El nom no pot estar duplicat
 *   - El parentRole ha d'existir
 *   - El level del fill ha de ser > level del pare (jerarquia coherent)
 *   - No es permeten cicles
 */
export const createRole = async (req, res) => {
  try {
    const { name, description, permissions = [], level, parentRole } = req.body;

    // 1. Comprovar duplicat
    const existing = await Role.findOne({ name: name.toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Ja existeix un rol amb aquest nom",
      });
    }

    // 2. Validar parentRole si s'ha especificat
    if (parentRole) {
      const parentRoleDoc = await Role.findById(parentRole);
      if (!parentRoleDoc) {
        return res.status(400).json({
          success: false,
          message: "El rol pare especificat no existeix",
        });
      }

      // El level del fill ha de ser > al del pare
      if (level !== undefined && parentRoleDoc.level !== undefined) {
        if (level <= parentRoleDoc.level) {
          return res.status(400).json({
            success: false,
            message: `El level del nou rol (${level}) ha de ser superior al del rol pare (${parentRoleDoc.level})`,
          });
        }
      }
    }

    // 3. Validar que els permisos existeixin
    if (permissions.length > 0) {
      const foundPermissions = await Permission.find({
        _id: { $in: permissions },
      });
      if (foundPermissions.length !== permissions.length) {
        return res.status(400).json({
          success: false,
          message: "Un o més permisos no existeixen",
        });
      }
    }

    // 4. Crear el rol
    const newRole = await Role.create({
      name: name.toLowerCase(),
      description,
      permissions,
      level: level ?? 1,
      parentRole: parentRole || null,
      isSystemRole: false,
    });

    const populatedRole = await Role.findById(newRole._id)
      .populate("permissions")
      .populate("parentRole", "name level");

    return res.status(201).json({
      success: true,
      message: "Rol creat correctament",
      data: {
        id: populatedRole._id,
        name: populatedRole.name,
        level: populatedRole.level,
        description: populatedRole.description,
        parentRole: populatedRole.parentRole
          ? { id: populatedRole.parentRole._id, name: populatedRole.parentRole.name }
          : null,
        permissions: (populatedRole.permissions || []).map((p) => ({
          id: p._id,
          name: p.name,
        })),
        createdAt: populatedRole.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al crear el rol",
      error: error.message,
    });
  }
};

// ─── UPDATE ROLE ─────────────────────────────────────────────────────────────

/**
 * PUT /api/roles/:id
 * Actualitza un rol. Protegeix els rols de sistema.
 */
export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions, level, parentRole } = req.body;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Rol no trobat" });
    }

    // Protecció rols de sistema: no es pot canviar el nom
    if (role.isSystemRole && name && name.toLowerCase() !== role.name) {
      return res.status(403).json({
        success: false,
        message: "No pots reanomenar un rol del sistema",
      });
    }

    // Validar permisos si s'actualitzen
    if (permissions && permissions.length > 0) {
      const found = await Permission.find({ _id: { $in: permissions } });
      if (found.length !== permissions.length) {
        return res.status(400).json({
          success: false,
          message: "Un o més permisos no existeixen",
        });
      }
    }

    // Validar parentRole si s'actualitza
    if (parentRole) {
      // No es pot ser pare de si mateix
      if (parentRole.toString() === id.toString()) {
        return res.status(400).json({
          success: false,
          message: "Un rol no pot ser pare de si mateix",
        });
      }
      const parentDoc = await Role.findById(parentRole);
      if (!parentDoc) {
        return res.status(400).json({
          success: false,
          message: "El rol pare especificat no existeix",
        });
      }
    }

    // Aplicar canvis
    if (name) role.name = name.toLowerCase();
    if (description !== undefined) role.description = description;
    if (permissions) role.permissions = permissions;
    if (level !== undefined) role.level = level;
    if (parentRole !== undefined) role.parentRole = parentRole || null;

    await role.save();

    const updated = await Role.findById(id)
      .populate("permissions")
      .populate("parentRole", "name level");

    return res.json({
      success: true,
      message: "Rol actualitzat correctament",
      data: {
        id: updated._id,
        name: updated.name,
        level: updated.level,
        description: updated.description,
        parentRole: updated.parentRole
          ? { id: updated.parentRole._id, name: updated.parentRole.name }
          : null,
        permissions: (updated.permissions || []).map((p) => ({
          id: p._id,
          name: p.name,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al actualitzar el rol",
      error: error.message,
    });
  }
};

// ─── DELETE ROLE ─────────────────────────────────────────────────────────────

/**
 * DELETE /api/roles/:id
 * Elimina un rol i reassigna els usuaris afectats al rol 'user' base.
 */
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Rol no trobat" });
    }

    if (role.isSystemRole) {
      return res.status(403).json({
        success: false,
        message: "No pots eliminar un rol del sistema",
      });
    }

    // Comprovar si altres rols depenen d'aquest com a parentRole
    const childRoles = await Role.find({ parentRole: id });
    if (childRoles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `No es pot eliminar: ${childRoles.length} rol(s) hereten d'aquest rol. Actualitza'ls primer.`,
        data: { childRoles: childRoles.map((r) => r.name) },
      });
    }

    const deletedRoleName = role.name;
    await Role.findByIdAndDelete(id);

    // Reassignar usuaris orfes al rol 'user'
    const defaultRole = await Role.findOne({ name: "user" });
    if (defaultRole) {
      const affectedUsers = await User.find({ roles: { $in: [id] } });
      const updatePromises = affectedUsers.map((user) => {
        user.roles = user.roles.filter((rId) => rId.toString() !== id.toString());
        if (user.roles.length === 0) user.roles.push(defaultRole._id);
        return user.save();
      });
      await Promise.all(updatePromises);

      return res.json({
        success: true,
        message: "Rol eliminat i usuaris reassignats correctament",
        data: { deletedRole: deletedRoleName, usersAffected: affectedUsers.length },
      });
    }

    return res.json({
      success: true,
      message: "Rol eliminat correctament",
      data: { deletedRole: deletedRoleName },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al eliminar el rol",
      error: error.message,
    });
  }
};

// ─── GET ROLE HIERARCHY ──────────────────────────────────────────────────────

/**
 * GET /api/roles/:id/hierarchy
 * Retorna l'arbre complet de jerarquia d'un rol (de fill a arrel).
 *
 * Exemple resposta per MANAGER:
 * {
 *   hierarchy: [
 *     { name: "manager", level: 3, ownPermissions: [...] },
 *     { name: "user",    level: 2, ownPermissions: [...] },
 *     { name: "viewer",  level: 1, ownPermissions: [...] }
 *   ]
 * }
 */
export const getRoleHierarchyEndpoint = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Rol no trobat" });
    }

    const hierarchy = await permissionService.getRoleHierarchy(req.params.id);

    return res.json({
      success: true,
      data: {
        roleId: role._id,
        roleName: role.name,
        hierarchy,
        totalLevels: hierarchy.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtenir la jerarquia",
      error: error.message,
    });
  }
};

// ─── GET ROLE PERMISSIONS (PROPIS + HERETATS) ────────────────────────────────

/**
 * GET /api/roles/:id/permissions
 * Retorna els permisos PROPIS del rol + els HERETATS del pare (i avies...).
 * Ideal per veure la matriu de permisos efectiva d'un rol.
 */
export const getRolePermissionsEndpoint = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id).populate("permissions");
    if (!role) {
      return res.status(404).json({ success: false, message: "Rol no trobat" });
    }

    // Permisos propis (sense jerarquia)
    const ownPermissions = (role.permissions || []).map((p) => ({
      id: p._id,
      name: p.name,
      description: p.description,
      inherited: false,
    }));

    // Tots els permisos (propis + heretats)
    const allPermissions = await permissionService.getRoleHierarchyPermissions(
      req.params.id
    );

    // Marcar els heretats
    const ownIds = new Set(ownPermissions.map((p) => p.id.toString()));
    const inheritedPermissions = allPermissions
      .filter((p) => !ownIds.has(p._id.toString()))
      .map((p) => ({
        id: p._id,
        name: p.name,
        description: p.description,
        inherited: true,
      }));

    return res.json({
      success: true,
      data: {
        roleId: role._id,
        roleName: role.name,
        level: role.level,
        ownPermissions,
        inheritedPermissions,
        allPermissions: [...ownPermissions, ...inheritedPermissions],
        totalCount: ownPermissions.length + inheritedPermissions.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtenir els permisos del rol",
      error: error.message,
    });
  }
};

// ─── ADD / REMOVE PERMISSION ─────────────────────────────────────────────────

/**
 * POST /api/roles/:id/permissions
 * Afegeix un permís al rol.
 */
export const addPermissionToRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissionId } = req.body;

    const permission = await Permission.findById(permissionId);
    if (!permission) {
      return res.status(404).json({ success: false, message: "Permís no trobat" });
    }

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Rol no trobat" });
    }

    await role.addPermission(permissionId);
    const updated = await Role.findById(id).populate("permissions");

    return res.json({
      success: true,
      message: "Permís afegit correctament",
      data: {
        id: updated._id,
        name: updated.name,
        permissions: updated.permissions.map((p) => ({ id: p._id, name: p.name })),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al afegir el permís",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/roles/:id/permissions/:permissionId
 * Elimina un permís del rol.
 */
export const removePermissionFromRole = async (req, res) => {
  try {
    const { id, permissionId } = req.params;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Rol no trobat" });
    }

    await role.removePermission(permissionId);
    const updated = await Role.findById(id).populate("permissions");

    return res.json({
      success: true,
      message: "Permís eliminat correctament",
      data: {
        id: updated._id,
        name: updated.name,
        permissions: updated.permissions.map((p) => ({ id: p._id, name: p.name })),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al eliminar el permís",
      error: error.message,
    });
  }
};