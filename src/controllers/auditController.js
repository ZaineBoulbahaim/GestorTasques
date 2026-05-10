import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";

// ─── GET LOGS ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/audit-logs
 * Llista logs amb filtres dinàmics i paginació.
 * Query params: userId, action, status, startDate, endDate, page, limit
 */
export const getAuditLogs = async (req, res) => {
  try {
    const {
      userId, action, startDate, endDate,
      status, page = 1, limit = 20,
    } = req.query;

    const filter = {};
    if (userId) filter.userId = userId;
    if (action) filter.action = { $regex: action, $options: "i" };
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, totalCount] = await Promise.all([
      AuditLog.find(filter)
        .populate("userId", "name email")
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      count: logs.length,
      totalCount,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      data: logs.map(_formatLog),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtenir els logs d'auditoria",
      error: error.message,
    });
  }
};

// ─── GET BY ID ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/audit-logs/:id
 */
export const getAuditLogById = async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id).populate(
      "userId",
      "name email role"
    );

    if (!log) {
      return res.status(404).json({ success: false, message: "Log no trobat" });
    }

    return res.json({ success: true, data: _formatLog(log) });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtenir el log",
      error: error.message,
    });
  }
};

// ─── GET LOGS BY USER ────────────────────────────────────────────────────────

/**
 * GET /api/admin/audit-logs/user/:userId
 * Historial d'accions d'un usuari concret.
 */
export const getUserAuditLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuari no trobat" });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, totalCount] = await Promise.all([
      AuditLog.find({ userId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments({ userId }),
    ]);

    return res.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email },
      count: logs.length,
      totalCount,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      data: logs.map(_formatLog),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtenir els logs de l'usuari",
      error: error.message,
    });
  }
};

// ─── GET STATS ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/audit-logs/stats
 * Estadístiques generals del sistema d'auditoria.
 */
export const getAuditStats = async (req, res) => {
  try {
    const [generalStats, topActions, topUsers, recentErrors] = await Promise.all([
      AuditLog.aggregate([
        {
          $group: {
            _id: null,
            totalActions: { $sum: 1 },
            successCount: {
              $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalActions: 1,
            successRate: {
              $round: [
                { $multiply: [{ $divide: ["$successCount", "$totalActions"] }, 100] },
                2,
              ],
            },
          },
        },
      ]),

      AuditLog.aggregate([
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, action: "$_id", count: 1 } },
      ]),

      AuditLog.aggregate([
        { $group: { _id: "$userId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: "$userInfo" },
        {
          $project: {
            _id: 0,
            userId: "$_id",
            userName: "$userInfo.name",
            userEmail: "$userInfo.email",
            count: 1,
          },
        },
      ]),

      AuditLog.aggregate([
        { $match: { status: "error" } },
        {
          $group: {
            _id: { action: "$action", error: "$errorMessage" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            action: "$_id.action",
            error: "$_id.error",
            count: 1,
          },
        },
      ]),
    ]);

    return res.json({
      success: true,
      data: {
        totalActions: generalStats[0]?.totalActions || 0,
        successRate: generalStats[0]?.successRate || 0,
        topActions,
        topUsers,
        recentErrors,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtenir estadístiques",
      error: error.message,
    });
  }
};

// ─── GET STATS BY USER ────────────────────────────────────────────────────────

/**
 * GET /api/admin/audit-logs/stats/user/:userId
 * Estadístiques d'auditoria d'un usuari concret.
 */
export const getUserAuditStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuari no trobat" });
    }

    const [generalStats, actionBreakdown, recentActivity] = await Promise.all([
      // Resum general de l'usuari
      AuditLog.aggregate([
        { $match: { userId: user._id } },
        {
          $group: {
            _id: null,
            totalActions: { $sum: 1 },
            successCount: {
              $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
            },
            errorCount: {
              $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] },
            },
            firstAction: { $min: "$timestamp" },
            lastAction: { $max: "$timestamp" },
          },
        },
        {
          $project: {
            _id: 0,
            totalActions: 1,
            successCount: 1,
            errorCount: 1,
            firstAction: 1,
            lastAction: 1,
            successRate: {
              $cond: [
                { $eq: ["$totalActions", 0] },
                0,
                {
                  $round: [
                    {
                      $multiply: [
                        { $divide: ["$successCount", "$totalActions"] },
                        100,
                      ],
                    },
                    2,
                  ],
                },
              ],
            },
          },
        },
      ]),

      // Accions més freqüents de l'usuari
      AuditLog.aggregate([
        { $match: { userId: user._id } },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, action: "$_id", count: 1 } },
      ]),

      // Últimes 5 accions
      AuditLog.find({ userId })
        .sort({ timestamp: -1 })
        .limit(5)
        .select("action status timestamp resource resourceType"),
    ]);

    return res.json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email },
        stats: generalStats[0] || {
          totalActions: 0,
          successCount: 0,
          errorCount: 0,
          successRate: 0,
        },
        actionBreakdown,
        recentActivity,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtenir les estadístiques de l'usuari",
      error: error.message,
    });
  }
};

