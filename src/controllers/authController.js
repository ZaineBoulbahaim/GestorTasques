import User from "../models/User.js";
import Role from "../models/Role.js";
import generateToken from "../utils/generateToken.js";

/**
 * REGISTRAR NOU USUARI
 * Gestió completa del registre: validació, assignació de rols base i generació de token.
 */
export const register = (req, res) => {
  const { name, email, password } = req.body;
  let userRole;

  // 1. Busquem el rol 'user' a la base de dades per assegurar que el nou usuari tingui permisos base.
  Role.findOne({ name: "user" })
    .then((role) => {
      if (!role) {
        return res.status(500).json({
          success: false,
          message: "Error del sistema: rol 'user' no trobat",
        });
      }
      userRole = role;
      // 2. Verifiquem si l'email ja està registrat abans de procedir.
      return User.findOne({ email });
    })
    .then((existingUser) => {
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Aquest email ja està registrat",
        });
      }

      // 3. Instanciem el nou usuari amb el sistema de rol clàssic i el nou sistema multi-rol.
      const newUser = new User({
        name,
        email,
        password,
        role: "user", 
        roles: [userRole._id], 
      });

      return newUser.save();
    })
    .then((savedUser) => {
      if (!savedUser) return;

      // 4. Per retornar una resposta completa, necessitem fer el 'populate' dels rols
      // i, de forma niuada, dels permisos de cada rol (jerarquia completa).
      return User.findById(savedUser._id).populate({
        path: "roles",
        populate: { path: "permissions" },
      });
    })
    .then((populatedUser) => {
      if (!populatedUser) return;

      // 5. Calculem els permisos efectius i generem el token JWT incloent la nova càrrega de dades.
      const permissions = populatedUser.getEffectivePermissions();
      const token = generateToken(populatedUser);

      res.status(201).json({
        success: true,
        message: "Usuari registrat correctament",
        data: {
          token,
          user: {
            id: populatedUser._id,
            name: populatedUser.name,
            email: populatedUser.email,
            role: populatedUser.role,
            roles: populatedUser.roles.map((r) => ({ id: r._id, name: r.name })),
            permissions,
            createdAt: populatedUser.createdAt,
          },
        },
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al registrar usuari",
        error: error.message,
      });
    });
};

/**
 * INICIAR SESSIÓ
 * Autenticació d'usuaris i càrrega dinàmica de la matriu de permisos.
 */
export const login = (req, res) => {
  const { email, password } = req.body;
  let authenticatedUser;

  // 1. Cercat de l'usuari i inclusió explícita del camp 'password' (marcat com select: false al model).
  User.findOne({ email })
    .select("+password")
    .then((user) => {
      if (!user) {
        return res.status(401).json({ success: false, message: "Credencials incorrectes" });
      }
      authenticatedUser = user;
      // 2. Validació de la contrasenya mitjançant el mètode de comparació del model.
      return user.comparePassword(password);
    })
    .then((isMatch) => {
      if (isMatch === undefined) return;
      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Credencials incorrectes" });
      }

      // 3. Un cop autenticat, carreguem la informació de rols i permisos per a la sessió actual.
      // Això permet que el token contingui les capacitats reals del moment.
      return User.findById(authenticatedUser._id).populate({
        path: "roles",
        populate: { path: "permissions" },
      });
    })
    .then((populatedUser) => {
      if (!populatedUser) return;

      const permissions = populatedUser.getEffectivePermissions();
      const token = generateToken(populatedUser);

      res.json({
        success: true,
        message: "Sessió iniciada correctament",
        data: {
          token,
          user: {
            id: populatedUser._id,
            name: populatedUser.name,
            email: populatedUser.email,
            role: populatedUser.role,
            roles: populatedUser.roles.map((r) => ({ id: r._id, name: r.name })),
            permissions,
          },
        },
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al iniciar sessió",
        error: error.message,
      });
    });
};

/**
 * ACTUALITZAR PERFIL
 * Modifica les dades personals de l'usuari amb control de duplicats per a l'email.
 */
export const updateProfile = (req, res) => {
  const { name, email } = req.body;

  // Cas A: L'usuari vol canviar el seu correu electrònic.
  if (email && email !== req.user.email) {
    User.findOne({ email })
      .then((existingUser) => {
        if (existingUser) {
          return res.status(400).json({ success: false, message: "Aquest email ja està en ús" });
        }
        // Apliquem el canvi només si l'email és lliure.
        return User.findByIdAndUpdate(req.user._id, { name, email }, { new: true });
      })
      .then((updatedUser) => {
        if (!updatedUser) return;
        res.json({
          success: true,
          message: "Perfil actualitzat correctament",
          data: { id: updatedUser._id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role },
        });
      })
      .catch((error) => {
        res.status(500).json({ success: false, message: "Error al actualitzar perfil", error: error.message });
      });
  } else {
    // Cas B: Només s'actualitza el nom (l'email no ha variat).
    User.findByIdAndUpdate(req.user._id, { name }, { new: true })
      .then((updatedUser) => {
        res.json({
          success: true,
          message: "Perfil actualitzat correctament",
          data: { id: updatedUser._id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role },
        });
      })
      .catch((error) => {
        res.status(500).json({ success: false, message: "Error al actualitzar perfil", error: error.message });
      });
  }
};

/**
 * VERIFICAR PERMÍS
 * Endpoint de suport per al frontend que valida capacitats sense processar lògica de negoci.
 */
export const checkUserPermission = (req, res) => {
  const { permission } = req.body;

  if (!permission) {
    return res.status(400).json({ success: false, message: "El permís és obligatori" });
  }

  // Obtenim l'usuari amb la càrrega de permisos per fer la comparació.
  User.findById(req.user._id)
    .populate({
      path: "roles",
      populate: { path: "permissions" },
    })
    .then((user) => {
      if (!user) return res.status(404).json({ success: false, message: "Usuari no trobat" });

      // Verifiquem si el permís demanat es troba dins de l'array de permisos efectius.
      const permissions = user.getEffectivePermissions();
      const hasPermission = permissions.includes(permission);

      if (hasPermission) {
        res.json({ success: true, hasPermission: true, message: "Tens permís per fer aquesta acció" });
      } else {
        res.status(403).json({ success: false, hasPermission: false, message: "No tens permís" });
      }
    })
    .catch((error) => {
      res.status(500).json({ success: false, message: "Error al verificar el permís", error: error.message });
    });
};