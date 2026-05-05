import Role from "../models/Role.js";
import Permission from "../models/Permission.js";
import User from "../models/User.js";

/**
 * CREAR NOU ROL
 * Registra un rol i vincula una llista d'IDs de permisos prèviament validats.
 */
export const createRole = (req, res) => {
  const { name, description, permissions } = req.body;

  // 1. Evitem duplicats normalitzant el nom a minúscules.
  Role.findOne({ name: name.toLowerCase() })
    .then((existingRole) => {
      if (existingRole) {
        return res.status(400).json({ success: false, message: "Ja existeix un rol amb aquest nom" });
      }

      // 2. Validació d'integritat: Verifiquem que tots els IDs de permisos enviats existeixin realment.
      return Permission.find({ _id: { $in: permissions } });
    })
    .then((foundPermissions) => {
      if (!foundPermissions) return;

      // Si la quantitat trobada no coincideix amb la demanada, algun ID és invàlid.
      if (foundPermissions.length !== permissions.length) {
        return res.status(400).json({ success: false, message: "Un o més permisos no existeixen" });
      }

      // 3. Persistència del nou rol com a recurs personalitzat (isSystemRole: false).
      return Role.create({
        name: name.toLowerCase(),
        description,
        permissions,
        isSystemRole: false,
      });
    })
    .then((newRole) => {
      if (!newRole) return;
      // Retornem el rol amb el detall dels permisos (populate) per a la confirmació al frontend.
      return Role.findById(newRole._id).populate("permissions");
    })
    .then((populatedRole) => {
      if (!populatedRole) return;

      res.status(201).json({
        success: true,
        message: "Rol creat correctament",
        data: {
          id: populatedRole._id,
          name: populatedRole.name,
          description: populatedRole.description,
          permissions: populatedRole.permissions.map((perm) => ({
            id: perm._id,
            name: perm.name,
            description: perm.description,
          })),
          createdAt: populatedRole.createdAt,
        },
      });
    })
    .catch((error) => {
      res.status(500).json({ success: false, message: "Error al crear el rol", error: error.message });
    });
};

/**
 * OBTENIR TOTS ELS ROLS
 * Llista exhaustiva amb resolució de permisos per a la gestió administrativa.
 */
export const getAllRoles = (req, res) => {
  Role.find()
    .populate("permissions")
    .sort({ name: 1 })
    .then((roles) => {
      res.json({
        success: true,
        count: roles.length,
        data: roles.map((role) => ({
          id: role._id,
          name: role.name,
          description: role.description,
          isSystemRole: role.isSystemRole,
          permissions: role.permissions.map((perm) => ({
            id: perm._id,
            name: perm.name,
            description: perm.description,
          })),
          createdAt: role.createdAt,
        })),
      });
    })
    .catch((error) => {
      res.status(500).json({ success: false, message: "Error al obtenir els rols", error: error.message });
    });
};

/**
 * ACTUALITZAR ROL
 * Modifica dades del rol protegint els noms de rols crítics del sistema.
 */
export const updateRole = (req, res) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body;

  Role.findById(id)
    .then((role) => {
      if (!role) return res.status(404).json({ success: false, message: "Rol no trobat" });

      // Protecció de seguretat: No es pot canviar el nom a rols base com 'admin' o 'user'.
      if (role.isSystemRole && name && name.toLowerCase() !== role.name) {
        return res.status(403).json({ success: false, message: "No pots renombrar un rol del sistema" });
      }

      // Validació de permisos si es demana una actualització de la llista.
      if (permissions && permissions.length > 0) {
        return Permission.find({ _id: { $in: permissions } }).then((foundPermissions) => {
          if (foundPermissions.length !== permissions.length) {
            return res.status(400).json({ success: false, message: "Un o més permisos no existeixen" });
          }
          return role;
        });
      }
      return role;
    })
    .then((role) => {
      if (!role || role.success === false) return;

      if (name) role.name = name.toLowerCase();
      if (description !== undefined) role.description = description;
      if (permissions) role.permissions = permissions;

      return role.save();
    })
    .then((updatedRole) => {
      if (!updatedRole) return;
      return Role.findById(updatedRole._id).populate("permissions");
    })
    .then((populatedRole) => {
      if (!populatedRole) return;

      res.json({
        success: true,
        message: "Rol actualitzat correctament",
        data: {
          id: populatedRole._id,
          name: populatedRole.name,
          description: populatedRole.description,
          permissions: populatedRole.permissions.map((perm) => ({
            id: perm._id,
            name: perm.name,
            description: perm.description,
          })),
        },
      });
    })
    .catch((error) => {
      res.status(500).json({ success: false, message: "Error al actualitzar el rol", error: error.message });
    });
};

