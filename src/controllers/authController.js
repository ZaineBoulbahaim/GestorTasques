import User from "../models/User.js";
import Role from "../models/Role.js";
import TokenBlacklist from "../models/TokenBlacklist.js";
import PasswordReset from "../models/PasswordReset.js";
import AuditLog from "../models/AuditLog.js";
import jwtService from "../services/jwtService.js";
import emailService from "../services/emailService.js";
import TokenBlacklist from "../models/TokenBlacklist.js";

/**
 * _buildTokenResponse(user)
 * Genera els dos tokens (access + refresh) i retorna l'objecte de resposta estàndard.
 * Centralitza el format de resposta per register i login.
 *
 * @param {Document} user - Usuari de MongoDB ja populat amb roles>permissions
 * @returns {Object} { accessToken, refreshToken, expiresIn, user }
 */
const _buildTokenResponse = async (user) => {
  const permissions = await user.getEffectivePermissions();
  const accessToken = jwtService.generateAccessToken(user);
  const refreshToken = jwtService.generateRefreshToken(user._id);

  return {
    accessToken,
    refreshToken,
    expiresIn: 900, 
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      roles: (user.roles || []).map((r) => ({
        id: r._id || r,
        name: r.name || 'Role',
      })),
      permissions, 
    },
  };
};

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const userRole = await Role.findOne({ name: "user" });
    
    if (!userRole) return res.status(500).json({ success: false, message: "Rol 'user' no trobat" });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: "Email ja registrat" });

    const newUser = new User({
      name,
      email,
      password,
      roles: [userRole._id], // Usamos solo el array de roles si es posible
      isActive: true,
    });
    await newUser.save();

    const populatedUser = await User.findById(newUser._id).populate({
      path: "roles",
      populate: { path: "permissions" },
    });

    const tokenData = await _buildTokenResponse(populatedUser);

    await AuditLog.log(populatedUser._id, "REGISTER", "Nou usuari registrat");

    return res.status(201).json({ success: true, ...tokenData });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).populate({
      path: "roles",
      populate: { path: "permissions" },
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Credencials incorrectes" });
    }

    const tokenData = await _buildTokenResponse(user);
    await AuditLog.log(user._id, "LOGIN", "Sessió iniciada");

    res.json({ success: true, ...tokenData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ success: false, message: "Refresh token requerit" });

    const decoded = jwtService.verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId).populate({
      path: "roles",
      populate: { path: "permissions" }
    });

    if (!user || !user.isActive) return res.status(401).json({ success: false, message: "Usuari no vàlid" });

    const tokenData = await _buildTokenResponse(user);
    res.json({ success: true, ...tokenData });
  } catch (error) {
    res.status(401).json({ success: false, message: "Sessió caducada" });
  }
};

export const logout = async (req, res) => {
  try {
    const accessToken = req.token; 
    const { refreshToken } = req.body;

    if (accessToken) await TokenBlacklist.addToBlacklist(accessToken);
    if (refreshToken) await TokenBlacklist.addToBlacklist(refreshToken);

    // Si el middleware 'auth' funciona, req.user.id existeix
    if (req.user) await AuditLog.log(req.user.id, "LOGOUT", "Sessió tancada");

    return res.json({ success: true, message: "Sessió tancada correctament" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al fer logout" });
  }
};

// ─── GET ME ───────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/me
 * Retorna les dades de l'usuari autenticat amb permisos efectius.
 */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "roles",
      populate: { path: "permissions" },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Usuari no trobat" });
    }

    const permissions = user.getEffectivePermissions();

    return res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: user.roles.map((r) => ({ id: r._id, name: r.name })),
        permissions,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtenir perfil",
      error: error.message,
    });
  }
};

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────

