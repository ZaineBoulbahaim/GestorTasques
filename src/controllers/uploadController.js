// Importamos Cloudinary configurado
import cloudinary from "../config/cloudinary.js";

// Función para subir imágenes a Cloudinary
export const uploadToCloudinary = async (req, res) => {
  try {
    // Verificamos que el usuario haya enviado un archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No se ha enviado ninguna imagen",
      });
    }

    // Subimos la imagen temporal a Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "task_manager", // Carpeta donde se guardarán tus imágenes
    });

    // Respondemos con la información de la imagen subida
    res.json({
      success: true,
      message: "Imagen subida correctamente a Cloudinary",
      url: result.secure_url,     // URL accesible públicamente
      public_id: result.public_id, // ID para poder borrar imágenes si hiciera falta
    });
  } catch (error) {
    console.error("❌ Error al subir a Cloudinary:", error);
    res.status(500).json({
      success: false,
      message: "Error al subir la imagen",
      error: error.message,
    });
  }
};
