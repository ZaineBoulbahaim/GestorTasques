// Importamos mongoose, que nos permite conectarnos a MongoDB
import mongoose from "mongoose";

// Función para conectar a MongoDB
const connectDB = async () => {
  try {
    // Intentamos conectar usando la URL que estará en el archivo .env
    await mongoose.connect(process.env.MONGO_URI);

    // Si funciona, mostramos este mensaje
    console.log("🟢 Conectado a MongoDB correctamente");
  } catch (error) {
    // Si hay un error, lo mostramos en consola
    console.error("🔴 Error al conectar a MongoDB:", error);

    // Finalizamos la app porque sin la base de datos no puede funcionar
    process.exit(1);
  }
};

// Exportamos la función para usarla en server.js
export default connectDB;
