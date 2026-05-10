import jwt from "jsonwebtoken";

/**
 * SERVEI JWT AVANÇAT (jwtService)
 *
 * Centralitza tota la lògica de generació i verificació de tokens.
 * T9 usa DOS tokens en lloc d'un:
 *
 *   ACCESS TOKEN  (15 min) → s'envia a cada petició com a Bearer
 *   REFRESH TOKEN (7 dies) → s'usa NOMÉS per renovar l'access token
 *
 * Per què dues claus secretes separades?
 *   Si usem la mateixa clau, un refresh token es podria usar com access token.
 *   Amb claus separades, cada token NOMÉS és vàlid pel seu endpoint específic.
 *
 * Variables d'entorn necessàries:
 *   JWT_ACCESS_SECRET   → clau secreta per access tokens
 *   JWT_REFRESH_SECRET  → clau secreta per refresh tokens
 *   JWT_ACCESS_EXPIRES_IN  → durada access (default: "15m")
 *   JWT_REFRESH_EXPIRES_IN → durada refresh (default: "7d")
 */

// ─── GENERACIÓ DE TOKENS ────────────────────────────────────────────────────

/**
 * generateAccessToken(user)
 * Genera un access token de curta durada (15 minuts per defecte).
 *
 * El payload inclou:
 *   - userId    → per identificar l'usuari
 *   - email     → per logs i auditoria
 *   - role      → rol simple (compatibilitat amb T7/T8)
 *   - roles     → array d'IDs de rols (sistema nou T9)
 *   - tokenType → 'access' per distingir-lo del refresh
 *
 * @param {Object} user - Document d'usuari de MongoDB (populat o no)
 * @returns {String} token JWT signat
 */
const generateAccessToken = (user) => {
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    roles: user.roles || [],
    tokenType: "access",
  };

  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  });
};

/**
 * generateRefreshToken(userId)
 * Genera un refresh token de llarga durada (7 dies per defecte).
 *
 * El payload és MÍNIM: només userId i tokenType.
 * No incloem permisos ni rols perquè:
 *   1. El refresh token NO accedeix a recursos, NOMÉS renova l'access token
 *   2. Si el rol canvia durant la sessió, el nou access token ja ho reflectirà
 *
 * @param {String|ObjectId} userId - ID de l'usuari
 * @returns {String} token JWT signat
 */
const generateRefreshToken = (userId) => {
  const payload = {
    userId: userId.toString(),
    tokenType: "refresh",
  };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });
};

// ─── VERIFICACIÓ DE TOKENS ──────────────────────────────────────────────────

/**
 * verifyAccessToken(token)
 * Verifica i decodifica un access token.
 *
 * Llança errors específics per tipus de problema:
 *   TokenExpiredError → el token és vàlid però ha expirat (cal refresh)
 *   JsonWebTokenError → el token és invàlid o falsificat
 *
 * @param {String} token - Token JWT a verificar
 * @returns {Object} payload decodificat { userId, email, role, roles, tokenType }
 * @throws {jwt.TokenExpiredError | jwt.JsonWebTokenError}
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

/**
 * verifyRefreshToken(token)
 * Verifica i decodifica un refresh token.
 * Usa JWT_REFRESH_SECRET (diferent de l'access) per seguretat.
 *
 * @param {String} token - Refresh token JWT a verificar
 * @returns {Object} payload decodificat { userId, tokenType }
 * @throws {jwt.TokenExpiredError | jwt.JsonWebTokenError}
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

// ─── UTILITATS ──────────────────────────────────────────────────────────────

/**
 * decodeTokenWithoutVerify(token)
 * Decodifica el payload sense verificar la signatura ni l'expiració.
 * IMPORTANT: Usar NOMÉS per obtenir metadades (ex: expiresAt per a la blacklist).
 * MAI usar per autenticar.
 *
 * @param {String} token - Token JWT
 * @returns {Object|null} payload decodificat o null si és invàlid
 */
const decodeTokenWithoutVerify = (token) => {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
};

/**
 * getTokenExpiration(token)
 * Retorna la data d'expiració d'un token com a objecte Date.
 * Útil per calcular l'expiresAt quan s'afegeix a la blacklist.
 *
 * @param {String} token - Token JWT
 * @returns {Date|null} data d'expiració o null si no es pot decodificar
 */
const getTokenExpiration = (token) => {
  const decoded = decodeTokenWithoutVerify(token);
  if (!decoded || !decoded.exp) return null;
  // decoded.exp és en segons des de l'epoch (Unix timestamp)
  return new Date(decoded.exp * 1000);
};

// ─── EXPORTACIÓ ─────────────────────────────────────────────────────────────

const jwtService = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeTokenWithoutVerify,
  getTokenExpiration,
};

export default jwtService;