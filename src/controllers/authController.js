import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

/**
 * REGISTRAR NUEVO USUARIO
 * POST /api/auth/register
 * Body: { name, email, password }
 */
export const register = (req, res) => {
  const { name, email, password } = req.body;

  // Verificar si el email ya existe
  User.findOne({ email })
    .then((existingUser) => {
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Este email ya está registrado",
        });
      }

      // Crear nuevo usuario
      const newUser = new User({
        name,
        email,
        password, // Se cifrará automáticamente con el pre-save hook
        role: "user",
      });

      // Guardar en la base de datos
      return newUser.save();
    })
    .then((savedUser) => {
      // Si savedUser es undefined, significa que ya se envió respuesta (email duplicado)
      if (!savedUser) return;

      // Generar token JWT
      const token = generateToken(savedUser);

      // Responder con token y datos del usuario
      res.status(201).json({
        success: true,
        message: "Usuari registrat correctament",
        data: {
          token,
          user: {
            id: savedUser._id,
            name: savedUser.name,
            email: savedUser.email,
            role: savedUser.role,
            createdAt: savedUser.createdAt,
          },
        },
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al registrar usuario",
        error: error.message,
      });
    });
};

/**
 * INICIAR SESIÓN
 * POST /api/auth/login
 * Body: { email, password }
 */
export const login = (req, res) => {
  const { email, password } = req.body;

  // Buscar usuario por email (incluir password con +password)
  User.findOne({ email })
    .select("+password")
    .then((user) => {
      if (!user) {
        // Usuario no encontrado
        return res.status(401).json({
          success: false,
          message: "Credencials incorrectes",
        });
      }

      // Comparar contraseña
      return user.comparePassword(password).then((isMatch) => {
        if (!isMatch) {
          // Contraseña incorrecta
          return res.status(401).json({
            success: false,
            message: "Credencials incorrectes",
          });
        }

        // Credenciales correctas - Generar token
        const token = generateToken(user);

        // Enviar respuesta
        return res.json({
          success: true,
          message: "Sessió iniciada correctament",
          data: {
            token,
            user: {
              id: user._id,
              name: user.name,
              email: user.email,
              role: user.role,
            },
          },
        });
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al iniciar sesión",
        error: error.message,
      });
    });
};

/**
 * OBTENER PERFIL DEL USUARIO ACTUAL
 * GET /api/auth/me
 * Requiere autenticación (middleware auth)
 */
export const getMe = (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt,
    },
  });
};

/**
 * ACTUALIZAR PERFIL
 * PUT /api/auth/profile
 * Body: { name, email }
 */
export const updateProfile = (req, res) => {
  const { name, email } = req.body;

  // Si se quiere cambiar el email, verificar que no esté en uso
  if (email && email !== req.user.email) {
    User.findOne({ email })
      .then((existingUser) => {
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "Este email ya está en uso",
          });
        }

        // Actualizar usuario
        return User.findByIdAndUpdate(
          req.user._id,
          { name, email },
          { new: true }
        );
      })
      .then((updatedUser) => {
        if (!updatedUser) return;

        res.json({
          success: true,
          message: "Perfil actualitzat correctament",
          data: {
            id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
          },
        });
      })
      .catch((error) => {
        res.status(500).json({
          success: false,
          message: "Error al actualizar perfil",
          error: error.message,
        });
      });
  } else {
    // Solo actualizar nombre
    User.findByIdAndUpdate(req.user._id, { name }, { new: true })
      .then((updatedUser) => {
        res.json({
          success: true,
          message: "Perfil actualitzat correctament",
          data: {
            id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
          },
        });
      })
      .catch((error) => {
        res.status(500).json({
          success: false,
          message: "Error al actualizar perfil",
          error: error.message,
        });
      });
  }
};

/**
 * CAMBIAR CONTRASEÑA
 * PUT /api/auth/change-password
 * Body: { currentPassword, newPassword }
 */
export const changePassword = (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Obtener usuario con contraseña
  User.findById(req.user._id)
    .select("+password")
    .then((user) => {
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      // Verificar contraseña actual
      return user.comparePassword(currentPassword).then((isMatch) => {
        if (!isMatch) {
          return res.status(401).json({
            success: false,
            message: "La contraseña actual es incorrecta",
          });
        }

        // Actualizar con nueva contraseña
        user.password = newPassword;
        return user.save();
      });
    })
    .then((updatedUser) => {
      if (!updatedUser) return;

      res.json({
        success: true,
        message: "Contrasenya canviada correctament",
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al cambiar contraseña",
        error: error.message,
      });
    });
};