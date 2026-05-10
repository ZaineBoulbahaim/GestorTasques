import Role from "../models/Role.js";
import Permission from "../models/Permission.js";
import User from "../models/User.js";
import permissionService from "../services/permissionService.js";

export const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find()
      .populate("permissions")
      .populate("parentRole", "name level")
      .sort({ level: 1 });

    return res.json({
      success: true,
      count: roles.length,
      data: roles
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
      .populate("permissions")
      .populate("parentRole", "name level");

    if (!role) return res.status(404).json({ success: false, message: "Rol no trobat" });

    return res.json({ success: true, data: role });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const createRole = async (req, res) => {
  try {
    const { name, description, permissions = [], level, parentRole } = req.body;

    // Validar si ya existe
    const existing = await Role.findOne({ name: name.toLowerCase() });
    if (existing) return res.status(400).json({ success: false, message: "El rol ja existeix" });

    // Prova 3.8: Validar Jerarquia
    if (parentRole) {
      const parentDoc = await Role.findById(parentRole);
      if (!parentDoc) return res.status(400).json({ success: false, message: "Pare no trobat" });

      // Regla: El nivel del hijo debe ser mayor que el del padre
      if (level <= parentDoc.level) {
        return res.status(400).json({
          success: false,
          message: "Jerarquia invàlida: el nivell ha de ser superior al del pare"
        });
      }
    }

    const newRole = await Role.create({
      name: name.toLowerCase(),
      description,
      permissions,
      level: level || 1,
      parentRole: parentRole || null
    });

    res.status(201).json({ success: true, data: newRole });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const updateRole = async (req, res) => {
  try {
    const role = await Role.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!role) return res.status(404).json({ success: false, message: "Rol no trobat" });
    
    res.json({ success: true, message: "Rol actualitzat correctament", data: role });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getRoleHierarchy = async (req, res) => {
  try {
    // Usamos el servicio que ya tienes o una lógica recursiva simple
    const hierarchy = await permissionService.getRoleHierarchy(req.params.id);
    res.json({ success: true, data: hierarchy });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getRolePermissions = async (req, res) => {
  try {
    const allPermissions = await permissionService.getRoleHierarchyPermissions(req.params.id);
    res.json({ success: true, data: allPermissions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: "Rol no trobat" });

    if (role.isSystemRole) {
      return res.status(403).json({ success: false, message: "No es pot esborrar un rol de sistema" });
    }

    await Role.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Rol eliminat correctament" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Funciones adicionales para evitar el error de importación en adminRoutes
export const addPermissionToRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissionId } = req.body;
    const role = await Role.findById(id);
    if (!role) return res.status(404).json({ success: false, message: "Rol no trobat" });
    
    if (!role.permissions.includes(permissionId)) {
        role.permissions.push(permissionId);
        await role.save();
    }
    res.json({ success: true, message: "Permís afegit" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const removePermissionFromRole = async (req, res) => {
  try {
    const { id, permissionId } = req.params;
    const role = await Role.findById(id);
    if (!role) return res.status(404).json({ success: false, message: "Rol no trobat" });
    
    role.permissions = role.permissions.filter(p => p.toString() !== permissionId);
    await role.save();
    res.json({ success: true, message: "Permís eliminat" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// --- ALIAS PARA COMPATIBILIDAD CON ADMINROUTES ---

// Mapeamos los nombres viejos a los nuevos
export const getRoleHierarchyEndpoint = getRoleHierarchy;
export const getRolePermissionsEndpoint = getRolePermissions;