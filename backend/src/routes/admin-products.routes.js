
const express = require('express');

const {
    verificarToken,
    autorizarRoles
} = require('../middlewares/auth.middleware');

const {
    listarProductosAdmin,
    obtenerProductoAdmin,
    crearProducto,
    actualizarProducto,
    cambiarEstadoProducto,
    obtenerTotalProductosAdmin
} = require('../controllers/admin-products.controller');

const router = express.Router();

// =====================================================
// TODAS LAS RUTAS REQUIEREN AUTENTICACIÓN
// =====================================================
router.use(verificarToken);

// =====================================================
// TOTAL GENERAL DE PRODUCTOS
// SUPERADMIN, GERENCIA y VENTAS.
//
// Devuelve únicamente el número total de productos.
// No permite consultar ni administrar productos inactivos.
// =====================================================
router.get(
    '/total',
    autorizarRoles('SUPERADMIN', 'GERENCIA', 'VENTAS'),
    obtenerTotalProductosAdmin
);

// =====================================================
// PERMISOS PARA ADMINISTRAR EL CATÁLOGO
// Únicamente SUPERADMIN y GERENCIA.
// =====================================================
router.use(
    autorizarRoles('SUPERADMIN', 'GERENCIA')
);

// Listar productos con filtros y paginación.
router.get('/', listarProductosAdmin);

// Obtener un producto por su ID.
router.get('/:id', obtenerProductoAdmin);

// Crear un producto.
router.post('/', crearProducto);

// Actualizar un producto.
router.put('/:id', actualizarProducto);

// Activar o desactivar un producto.
router.patch('/:id/estado', cambiarEstadoProducto);

module.exports = router;
