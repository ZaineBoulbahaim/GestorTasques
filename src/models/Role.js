import mongoose from "mongoose";

/**
 * MODEL DE ROL (Role)
 * Un rol és un contenidor o agrupació de permisos. 
 * Permet assignar un conjunt de capacitats a un usuari de cop.
 */
const roleSchema = new mongoose.Schema(
  {
    // Nom del rol (únic). Ex: "admin", "editor", "viewer"
    name: {
      type: String,
      required: [true, "El nom del rol és obligatori"],
      unique: true,
      trim: true,
      lowercase: true,
    },

    // Descripció de les capacitats del rol
    description: {
      type: String,
      trim: true,
      default: "",
    },

    // Relació Many-to-Many amb el model Permission
    // Guardem un array d'ObjectIds que apunten a la col·lecció 'permissions'
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],

    // Protecció contra l'esborrat de rols base (admin/user)
    isSystemRole: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ÍNDEXS PER A OPTIMITZACIÓ
roleSchema.index({ name: 1 }, { unique: true });

// MÈTODES D'INSTÀNCIA (Sobre un rol concret)

/**
 * Afegeix un permís al rol si no el té ja.
 */
roleSchema.methods.addPermission = function (permissionId) {
  if (!this.permissions.includes(permissionId)) {
    this.permissions.push(permissionId);
  }
  return this.save();
};

/**
 * Elimina un permís del rol.
 */
roleSchema.methods.removePermission = function (permissionId) {
  this.permissions = this.permissions.filter(
    (id) => id.toString() !== permissionId.toString()
  );
  return this.save();
};

/**
 * Verifica si el rol té un permís concret per nom.
 * Requereix que el camp 'permissions' estigui populated.
 */
roleSchema.methods.hasPermission = function (permissionName) {
  return this.permissions.some(
    (permission) => permission.name && permission.name === permissionName
  );
};

// MÈTODES ESTÀTICS (Sobre el model global)

/**
 * Busca un rol pel seu nom i carrega automàticament els seus permisos.
 */
roleSchema.statics.findByName = function (name) {
  return this.findOne({ name: name.toLowerCase() }).populate("permissions");
};

const Role = mongoose.model("Role", roleSchema);

export default Role;