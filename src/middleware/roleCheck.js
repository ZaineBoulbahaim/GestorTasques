/**
 MIDDLEWARE DE VERIFICACIÓN DE ROL
 * Este middleware verifica que el usuario autenticado tenga
 * uno de los roles permitidos para acceder a una ruta específica
 * @param {Array} allowedRoles - Array con los roles permitidos (ej: ['admin'] o ['user', 'admin'])
 * @returns {Function} Middleware que verifica el rol
 */
const roleCheck = (allowedRoles) => {
  /**
   * Esta función devuelve OTRA función (el middleware real)
   * Esto nos permite pasar parámetros al middleware
   */
  
  return (req, res, next) => {
    /**
     * VERIFICAR QUE EL USUARIO ESTÁ AUTENTICADO */
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "No autorizado. Debes iniciar sesión primero",
      });
    }

    /** VERIFICAR QUE EL USUARIO TIENE UN ROL VÁLIDO
     * Comprobamos que el rol del usuario esté en la lista */
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "No tienes permisos para acceder a este recurso",
      });
    }

    /** SI TODO ESTÁ BIEN, CONTINUAR */
    next();
  };
};

// Exportamos el middleware para usarlo en las rutas
export default roleCheck;