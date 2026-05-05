import jwtService from "../services/jwtService.js";
import User from "../models/User.js";
import TokenBlacklist from "../models/TokenBlacklist.js";

/**
 * MIDDLEWARE D'AUTENTICACIÓ T9
 *
 * Evolució respecte T8:
 *   T8 → verifica signatura + expiració
 *   T9 → verifica signatura + expiració + BLACKLIST
 *
 * Flux de verificació:
 *   1. Extreure token del header Authorization: Bearer <token>
 *   2. Verificar signatura i expiració (jwtService)
 *   3. Comprovar si el token ha estat revocat (TokenBlacklist)
 *   4. Carregar l'usuari de la BD i afegir-lo a req.user
 *
 * Codis d'error específics (per al client):
 *   TOKEN_NOT_PROVIDED → no hi ha header Authorization
 *   TOKEN_EXPIRED      → token vàlid però expirat (el client ha de fer /refresh)
 *   TOKEN_INVALID      → token malmès o falsificat
 *   TOKEN_REVOKED      → token revocat per logout
 *   USER_NOT_FOUND     → l'usuari ja no existeix a la BD
 */
const auth = async (req, res, next) => {
  try {
    // ── PAS 1: Extreure token del header ─────────────────────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No autoritzat. Token no proporcionat",
        code: "TOKEN_NOT_PROVIDED",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No autoritzat. Token no proporcionat",
        code: "TOKEN_NOT_PROVIDED",
      });
    }

    // ── PAS 2: Verificar signatura i expiració ───────────────────────────
    let decoded;
    try {
      decoded = jwtService.verifyAccessToken(token);
    } catch (jwtError) {
      // El token ha expirat → el client sap que ha de fer POST /api/auth/refresh
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expirat. Renova la sessió amb el refresh token",
          code: "TOKEN_EXPIRED",
        });
      }
      // El token és invàlid per qualsevol altra raó
      return res.status(401).json({
        success: false,
        message: "Token invàlid",
        code: "TOKEN_INVALID",
      });
    }

    // Comprovació addicional: ha de ser un access token, no un refresh token
    if (decoded.tokenType !== "access") {
      return res.status(401).json({
        success: false,
        message: "Tipus de token incorrecte",
        code: "TOKEN_INVALID",
      });
    }

    // ── PAS 3: Comprovar blacklist ────────────────────────────────────────
    // Aquesta comprovació és la novetat clau de T9.
    // Un token pot ser criptogràficament vàlid però revocat (logout).
    const isRevoked = await TokenBlacklist.isBlacklisted(token);
    if (isRevoked) {
      return res.status(401).json({
        success: false,
        message: "Sessió tancada. Si us plau, inicia sessió de nou",
        code: "TOKEN_REVOKED",
      });
    }

    // ── PAS 4: Carregar l'usuari ──────────────────────────────────────────
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Usuari no trobat. Token invàlid",
        code: "USER_NOT_FOUND",
      });
    }

    // Comprovació opcional: usuari actiu
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Compte desactivat. Contacta amb l'administrador",
        code: "USER_INACTIVE",
      });
    }

    // ── PAS 5: Enriquir el request ────────────────────────────────────────
    req.user = user;
    req.token = token; // Guardem el token per si el logout el necessita

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Error intern en verificar autenticació",
    });
  }
};

export default auth;