// Importamos jsonwebtoken para crear tokens
import jwt from "jsonwebtoken";

/**FUNCIÓN PARA GENERAR TOKEN JWT */
const generateToken = (user) => {
  /**PAYLOAD (Carga útil del token)*/
  const payload = {
    userId: user._id,        // ID único del usuario en MongoDB
    email: user.email,       // Email del usuario
    role: user.role,         // Rol del usuario (user o admin)
  };

  /** GENERAR EL TOKEN*/
  const token = jwt.sign(
    payload,                          // 1. Datos del usuario
    process.env.JWT_SECRET,           // 2. Clave secreta (desde .env)
    {
      expiresIn: process.env.JWT_EXPIRES_IN, // 3. Tiempo de validez (7d)
    }
  );
  // Retornamos el token generado
  return token;
};

// Exportamos la función para usarla en los controladores
export default generateToken;