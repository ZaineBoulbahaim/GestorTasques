import AuditLog from "../models/AuditLog.js";

/**
 * MIDDLEWARE D'AUDITORIA DINÀMICA
 * Intercepta el cicle de petició-resposta (request-response) per registrar accions.
 */
const auditMiddleware = async (req, res, next) => {
  // 1. INTERCEPCIÓ DEL MÈTODE res.json
  // Guardem la referència a la funció original per poder enviar la resposta real més tard.
  const originalJson = res.json.bind(res);

  /**
   * SOBREESCRIPTURA TEMPORAL (Monkey Patch)
   * Aquesta funció s'executarà automàticament quan qualsevol controlador faci un res.json().
   */
  res.json = async function (data) {
    // A) FILTRATGE: Decidim si la petició mereix ser registrada per no saturar la DB de logs inútils.
    const shouldAudit = shouldAuditRequest(req, res);

    if (!shouldAudit) {
      // Si el client ja ha rebut capçaleres (per algun error previ), sortim per evitar col·lisions.
      if (res.headersSent) return;
      return originalJson(data);
    }

    // B) EXTRACCIÓ DE METADADES
    try {
      // Prioritzem el permís definit al middleware de seguretat; si no n'hi ha, el deduïm.
      const action = req.permission || determineAction(req);
      
      // Identifiquem l'objecte afectat, normalment l'ID que ve a la URL (req.params.id).
      const resource = req.params.id || null;
      
      // Classifiquem el recurs (tasca, usuari, etc.) basant-nos en el path.
      const resourceType = determineResourceType(req.path);

      // Definim l'estat basant-nos en el codi HTTP (200-299 és èxit).
      const status = res.statusCode >= 200 && res.statusCode < 300 ? "success" : "error";

      // Capturem el body enviat per l'usuari (els canvis proposats).
      const changes = req.body || null;

      // Si la resposta és un error, capturem el missatge que el controlador envia al frontend.
      const errorMessage = status === "error" && data.message ? data.message : null;

      // C) PERSISTÈNCIA ASÍNCRONA
      // Només registrem si hi ha un subjecte (usuari autenticat) realitzant l'acció.
      if (req.user && req.user._id) {
        await AuditLog.log(
          req.user._id,
          action,
          resource,
          resourceType,
          status,
          changes,
          req, // Enviem tot el 'req' perquè el model extregui IP i UserAgent.
          errorMessage
        );
      }
    } catch (error) {
      // IMPORTANT: Si l'auditoria falla (ex: DB caiguda), l'usuari NO ho ha de notar.
      // Fem un log a la consola del servidor però deixem que la petició acabi correctament.
      console.error("CRITICAL: Error al crear log d'auditoria:", error.message);
    }

    // D) FINALITZACIÓ DE LA RESPOSTA
    // Un cop fet el log, cridem a la funció JSON original amb les dades que volia el controlador.
    if (res.headersSent) return;
    return originalJson(data);
  };

  // Passem el control al següent middleware o al controlador de la ruta.
  next();
};

// ============================================================
// LOGICA DE DECISIÓ I MAPEJAT
// ============================================================

/**
 * DETERMINA SI CAL AUDITAR
 * Evitem registrar milers de GETs simples que no canvien d'estat (soroll).
 */
function shouldAuditRequest(req, res) {
  if (!req.user) return false;

  // 1. Qualsevol intent de modificació (POST, PUT, DELETE) es registra SEMPRE.
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) return true;

  // 2. Operacions de lectura en rutes crítiques d'administració (ex: veure logs o llista d'usuaris).
  if (req.method === "GET" && req.path.startsWith("/admin")) return true;

  // 3. Errors d'accés o del servidor: ens interessa saber si algú està intentant "atacar" rutes.
  if (res.statusCode >= 400) return true;

  return false;
}

/**
 * DEDUEIX L'ACCIÓ
 * Converteix un mètode HTTP en una acció llegible (ex: PUT /api/tasks -> tasks:update).
 */
function determineAction(req) {
  const pathParts = req.path.split("/").filter(Boolean);
  const resource = pathParts[1] || "unknown"; // Assumeix format /api/resource/...

  const actionMap = {
    POST: "create",
    GET: "read",
    PUT: "update",
    DELETE: "delete",
    PATCH: "update",
  };

  return `${resource}:${actionMap[req.method] || "unknown"}`;
}

/**
 * MAPEJAT DE RECURSOS
 * Ajuda a filtrar logs per tipus a la base de dades.
 */
function determineResourceType(path) {
  if (path.includes("/tasks")) return "task";
  if (path.includes("/users")) return "user";
  if (path.includes("/roles")) return "role";
  if (path.includes("/permissions")) return "permission";
  if (path.includes("/audit")) return "audit";
  return "other";
}

export default auditMiddleware;