/**
 * PUT /api/auth/profile
 * Actualitza nom i/o email de l'usuari autenticat.
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user._id;

    // Comprovar email duplicat si ha canviat
    if (email && email !== req.user.email) {
      const exists = await User.findOne({ email });
      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Aquest email ja està en ús",
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { ...(name && { name }), ...(email && { email }) },
      { new: true }
    );

    return res.json({
      success: true,
      message: "Perfil actualitzat correctament",
      data: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al actualitzar perfil",
      error: error.message,
    });
  }
};

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────

/**
 * PUT /api/auth/change-password
 * Canvia la contrasenya de l'usuari autenticat.
 * Body: { currentPassword, newPassword }
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "La contrasenya actual és incorrecta",
      });
    }

    user.password = newPassword;
    await user.save();

    await AuditLog.log(
      user._id,
      "auth:password_changed",
      user._id.toString(),
      "user",
      "success",
      null,
      req
    );

    return res.json({
      success: true,
      message: "Contrasenya canviada correctament",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al canviar la contrasenya",
      error: error.message,
    });
  }
};

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────

/**
 * POST /api/auth/forgot-password
 * Genera un token de recuperació i envia un email.
 * Body: { "email": "user@example.com" }
 *
 * SEGURETAT: Sempre retorna 200 per no revelar si l'email existeix o no.
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Resposta genèrica sempre (no revelar si l'email existeix)
    const genericResponse = {
      success: true,
      message: "Si l'email existeix, rebràs un correu amb les instruccions",
    };

    const user = await User.findOne({ email });
    if (!user) {
      // Retornem 200 igualment (no revelar existència)
      return res.json(genericResponse);
    }

    // Generar token de reset (el model s'encarrega del hash)
    const rawToken = await PasswordReset.createResetToken(
      user._id,
      req.ip
    );

    // Enviar email amb el token en clar
    await emailService.sendPasswordResetEmail(user.email, user.name, rawToken);

    // Auditoria
    await AuditLog.log(
      user._id,
      "auth:forgot_password",
      user._id.toString(),
      "user",
      "success",
      { email },
      req
    );

    return res.json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Error al processar la petició",
      error: error.message,
    });
  }
};

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────

/**
 * POST /api/auth/reset-password/:token
 * Valida el token de reset i actualitza la contrasenya.
 * Body: { "newPassword": "NovaPassword123!" }
 */
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    // 1. Buscar el token de reset (el model fa el hash internament)
    const resetDoc = await PasswordReset.findByRawToken(token);

    if (!resetDoc) {
      return res.status(400).json({
        success: false,
        message: "Token de recuperació invàlid o expirat",
        code: "RESET_TOKEN_INVALID",
      });
    }

    // 2. Buscar l'usuari
    const user = await User.findById(resetDoc.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuari no trobat",
      });
    }

    // 3. Actualitzar contrasenya (el model fa el hash al pre-save)
    user.password = newPassword;
    await user.save();

    // 4. Marcar el token com usat
    await resetDoc.markAsUsed();

    // 5. Auditoria
    await AuditLog.log(
      user._id,
      "auth:password_reset",
      user._id.toString(),
      "user",
      "success",
      null,
      req
    );

    return res.json({
      success: true,
      message: "Contrasenya actualitzada correctament. Ja pots iniciar sessió",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al restablir la contrasenya",
      error: error.message,
    });
  }
};

// ─── CHECK PERMISSION ─────────────────────────────────────────────────────────

/**
 * POST /api/auth/check-permission
 * Verifica si l'usuari autenticat té un permís específic.
 * Body: { "permission": "tasks:delete" }
 */
export const checkUserPermission = async (req, res) => {
  try {
    const { permission } = req.body;

    if (!permission) {
      return res.status(400).json({
        success: false,
        message: "El permís és obligatori",
      });
    }

    const user = await User.findById(req.user._id).populate({
      path: "roles",
      populate: { path: "permissions" },
    });

    const permissions = user.getEffectivePermissions();
    const hasPermission = permissions.includes(permission);

    if (hasPermission) {
      return res.json({
        success: true,
        hasPermission: true,
        message: "Tens permís per fer aquesta acció",
      });
    }

    return res.status(403).json({
      success: false,
      hasPermission: false,
      message: "No tens permís",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al verificar el permís",
      error: error.message,
    });
  }
};