// ─── EXPORT CSV ───────────────────────────────────────────────────────────────

/**
 * GET /api/admin/audit-logs/export?format=csv
 * Exporta els logs d'auditoria en format CSV.
 * Suporta els mateixos filtres que getAuditLogs.
 */
export const exportAuditLogs = async (req, res) => {
  try {
    const { userId, action, status, startDate, endDate, format = "csv" } = req.query;

    const filter = {};
    if (userId) filter.userId = userId;
    if (action) filter.action = { $regex: action, $options: "i" };
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    // Màxim 5000 registres per exportació
    const logs = await AuditLog.find(filter)
      .populate("userId", "name email")
      .sort({ timestamp: -1 })
      .limit(5000);

    if (format === "csv") {
      // Generar CSV manualment (sense llibreries externes)
      const headers = [
        "ID",
        "Usuari ID",
        "Usuari Nom",
        "Usuari Email",
        "Acció",
        "Recurs",
        "Tipus Recurs",
        "Estat",
        "IP",
        "Timestamp",
        "Error",
      ];

      const rows = logs.map((log) => [
        log._id,
        log.userId?._id || "",
        _escapeCsv(log.userId?.name || ""),
        _escapeCsv(log.userId?.email || ""),
        _escapeCsv(log.action || ""),
        _escapeCsv(log.resource || ""),
        _escapeCsv(log.resourceType || ""),
        log.status || "",
        log.ipAddress || "",
        log.timestamp ? log.timestamp.toISOString() : "",
        _escapeCsv(log.errorMessage || ""),
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");

      // Configurar headers de descàrrega
      const filename = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      // BOM per a Excel (UTF-8)
      return res.send("\uFEFF" + csvContent);
    }

    // Format JSON per defecte si no és CSV
    return res.json({
      success: true,
      count: logs.length,
      data: logs.map(_formatLog),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al exportar els logs",
      error: error.message,
    });
  }
};

// ─── HELPERS PRIVATS ─────────────────────────────────────────────────────────

const _formatLog = (log) => ({
  id: log._id,
  userId: log.userId?._id || log.userId,
  userName: log.userId?.name || "Usuari desconegut",
  userEmail: log.userId?.email || null,
  action: log.action,
  resource: log.resource,
  resourceType: log.resourceType,
  status: log.status,
  changes: log.changes,
  errorMessage: log.errorMessage,
  ipAddress: log.ipAddress,
  userAgent: log.userAgent,
  timestamp: log.timestamp,
});

/**
 * _escapeCsv(value)
 * Escapa un valor per a CSV: si conté comes, cometes o salts de línia,
 * l'envolta amb cometes dobles i escapa les cometes internes.
 */
const _escapeCsv = (value) => {
  if (!value) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};