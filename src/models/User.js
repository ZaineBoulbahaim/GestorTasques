import mongoose from "mongoose";
import bcrypt from "bcrypt";

/** Define la estructura de los documentos de usuario en MongoDB */
const userSchema = new mongoose.Schema(
  {
    // NOMBRE del usuario 
    name: {
      type: String,
      trim: true,
    },

    // EMAIL del usuario (obligatorio y único)
    email: {
      type: String,
      required: [true, "El email es obligatorio"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Por favor ingresa un email válido",
      ],
    },

    // CONTRASEÑA del usuario (obligatoria, mínimo 6 caracteres)
    password: {
      type: String,
      required: [true, "La contraseña es obligatoria"],
      minlength: [6, "La contraseña debe tener mínimo 6 caracteres"],
      select: false,
    },

    // ROL del usuario (por defecto es "user", puede ser "admin")
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  {
    timestamps: true,
  }
);

/** MIDDLEWARE PRE-SAVE
 * Se ejecuta ANTES de guardar un usuario en la base de datos
 * Cifra la contraseña solo si ha sido modificada o es nueva */
userSchema.pre("save", async function () {
  // Si la contraseña NO ha sido modificada, salimos
  if (!this.isModified("password")) {
    return;
  }

  // CIFRAR la contraseña con bcrypt
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * MÉTODO PARA COMPARAR CONTRASEÑAS
 * Compara una contraseña en texto plano con la contraseña cifrada
 * @param {String} candidatePassword - Contraseña que el usuario ingresa al hacer login
 * @returns {Promise<Boolean>} - true si coinciden, false si no
 */
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * MÉTODO toJSON PERSONALIZADO
 * Se ejecuta automáticamente cuando convertimos el usuario a JSON
 * Elimina la contraseña de la respuesta por seguridad
 */
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

/**
 * CREAMOS EL MODELO
 * A partir del esquema creamos el modelo User
 */
const User = mongoose.model("User", userSchema);

export default User;