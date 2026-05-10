import mongoose from "mongoose";

/**
 * MODEL DE ROL (Role)
 * Un rol és un contenidor o agrupació de permisos. 
 * Permet assignar un conjunt de capacitats a un usuari de cop.
 */
const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nom del rol és obligatori"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    // --- NUEVOS CAMPOS T9 ---
    level: {
      type: Number,
      default: 1, // 1: VIEWER, 5: SUPER_ADMIN
      required: true
    },
    parentRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      default: null
    },
    // ------------------------
    description: {
      type: String,
      trim: true,
      default: "",
    },
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],
    isSystemRole: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ... (tus índices y métodos actuales están bien)

// VALIDACIÓN DE JERARQUÍA: Evitar que un rol sea su propio padre (ciclo infinito)
roleSchema.pre('save', function(next) {
  if (this.parentRole && this.parentRole.equals(this._id)) {
    return next(new Error("Un rol no pot ser el seu propi pare (evitar bucles infinits)"));
  }
  next();
});

const Role = mongoose.model("Role", roleSchema);
export default Role;