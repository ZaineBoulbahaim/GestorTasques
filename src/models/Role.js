import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nom del rol és obligatori"],
      unique: true, // Esto ya crea un índice, no hace falta poner index: true ni definirlo abajo
      trim: true,
      lowercase: true,
    },
    level: {
      type: Number,
      default: 1,
      required: true,
    },
    parentRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      default: null,
    },
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

// ÍNDEXS (Solo los que no son únicos por defecto)
roleSchema.index({ level: 1 });
roleSchema.index({ parentRole: 1 });

// VALIDACIÓ PRE-SAVE
// Si usas async/await en el pre-save, NO uses 'next'. Mongoose detecta la promesa.
roleSchema.pre("save", async function () {
  if (this.parentRole && this._id && this.parentRole.equals(this._id)) {
    throw new Error("Un rol no pot ser el seu propi pare");
  }
});

// MÈTODES D'INSTÀNCIA
roleSchema.methods.addPermission = function (permissionId) {
  if (!this.permissions.includes(permissionId)) {
    this.permissions.push(permissionId);
  }
  return this.save();
};

roleSchema.methods.removePermission = function (permissionId) {
  this.permissions = this.permissions.filter(
    (id) => id.toString() !== permissionId.toString()
  );
  return this.save();
};

const Role = mongoose.model("Role", roleSchema);
export default Role;