/**
 * ELIMINAR ROL
 * Suprimeix un rol i gestiona la reassignació d'usuaris orfes cap al rol 'user'.
 */
export const deleteRole = (req, res) => {
  const { id } = req.params;
  let deletedRoleName;

  Role.findById(id)
    .then((role) => {
      if (!role) return res.status(404).json({ success: false, message: "Rol no trobat" });

      // Evitem el tancament accidental de l'accés eliminant rols de sistema.
      if (role.isSystemRole) {
        return res.status(403).json({ success: false, message: "No pots eliminar un rol del sistema" });
      }

      deletedRoleName = role.name;
      return Role.findByIdAndDelete(id);
    })
    .then((deletedRole) => {
      if (!deletedRole) return;
      // Busquem el rol per defecte per no deixar els usuaris sense permisos.
      return Role.findOne({ name: "user" });
    })
    .then((defaultRole) => {
      if (!defaultRole) return;

      // 1. Busquem usuaris que tinguessin el rol eliminat.
      return User.find({ roles: { $in: [id] } }).then((users) => {
        // 2. Per a cada usuari, netegem la referència i assegurem que tingui almenys el rol 'user'.
        const updatePromises = users.map((user) => {
          user.roles = user.roles.filter((roleId) => roleId.toString() !== id.toString());
          if (user.roles.length === 0) {
            user.roles.push(defaultRole._id);
          }
          return user.save();
        });
        return Promise.all(updatePromises);
      });
    })
    .then((updatedUsers) => {
      if (!updatedUsers) return;

      res.json({
        success: true,
        message: "Rol eliminat i usuaris reassignats correctament",
        data: {
          deletedRole: deletedRoleName,
          usersAffected: updatedUsers.length,
        },
      });
    })
    .catch((error) => {
      res.status(500).json({ success: false, message: "Error al eliminar el rol", error: error.message });
    });
};

/**
 * AFEGIR/ELIMINAR PERMÍS A ROL
 * Mètodes atòmics per a la gestió granular de la matriu de permisos d'un rol.
 */
export const addPermissionToRole = (req, res) => {
  const { id } = req.params;
  const { permissionId } = req.body;
  let roleFound;

  // Validem primer l'existència del permís abans d'intentar l'associació.
  Permission.findById(permissionId)
    .then((permission) => {
      if (!permission) return res.status(404).json({ success: false, message: "Permís no trobat" });
      return Role.findById(id);
    })
    .then((role) => {
      if (!role) return res.status(404).json({ success: false, message: "Rol no trobat" });
      roleFound = role;
      // Mètode d'instància del model per evitar duplicats en l'array de permisos.
      return role.addPermission(permissionId);
    })
    .then(() => Role.findById(roleFound._id).populate("permissions"))
    .then((updatedRole) => {
      res.json({
        success: true,
        message: "Permís afegit correctament",
        data: {
          id: updatedRole._id,
          name: updatedRole.name,
          permissions: updatedRole.permissions.map((p) => ({ id: p._id, name: p.name })),
        },
      });
    })
    .catch((error) => {
      res.status(500).json({ success: false, message: "Error al afegir permís", error: error.message });
    });
};