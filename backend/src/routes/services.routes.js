
const express = require('express');

const {
    listarServicios,
    listarTodosServicios,
    obtenerServicioPorId,
    crearServicio,
    actualizarServicio,
    cambiarEstadoServicio,
    eliminarServicio
} = require('../controllers/services.controller');

const {
    verificarToken,
    autorizarRoles
} = require('../middlewares/auth.middleware');

const router = express.Router();

// ======================================================
// PERMISOS DE ADMINISTRACIÓN
// ======================================================

const soloAdministracion = [
    verificarToken,
    autorizarRoles('SUPERADMIN', 'GERENCIA')
];

// ======================================================
// RUTAS PÚBLICAS
// ======================================================

// Listar servicios activos.
router.get('/', listarServicios);

// ======================================================
// RUTAS PRIVADAS
// ======================================================

// Listar servicios activos e inactivos.
router.get(
    '/admin/list',
    ...soloAdministracion,
    listarTodosServicios
);

// Obtener servicio por ID.
router.get(
    '/:id',
    ...soloAdministracion,
    obtenerServicioPorId
);

// Crear servicio.
router.post(
    '/',
    ...soloAdministracion,
    crearServicio
);

// Actualizar servicio.
router.put(
    '/:id',
    ...soloAdministracion,
    actualizarServicio
);

// Activar o desactivar servicio.
router.patch(
    '/:id/estado',
    ...soloAdministracion,
    cambiarEstadoServicio
);

// Desactivación lógica.
router.delete(
    '/:id',
    ...soloAdministracion,
    eliminarServicio
);

module.exports = router;
