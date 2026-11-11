
const express = require('express');

const {
    listarCategorias,
    obtenerCategoriaPorId,
    listarTodasCategorias,
    crearCategoria,
    actualizarCategoria,
    cambiarEstadoCategoria,
    eliminarCategoria
} = require('../controllers/categories.controller');

const {
    verificarToken,
    autorizarRoles
} = require('../middlewares/auth.middleware');

const router = express.Router();

// =====================================================
// PERMISOS DE ADMINISTRACIÓN
// SUPERADMIN y GERENCIA pueden administrar categorías.
// =====================================================
const soloAdministracion = [
    verificarToken,
    autorizarRoles('SUPERADMIN', 'GERENCIA')
];

// =====================================================
// RUTAS PÚBLICAS: CATÁLOGO
// =====================================================

// Listar únicamente las categorías activas.
router.get('/', listarCategorias);

// =====================================================
// RUTAS PRIVADAS: ADMINISTRACIÓN DE CATEGORÍAS
// =====================================================

// Listar categorías activas e inactivas.
// Debe estar antes de /:id.
router.get(
    '/admin/list',
    ...soloAdministracion,
    listarTodasCategorias
);

// Obtener una categoría por ID.
router.get(
    '/:id',
    ...soloAdministracion,
    obtenerCategoriaPorId
);

// Crear categoría.
router.post(
    '/',
    ...soloAdministracion,
    crearCategoria
);

// Actualizar categoría.
router.put(
    '/:id',
    ...soloAdministracion,
    actualizarCategoria
);

// Activar o desactivar categoría.
router.patch(
    '/:id/estado',
    ...soloAdministracion,
    cambiarEstadoCategoria
);

// Eliminar categoría.
router.delete(
    '/:id',
    ...soloAdministracion,
    eliminarCategoria
);

module.exports = router;
