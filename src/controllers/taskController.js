import Task from "../models/Task.js";
import AuditLog from "../models/AuditLog.js";

/**
 * CREAR NOVA TASCA
 */
export const createTask = (req, res) => {
  const { title, description, cost, hours_estimated, image } = req.body;

  const task = new Task({
    title,
    description,
    cost,
    hours_estimated,
    image,
    user: req.user._id,
  });

  let savedTaskData;

  task
    .save()
    .then((savedTask) => {
      savedTaskData = savedTask;
      return AuditLog.log(
        req.user._id,
        "tasks:create",
        savedTask._id.toString(),
        "task",
        "success",
        { title: savedTask.title, cost: savedTask.cost },
        req
      );
    })
    .then(() => {
      res.status(201).json({
        success: true,
        message: "Tasca creada correctament",
        data: savedTaskData,
      });
    })
    .catch((error) => {
      res.status(400).json({
        success: false,
        message: "Error al crear la tasca",
        error: error.message,
      });
    });
};

/**
 * LLISTAR TOTES LES TASQUES DE L'USUARI
 * Suporta paginació: ?page=1&limit=10
 */
export const getAllTasks = (req, res) => {
  const { page = 1, limit = 10, completed } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Filtre: només les tasques de l'usuari autenticat
  const filter = { user: req.user._id };

  // Filtre opcional per estat
  if (completed !== undefined) {
    filter.completed = completed === "true";
  }

  Promise.all([
    Task.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Task.countDocuments(filter),
  ])
    .then(([tasks, totalCount]) => {
      res.json({
        success: true,
        count: tasks.length,
        totalCount,
        page: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        data: tasks,
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al obtenir les tasques",
        error: error.message,
      });
    });
};

/**
 * OBTENIR UNA TASCA PER ID
 */
export const getTaskById = (req, res) => {
  Task.findOne({ _id: req.params.id, user: req.user._id })
    .then((task) => {
      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Tasca no trobada o no tens permisos",
        });
      }
      res.json({ success: true, data: task });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al obtenir la tasca",
        error: error.message,
      });
    });
};

/**
 * ACTUALITZAR TASCA
 */
export const updateTask = (req, res) => {
  let originalTask;
  let updatedTaskData;

  Task.findOne({ _id: req.params.id, user: req.user._id })
    .then((task) => {
      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Tasca no trobada o no tens permisos",
        });
      }

      originalTask = {
        title: task.title,
        description: task.description,
        cost: task.cost,
        hours_estimated: task.hours_estimated,
        completed: task.completed,
      };

      return Task.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        req.body,
        { new: true, runValidators: true }
      );
    })
    .then((task) => {
      if (!task) return;
      updatedTaskData = task;

      if (task.completed && !task.finished_at) {
        task.finished_at = new Date();
        return task.save();
      }
      return task;
    })
    .then((finalTask) => {
      if (!finalTask) return;

      const changes = {};
      const fields = ["title", "description", "cost", "hours_estimated", "completed"];
      fields.forEach((field) => {
        if (originalTask[field] !== finalTask[field]) {
          changes[field] = `${originalTask[field]} → ${finalTask[field]}`;
        }
      });

      return AuditLog.log(
        req.user._id,
        "tasks:update",
        finalTask._id.toString(),
        "task",
        "success",
        changes,
        req
      );
    })
    .then(() => {
      res.json({
        success: true,
        message: "Tasca actualitzada correctament",
        data: updatedTaskData,
      });
    })
    .catch((error) => {
      res.status(400).json({
        success: false,
        message: "Error al actualitzar",
        error: error.message,
      });
    });
};

/**
 * ELIMINAR TASCA
 */
export const deleteTask = (req, res) => {
  let deletedTaskData;

  Task.findOneAndDelete({ _id: req.params.id, user: req.user._id })
    .then((task) => {
      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Tasca no trobada",
        });
      }

      deletedTaskData = task;

      return AuditLog.log(
        req.user._id,
        "tasks:delete",
        task._id.toString(),
        "task",
        "success",
        { title: task.title, description: task.description },
        req
      );
    })
    .then(() => {
      res.json({
        success: true,
        message: "Tasca eliminada correctament",
        data: deletedTaskData,
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al eliminar",
        error: error.message,
      });
    });
};

/**
 * ESTADÍSTIQUES DE TASQUES
 */
export const getTaskStats = (req, res) => {
  Task.aggregate([
    { $match: { user: req.user._id } },
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        completedTasks: { $sum: { $cond: ["$completed", 1, 0] } },
        pendingTasks: { $sum: { $cond: ["$completed", 0, 1] } },
        totalCost: { $sum: "$cost" },
        totalHours: { $sum: "$hours_estimated" },
        averageCost: { $avg: "$cost" },
        averageHours: { $avg: "$hours_estimated" },
      },
    },
  ])
    .then((stats) => {
      if (stats.length === 0) {
        return res.json({
          success: true,
          data: {
            totalTasks: 0,
            completedTasks: 0,
            pendingTasks: 0,
            totalCost: 0,
            totalHours: 0,
          },
        });
      }
      res.json({ success: true, data: stats[0] });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error en estadístiques",
        error: error.message,
      });
    });
};