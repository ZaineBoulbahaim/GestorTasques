// src/seeds/permissionSeed.js
import Permission from "../models/Permission.js";

/**
 * LLISTA DE PERMISOS DEL SISTEMA
 * Marcats com 'isSystemPermission: true' per evitar la seva eliminació.
 * Estructura: "categoria:acció"
 */
const systemPermissions = [
  // Mòdul de Tasques
  { name: "tasks:create", description: "Crear tasques", category: "tasks", isSystemPermission: true },
  { name: "tasks:read", description: "Veure tasques", category: "tasks", isSystemPermission: true },
  { name: "tasks:update", description: "Editar tasques", category: "tasks", isSystemPermission: true },
  { name: "tasks:delete", description: "Eliminar tasques", category: "tasks", isSystemPermission: true },
  { name: "system:configure", description: "Configurar el sistema", category: "audit", isSystemPermission: true },
  { name: "system:backup", description: "Fer còpia de seguretat", category: "audit", isSystemPermission: true },

  // Mòdul d'Usuaris
  { name: "users:manage", description: "Gestionar usuaris", category: "users", isSystemPermission: true },
  { name: "users:read", description: "Llegir dades d'usuaris", category: "users", isSystemPermission: true },

  // Mòdul de Rols
  { name: "roles:manage", description: "Gestionar rols", category: "roles", isSystemPermission: true },
  { name: "roles:read", description: "Llegir rols", category: "roles", isSystemPermission: true },

  // Mòdul de Permisos
  { name: "permissions:manage", description: "Gestionar permisos", category: "permissions", isSystemPermission: true },
  { name: "permissions:read", description: "Llegir permisos", category: "permissions", isSystemPermission: true },

  // Mòdul d'Auditoria
  { name: "audit:read", description: "Llegir logs d'auditoria", category: "audit", isSystemPermission: true },

  // Mòdul d'Informes
  { name: "reports:view", description: "Veure informes", category: "reports", isSystemPermission: true },
  { name: "reports:export", description: "Exportar informes", category: "reports", isSystemPermission: true },
];

/**
 * FUNCIÓ SEEDER: seedPermissions
 * S'executa a l'arrencada del servidor per garantir que la base 
 * de dades tingui els permisos mínims operatius.
 */
const seedPermissions = async () => {
  try {
    console.log("🔄 Iniciant seed de permisos del sistema...");
    let createdCount = 0;

    for (const permission of systemPermissions) {
      // Comprovació d'existència per evitar duplicats
      const exists = await Permission.findOne({ name: permission.name });

      if (!exists) {
        await Permission.create(permission);
        createdCount++;
      }
    }

    if (createdCount > 0) {
      console.log(`✅ S'han creat ${createdCount} permisos nous`);
    } else {
      console.log("✅ Els permisos del sistema ja estan actualitzats");
    }
  } catch (error) {
    console.error("❌ Error en el seeder de permisos:", error.message);
  }
};

export default seedPermissions;