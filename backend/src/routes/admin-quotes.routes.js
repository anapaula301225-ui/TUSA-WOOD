const express = require('express');

const {
    verificarToken,
    autorizarRoles
} = require('../middlewares/auth.middleware');

const {
    listarCotizaciones,
    obtenerSupervisionComercial,
    obtenerCotizacionPorId,
    actualizarEstadoCotizacion
} = require('../controllers/admin-quotes.controller');

const router = express.Router();

// =====================================================
// TODAS LAS RUTAS REQUIEREN AUTENTICACIÓN
// =====================================================

router.use(verificarToken);

// =====================================================
// SUPERVISIÓN COMERCIAL
// Exclusivo para SUPERADMIN y GERENCIA.
// Debe declararse antes de /:id.
// =====================================================

router.get(
    '/supervision',
    autorizarRoles('SUPERADMIN', 'GERENCIA'),
    obtenerSupervisionComercial
);

// =====================================================
// CONSULTAR COTIZACIONES
// SUPERADMIN, GERENCIA y VENTAS.
// =====================================================

router.get(
    '/',
    autorizarRoles('SUPERADMIN', 'GERENCIA', 'VENTAS'),
    listarCotizaciones
);

// =====================================================
// OBTENER COTIZACIÓN POR ID
// SUPERADMIN, GERENCIA y VENTAS.
// =====================================================

router.get(
    '/:id',
    autorizarRoles('SUPERADMIN', 'GERENCIA', 'VENTAS'),
    obtenerCotizacionPorId
);

// =====================================================
// ACTUALIZAR ESTADO DE COTIZACIONES
// Las restricciones específicas se validan en el controlador.
// =====================================================

router.patch(
    '/:id/estado',
    autorizarRoles('SUPERADMIN', 'GERENCIA', 'VENTAS'),
    actualizarEstadoCotizacion
);

module.exports = router;