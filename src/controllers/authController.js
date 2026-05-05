import User from "../models/User.js";
import Role from "../models/Role.js";
import TokenBlacklist from "../models/TokenBlacklist.js";
import PasswordReset from "../models/PasswordReset.js";
import AuditLog from "../models/AuditLog.js";
import jwtService from "../services/jwtService.js";
import emailService from "../services/emailService.js";

// ─── HELPERS PRIVATS ─────────────────────────────────────────────────────────

/**
 * _buildTokenResponse(user)
 * Genera els dos tokens (access + refresh) i retorna l'objecte de resposta estàndard.
 * Centralitza el format de resposta per register i login.
 *
 * @param {Document} user - Usuari de MongoDB ja populat amb roles>permissions
 * @returns {Object} { accessToken, refreshToken, expiresIn, user }
 */
const _buildTokenResponse = (user) => {
  const permissions = user.getEffectivePermissions();
  const accessToken = jwtService.generateAccessToken(user);
  const refreshToken = jwtService.generateRefreshToken(user._id);

  return {
    accessToken,
    refreshToken,
    expiresIn: 900,                                 // 15 minuts en segons
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      roles: (user.roles || []).map((r) => ({
        id: r._id,
        name: r.name,
      })),
      permissions,
    },
  };
};

// ─── REGISTER ────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Registra un nou usuari i retorna access + refresh tokens.
 */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Buscar el rol 'user' base
    const userRole = await Role.findOne({ name: "user" });
    if (!userRole) {
      return res.status(500).json({
        success: false,
        message: "Error del sistema: rol 'user' no trobat",
      });
    }

    // 2. Comprovar email duplicat
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Aquest email ja està registrat",
      });
    }

    // 3. Crear l'usuari
    const newUser = new User({
      name,
      email,
      password,
      role: "user",
      roles: [userRole._id],
      isActive: true,
    });
    await newUser.save();

    // 4. Populate per obtenir permisos efectius
    const populatedUser = await User.findById(newUser._id).populate({
      path: "roles",
      populate: { path: "permissions" },
    });

    // 5. Generar tokens i respondre
    const tokenData = _buildTokenResponse(populatedUser);

    // 6. Registrar a auditoria
    await AuditLog.log(
      populatedUser._id,
      "auth:register",
      populatedUser._id.toString(),
      "user",
      "success",
      { email },
      req
    );

    return res.status(201).json({
      success: true,
      message: "Usuari registrat correctament",
      data: tokenData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al registrar usuari",
      error: error.message,
    });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Autentica un usuari i retorna access + refresh tokens.
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Buscar usuari (incloure password que per defecte és select: false)
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Credencials incorrectes",
      });
    }

    // 2. Verificar contrasenya
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Registrar intent fallit per seguretat
      await AuditLog.log(
        user._id,
        "auth:login_failed",
        user._id.toString(),
        "user",
        "error",
        { email },
        req,
        "Contrasenya incorrecta"
      );
      return res.status(401).json({
        success: false,
        message: "Credencials incorrectes",
      });
    }

    // 3. Comprovar que l'usuari està actiu
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Compte desactivat. Contacta amb l'administrador",
      });
    }

    // 4. Populate rols i permisos
    const populatedUser = await User.findById(user._id).populate({
      path: "roles",
      populate: { path: "permissions" },
    });

    // 5. Actualitzar lastLogin
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

    // 6. Generar tokens i respondre
    const tokenData = _buildTokenResponse(populatedUser);

    // 7. Auditoria
    await AuditLog.log(
      populatedUser._id,
      "auth:login",
      populatedUser._id.toString(),
      "user",
      "success",
      null,
      req
    );

    return res.json({
      success: true,
      message: "Sessió iniciada correctament",
      data: tokenData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al iniciar sessió",
      error: error.message,
    });
  }
};

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/refresh
 * Renova l'access token usant un refresh token vàlid.
 *
 * Body: { "refreshToken": "xxxxx.yyyyy.zzzzz" }
 * Resposta: { "accessToken": "...", "expiresIn": 900 }
 */
export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "El refresh token és obligatori",
        code: "REFRESH_TOKEN_REQUIRED",
      });
    }

    // 1. Verificar signatura i expiració del refresh token
    let decoded;
    try {
      decoded = jwtService.verifyRefreshToken(refreshToken);
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Sessió expirada. Si us plau, inicia sessió de nou",
          code: "REFRESH_TOKEN_EXPIRED",
        });
      }
      return res.status(401).json({
        success: false,
        message: "Refresh token invàlid",
        code: "REFRESH_TOKEN_INVALID",
      });
    }

    // 2. Comprovar que el token sigui de tipus refresh
    if (decoded.tokenType !== "refresh") {
      return res.status(401).json({
        success: false,
        message: "Tipus de token incorrecte",
        code: "REFRESH_TOKEN_INVALID",
      });
    }

    // 3. Comprovar blacklist (per si s'ha fet logout)
    const isRevoked = await TokenBlacklist.isBlacklisted(refreshToken);
    if (isRevoked) {
      return res.status(401).json({
        success: false,
        message: "Sessió tancada. Si us plau, inicia sessió de nou",
        code: "REFRESH_TOKEN_REVOKED",
      });
    }

    // 4. Buscar l'usuari i popular rols
    const user = await User.findById(decoded.userId).populate({
      path: "roles",
      populate: { path: "permissions" },
    });

    if (!user || user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Usuari no trobat o inactiu",
        code: "USER_NOT_FOUND",
      });
    }

    // 5. Generar NOU access token (el refresh token es manté)
    const newAccessToken = jwtService.generateAccessToken(user);

    return res.json({
      success: true,
      message: "Access token renovat correctament",
      data: {
        accessToken: newAccessToken,
        expiresIn: 900,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al renovar el token",
      error: error.message,
    });
  }
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Revoca els tokens afegint-los a la blacklist.
 *
 * Headers: Authorization: Bearer <accessToken>
 * Body:    { "refreshToken": "xxxxx.yyyyy.zzzzz" }
 */
export const logout = async (req, res) => {
  try {
    const accessToken = req.token;              // Posat per auth middleware
    const { refreshToken } = req.body;

    // 1. Revocar el access token
    if (accessToken) {
      const accessExpiry = jwtService.getTokenExpiration(accessToken);
      await TokenBlacklist.revokeToken(
        accessToken,
        req.user._id,
        "access",
        accessExpiry || new Date(Date.now() + 15 * 60 * 1000)
      );
    }

    // 2. Revocar el refresh token (si s'ha proporcionat)
    if (refreshToken) {
      const refreshExpiry = jwtService.getTokenExpiration(refreshToken);
      await TokenBlacklist.revokeToken(
        refreshToken,
        req.user._id,
        "refresh",
        refreshExpiry || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );
    }

    // 3. Auditoria
    await AuditLog.log(
      req.user._id,
      "auth:logout",
      req.user._id.toString(),
      "user",
      "success",
      null,
      req
    );

    return res.json({
      success: true,
      message: "Sessió tancada correctament",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al tancar sessió",
      error: error.message,
    });
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