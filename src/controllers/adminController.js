import User from "../models/User.js";
import Task from "../models/Task.js";

/** 
 * OBTENER TODOS LOS USUARIOS
 * 
 * GET /api/admin/users
 * Solo accesible para administradores
 */
export const getAllUsers = (req, res) => {
  // Obtener todos los usuarios (sin contraseña)
  User.find()
    .select("-password") // Excluir contraseña
    .sort({ createdAt: -1 }) // Ordenar por más recientes
    .then((users) => {
      res.json({
        success: true,
        count: users.length,
        data: users,
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al obtener usuarios",
        error: error.message,
      });
    });
};

/** 
 * OBTENER TODAS LAS TAREAS DEL SISTEMA
 * 
 * GET /api/admin/tasks
 * Solo accesible para administradores
 * Incluye información del usuario propietario
 */
export const getAllTasks = (req, res) => {
  // Obtener todas las tareas con información del usuario
  Task.find()
    .populate("user", "name email role") // Poblar datos del usuario (sin contraseña)
    .sort({ createdAt: -1 }) // Ordenar por más recientes
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
        message: "Error al obtener tareas",
        error: error.message,
      });
    });
};

/** 
 * ELIMINAR USUARIO
 * 
 * DELETE /api/admin/users/:id
 * Solo accesible para administradores
 * 
 * Funcionalidad:
 * 1. Verificar que el admin no se elimine a sí mismo
 * 2. Eliminar todas las tareas del usuario
 * 3. Eliminar el usuario
 */
export const deleteUser = (req, res) => {
  const userId = req.params.id;

  // PASO 1: Verificar que el admin no se elimine a sí mismo
  if (userId === req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: "No puedes eliminarte a ti mismo",
    });
  }

  // PASO 2: Buscar el usuario
  User.findById(userId)
    .then((user) => {
      if (!user) {
        return Promise.reject({
          statusCode: 404,
          message: "Usuario no encontrado",
        });
      }

      // PASO 3: Eliminar todas las tareas del usuario
      return Task.deleteMany({ user: userId })
        .then((deletedTasks) => {
          console.log(`✅ Eliminadas ${deletedTasks.deletedCount} tareas del usuario`);
          
          // PASO 4: Eliminar el usuario
          return User.findByIdAndDelete(userId);
        });
    })
    .then((deletedUser) => {
      res.json({
        success: true,
        message: `Usuario ${deletedUser.email} y sus tareas eliminados correctamente`,
        data: {
          id: deletedUser._id,
          email: deletedUser.email,
          name: deletedUser.name,
        },
      });
    })
    .catch((error) => {
      // Manejar errores personalizados
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }

      // Otros errores
      res.status(500).json({
        success: false,
        message: "Error al eliminar usuario",
        error: error.message,
      });
    });
};

/**
 * CAMBIAR ROL DE USUARIO
 * 
 * PUT /api/admin/users/:id/role
 * Solo accesible para administradores
 * 
 * Body: { role: "user" | "admin" }
 * 
 * Funcionalidad:
 * 1. Verificar que el admin no cambie su propio rol
 * 2. Validar que el rol sea válido (user o admin)
 * 3. Actualizar el rol del usuario
 */
export const changeUserRole = (req, res) => {
  const userId = req.params.id;
  const { role } = req.body;

  // PASO 1: Verificar que el admin no cambie su propio rol
  if (userId === req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: "No puedes cambiar tu propio rol",
    });
  }

  // PASO 2: Validar que el rol sea válido
  if (!role || !["user", "admin"].includes(role)) {
    return res.status(400).json({
      success: false,
      message: "Rol inválido. Debe ser 'user' o 'admin'",
    });
  }

  // PASO 3: Buscar y actualizar el usuario
  User.findByIdAndUpdate(
    userId,
    { role },
    { new: true } // Devolver documento actualizado
  )
    .select("-password") // No devolver contraseña
    .then((user) => {
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      res.json({
        success: true,
        message: `Rol de ${user.email} cambiado a ${role} correctamente`,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al cambiar rol",
        error: error.message,
      });
    });
};

/** 
 * OBTENER ESTADÍSTICAS GENERALES DEL SISTEMA

 * GET /api/admin/stats
 * Solo accesible para administradores

 * Devuelve:
 * - Total de usuarios
 * - Total de tareas
 * - Tareas completadas
 * - Tareas pendientes
 */
export const getSystemStats = (req, res) => {
  // Promesas para obtener estadísticas
  Promise.all([
    User.countDocuments(), // Total de usuarios
    Task.countDocuments(), // Total de tareas
    Task.countDocuments({ completed: true }), // Tareas completadas
    Task.countDocuments({ completed: false }), // Tareas pendientes
  ])
    .then(([totalUsers, totalTasks, completedTasks, pendingTasks]) => {
      res.json({
        success: true,
        data: {
          users: {
            total: totalUsers,
          },
          tasks: {
            total: totalTasks,
            completed: completedTasks,
            pending: pendingTasks,
            completionRate: totalTasks > 0 
              ? ((completedTasks / totalTasks) * 100).toFixed(2) + '%'
              : '0%',
          },
        },
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