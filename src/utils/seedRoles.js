import Role from "../models/Role.js";
import Permission from "../models/Permission.js";

/**
 * SEED DE ROLS T9 — AMB JERARQUIA COMPLETA
 *
 * Jerarquia implementada:
 *   SUPER_ADMIN (5) → hereta d'ADMIN
 *   ADMIN       (4) → hereta de MANAGER
 *   MANAGER     (3) → hereta d'USER
 *   USER        (2) → hereta de VIEWER
 *   VIEWER      (1) → rol arrel (sense pare)
 *
 * IMPORTANT: Els rols s'han de crear en ordre de menor a major level
 * perquè quan creem ADMIN, el rol MANAGER ja ha d'existir com a parentRole.
 *
 * Cada rol NOMÉS té els permisos PROPIS (no els heretats).
 * permissionService.getRoleHierarchyPermissions() s'encarrega d'acumular-los.
 */

const getPermissionIds = async (permissionNames) => {
  const permissions = await Permission.find({ name: { $in: permissionNames } });
  return permissions.map((p) => p._id);
};

/**
 * Rols ordenats de menor a major level per garantir que el pare existeix
 * quan es crea el fill.
 */
const systemRoles = [
  // ── VIEWER (Level 1) — Rol arrel, sense pare ─────────────────────────────
  {
    name: "viewer",
    level: 1,
    parentRoleName: null,
    description: "Accés de només lectura al sistema",
    // Permisos PROPIS (no heretats, perquè és el rol arrel)
    permissions: [
      "tasks:read",
    ],
    isSystemRole: true,
  },

  // ── USER (Level 2) — Hereta de VIEWER ────────────────────────────────────
  {
    name: "user",
    level: 2,
    parentRoleName: "viewer",
    description: "Usuari estàndard. Pot gestionar les seves pròpies tasques",
    // Permisos PROPIS (a més dels heretats de VIEWER: tasks:read)
    permissions: [
      "tasks:create",
      "tasks:update",
      "tasks:delete",
    ],
    isSystemRole: true,
  },

  // ── MANAGER (Level 3) — Hereta d'USER ────────────────────────────────────
  {
    name: "manager",
    level: 3,
    parentRoleName: "user",
    description: "Gestor de projectes. Pot veure usuaris i assignar tasques",
    // Permisos PROPIS (a més dels heretats d'USER+VIEWER)
    permissions: [
      "users:read",
      "reports:view",
    ],
    isSystemRole: true,
  },

  // ── ADMIN (Level 4) — Hereta de MANAGER ──────────────────────────────────
  {
    name: "admin",
    level: 4,
    parentRoleName: "manager",
    description: "Administrador. Gestió completa d'usuaris, rols i permisos",
    // Permisos PROPIS (a més dels heretats de MANAGER+USER+VIEWER)
    permissions: [
      "users:manage",
      "roles:manage",
      "roles:read",
      "permissions:manage",
      "permissions:read",
      "audit:read",
      "reports:export",
    ],
    isSystemRole: true,
  },

  // ── SUPER_ADMIN (Level 5) — Hereta d'ADMIN ───────────────────────────────
  {
    name: "super_admin",
    level: 5,
    parentRoleName: "admin",
    description: "Super administrador amb control total del sistema",
    permissions: [],
    isSystemRole: true,
  },

  // ── EDITOR (Level 2) — Hereta de VIEWER ──────────────────────────────────
  // Rol no jeràrquic addicional (mateix nivell que USER però diferent)
  {
    name: "editor",
    level: 2,
    parentRoleName: "viewer",
    description: "Editor. Pot crear i editar tasques però no eliminar",
    permissions: [
      "tasks:create",
      "tasks:update",
    ],
    isSystemRole: false,
  },
];

/**
 * seedRoles()
 * Crea els rols del sistema si no existeixen, respectant la jerarquia.
 * Si un rol ja existeix, actualitza el seu level i parentRole si han canviat.
 */
const seedRoles = async () => {
  try {
    console.log("🔄 Iniciant seed de rols del sistema (T9 amb jerarquia)...");
    let createdCount = 0;
    let updatedCount = 0;

    for (const roleData of systemRoles) {
      // Obtenir IDs dels permisos PROPIS d'aquest rol
      const permissionIds = await getPermissionIds(roleData.permissions);

      // Obtenir l'ID del rol pare (si en té)
      let parentRoleId = null;
      if (roleData.parentRoleName) {
        const parentRole = await Role.findOne({ name: roleData.parentRoleName });
        if (!parentRole) {
          console.warn(
            `⚠️  Rol pare '${roleData.parentRoleName}' no trobat per a '${roleData.name}'. Comprova l'ordre dels rols.`
          );
        } else {
          parentRoleId = parentRole._id;
        }
      }

      const exists = await Role.findOne({ name: roleData.name });

      if (!exists) {
        // Crear nou rol
        await Role.create({
          name: roleData.name,
          level: roleData.level,
          parentRole: parentRoleId,
          description: roleData.description,
          permissions: permissionIds,
          isSystemRole: roleData.isSystemRole,
        });
        console.log(`  ✅ Creat: ${roleData.name} (level ${roleData.level})`);
        createdCount++;
      } else {
        // Actualitzar level i parentRole si han canviat (per migració de T8 → T9)
        let needsUpdate = false;

        if (exists.level !== roleData.level) {
          exists.level = roleData.level;
          needsUpdate = true;
        }

        const currentParentId = exists.parentRole?.toString() ?? null;
        const newParentId = parentRoleId?.toString() ?? null;
        if (currentParentId !== newParentId) {
          exists.parentRole = parentRoleId;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await exists.save();
          console.log(`  🔄 Actualitzat: ${roleData.name} (level ${roleData.level})`);
          updatedCount++;
        }
      }
    }

    if (createdCount > 0 || updatedCount > 0) {
      console.log(
        `✅ Seed rols completat: ${createdCount} creats, ${updatedCount} actualitzats`
      );
    } else {
      console.log("✅ Els rols del sistema ja estan actualitzats");
    }
  } catch (error) {
    console.error("❌ Error en el seeder de rols:", error.message);
  }
};

export default seedRoles;