import Task from "../models/Task.js";
import AuditLog from "../models/AuditLog.js";

/**
 * CREAR NOVA TASCA
 * Registra una tasca vinculada a l'usuari i genera una entrada a l'historial d'auditoria.
 */
export const createTask = (req, res) => {
  const { title, description, cost, hours_estimated, image } = req.body;

  // 1. Instanciem la tasca assignant l'ID de l'usuari des del token (req.user)
  const task = new Task({
    title,
    description,
    cost,
    hours_estimated,
    image,
    user: req.user._id,
  });

  let savedTaskData;

  // 2. Persistència en base de dades
  task
    .save()
    .then((savedTask) => {
      savedTaskData = savedTask;

      // 3. AUDITORIA: Registrem qui ha creat el recurs i amb quines dades.
      // El mètode AuditLog.log captura automàticament IP i UserAgent mitjançant 'req'.
      return AuditLog.log(
        req.user._id,
        "tasks:create",
        savedTask._id.toString(),
        "task",
        "success",
        {
          title: savedTask.title,
          cost: savedTask.cost,
        },
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
      res.status(400).json({ success: false, message: "Error al crear la tasca", error: error.message });
    });
};

/**
 * ACTUALITZAR TASCA
 * Gestiona la modificació de tasques i el "diff" (diferència) entre dades velles i noves.
 */
export const updateTask = (req, res) => {
  let originalTask;
  let updatedTaskData;

  // 1. Recuperem l'estat actual de la tasca abans de sobreescriure-la per poder comparar canvis.
  Task.findOne({ _id: req.params.id, user: req.user._id })
    .then((task) => {
      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Tasca no trobada o no tens permisos",
        });
      }

      // Guardem una "snapshot" dels valors originals.
      originalTask = {
        title: task.title,
        description: task.description,
        cost: task.cost,
        hours_estimated: task.hours_estimated,
        completed: task.completed,
      };

      // 2. Executem l'actualització amb validació de dades activa.
      return Task.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        req.body,
        { new: true, runValidators: true }
      );
    })
    .then((task) => {
      if (!task) return;
      updatedTaskData = task;

      // Lògica de negoci: Si es marca com a completada ara, registrem el timestamp de finalització.
      if (task.completed && !task.finished_at) {
        task.finished_at = new Date();
        return task.save();
      }
      return task;
    })
    .then((finalTask) => {
      if (!finalTask) return;

      // 3. CÀLCUL DE CANVIS: Comparem camp per camp per guardar només el que ha variat a l'auditoria.
      const changes = {};
      const fields = ["title", "description", "cost", "hours_estimated", "completed"];
      
      fields.forEach(field => {
        if (originalTask[field] !== finalTask[field]) {
          changes[field] = `${originalTask[field]} → ${finalTask[field]}`;
        }
      });

      // 4. AUDITORIA: Registrem l'acció amb el detall de les modificacions.
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
      res.status(400).json({ success: false, message: "Error al actualitzar", error: error.message });
    });
};

/**
 * ELIMINAR TASCA
 * Esborra el recurs i registra una còpia de seguretat de les dades eliminades al log d'auditoria.
 */
export const deleteTask = (req, res) => {
  let deletedTaskData;

  Task.findOneAndDelete({ _id: req.params.id, user: req.user._id })
    .then((task) => {
      if (!task) {
        return res.status(404).json({ success: false, message: "Tasca no trobada" });
      }

      deletedTaskData = task;

      // AUDITORIA: Guardem el títol de la tasca eliminada perquè l'administrador sàpiga què s'ha perdut.
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
      res.status(500).json({ success: false, message: "Error al eliminar", error: error.message });
    });
};

/**
 * ESTADÍSTIQUES DE TASQUES
 * Utilitza el motor d'agregació de MongoDB per calcular mètriques en temps real.
 */
export const getTaskStats = (req, res) => {
  Task.aggregate([
    // ETAPA 1: Filtrem només les tasques que pertanyen a l'usuari actual.
    { $match: { user: req.user._id } },

    // ETAPA 2: Processem els documents per calcular totals, mitjanes i sumes condicionals.
    {
      $group: {
        _id: null, // Agrupem tot el set de dades filtrat en un sol objecte de resultats.
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
      // Si l'usuari no té tasques, l'array d'agregació estarà buit. Retornem valors a zero.
      if (stats.length === 0) {
        return res.json({
          success: true,
          data: { totalTasks: 0, completedTasks: 0, pendingTasks: 0, totalCost: 0, totalHours: 0 },
        });
      }

      res.json({ success: true, data: stats[0] });
    })
    .catch((error) => {
      res.status(500).json({ success: false, message: "Error en estadístiques", error: error.message });
    });
};