import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";

/**
 * GET /api/admin/audit-logs
 * Gestiona la consulta de logs con soporte para filtros dinámicos y paginación.
 */
export const getAuditLogs = (req, res) => {
  const { userId, action, startDate, endDate, status, page = 1, limit = 20 } = req.query;
  const filter = {};

  // Aplicación de filtros según los parámetros recibidos en la query
  if (userId) filter.userId = userId;
  if (action) filter.action = action;
  if (status) filter.status = status;

  // Filtrado por rango de fechas (conversión a objetos Date de JS)
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = new Date(startDate);
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999); // Incluye hasta el último milisegundo del día
      filter.timestamp.$lte = endDateTime;
    }
  }

  const skip = (page - 1) * limit;

  // Ejecución paralela de la búsqueda y el conteo total para optimizar rendimiento
  Promise.all([
    AuditLog.find(filter)
      .populate("userId", "name email")
      .sort({ timestamp: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit)),
    AuditLog.countDocuments(filter),
  ])
    .then(([logs, totalCount]) => {
      // Mapeo de resultados para asegurar un formato de respuesta consistente
      const formattedLogs = logs.map((log) => ({
        id: log._id,
        userId: log.userId?._id,
        userName: log.userId?.name || "Usuari desconegut",
        userEmail: log.userId?.email,
        action: log.action,
        resource: log.resource,
        resourceType: log.resourceType,
        status: log.status,
        changes: log.changes,
        errorMessage: log.errorMessage,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        timestamp: log.timestamp,
      }));

      res.json({
        success: true,
        count: formattedLogs.length,
        totalCount,
        page: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        data: formattedLogs,
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al obtenir els logs d'auditoria",
        error: error.message,
      });
    });
};

/**
 * GET /api/admin/audit-logs/:id
 * Recupera el detalle de un log incluyendo información extendida del usuario.
 */
export const getAuditLogById = (req, res) => {
  const { id } = req.params;

  AuditLog.findById(id)
    .populate("userId", "name email role")
    .then((log) => {
      if (!log) return res.status(404).json({ success: false, message: "Log no trobat" });

      res.json({
        success: true,
        data: {
          id: log._id,
          userId: log.userId?._id,
          userName: log.userId?.name,
          userEmail: log.userId?.email,
          userRole: log.userId?.role,
          action: log.action,
          resource: log.resource,
          resourceType: log.resourceType,
          status: log.status,
          changes: log.changes,
          errorMessage: log.errorMessage,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          timestamp: log.timestamp,
        },
      });
    })
    .catch((error) => {
      res.status(500).json({ success: false, message: "Error al obtenir el log", error: error.message });
    });
};

/**
 * GET /api/admin/audit-logs/user/:userId
 * Obtiene el historial específico de acciones de un usuario para facilitar el rastreo.
 */
export const getUserAuditLogs = (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  User.findById(userId)
    .then((user) => {
      if (!user) return res.status(404).json({ success: false, message: "Usuari no trobat" });

      const skip = (page - 1) * limit;
      return Promise.all([
        AuditLog.find({ userId }).sort({ timestamp: -1 }).skip(parseInt(skip)).limit(parseInt(limit)),
        AuditLog.countDocuments({ userId }),
      ]);
    })
    .then((result) => {
      if (!result) return;
      const [logs, totalCount] = result;

      res.json({
        success: true,
        count: logs.length,
        totalCount,
        page: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        data: logs.map((log) => ({
          id: log._id,
          action: log.action,
          resource: log.resource,
          resourceType: log.resourceType,
          status: log.status,
          changes: log.changes,
          timestamp: log.timestamp,
        })),
      });
    })
    .catch((error) => {
      res.status(500).json({ success: false, message: "Error al obtenir els logs de l'usuari", error: error.message });
    });
};

/**
 * GET /api/admin/audit-logs/stats
 * Genera analíticas mediante pipelines de agregación para el panel de administración.
 */
export const getAuditStats = (req, res) => {
  Promise.all([
    // Cálculo del volumen total de operaciones y porcentaje de éxito (Success Rate)
    AuditLog.aggregate([
      {
        $group: {
          _id: null,
          totalActions: { $sum: 1 },
          successCount: { $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] } },
        },
      },
      {
        $project: {
          totalActions: 1,
          successRate: { $round: [{ $multiply: [{ $divide: ["$successCount", "$totalActions"] }, 100] }, 2] },
        },
      },
    ]),

    // Clasificación de las acciones más frecuentes ejecutadas en el sistema
    AuditLog.aggregate([
      { $group: { _id: "$action", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, action: "$_id", count: 1 } },
    ]),

    // Identificación de los 5 usuarios con mayor volumen de actividad (incluye cruce de datos)
    AuditLog.aggregate([
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "userInfo" } },
      { $unwind: "$userInfo" },
      { $project: { _id: 0, userId: "$_id", userName: "$userInfo.name", userEmail: "$userInfo.email", count: 1 } },
    ]),

    // Resumen de errores críticos: agrupa los mensajes de error por el tipo de acción
    AuditLog.aggregate([
      { $match: { status: "error" } },
      { $group: { _id: { action: "$action", error: "$errorMessage" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, action: "$_id.action", error: "$_id.error", count: 1 } },
    ]),
  ])
    .then(([generalStats, topActions, topUsers, recentErrors]) => {
      res.json({
        success: true,
        data: {
          totalActions: generalStats[0]?.totalActions || 0,
          successRate: generalStats[0]?.successRate || 0,
          topActions,
          topUsers,
          recentErrors,
        },
      });
    })
    .catch((error) => {
      res.status(500).json({ success: false, message: "Error al obtenir estadístiques", error: error.message });
    });
};