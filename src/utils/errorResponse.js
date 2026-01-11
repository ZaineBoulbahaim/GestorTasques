/**
 * CLASE PERSONALIZADA PARA ERRORES

 * Esta clase extiende la clase Error nativa de JavaScript
 * y añade un código de estado HTTP (statusCode)

 * Permite crear errores personalizados con mensajes y códigos específicos */
class ErrorResponse extends Error {
  /**
   * Constructor de la clase
   * @param {String} message - Mensaje de error
   * @param {Number} statusCode - Código HTTP (400, 404, 500, etc.)
   */
  constructor(message, statusCode) {
    // Llamamos al constructor de Error (clase padre)
    super(message);
    
    // Añadimos el código de estado
    this.statusCode = statusCode;
  }
}

/**MIDDLEWARE GLOBAL DE MANEJO DE ERRORES
 
 * Este middleware captura TODOS los errores que ocurran en la aplicación
 * y devuelve una respuesta JSON consistente
 * Se debe colocar AL FINAL de todas las rutas en server.js */
export const errorHandler = (err, req, res, next) => {
  // Copiamos el error para no modificar el original
  let error = { ...err };
  error.message = err.message;

  // Log del error en consola (solo en desarrollo)
  if (process.env.NODE_ENV === "development") {
    console.log("❌ ERROR:", err);
  }

  /** MANEJO DE ERRORES ESPECÍFICOS DE MONGOOSE*/
  // Error de CastError (ID inválido de MongoDB)
  if (err.name === "CastError") {
    const message = "Recurso no encontrado";
    error = new ErrorResponse(message, 404);
  }

  // Error de duplicación (email ya registrado)
  if (err.code === 11000) {
    const message = "Este email ya está registrado";
    error = new ErrorResponse(message, 400);
  }

  // Error de validación de Mongoose
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors).map((val) => val.message);
    error = new ErrorResponse(message, 400);
  }

  // Error de JWT (token inválido o expirado)
  if (err.name === "JsonWebTokenError") {
    const message = "Token inválido";
    error = new ErrorResponse(message, 401);
  }

  if (err.name === "TokenExpiredError") {
    const message = "Token expirado";
    error = new ErrorResponse(message, 401);
  }

  /**
   * Enviamos una respuesta JSON con:
   * - success: false
   * - message: Mensaje de error
   * - stack: Pila de errores (solo en desarrollo)*/
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Error del servidor",
    // Solo mostrar stack trace en desarrollo
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export default ErrorResponse;