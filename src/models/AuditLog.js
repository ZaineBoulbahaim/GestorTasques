import mongoose from "mongoose";

/**
 * MODEL D'AUDITORIA (AuditLog)
 * * Aquest model funciona com una "caixa negra" d'un avió: registra tot el que 
 * passa per poder analitzar-ho en cas de fallada o bretxa de seguretat.
 */
const auditLogSchema = new mongoose.Schema(
  {
    // L'usuari que executa l'acció. Fem referència a 'User'.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "L'ID d'usuari és obligatori"],
    },

    // Què s'ha fet? (ex: "tasks:update")
    action: {
      type: String,
      required: [true, "L'acció és obligatòria"],
      trim: true,
    },

    // ID del recurs (ex: ID de la tasca). Es guarda com a String per ser genèric.
    resource: {
      type: String,
      default: null,
    },

    // Tipus de recurs (ex: "task", "user", "role")
    resourceType: {
      type: String,
      default: null,
    },

    // "success" o "error"
    status: {
      type: String,
      enum: {
        values: ["success", "error"],
        message: "L'estat ha de ser 'success' o 'error'",
      },
      required: [true, "L'estat és obligatori"],
    },

    // Dades modificades. Usem 'Mixed' perquè l'estructura pot variar segons l'acció.
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    errorMessage: {
      type: String,
      default: null,
    },

    ipAddress: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      default: null,
    },

    // Data del registre (manualmente per tenir control total)
    timestamp: {
      type: Date,
      default: Date.now,
    }
  },
  {
    // No usem timestamps: true perquè els logs d'auditoria SÓN IMMUTABLES.
    // Mai s'actualitzen, només es creen.
    timestamps: false,
    versionKey: false // Estalviem espai traient el camp __v
  }
);

// OPTIMITZACIÓ: ÍNDEXS

// Indexem userId per carregar ràpid l'activitat d'un usuari.
auditLogSchema.index({ userId: 1 });

// Índex compost: Molt útil per a consultes tipus "últims logs de l'usuari X".
auditLogSchema.index({ userId: 1, timestamp: -1 });

// Índex per auditar accions específiques (ex: quants 'delete' s'han fet avui).
auditLogSchema.index({ action: 1, timestamp: -1 });

// ============================================================
// MÈTODES ESTÀTICS (Lògica de Model)
// ============================================================

/**
 * AuditLog.log()
 * Mètode centralitzat per registrar esdeveniments.
 * Extreu automàticament la IP i el UserAgent de l'objecte 'req' d'Express.
 */
auditLogSchema.statics.log = function (
  userId,
  action,
  resource,
  resourceType,
  status,
  changes,
  req,
  errorMessage = null
) {
  return this.create({
    userId,
    action,
    resource: resource ? resource.toString() : null,
    resourceType,
    status,
    changes,
    errorMessage,
    ipAddress: req?.ip || "unknown",
    userAgent: req?.headers["user-agent"] || "unknown",
    timestamp: new Date(),
  });
};

/**
 * AuditLog.getStats()
 * Analitza el rendiment i seguretat del sistema usant el motor d'agregació.
 */
auditLogSchema.statics.getStats = async function () {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalActions: { $sum: 1 },
        successCount: {
          $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
        },
        errorCount: {
          $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] },
        }
      },
    },
    {
      $project: {
        _id: 0,
        totalActions: 1,
        successRate: {
          $round: [{ $multiply: [{ $divide: ["$successCount", "$totalActions"] }, 100] }, 2]
        },
        errorRate: {
          $round: [{ $multiply: [{ $divide: ["$errorCount", "$totalActions"] }, 100] }, 2]
        }
      }
    }
  ]);
};

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;