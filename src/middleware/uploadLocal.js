// Importamos Multer y Path para manejo de rutas
import multer from "multer";
import path from "path";

// Configuración del almacenamiento local
const storage = multer.diskStorage({
  // Carpeta donde se guardarán las imágenes
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  // Nombre del archivo: timestamp + nombre original para evitar colisiones
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + file.originalname;
    cb(null, uniqueSuffix);
  },
});

// Filtro de archivos: solo imágenes
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const mimetype = allowedTypes.test(file.mimetype.toLowerCase());
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    cb(null, true); // Aceptar archivo
  } else {
    cb(new Error("Solo se permiten imágenes (jpeg, jpg, png, gif, webp)"));
  }
};

// Tamaño máximo: 5MB
const limits = {
  fileSize: 5 * 1024 * 1024, // 5MB
};

// Creamos el middleware Multer
const uploadLocal = multer({
  storage,
  fileFilter,
  limits,
});

export default uploadLocal;
