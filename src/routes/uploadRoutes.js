// src/routes/uploadRoutes.js
import express from "express";
import path from "path";

// Middlewares para subida
import uploadLocal from "../middleware/uploadLocal.js"; // Subida local
import uploadCloud from "../middleware/uploadCloud.js"; // Subida a Cloudinary

// Configuración de Cloudinary
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

/* 1. SUBIR IMAGEN LOCALMENTE
   Ruta: POST /api/upload/local*/
router.post("/local", uploadLocal.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No se envió ningún archivo",
    });
  }

  // Respuesta con los datos de la imagen subida
  res.json({
    success: true,
    message: "Imagen subida localmente",
    image: {
      filename: req.file.filename,
      path: req.file.path,
      url: `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype,
    },
  });
});

/* 2. SUBIR IMAGEN A CLOUDINARY
   Ruta: POST /api/upload/cloud */
router.post("/cloud", uploadCloud.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No se envió archivo" });
  }

  // Creamos promesa para subir a Cloudinary
  const uploadToCloud = () =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "task-manager/images" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

  uploadToCloud()
    .then((result) => {
      res.json({
        success: true,
        message: "Imagen subida a Cloudinary",
        image: {
          url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          size: result.bytes,
        },
      });
    })
    .catch((err) => {
      res.status(500).json({ success: false, message: err.message });
    });
});

export default router;