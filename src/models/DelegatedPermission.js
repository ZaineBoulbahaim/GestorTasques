import mongoose from "mongoose";

/**
 * MODEL DE DELEGACIÓ DE PERMISOS (DelegatedPermission)
 *
 * Permet que un usuari amb permisos suficients cedeixi temporalment
 * una capacitat a un altre usuari.
 *
 * Exemple real:
 *   Un Manager que se'n va de vacances pot delegar el permís
 *   "tasks:assign" a un User de confiança durant 5 dies.
 *   Quan el Manager torni, el permís expira automàticament
 *   o ell mateix el pot revocar manualment.
 *
 * Cicle de vida d'una delegació:
 *   1. Es crea amb status: 'active'
 *   2. L'usuari destí pot usar el permís fins a 'expiresAt'
 *   3a. Expira automàticament (cron job canvia status a 'expired')
 *   3b. O el delegant la revoca manualment (status → 'revoked')
 */
const delegatedPermissionSchema = new mongoose.Schema(
  {
    // Qui delega el permís (ha de tenir el permís que vol delegar)
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "L'usuari delegant és obligatori"],
    },

    // Qui rep el permís temporal
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "L'usuari receptor és obligatori"],
    },

    // Quin permís s'està delegant (referència al model Permission)
    permission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
      required: [true, "El permís a delegar és obligatori"],
    },

    // Per què es fa la delegació (justificació, útil per auditoria)
    reason: {
      type: String,
      trim: true,
      maxlength: [500, "El motiu no pot superar 500 caràcters"],
      default: "",
    },

    // Quan s'ha creat la delegació
    delegatedAt: {
      type: Date,
      default: Date.now,
    },

    // Fins quan és vàlid el permís delegat
    expiresAt: {
      type: Date,
      required: [true, "La data d'expiració és obligatòria"],
    },

    // Quan s'ha revocat manualment (null si no s'ha revocat)
    revokedAt: {
      type: Date,
      default: null,
    },

    // Estat actual de la delegació
    // 'active'  → el permís és usable ara mateix
    // 'expired' → ha passat expiresAt (actualitzat per cron job)
    // 'revoked' → el delegant l'ha cancel·lat manualment
    status: {
      type: String,
      enum: {
        values: ["active", "expired", "revoked"],
        message: "L'estat ha de ser 'active', 'expired' o 'revoked'",
      },
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// ─── ÍNDEXS ────────────────────────────────────────────────────────────────

// Busquem sovint "permisos actius de l'usuari X" → índex compost
delegatedPermissionSchema.index({ toUserId: 1, status: 1 });

// Busquem delegacions fetes per un usuari concret
delegatedPermissionSchema.index({ fromUserId: 1 });

// Índex per als cron jobs que busquen delegacions expirades
delegatedPermissionSchema.index({ expiresAt: 1, status: 1 });

// ─── VIRTUALS ──────────────────────────────────────────────────────────────

/**
 * Virtual: isCurrentlyActive
 * Retorna true si la delegació és activa I no ha expirat encara.
 * Un status 'active' pot tenir expiresAt en el passat si el cron
 * no ha corregut encara → aquest virtual ho comprova exactament.
 */
delegatedPermissionSchema.virtual("isCurrentlyActive").get(function () {
  return this.status === "active" && this.expiresAt > new Date();
});

// ─── MÈTODES D'INSTÀNCIA ───────────────────────────────────────────────────

/**
 * delegation.revoke()
 * Revoca manualment aquesta delegació.
 * Estableix revokedAt = ara i canvia status a 'revoked'.
 */
delegatedPermissionSchema.methods.revoke = function () {
  this.status = "revoked";
  this.revokedAt = new Date();
  return this.save();
};

// ─── MÈTODES ESTÀTICS ──────────────────────────────────────────────────────

/**
 * DelegatedPermission.getActiveForUser(userId)
 * Retorna tots els permisos delegats ACTIUS i NO expirats per a un usuari.
 * Fa populate del permís per obtenir el nom (ex: "tasks:assign").
 *
 * Exemple d'ús:
 *   const delegats = await DelegatedPermission.getActiveForUser(userId);
 *   // delegats[0].permission.name → "tasks:assign"
 */
delegatedPermissionSchema.statics.getActiveForUser = function (userId) {
  return this.find({
    toUserId: userId,
    status: "active",
    expiresAt: { $gt: new Date() },          // Que no hagi expirat encara
  }).populate("permission");
};

/**
 * DelegatedPermission.expireOld()
 * Marca com 'expired' totes les delegacions que haurien d'haver expirat.
 * Cridat des del cron job periòdic.
 * Retorna el nombre de documents actualitzats.
 */
delegatedPermissionSchema.statics.expireOld = async function () {
  const result = await this.updateMany(
    {
      status: "active",
      expiresAt: { $lte: new Date() },       // expiresAt ja ha passat
    },
    {
      $set: { status: "expired" },
    }
  );
  return result.modifiedCount;
};

const DelegatedPermission = mongoose.model(
  "DelegatedPermission",
  delegatedPermissionSchema
);

export default DelegatedPermission;