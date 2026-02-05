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
      select: false,                     // Nunca se devuelve la contraseña por defecto
    },

    // ROL del usuario (MANTENEMOS este campo por compatibilidad)
    // El middleware roleCheck.js actual usa este campo
    // Cuando asignemos rols nuevos, actualizaremos este campo también
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // ─── CAMPO NUEVO ─────────────────────────────────────────────
    // ARRAY DE ROLES del usuario
    // Es IGUAL a como "permissions" funciona en el modelo Role:
    // cada elemento es una REFERENCIA (ObjectId) al modelo Role
    //
    // Ejemplo en MongoDB:
    //   roles: ["507f...012", "507f...013"]
    //          ^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^
    //          ID del rol      ID del rol
    //          "editor"        "viewer"
    //
    // Con populate("roles") se convierten en objetos completos
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,  // Tipo: ID de MongoDB
        ref: "Role",                           // Referencia al modelo Role
      },
    ],
    // ─── FI CAMP NOU ─────────────────────────────────────────────
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

// MÉTODOS NUEVOS RELACIONADOS CON ROLES
/**
 * MÉTODO: addRole
 * Añade un rol al array de roles de ESTE usuario
 * Es IGUAL a como funciona "addPermission" en el modelo Role
 * @param {String} roleId - ID del rol a añadir
 * 
 * Ejemplo de uso:
 *   const usuario = await User.findById("...011");
 *   await usuario.addRole("...012");   ← añade rol "editor"
 */
userSchema.methods.addRole = function (roleId) {
  // Verificamos si el rol YA existe en el array (evitar duplicados)
  if (!this.roles.includes(roleId)) {
    // Si no existe, lo añadimos
    this.roles.push(roleId);
  }
  // Guardamos los cambios
  return this.save();
};

/**
 * MÉTODO: removeRole
 * Elimina un rol del array de roles de ESTE usuario
 * Es IGUAL a como funciona "removePermission" en el modelo Role
 * @param {String} roleId - ID del rol a eliminar
 */
userSchema.methods.removeRole = function (roleId) {
  // filter() crea un nuevo array sin el rol que queremos eliminar
  // toString() porque los ObjectId no se comparan directamente con ===
  this.roles = this.roles.filter(
    (id) => id.toString() !== roleId.toString()
  );
  return this.save();
};

/**
 * MÉTODO: getEffectivePermissions
 * Obtiene TODOS los permisos que tiene este usuario
 * combinando los permisos de TODOS sus roles
 * 
 * IMPORTANTE: Este método necesita que los roles estén populated
 * y que dentro de cada rol, los permisos también estén populated
 * 
 * Ejemplo:
 *   Usuario tiene roles: ["editor", "viewer"]
 *   "editor"  tiene permisos: ["tasks:create", "tasks:read", "tasks:update"]
 *   "viewer"  tiene permisos: ["tasks:read"]
 *   
 *   getEffectivePermissions() retorna: ["tasks:create", "tasks:read", "tasks:update"]
 *                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *                                       "tasks:read" aparece solo UNA vez (sin duplicados)
 */
userSchema.methods.getEffectivePermissions = function () {
  // Verificamos que los roles estén populated
  // Si están populated, cada rol es un objeto con campo "permissions"
  // Si NO están populated, solo serían IDs (strings)
  if (!this.roles || this.roles.length === 0) {
    return [];                           // Si no tiene roles, no tiene permisos
  }

  // Anem a recopilar tots els noms de permisos de tots els rols
  // reduce() va recorrer cada rol i va acumular els permisos
  const allPermissions = this.roles.reduce((accumulator, role) => {
    // Si el rol no està populated o no té permisos, tornem l'acumulador sense canvis
    if (!role.permissions) return accumulator;

    // Cada permís dins del rol té un camp "name" (ej: "tasks:create")
    // map() extrae solo los nombres de los permisos
    const permissionNames = role.permissions.map((perm) => perm.name);

    // concat() une el acumulador amb els nous noms de permisos
    return accumulator.concat(permissionNames);
  }, []);                                // [] és el valor inicial de l'acumulador

  // [...new Set()] elimina duplicados
  // Set és una estructura que solo permite valores únicos
  // Ejemplo: ["tasks:read", "tasks:read", "tasks:create"]
  //          → Set → ["tasks:read", "tasks:create"]
  return [...new Set(allPermissions)];
};

/**
 * MÉTODO toJSON PERSONALIZADO
 * Se ejecuta automáticamente cuando convertimos el usuario a JSON
 * Elimina la contraseña de la respuesta por seguridad
 */
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;            // Mai retornar la contraseña
  return userObject;
};

/**
 * CREAMOS EL MODELO
 */
const User = mongoose.model("User", userSchema);

export default User;