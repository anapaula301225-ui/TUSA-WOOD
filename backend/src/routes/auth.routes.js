
const express = require('express');

const {
    iniciarSesion,
    obtenerPerfil,
    actualizarPerfil,
    cambiarPassword,
    listarAdministradores,
    obtenerAdministrador,
    crearAdministrador,
    actualizarAdministrador,
    cambiarEstadoAdministrador
} = require('../controllers/auth.controller');

const {
    verificarToken,
    autorizarRoles
} = require('../middlewares/auth.middleware');

const router = express.Router();

// =====================================================
// AUTENTICACIÓN
// =====================================================

// Pública: iniciar sesión
router.post('/login', iniciarSesion);

// =====================================================
// PERFIL PROPIO
// Requiere una sesión válida.
// =====================================================

router.get(
    '/perfil',
    verificarToken,
    obtenerPerfil
);

router.put(
    '/perfil',
    verificarToken,
    actualizarPerfil
);

router.patch(
    '/perfil/password',
    verificarToken,
    cambiarPassword
);

// =====================================================
// CRUD DE ADMINISTRADORES
// Solo SUPERADMIN.
// =====================================================

router.get(
    '/administradores',
    verificarToken,
    autorizarRoles('SUPERADMIN'),
    listarAdministradores
);

router.get(
    '/administradores/:id',
    verificarToken,
    autorizarRoles('SUPERADMIN'),
    obtenerAdministrador
);

router.post(
    '/administradores',
    verificarToken,
    autorizarRoles('SUPERADMIN'),
    crearAdministrador
);

router.put(
    '/administradores/:id',
    verificarToken,
    autorizarRoles('SUPERADMIN'),
    actualizarAdministrador
);

router.patch(
    '/administradores/:id/estado',
    verificarToken,
    autorizarRoles('SUPERADMIN'),
    cambiarEstadoAdministrador
);

module.exports = router;
