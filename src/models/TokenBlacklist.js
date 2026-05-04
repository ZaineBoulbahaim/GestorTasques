import mongoose from "mongoose";

/**
 * MODEL DE BLACKLIST DE TOKENS (TokenBlacklist)
 *
 * Quan un usuari fa logout, els seus tokens (access i refresh) s'afegeixen
 * aquí. Cada petició autenticada comprova si el token és en aquesta llista.
 *
 * Per què és necessari?
 *   JWT és stateless: un cop emès, és vàlid fins que expira.
 *   Sense blacklist, un token robat o d'un usuari que ha fet logout
 *   continuaria sent vàlid fins a la seva expiració natural.
 *
 * Estratègia de neteja:
 *   Els tokens expirats es poden eliminar automàticament gràcies
 *   a l'índex TTL de MongoDB (expireAfterSeconds: 0).
 *   MongoDB compara el camp 'expiresAt' amb l'hora actual i esborra
 *   el document quan ha passat aquella data. Això evita que la col·lecció
 *   creixi indefinidament.
 */
const tokenBlacklistSchema = new mongoose.Schema(
  {
    // El token JWT complet (access o refresh)
    token: {
      type: String,
      required: [true, "El token és obligatori"],
      unique: true,
    },

    // Referència a l'usuari propietari del token
    // Útil per revocar TOTS els tokens d'un usuari si cal
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "L'ID d'usuari és obligatori"],
    },

    // Tipus de token revocat: 'access' (15min) o 'refresh' (7 dies)
    tokenType: {
      type: String,
      enum: {
        values: ["access", "refresh"],
        message: "El tipus de token ha de ser 'access' o 'refresh'",
      },
      required: [true, "El tipus de token és obligatori"],
    },

    // Quan s'ha revocat (moment del logout)
    revokedAt: {
      type: Date,
      default: Date.now,
    },

    // Quan expiraria el token de forma natural
    // MongoDB usa aquest camp per esborrar automàticament el document
    // quan ja no té sentit guardar-lo (el token ja seria invàlid de totes formes)
    expiresAt: {
      type: Date,
      required: [true, "La data d'expiració és obligatòria"],
    },
  },
  {
    // Sense timestamps automàtics: els logs de blacklist SÓN IMMUTABLES
    timestamps: false,
    versionKey: false,
  }
);

// ─── ÍNDEXS ────────────────────────────────────────────────────────────────

// Índex principal: busquem per token a CADA petició autenticada
// Ha de ser extremadament ràpid
tokenBlacklistSchema.index({ token: 1 }, { unique: true });

// Índex per userId: per revocar tots els tokens d'un usuari de cop
tokenBlacklistSchema.index({ userId: 1 });

// Índex TTL: MongoDB esborra automàticament el document quan expiresAt < ara
// expireAfterSeconds: 0 significa "esborra quan la data del camp ja ha passat"
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── MÈTODES ESTÀTICS ──────────────────────────────────────────────────────

/**
 * TokenBlacklist.isBlacklisted(token)
 * Comprova si un token concret ha estat revocat.
 * Retorna true si el token està a la blacklist, false si no.
 *
 * Exemple d'ús:
 *   const revocat = await TokenBlacklist.isBlacklisted("xxxxx.yyyyy.zzzzz");
 *   if (revocat) → rebutjar la petició
 */
tokenBlacklistSchema.statics.isBlacklisted = async function (token) {
  const found = await this.findOne({ token });
  return found !== null;
};

/**
 * TokenBlacklist.revokeToken(token, userId, tokenType, expiresAt)
 * Afegeix un token a la blacklist de forma segura.
 * Usa upsert per evitar errors si el token ja existeix (logout doble).
 *
 * @param {String} token       - El token JWT complet
 * @param {ObjectId} userId    - ID de l'usuari propietari
 * @param {String} tokenType   - 'access' o 'refresh'
 * @param {Date} expiresAt     - Data d'expiració natural del token
 */
tokenBlacklistSchema.statics.revokeToken = function (
  token,
  userId,
  tokenType,
  expiresAt
) {
  return this.updateOne(
    { token },                                 // filtre: busca per token
    {
      $setOnInsert: {                          // només insereix si no existeix
        token,
        userId,
        tokenType,
        revokedAt: new Date(),
        expiresAt,
      },
    },
    { upsert: true }                           // crea si no existeix
  );
};

/**
 * TokenBlacklist.revokeAllUserTokens(userId)
 * Per casos d'emergència: revoca TOTS els tokens actius d'un usuari.
 * Útil quan es detecta activitat sospitosa o l'usuari canvia la contrasenya.
 *
 * IMPORTANT: Això no revoca tokens futurs, només els que ja estan a la blacklist.
 * Per invalidar sessions futures, caldria canviar el JWT_SECRET (extrem).
 *
 * @param {ObjectId} userId - ID de l'usuari
 */
tokenBlacklistSchema.statics.revokeAllUserTokens = function (userId) {
  return this.deleteMany({ userId });
};

const TokenBlacklist = mongoose.model("TokenBlacklist", tokenBlacklistSchema);

export default TokenBlacklist;