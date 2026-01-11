import multer from "multer";

// Usamos memoria en vez de disco, Cloudinary recibirá el buffer
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const mimetype = allowedTypes.test(file.mimetype.toLowerCase());

  if (mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten imágenes"));
  }
};

const limits = { fileSize: 5 * 1024 * 1024 }; // 5MB

const uploadCloud = multer({ storage, fileFilter, limits });

export default uploadCloud;
