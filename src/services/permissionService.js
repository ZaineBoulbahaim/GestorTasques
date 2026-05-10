import Role from "../models/Role.js";
import DelegatedPermission from "../models/DelegatedPermission.js";

/**
 * SERVEI DE PERMISOS (permissionService)
 *
 * Centralitza tota la lògica de resolució de permisos:
 *   1. Permisos heretats per jerarquia de rols (parentRole)
 *   2. Permisos delegats temporalment (DelegatedPermission)
 *
 * La jerarquia funciona de forma RECURSIVA:
 *   MANAGER hereta de USER, USER hereta de VIEWER
 *   → getRoleHierarchyPermissions(MANAGER) retorna:
 *     permisos MANAGER + permisos USER + permisos VIEWER
 */

// ─── JERARQUIA DE ROLS ──────────────────────────────────────────────────────

/**
 * getRoleHierarchyPermissions(roleId)
 * Recorre l'arbre de rols cap amunt (fill → pare → avi...)
 * i retorna TOTS els permisos acumulats sense duplicats.
 *
 * Algoritme recursiu:
 *   1. Carregar el rol amb els seus permisos propis
 *   2. Si té parentRole, cridar recursivament amb l'ID del pare
 *   3. Combinar permisos propis + heretats (sense duplicats)
 *
 * Protecció contra cicles:
 *   visited Set guarda els IDs ja processats.
 *   Si un ID ja ha estat visitat, s'atura la recursió.
 *   Això evita bucles infinits si hi hagués un error de dades.
 *
 * @param {String|ObjectId} roleId - ID del rol del qual volem els permisos
 * @param {Set} visited            - IDs de rols ja processats (anti-cicles)
 * @returns {Array} Array d'objectes Permission sense duplicats
 */
const getRoleHierarchyPermissions = async (roleId, visited = new Set()) => {
  // Protecció contra cicles i IDs nuls
  if (!roleId || visited.has(roleId.toString())) return [];
  visited.add(roleId.toString());

  // Carregar el rol amb els seus permisos propis populats
  const role = await Role.findById(roleId).populate("permissions");
  if (!role) return [];

  // Permisos propis d'aquest rol
  let allPermissions = [...(role.permissions || [])];

  // Si té pare, obtenim recursivament els permisos heretats
  if (role.parentRole) {
    const parentPermissions = await getRoleHierarchyPermissions(
      role.parentRole,
      visited
    );
    allPermissions = [...allPermissions, ...parentPermissions];
  }

  // Eliminar duplicats per ID de permís
  const seen = new Set();
  return allPermissions.filter((perm) => {
    const id = perm._id.toString();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

/**
 * getRoleHierarchy(roleId)
 * Retorna l'arbre complet de la jerarquia d'un rol com a array ordenat
 * des del rol actual fins al rol arrel.
 *
 * Exemple:
 *   getRoleHierarchy(MANAGER) → [MANAGER, USER, VIEWER]
 *
 * @param {String|ObjectId} roleId - ID del rol
 * @returns {Array} Array de rols en ordre jeràrquic (de fill a pare)
 */
const getRoleHierarchy = async (roleId, visited = new Set()) => {
  if (!roleId || visited.has(roleId.toString())) return [];
  visited.add(roleId.toString());

  const role = await Role.findById(roleId).populate("permissions");
  if (!role) return [];

  const hierarchy = [
    {
      id: role._id,
      name: role.name,
      level: role.level,
      description: role.description,
      ownPermissions: (role.permissions || []).map((p) => ({
        id: p._id,
        name: p.name,
        description: p.description,
      })),
    },
  ];

  // Afegir recursivament els pares
  if (role.parentRole) {
    const parentHierarchy = await getRoleHierarchy(role.parentRole, visited);
    hierarchy.push(...parentHierarchy);
  }

  return hierarchy;
};

// ─── PERMISOS EFECTIUS D'UN USUARI ─────────────────────────────────────────

/**
 * getUserEffectivePermissions(user)
 * Retorna TOTS els permisos efectius d'un usuari combinant:
 *   1. Permisos heretats per jerarquia (recursivament)
 *   2. Permisos delegats temporalment (actius)
 * 
 * @param {Document} user - Document d'usuari de MongoDB
 */
const getUserEffectivePermissions = async (user) => {
  if (!user) return { permissionObjects: [], permissionNames: [] };

  // 1. Permisos per jerarquia de rols
  const rolePermissions = [];
  
  // Assegurem que roles sigui un array (per si l'usuari és nou i no en té)
  const userRoleIds = Array.isArray(user.roles) ? user.roles : [];

  for (const roleEntry of userRoleIds) {
    // Si el rol ja està populat, n'extraiem l'ID; si no, el fem servir directament
    const roleId = roleEntry._id || roleEntry;
    
    try {
      const perms = await getRoleHierarchyPermissions(roleId);
      rolePermissions.push(...perms);
    } catch (error) {
      console.error(`Error resolent jerarquia pel rol ${roleId}:`, error);
    }
  }

  // 2. Permisos delegats actius (Fase 4 de la T9)
  let delegatedPerms = [];
  try {
    const delegations = await DelegatedPermission.getActiveForUser(user._id);
    // Extraiem els objectes 'permission' de les delegacions trobades
    delegatedPerms = delegations
      .map((d) => d.permission)
      .filter(Boolean); // Filtrem per si algun permís delegat hagués estat esborrat
  } catch (error) {
    console.error(`Error obtenint delegacions per l'usuari ${user._id}:`, error);
  }

  // 3. Combinar i eliminar duplicats de forma eficient
  const allPermissions = [...rolePermissions, ...delegatedPerms];
  
  const seenIds = new Set();
  const uniquePermissions = allPermissions.filter((perm) => {
    // Verificació de seguretat per si el permís no té ID
    if (!perm || !perm._id) return false;
    
    const id = perm._id.toString();
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });

  return {
    permissionObjects: uniquePermissions,
    permissionNames: uniquePermissions.map((p) => p.name),
  };
};
/**
 * userHasPermission(user, permissionName)
 * Comprova ràpidament si un usuari té un permís concret
 * (incloent jerarquia i delegacions).
 *
 * @param {Document} user            - Document d'usuari
 * @param {String} permissionName    - Nom del permís (ex: "tasks:assign")
 * @returns {Boolean}
 */
const userHasPermission = async (user, permissionName) => {
  const { permissionNames } = await getUserEffectivePermissions(user);
  return permissionNames.includes(permissionName);
};

// ─── EXPORTACIÓ ─────────────────────────────────────────────────────────────

const permissionService = {
  getRoleHierarchyPermissions,
  getRoleHierarchy,
  getUserEffectivePermissions,
  userHasPermission,
};

export default permissionService;