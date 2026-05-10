import DelegatedPermission from "../models/DelegatedPermission.js";
import Permission from "../models/Permission.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

/**
 * SERVEI DE DELEGACIÓ DE PERMISOS (delegationService)
 *
 * Gestiona el cicle de vida complet de les delegacions:
 *   - Crear delegació (amb validacions)
 *   - Revocar delegació
 *   - Expirar delegacions antigues (per al cron job)
 *   - Consultar delegacions actives d'un usuari
 */

// ─── CREAR DELEGACIÓ ─────────────────────────────────────────────────────────

/**
 * delegatePermission(fromUserId, toUserId, permissionName, days, reason, req)
 *
 * Validacions:
 *   - El delegant ha d'existir
 *   - El receptor ha d'existir
 *   - No es pot delegar a un mateix
 *   - El permís ha d'existir
 *   - Els dies han de ser > 0
 *   - No duplicar una delegació activa del mateix permís al mateix usuari
 *
 * @param {String} fromUserId      - ID de l'usuari que delega
 * @param {String} toUserId        - ID de l'usuari receptor
 * @param {String} permissionName  - Nom del permís (ex: "tasks:assign")
 * @param {Number} days            - Dies de validesa (>0)
 * @param {String} reason          - Motiu de la delegació
 * @param {Object} req             - Request d'Express (per auditoria)
 * @returns {Document} La delegació creada
 */
const delegatePermission = async (
  fromUserId,
  toUserId,
  permissionName,
  days,
  reason = "",
  req = null
) => {
  // 1. Validar dies
  if (!days || days <= 0) {
    const error = new Error("Els dies de validesa han de ser majors a 0");
    error.statusCode = 400;
    throw error;
  }

  // 2. No es pot delegar a un mateix
  if (fromUserId.toString() === toUserId.toString()) {
    const error = new Error("No pots delegar un permís a tu mateix");
    error.statusCode = 400;
    throw error;
  }

  // 3. Verificar que el delegant existeix
  const fromUser = await User.findById(fromUserId);
  if (!fromUser) {
    const error = new Error("Usuari delegant no trobat");
    error.statusCode = 404;
    throw error;
  }

  // 4. Verificar que el receptor existeix
  const toUser = await User.findById(toUserId);
  if (!toUser) {
    const error = new Error("Usuari receptor no trobat");
    error.statusCode = 404;
    throw error;
  }

  // 5. Verificar que el permís existeix
  const permission = await Permission.findOne({ name: permissionName.toLowerCase() });
  if (!permission) {
    const error = new Error(`El permís '${permissionName}' no existeix`);
    error.statusCode = 404;
    throw error;
  }

  // 6. Comprovar si ja existeix una delegació activa del mateix permís
  const existingDelegation = await DelegatedPermission.findOne({
    fromUserId,
    toUserId,
    permission: permission._id,
    status: "active",
    expiresAt: { $gt: new Date() },
  });

  if (existingDelegation) {
    const error = new Error(
      "Ja existeix una delegació activa d'aquest permís per a aquest usuari"
    );
    error.statusCode = 409;
    throw error;
  }

  // 7. Crear la delegació
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const delegation = await DelegatedPermission.create({
    fromUserId,
    toUserId,
    permission: permission._id,
    reason,
    delegatedAt: new Date(),
    expiresAt,
    status: "active",
  });

  // 8. Registrar a auditoria
  if (req && req.user) {
    await AuditLog.log(
      fromUserId,
      "permission:delegate",
      toUserId.toString(),
      "user",
      "success",
      {
        permission: permissionName,
        toUser: toUser.email,
        days,
        reason,
        expiresAt,
      },
      req
    );
  }

  // Retornar la delegació populada
  return DelegatedPermission.findById(delegation._id)
    .populate("permission", "name description category")
    .populate("fromUserId", "name email")
    .populate("toUserId", "name email");
};

// ─── REVOCAR DELEGACIÓ ───────────────────────────────────────────────────────

/**
 * revokePermission(delegationId, requestingUserId, req)
 * Revoca manualment una delegació.
 * Només el delegant original o un admin pot revocar-la.
 *
 * @param {String} delegationId       - ID de la delegació
 * @param {String} requestingUserId   - ID de l'usuari que fa la revocació
 * @param {Object} req                - Request (per auditoria)
 */
const revokePermission = async (delegationId, requestingUserId, req = null) => {
  const delegation = await DelegatedPermission.findById(delegationId).populate(
    "permission",
    "name"
  );

  if (!delegation) {
    const error = new Error("Delegació no trobada");
    error.statusCode = 404;
    throw error;
  }

  if (delegation.status !== "active") {
    const error = new Error(
      `No es pot revocar una delegació amb estat '${delegation.status}'`
    );
    error.statusCode = 400;
    throw error;
  }

  // Verificar que qui revoca és el delegant original
  if (delegation.fromUserId.toString() !== requestingUserId.toString()) {
    const error = new Error("Només el delegant pot revocar aquesta delegació");
    error.statusCode = 403;
    throw error;
  }

  await delegation.revoke();

  // Auditoria
  if (req && req.user) {
    await AuditLog.log(
      requestingUserId,
      "permission:revoke",
      delegation.toUserId.toString(),
      "user",
      "success",
      {
        permission: delegation.permission?.name,
        delegationId,
      },
      req
    );
  }

  return delegation;
};

// ─── EXPIRAR DELEGACIONS ANTIGUES (CRON JOB) ────────────────────────────────

/**
 * expireOldDelegations()
 * Marca com 'expired' totes les delegacions que han superat la seva data límit.
 * Pensat per ser cridat des d'un cron job periòdic (ex: cada hora).
 *
 * @returns {Number} Nombre de delegacions expirades
 */
const expireOldDelegations = async () => {
  const count = await DelegatedPermission.expireOld();
  if (count > 0) {
    console.log(`⏱️  Cron: ${count} delegació(ns) expirada(es) automàticament`);
  }
  return count;
};

// ─── CONSULTES ───────────────────────────────────────────────────────────────

/**
 * getActivePermissionsForUser(userId)
 * Retorna els noms dels permisos delegats actius per a un usuari.
 * Usat per checkPermission middleware.
 *
 * @param {String} userId
 * @returns {String[]} Array de noms de permisos
 */
const getActivePermissionsForUser = async (userId) => {
  const delegations = await DelegatedPermission.getActiveForUser(userId);
  return delegations
    .map((d) => d.permission?.name)
    .filter(Boolean);
};

/**
 * getDelegationsByUser(userId)
 * Retorna totes les delegacions DONADES i REBUDES per un usuari.
 *
 * @param {String} userId
 * @returns {Object} { given: [...], received: [...] }
 */
const getDelegationsByUser = async (userId) => {
  const [given, received] = await Promise.all([
    DelegatedPermission.find({ fromUserId: userId })
      .populate("permission", "name description")
      .populate("toUserId", "name email")
      .sort({ delegatedAt: -1 }),
    DelegatedPermission.find({ toUserId: userId })
      .populate("permission", "name description")
      .populate("fromUserId", "name email")
      .sort({ delegatedAt: -1 }),
  ]);

  return { given, received };
};

// ─── EXPORTACIÓ ─────────────────────────────────────────────────────────────

const delegationService = {
  delegatePermission,
  revokePermission,
  expireOldDelegations,
  getActivePermissionsForUser,
  getDelegationsByUser,
};

export default delegationService;