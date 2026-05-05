import Permission from "../models/Permission.js";

/**
 * CREAR NOU PERMÍS
 * Registra una nova capacitat atòmica al sistema amb normalització de strings.
 */
export const createPermission = (req, res) => {
  const { name, description, category } = req.body;

  // 1. Verificació d'existència prèvia per evitar duplicats en la matriu de permisos.
  Permission.findOne({ name: name.toLowerCase() })
    .then((existingPermission) => {
      if (existingPermission) {
        return res.status(400).json({
          success: false,
          message: "Ja existeix un permís amb aquest nom",
        });
      }

      // 2. Creació del permís forçant minúscules per mantenir la consistència en les validacions de seguretat.
      return Permission.create({
        name: name.toLowerCase(),
        description,
        category: category.toLowerCase(),
        isSystemPermission: false, // Marcat com a recurs d'usuari (no protegit pel sistema)
      });
    })
    .then((newPermission) => {
      if (!newPermission) return;

      res.status(201).json({
        success: true,
        message: "Permís creat correctament",
        data: {
          id: newPermission._id,
          name: newPermission.name,
          description: newPermission.description,
          category: newPermission.category,
          createdAt: newPermission.createdAt,
        },
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al crear el permís",
        error: error.message,
      });
    });
};

/**
 * OBTENIR TOTS ELS PERMISOS
 * Retorna la llista completa organitzada per categories per facilitar la visualització al frontend.
 */
export const getAllPermissions = (req, res) => {
  Permission.find()
    .sort({ category: 1, name: 1 })
    .then((permissions) => {
      // Procés d'agrupació dinàmica: convertim l'array pla en un objecte on cada clau és una categoria.
      const groupedByCategory = permissions.reduce((acc, permission) => {
        if (!acc[permission.category]) {
          acc[permission.category] = [];
        }
        
        acc[permission.category].push({
          id: permission._id,
          name: permission.name,
          description: permission.description,
          isSystemPermission: permission.isSystemPermission,
        });
        
        return acc;
      }, {});

      res.json({
        success: true,
        count: permissions.length,
        data: groupedByCategory,
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al obtenir els permisos",
        error: error.message,
      });
    });
};

/**
 * OBTENIR CATEGORIES
 * Llista de forma única totes les seccions de permisos definides al model.
 */
export const getCategories = (req, res) => {
  // Utilitza el mètode estàtic del model per fer un 'distinct' sobre el camp category.
  Permission.getCategories()
    .then((categories) => {
      res.json({
        success: true,
        count: categories.length,
        data: categories,
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al obtenir les categories",
        error: error.message,
      });
    });
};

/**
 * ACTUALITZAR PERMÍS
 * Permet modificar la descripció d'una capacitat. El nom i la categoria són immutables per seguretat.
 */
export const updatePermission = (req, res) => {
  const { id } = req.params;
  const { description } = req.body;

  Permission.findById(id)
    .then((permission) => {
      if (!permission) {
        return res.status(404).json({ success: false, message: "Permís no trobat" });
      }

      // Només actualitzem el camp descriptiu per no trencar les referències lògiques en el codi.
      permission.description = description;
      return permission.save();
    })
    .then((updatedPermission) => {
      if (!updatedPermission) return;

      res.json({
        success: true,
        message: "Permís actualitzat correctament",
        data: {
          id: updatedPermission._id,
          name: updatedPermission.name,
          description: updatedPermission.description,
          category: updatedPermission.category,
        },
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al actualitzar el permís",
        error: error.message,
      });
    });
};

/**
 * ELIMINAR PERMÍS
 * Suprimeix un permís si no és essencial per al funcionament del nucli del sistema.
 */
export const deletePermission = (req, res) => {
  const { id } = req.params;

  Permission.findById(id)
    .then((permission) => {
      if (!permission) {
        return res.status(404).json({ success: false, message: "Permís no trobat" });
      }

      // Bloqueig de seguretat: els permisos amb 'isSystemPermission: true' són vitals i no es poden borrar.
      if (permission.isSystemPermission) {
        return res.status(403).json({
          success: false,
          message: "No pots eliminar un permís del sistema",
        });
      }

      return Permission.findByIdAndDelete(id);
    })
    .then((deletedPermission) => {
      if (!deletedPermission) return;

      res.json({
        success: true,
        message: "Permís eliminat correctament",
        data: {
          id: deletedPermission._id,
          name: deletedPermission.name,
        },
      });
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: "Error al eliminar el permís",
        error: error.message,
      });
    });
};