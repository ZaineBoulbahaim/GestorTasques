// src/middleware/checkPermission.js

import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

/**
 * MIDDLEWARE DE VERIFICACIÓ DE PERMISOS
 * * Implementa un control d'accés basat en permisos granulars. 
 * A diferència dels rols, permet una flexibilitat total: pots treure o afegir 
 * capacitats a un usuari sense canviar el seu rol principal.
 */
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // 1. Verificació de pre-condició: L'usuari ha d'estar identificat.
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Sessió no iniciada",
        });
      }

      // 2. Resolució de la Matriu de Permisos
      // Fem un 'deep populate': Usuari -> Rols -> Permisos.
      // Això ens permet navegar per tota la jerarquia de seguretat en una sola consulta.
      const user = await User.findById(req.user._id).populate({
        path: "roles",
        populate: {
          path: "permissions",
        },
      });

      if (!user) {
        return res.status(401).json({ success: false, message: "Usuari invàlid" });
      }

      // 3. Obtenció de permisos efectius
      // Invoquem el mètode d'instància del model User que aplana l'array de rols
      // en una llista simple de strings: ['tasks:read', 'tasks:write', ...]
      const userPermissions = user.getEffectivePermissions();

      // 4. Validació del permís requerit
      const hasPermission = userPermissions.includes(requiredPermission);

      if (!hasPermission) {
        // SEGURETAT PROACTIVA: Si algú intenta accedir a una zona prohibida,
        // ho registrem a l'auditoria com un intent d'error per detectar possibles atacs.
        await AuditLog.log(
          req.user._id,
          `access_denied:${requiredPermission}`,
          null,
          "security",
          "error",
          { requestedPath: req.originalUrl },
          req,
          "Permís insuficient"
        );

        return res.status(403).json({
          success: false,
          message: "No tens permís per realitzar aquesta operació",
          required: requiredPermission,
        });
      }

      // 5. Enriquiment del Request
      // Passem la llista de permisos al següent middleware/controlador.
      // Això és útil si el controlador vol fer lògica extra (ex: amagar camps sensibles).
      req.permission = requiredPermission;
      req.userPermissions = userPermissions;

      next();
      
    } catch (error) {
      console.error("Critical Security Error:", error);
      res.status(500).json({
        success: false,
        message: "Error intern en validar autorització",
      });
    }
  };
};

export default checkPermission;