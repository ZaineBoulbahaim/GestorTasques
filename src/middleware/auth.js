// Importamos jsonwebtoken para verificar tokens
import jwt from "jsonwebtoken";

// Importamos el modelo User para buscar el usuario
import User from "../models/User.js";

/**
 * MIDDLEWARE DE AUTENTICACIÓN
 * Este middleware actúa como un "guardia de seguridad"
 * Se ejecuta ANTES del controlador de la ruta
 * @param {Object} req - Objeto de petición (request)
 * @param {Object} res - Objeto de respuesta (response)
 * @param {Function} next - Función para continuar al siguiente middleware/controlador
 */
const auth = (req, res, next) => {
  /** EXTRAER EL TOKEN DEL HEADER
   * 
   * El cliente debe enviar el token en el header Authorization con este formato:
   * Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...   */
  
  // Obtenemos el header Authorization
  const authHeader = req.headers.authorization;

  // Verificamos que el header exista y comience con "Bearer "
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No autorizado. Token no proporcionado",
    });
  }

  /** EXTRAER SOLO EL TOKEN
   * authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * Necesitamos solo la parte después de "Bearer "
   * split(" ") divide el string en ["Bearer", "eyJhbGciOi..."]
   * [1] obtiene el segundo elemento (el token)
   */
  const token = authHeader.split(" ")[1];

  // Verificamos que el token no esté vacío
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No autorizado. Token no proporcionado",
    });
  }

  /** VERIFICAR Y DECODIFICAR EL TOKEN
   * 
   * jwt.verify() hace dos cosas:
   * 1. Verifica que el token sea válido (no modificado, no expirado)
   * 2. Decodifica el token para obtener el payload (userId, email, role)
   */
  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    /** MANEJO DE ERRORES */
    if (error) {
      // Si el token ha expirado
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expirado. Por favor, inicia sesión nuevamente",
        });
      }

      // Si el token es inválido por cualquier otra razón
      return res.status(401).json({
        success: false,
        message: "Token inválido",
      });
    }

    /** BUSCAR EL USUARIO EN LA BASE DE DATOS
        por su ID */
    User.findById(decoded.userId)
      .select("-password") // No incluir la contraseña en los resultados
      .then((user) => {
        /** VERIFICAR QUE EL USUARIO EXISTE*/
        if (!user) {
          return res.status(401).json({
            success: false,
            message: "Usuario no encontrado. Token inválido",
          });
        }

        /** AÑADIR EL USUARIO A LA REQUEST */
        req.user = user;

        /** CONTINUAR AL SIGUIENTE MIDDLEWARE O CONTROLADOR */
        next();
      })
      .catch((error) => {
        /** ERROR AL BUSCAR EL USUARIO EN LA BASE DE DATOS */
        return res.status(500).json({
          success: false,
          message: "Error del servidor al verificar autenticación",
          error: error.message,
        });
      });
  });
};

// Exportamos el middleware para usarlo en las rutas
export default auth;