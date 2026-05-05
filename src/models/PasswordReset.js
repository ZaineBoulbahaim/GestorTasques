import mongoose from "mongoose";
import crypto from "crypto";

/**
 * MODEL DE RECUPERACIÓ DE CONTRASENYA (PasswordReset)
 *
 * Gestiona el flux de "forgot password":
 *   1. L'usuari demana un reset → creem un document amb un token segur
 *   2. Enviem el token per email (com a URL: /reset-password/:token)
 *   3. L'usuari clica l'enllaç → validem el token i actualitzem la contrasenya
 *   4. Marquem el token com usat (usedAt) per evitar reutilitzacions
 *
 * Seguretat:
 *   - El token que enviem per email és el token en clar (rawToken)
 *   - A la base de dades NOMÉS guardem el hash del token
 *   - Així, si la BD es compromet, els tokens de l'email no serveixen
 *   - És el mateix principi que bcrypt per contrasenyes
 *
 *   rawToken  → enviem per email (URL)
 *   hashedToken → guardem a MongoDB
 *
 *   Per validar: hash(rawToken de l'URL) === hashedToken de la BD?
 */
const passwordResetSchema = new mongoose.Schema(
  {
    // Referència a l'usuari que vol recuperar la contrasenya
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "L'ID d'usuari és obligatori"],
    },

    // Hash SHA-256 del token (NO el token en clar per seguretat)
    // El token en clar s'envia per email, aquí guardem el hash
    hashedToken: {
      type: String,
      required: [true, "El token és obligatori"],
    },

    // Fins quan és vàlid (normalment 1 hora des de la creació)
    expiresAt: {
      type: Date,
      required: [true, "La data d'expiració és obligatòria"],
    },

    // Quan s'ha usat (null si encara no s'ha usat)
    // Un token usat NO es pot tornar a usar, fins i tot si no ha expirat
    usedAt: {
      type: Date,
      default: null,
    },

    // IP des d'on s'ha fet la petició (per seguretat i auditoria)
    requestIp: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── ÍNDEXS ────────────────────────────────────────────────────────────────

// Busquem per hashedToken quan validem el reset
passwordResetSchema.index({ hashedToken: 1 });

// Busquem per userId per invalidar resets anteriors quan se'n crea un nou
passwordResetSchema.index({ userId: 1 });

// TTL: MongoDB esborra automàticament els resets expirats
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── VIRTUALS ──────────────────────────────────────────────────────────────

/**
 * Virtual: isValid
 * Retorna true si el token encara és vàlid (no expirat i no usat).
 */
passwordResetSchema.virtual("isValid").get(function () {
  return !this.usedAt && this.expiresAt > new Date();
});

// ─── MÈTODES D'INSTÀNCIA ───────────────────────────────────────────────────

/**
 * reset.markAsUsed()
 * Marca el token com usat per evitar reutilitzacions.
 * S'ha de cridar IMMEDIATAMENT després de canviar la contrasenya.
 */
passwordResetSchema.methods.markAsUsed = function () {
  this.usedAt = new Date();
  return this.save();
};

// ─── MÈTODES ESTÀTICS ──────────────────────────────────────────────────────

/**
 * PasswordReset.createResetToken(userId, requestIp)
 * Genera un token segur, crea el document i retorna el rawToken.
 *
 * Flux:
 *   1. Genera 32 bytes aleatoris com rawToken (hex = 64 caràcters)
 *   2. Calcula el hash SHA-256 del rawToken
 *   3. Invalida tokens anteriors de l'usuari (per seguretat)
 *   4. Guarda el document amb el HASH (no el raw)
 *   5. Retorna el rawToken → l'enviem per email
 *
 * @param {ObjectId} userId    - ID de l'usuari
 * @param {String} requestIp   - IP de la petició
 * @returns {String} rawToken  - Token en clar per enviar per email
 */
passwordResetSchema.statics.createResetToken = async function (
  userId,
  requestIp = null
) {
  // 1. Generar token aleatori segur (criptogràficament)
  const rawToken = crypto.randomBytes(32).toString("hex");

  // 2. Hash SHA-256 del token → el que guardarem a la BD
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  // 3. Invalidar qualsevol reset anterior pendent d'aquest usuari
  //    (evita tenir múltiples tokens vàlids alhora)
  await this.updateMany(
    { userId, usedAt: null },
    { $set: { usedAt: new Date() } }          // marca tots com usats
  );

  // 4. Crear el nou document (guardem el HASH, no el rawToken)
  await this.create({
    userId,
    hashedToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
    requestIp,
  });

  // 5. Retornem el rawToken → l'enviarem per email
  return rawToken;
};

/**
 * PasswordReset.findByRawToken(rawToken)
 * Busca un document de reset pel token en clar (de l'URL de l'email).
 * Converteix el rawToken a hash i busca per hash.
 * Retorna null si no existeix, ha expirat o ja ha estat usat.
 *
 * @param {String} rawToken - Token en clar rebut per URL
 * @returns {Document|null}
 */
passwordResetSchema.statics.findByRawToken = function (rawToken) {
  // Recalculem el hash per comparar amb el que tenim a la BD
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  return this.findOne({
    hashedToken,
    usedAt: null,                             // Que no s'hagi usat
    expiresAt: { $gt: new Date() },          // Que no hagi expirat
  });
};

const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema);

export default PasswordReset;