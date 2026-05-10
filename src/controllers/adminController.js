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

export const getUserById = (req, res) => {
  const { id } = req.params;

  User.findById(id)
    .select("-password")
    .populate("roles")
    .then((user) => {
      if (!user) {
        return res.status(404).json({ success: false, message: "Usuari no trobat" });
      }
      res.json({ success: true, data: user });
    })
    .catch((error) => {
      res.status(500).json({ success: false, message: "Error al buscar l'usuari", error: error.message });
    });
};

/** 
 * ACTUALIZAR USUARIO
 * PUT /api/users/:id
 */
export const updateUser = (req, res) => {
  const userId = req.params.id;
  const { firstName, lastName, name } = req.body;

  // Si la prueba envía firstName/lastName pero tu modelo usa 'name'
  const updateData = {};
  if (name) updateData.name = name;
  if (firstName || lastName) {
    updateData.name = `${firstName || ''} ${lastName || ''}`.trim();
  }

  User.findByIdAndUpdate(userId, updateData, { new: true })
    .select("-password")
    .then((user) => {
      if (!user) {
        return res.status(404).json({ success: false, message: "Usuari no trobat" });
      }
      res.json({
        success: true,
        message: "Usuari actualitzat correctament",
        data: user
      });
    })
    .catch((error) => {
      res.status(500).json({ success: false, message: error.message });
    });
};

/** 
 * OBTENIR PERMISOS DE L'USUARI
 * GET /api/users/:id/permissions
 */
export const getUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Busquem l'usuari amb els seus rols i els permisos de cada rol
    const user = await User.findById(id).populate({
      path: "roles",
      populate: { path: "permissions" }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Usuari no trobat" });
    }

    // 2. Extraure permisos del ROL (aplanem l'array de rols)
    const rolePermissions = user.roles.flatMap(role => role.permissions);

    // 3. Buscar permisos DELEGATS (en la col·lecció DelegatedPermission)
    // Importa el model DelegatedPermission a dalt de tot si no el tens!
    let delegatedPermissions = [];
    try {
      const DelegatedPermission = (await import('../models/DelegatedPermission.js')).default;
      delegatedPermissions = await DelegatedPermission.find({ 
        toUser: id,
        status: 'active',
        expiryDate: { $gte: new Date() } // Que no estiguin caducats
      }).populate('permission');
    } catch (e) {
      console.log("Model DelegatedPermission no trobat o no implementat encara.");
    }

    res.json({
      success: true,
      data: {
        userId: user._id,
        email: user.email,
        rolePermissions: rolePermissions,
        delegatedPermissions: delegatedPermissions,
        // Unió de noms de permisos per facilitar la comprovació al frontend/test
        allPermissionNames: [
          ...new Set([
            ...rolePermissions.map(p => p.name),
            ...delegatedPermissions.map(d => d.permission.name)
          ])
        ]
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};