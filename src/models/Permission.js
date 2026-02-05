import mongoose from "mongoose";

/**
 * MODEL DE PERMIS (Permission)
 * Representa una capacitat atòmica dins del sistema. 
 * Utilitzem el format "recurs:acció" per garantir una estructura llegible i escalable.
 */
const permissionSchema = new mongoose.Schema(
  {
    // Nom del permís (Clau de seguretat)
    // Ex: "tasks:create", "audit:view"
    name: {
      type: String,
      required: [true, "El nom del permís és obligatori"],
      unique: true,
      trim: true,
      lowercase: true,
    },

    // Descripció amigable per a la interfície d'usuari
    description: {
      type: String,
      required: [true, "La descripció del permís és obligatòria"],
      trim: true,
    },

    // Agrupació lògica per organitzar la matriu de permisos
    category: {
      type: String,
      required: [true, "La categoria és obligatòria"],
      enum: {
        values: ["tasks", "users", "roles", "permissions", "audit", "reports"],
        message: "{VALUE} no és una categoria vàlida",
      },
      lowercase: true,
    },

    // Protecció del sistema contra esborrats accidentals
    isSystemPermission: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ÍNDEXS PER A OPTIMITZACIÓ
permissionSchema.index({ name: 1 }, { unique: true });
permissionSchema.index({ category: 1 });

// MÈTODES ESTÀTICS
/**
 * Retorna tots els permisos d'un mòdul concret.
 */
permissionSchema.statics.findByCategory = function (category) {
  return this.find({ category: category.toLowerCase() });
};

/**
 * Llista quines categories estan actives actualment.
 */
permissionSchema.statics.getCategories = function () {
  return this.distinct("category");
};

const Permission = mongoose.model("Permission", permissionSchema);

export default Permission;