import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * RATE LIMITER T9 — PER NIVELLS DE ROL
 *
 * Límits definits a l'enunciat:
 *   SUPER_ADMIN → 1000 req/min
 *   ADMIN       → 500  req/min
 *   MANAGER     → 200  req/min
 *   USER        → 100  req/min
 *   VIEWER      → 50   req/min
 *   No autenticat → 30 req/min (protecció extra)
 *
 * Nota T9: No s'usa Redis perquè express-rate-limit amb MemoryStore
 * és suficient per a un projecte acadèmic. En producció real
 * s'usaria RedisStore per compartir comptadors entre instàncies.
 *
 * Headers retornats automàticament (standardHeaders: true):
 *   RateLimit-Limit     → límit màxim
 *   RateLimit-Remaining → peticions restants
 *   RateLimit-Reset     → quan es reinicia el comptador
 */

// ─── MAPA DE LÍMITS PER ROL ─────────────────────────────────────────────────

const ROLE_LIMITS = {
  super_admin: 1000,
  admin: 500,
  manager: 200,
  user: 100,
  viewer: 50,
};

/**
 * getLimitByRole(user)
 * Determina el límit de peticions segons el rol de l'usuari.
 *
 * Estratègia: agafem el rol de major level (més permisos = més límit).
 * Si l'usuari té roles populats (objectes), llegim el name.
 * Si té roles com a IDs (strings), usem el camp role simple com a fallback.
 *
 * @param {Object|null} user - req.user (pot ser null si no està autenticat)
 * @returns {Number} Límit de peticions per minut
 */
const getLimitByRole = (user) => {
  if (!user) return 30; // No autenticat: límit molt baix

  // Intentar llegir els rols populats (objectes amb .name)
  if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
    // Trobar el límit màxim entre tots els rols de l'usuari
    // (un usuari amb admin + viewer obté el límit d'admin)
    let maxLimit = 30;
    for (const role of user.roles) {
      const roleName = typeof role === "object" ? role.name : null;
      if (roleName && ROLE_LIMITS[roleName]) {
        maxLimit = Math.max(maxLimit, ROLE_LIMITS[roleName]);
      }
    }
    if (maxLimit > 30) return maxLimit;
  }

  // Fallback: usar el camp role simple (string) de compatibilitat T7/T8
  if (user.role && ROLE_LIMITS[user.role]) {
    return ROLE_LIMITS[user.role];
  }

  // Fallback final: tractar com a USER
  return ROLE_LIMITS.user;
};

// ─── LIMITER DINÀMIC PRINCIPAL ───────────────────────────────────────────────

/**
 * dynamicRateLimiter
 * Middleware principal que aplica el límit segons el rol de req.user.
 * Usar DESPRÉS del middleware auth perquè req.user ja estigui disponible.
 *
 * Exemple d'ús a server.js:
 *   app.use(auth);                   // primer autenticar
 *   app.use(dynamicRateLimiter);     // després limitar per rol
 */
export const dynamicRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,            // Finestra de 1 minut

  // max pot ser una funció que rep (req, res) → retorna el límit
  max: (req) => getLimitByRole(req.user),

  // Clau d'identificació: per IP + userId (si autenticat)
  // Així cada usuari té el seu propi comptador, no compartit per IP
  keyGenerator: (req) => {
    const userId = req.user?._id?.toString() || "anonymous";
    return `${ipKeyGenerator(req)}_${userId}`;
  },

  message: (req) => ({
    success: false,
    message: "Has superat el límit de peticions permès per al teu rol",
    limit: getLimitByRole(req.user),
    code: "RATE_LIMIT_EXCEEDED",
  }),

  standardHeaders: true,               // Retorna RateLimit-* headers (RFC 6585)
  legacyHeaders: false,                // Desactiva X-RateLimit-* (obsolets)

  // Skippejar per a rutes que no volem limitar (ex: health check)
  skip: (req) => req.path === "/health",
});

// ─── LIMITER ESPECÍFIC PER AUTH ──────────────────────────────────────────────

/**
 * authRateLimiter
 * Protecció extra per a rutes sensibles: login, forgot-password.
 * Evita atacs de força bruta.
 *
 * Límit: 10 intents per IP cada 15 minuts.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,           // 15 minuts
  max: 10,                             // Màxim 10 intents

  keyGenerator: (req) => ipKeyGenerator(req),

  message: {
    success: false,
    message:
      "Massa intents d'accés. Per seguretat, s'ha bloquejat la IP durant 15 minuts.",
    code: "AUTH_RATE_LIMIT_EXCEEDED",
  },

  standardHeaders: true,
  legacyHeaders: false,
});

// ─── LIMITER ESTRICTE PER RUTES CRÍTIQUES ────────────────────────────────────

/**
 * strictRateLimiter
 * Per a operacions molt sensibles: reset-password, canvi de rol, etc.
 * Límit: 5 intents per IP cada 30 minuts.
 */
export const strictRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,           // 30 minuts
  max: 5,

  keyGenerator: (req) => ipKeyGenerator(req),

  message: {
    success: false,
    message: "Massa intents. Torna-ho a intentar en 30 minuts.",
    code: "STRICT_RATE_LIMIT_EXCEEDED",
  },

  standardHeaders: true,
  legacyHeaders: false,
});