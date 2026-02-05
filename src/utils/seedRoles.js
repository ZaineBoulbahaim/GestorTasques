// src/seeds/roleSeed.js
import Role from "../models/Role.js";
import Permission from "../models/Permission.js";

/**
 * FUNCIÓ AUXILIAR: getPermissionIds
 * Converteix un array de noms de permisos ("tasks:read") en IDs d'objecte de MongoDB.
 */
const getPermissionIds = async (permissionNames) => {
  const permissions = await Permission.find({
    name: { $in: permissionNames },
  });
  return permissions.map((p) => p._id);
};

/**
 * LLISTA DE ROLS DEL SISTEMA
 * Defineix l'estructura base i els permisos associats a cada perfil.
 */
const systemRoles = [
  {
    name: "admin",
    description: "Administrador amb control total del sistema",
    permissions: [
      "tasks:create", "tasks:read", "tasks:update", "tasks:delete",
      "users:manage", "users:read",
      "roles:manage", "roles:read",
      "permissions:manage", "permissions:read",
      "audit:read", "reports:view", "reports:export",
    ],
    isSystemRole: true,
  },
  {
    name: "user",
    description: "Usuari estàndard per a la gestió de tasques pròpies",
    permissions: ["tasks:create", "tasks:read", "tasks:update", "tasks:delete"],
    isSystemRole: true,
  },
  {
    name: "viewer",
    description: "Perfil de només lectura",
    permissions: ["tasks:read"],
    isSystemRole: false,
  },
  {
    name: "editor",
    description: "Pot gestionar tasques però no administrar el sistema",
    permissions: ["tasks:create", "tasks:read", "tasks:update", "tasks:delete"],
    isSystemRole: false,
  },
];

/**
 * FUNCIÓ SEEDER: seedRoles
 * Garanteix que els rols estiguin disponibles i tinguin els IDs de permisos correctes.
 */
const seedRoles = async () => {
  try {
    console.log("🔄 Iniciant seed de rols del sistema...");
    let createdCount = 0;

    for (const roleData of systemRoles) {
      const exists = await Role.findOne({ name: roleData.name });

      if (!exists) {
        // Transformem els noms en ObjectIds abans de guardar
        const permissionIds = await getPermissionIds(roleData.permissions);

        await Role.create({
          name: roleData.name,
          description: roleData.description,
          permissions: permissionIds,
          isSystemRole: roleData.isSystemRole,
        });

        createdCount++;
      }
    }

    if (createdCount > 0) {
      console.log(`✅ S'han creat ${createdCount} rols nous`);
    } else {
      console.log("✅ Els rols del sistema ja estan actualitzats");
    }
  } catch (error) {
    console.error("❌ Error en el seeder de rols:", error.message);
  }
};

export default seedRoles;