import mongoose from "mongoose";

/** Define la estructura de las tareas en MongoDB */
const taskSchema = new mongoose.Schema(
  {
    /** Campo user: Referencia al usuario que creó la tarea */
    user: {
      type: mongoose.Schema.Types.ObjectId, // Tipo ObjectId (ID de MongoDB)
      ref: "User",                          // Referencia al modelo User
      required: [true, "La tarea debe tener un usuario asignado"],
      index: true,                          // Crear índice para búsquedas rápidas
    },

    // CAMPOS EXISTENTES
    
    title: {
      type: String,
      required: [true, "El título es obligatorio"],
      trim: true,
      maxlength: [100, "El título no puede superar los 100 caracteres"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "La descripción no puede superar los 500 caracteres"],
    },

    completed: {
      type: Boolean,
      default: false,
    },

    cost: {
      type: Number,
      min: [0, "El coste no puede ser negativo"],
      default: 0,
    },

    hours_estimated: {
      type: Number,
      min: [0, "Las horas estimadas no pueden ser negativas"],
      default: 0,
    },

    finished_at: {
      type: Date,
      default: null,
    },

    image: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // Crea automáticamente createdAt y updatedAt
  }
);

/**ÍNDICES COMPUESTOS
 Útil para filtrar tareas de un usuario por estado */
taskSchema.index({ user: 1, completed: 1 });

/** MÉTODO VIRTUAL: Obtener tareas populadas con datos del usuario */
taskSchema.virtual("ownerInfo", {
  ref: "User",
  localField: "user",
  foreignField: "_id",
  justOne: true,
});

// Crear y exportar el modelo
const Task = mongoose.model("Task", taskSchema);

export default Task;