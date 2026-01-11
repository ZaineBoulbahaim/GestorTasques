import Task from "../models/Task.js";

/**
 * CREAR NUEVA TAREA
 * 
 * POST /api/tasks
 * Body: { title, description, cost, hours_estimated, image }
 * 
 * CAMBIOS:
 * - Ahora asigna automáticamente el usuario autenticado
 * - El usuario NO puede especificar manualmente el propietario
 */
export const createTask = (req, res) => {
  // Extraer datos del body
  const { title, description, cost, hours_estimated, image } = req.body;

  // Crear nueva tarea asignando automáticamente el usuario autenticado
  const task = new Task({
    title,
    description,
    cost,
    hours_estimated,
    image,
    user: req.user._id, // ⬅️ IMPORTANTE: Asignar usuario desde req.user
  });

  // Guardar en la base de datos
  task
    .save()
    .then((savedTask) => {
      res.status(201).json({
        success: true,
        message: "Tarea creada correctamente",
        data: savedTask,
      });
    })
    .catch((error) => {
      res.status(400).json({
        success: false,
        message: "Error al crear la tarea",
        error: error.message,
      });
    });
};

/**
 * OBTENER TODAS LAS TAREAS
 * 
 * GET /api/tasks
 * 
 * CAMBIOS:
 * - Ahora solo devuelve las tareas del usuario autenticado
 * - Filtra automáticamente por req.user._id
 */
export const getAllTasks = (req, res) => {
  // Buscar solo las tareas que pertenecen al usuario autenticado
  Task.find({ user: req.user._id }) // ⬅️ Filtrar por usuario
    .sort({ createdAt: -1 }) // Ordenar por más recientes primero
    .then((tasks) => {
      res.json({
        success: true,
        count: tasks.length,
        data: tasks,
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al obtener las tareas",
        error: error.message,
      });
    });
};

/**
 * OBTENER TAREA POR ID
 * 
 * GET /api/tasks/:id
 * 
 * CAMBIOS:
 * - Verifica que la tarea pertenezca al usuario autenticado
 * - Si no es el propietario, devuelve 404 (como si no existiera)
 */
export const getTaskById = (req, res) => {
  // Buscar por ID Y por usuario (doble verificación)
  Task.findOne({
    _id: req.params.id,
    user: req.user._id, // ⬅️ Solo si pertenece al usuario
  })
    .then((task) => {
      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Tarea no encontrada",
        });
      }

      res.json({
        success: true,
        data: task,
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al obtener la tarea",
        error: error.message,
      });
    });
};

/**
 * 
 * ACTUALIZAR TAREA
 * 
 * PUT /api/tasks/:id
 * Body: { title, description, cost, hours_estimated, completed }
 * 
 * CAMBIOS:
 * - Verifica que la tarea pertenezca al usuario antes de actualizar
 * - Solo el propietario puede modificar la tarea
 */
export const updateTask = (req, res) => {
  // Buscar y actualizar solo si pertenece al usuario
  Task.findOneAndUpdate(
    {
      _id: req.params.id,
      user: req.user._id, // ⬅️ Verificar propiedad
    },
    req.body,
    { new: true, runValidators: true } // Devolver documento actualizado
  )
    .then((task) => {
      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Tarea no encontrada o no tienes permiso para modificarla",
        });
      }

      // Si se marca como completada y no tenía fecha de finalización
      if (task.completed && !task.finished_at) {
        task.finished_at = new Date();
        return task.save();
      }

      return task;
    })
    .then((updatedTask) => {
      res.json({
        success: true,
        message: "Tarea actualizada correctamente",
        data: updatedTask,
      });
    })
    .catch((error) => {
      res.status(400).json({
        success: false,
        message: "Error al actualizar la tarea",
        error: error.message,
      });
    });
};

/** ELIMINAR TAREA */
export const deleteTask = (req, res) => {
  // Buscar y eliminar solo si pertenece al usuario
  Task.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id, // ⬅️ Verificar propiedad
  })
    .then((task) => {
      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Tarea no encontrada o no tienes permiso para eliminarla",
        });
      }

      res.json({
        success: true,
        message: "Tarea eliminada correctamente",
        data: task,
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al eliminar la tarea",
        error: error.message,
      });
    });
};

/** OBTENER ESTADÍSTICAS DE TAREAS */
export const getTaskStats = (req, res) => {
  // Agregación con filtro por usuario
  Task.aggregate([
    // PASO 1: Filtrar solo las tareas del usuario autenticado
    {
      $match: {
        user: req.user._id, // ⬅️ Filtrar por usuario
      },
    },
    // PASO 2: Agrupar y calcular estadísticas
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        completedTasks: {
          $sum: { $cond: ["$completed", 1, 0] },
        },
        pendingTasks: {
          $sum: { $cond: ["$completed", 0, 1] },
        },
        totalCost: { $sum: "$cost" },
        totalHours: { $sum: "$hours_estimated" },
        averageCost: { $avg: "$cost" },
        averageHours: { $avg: "$hours_estimated" },
      },
    },
  ])
    .then((stats) => {
      // Si no hay tareas, devolver estadísticas vacías
      if (stats.length === 0) {
        return res.json({
          success: true,
          data: {
            totalTasks: 0,
            completedTasks: 0,
            pendingTasks: 0,
            totalCost: 0,
            totalHours: 0,
            averageCost: 0,
            averageHours: 0,
          },
        });
      }

      res.json({
        success: true,
        data: stats[0],
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al obtener estadísticas",
        error: error.message,
      });
    });
};