
const express = require('express');

const {
    listarUsuarios,
    obtenerUsuarioPorId,
    crearUsuario,
    actualizarUsuario,
    cambiarEstadoUsuario
} = require('../controllers/admin-users.controller');

const {
    verificarToken,
    autorizarRoles
} = require('../middlewares/auth.middleware');

const router = express.Router();

// =====================================================
// SEGURIDAD: SOLO SUPERADMIN PUEDE GESTIONAR USUARIOS
// =====================================================
router.use(verificarToken);
router.use(autorizarRoles('SUPERADMIN'));

// =====================================================
// RUTAS DE GESTIÓN DE USUARIOS
// =====================================================

// Listar usuarios
router.get('/', listarUsuarios);

// Obtener usuario por ID
router.get('/:id', obtenerUsuarioPorId);

// Crear usuario
router.post('/', crearUsuario);

// Actualizar usuario
router.put('/:id', actualizarUsuario);

// Activar o desactivar usuario
router.patch('/:id/estado', cambiarEstadoUsuario);

module.exports = router;
