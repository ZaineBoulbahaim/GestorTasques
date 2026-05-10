import permissionService from "../services/permissionService.js"; // Importamos el servicio
import AuditLog from "../models/AuditLog.js";

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "Sessió no iniciada" });
      }

      // ── CAMBIO CLAVE: Usamos el servicio que resuelve jerarquías y delegaciones ──
      const { permissionNames } = await permissionService.getUserEffectivePermissions(req.user);
      
      const hasPermission = permissionNames.includes(requiredPermission);

      if (!hasPermission) {
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

      req.userPermissions = permissionNames;
      next();
    } catch (error) {
      console.error("Critical Security Error:", error);
      res.status(500).json({ success: false, message: "Error intern en validar autorització" });
    }
  };
};

export default checkPermission;