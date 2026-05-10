import DelegatedPermission from "../models/DelegatedPermission.js";
import delegationService from "../services/delegationService.js";

/**
 * CONTROLADOR DE DELEGACIÓ DE PERMISOS T9
 *
 * Endpoints:
 *   GET    /api/delegations                → llistar totes (admin)
 *   GET    /api/delegations/:id            → obtenir una delegació
 *   POST   /api/delegations                → crear delegació
 *   DELETE /api/delegations/:id            → revocar delegació
 *   GET    /api/delegations/user/:userId   → delegacions d'un usuari
 */

// ─── GET ALL ─────────────────────────────────────────────────────────────────

/**
 * GET /api/delegations
 * Llista totes les delegacions (només admins).
 * Suporta filtre per status: ?status=active|expired|revoked
 */
export const getAllDelegations = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [delegations, total] = await Promise.all([
      DelegatedPermission.find(filter)
        .populate("permission", "name description category")
        .populate("fromUserId", "name email")
        .populate("toUserId", "name email")
        .sort({ delegatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      DelegatedPermission.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      count: delegations.length,
      totalCount: total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: delegations.map(_formatDelegation),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtenir les delegacions",
      error: error.message,
    });
  }
};

// ─── GET BY ID ───────────────────────────────────────────────────────────────

/**
 * GET /api/delegations/:id
 * Retorna una delegació concreta.
 */
export const getDelegationById = async (req, res) => {
  try {
    const delegation = await DelegatedPermission.findById(req.params.id)
      .populate("permission", "name description category")
      .populate("fromUserId", "name email")
      .populate("toUserId", "name email");

    if (!delegation) {
      return res.status(404).json({
        success: false,
        message: "Delegació no trobada",
      });
    }

    return res.json({
      success: true,
      data: _formatDelegation(delegation),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtenir la delegació",
      error: error.message,
    });
  }
};

// ─── CREATE ───────────────────────────────────────────────────────────────────

/**
 * POST /api/delegations
 * Crea una nova delegació de permís temporal.
 *
 * Body:
 * {
 *   "toUserId":   "ID_del_receptor",
 *   "permission": "tasks:assign",     ← nom del permís
 *   "daysValid":  5,
 *   "reason":     "Cobertura de vacances"
 * }
 */
export const createDelegation = async (req, res) => {
  try {
    const { toUserId, permission, daysValid, reason } = req.body;
    const fromUserId = req.user._id;

    if (daysValid <= 0) {
      return res.status(400).json({
        success: false,
        message: "Delegació invàlida: els dies han de ser positius"
      });
    }

    // Validacions bàsiques
    if (!toUserId || !permission || !daysValid) {
      return res.status(400).json({
        success: false,
        message: "toUserId, permission i daysValid són obligatoris",
      });
    }

    const delegation = await delegationService.delegatePermission(
      fromUserId,
      toUserId,
      permission,
      daysValid,
      reason || "",
      req
    );

    return res.status(201).json({
      success: true,
      message: `Permís '${permission}' delegat correctament durant ${daysValid} dies`,
      data: _formatDelegation(delegation),
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error al crear la delegació",
    });
  }
};

// ─── REVOKE (DELETE) ─────────────────────────────────────────────────────────

/**
 * DELETE /api/delegations/:id
 * Revoca una delegació activa.
 * Només el delegant original pot revocar-la.
 */
export const revokeDelegation = async (req, res) => {
  try {
    await delegationService.revokePermission(
      req.params.id,
      req.user._id,
      req
    );

    return res.json({
      success: true,
      message: "Delegació revocada correctament",
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error al revocar la delegació",
    });
  }
};

// ─── GET BY USER ─────────────────────────────────────────────────────────────

/**
 * GET /api/delegations/user/:userId
 * Retorna les delegacions DONADES i REBUDES per un usuari concret.
 *
 * Resposta:
 * {
 *   given:    [...],   ← delegacions que ell ha donat a altres
 *   received: [...]    ← delegacions que ell ha rebut d'altres
 * }
 */
export const getDelegationsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const { given, received } = await delegationService.getDelegationsByUser(userId);

    return res.json({
      success: true,
      data: {
        userId,
        given: given.map(_formatDelegation),
        received: received.map(_formatDelegation),
        summary: {
          totalGiven: given.length,
          totalReceived: received.length,
          activeReceived: received.filter((d) => d.status === "active" && d.expiresAt > new Date()).length,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtenir les delegacions de l'usuari",
      error: error.message,
    });
  }
};

// ─── HELPER PRIVAT ────────────────────────────────────────────────────────────

/**
 * _formatDelegation(delegation)
 * Normalitza el format de sortida d'una delegació.
 */
const _formatDelegation = (d) => ({
  id: d._id,
  permission: d.permission
    ? { id: d.permission._id, name: d.permission.name, description: d.permission.description }
    : d.permission,
  fromUser: d.fromUserId
    ? { id: d.fromUserId._id, name: d.fromUserId.name, email: d.fromUserId.email }
    : d.fromUserId,
  toUser: d.toUserId
    ? { id: d.toUserId._id, name: d.toUserId.name, email: d.toUserId.email }
    : d.toUserId,
  reason: d.reason,
  status: d.status,
  delegatedAt: d.delegatedAt,
  expiresAt: d.expiresAt,
  revokedAt: d.revokedAt,
  isCurrentlyActive: d.status === "active" && d.expiresAt > new Date(),
});