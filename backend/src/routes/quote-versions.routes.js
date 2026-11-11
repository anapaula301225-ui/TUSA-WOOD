
const express = require('express');

const {
    verificarToken,
    autorizarRoles
} = require('../middlewares/auth.middleware');

const {
    crearPrimeraVersion,
    listarVersiones,
    obtenerVersionPorId,
    actualizarVersion,
    enviarAprobacion,
    resolverAprobacion,
    enviarCotizacionAlCliente
} = require('../controllers/quote-versions.controller');

const {
    agregarProductoVersion,
    eliminarProductoVersion,
    agregarServicioVersion,
    eliminarServicioVersion
} = require('../controllers/quote-version-lines.controller');

const router = express.Router();

// Todas las rutas requieren autenticación.
router.use(verificarToken);

// ============================================================
// CONSULTAR Y CREAR VERSIONES
// ============================================================

router.get(
    '/quotes/:id/versions',
    autorizarRoles('SUPERADMIN', 'GERENCIA', 'VENTAS'),
    listarVersiones
);

router.post(
    '/quotes/:id/versions',
    autorizarRoles('SUPERADMIN', 'GERENCIA', 'VENTAS'),
    crearPrimeraVersion
);

// ============================================================
// CONSULTAR Y ACTUALIZAR UNA VERSIÓN
// ============================================================

router.get(
    '/quote-versions/:id',
    autorizarRoles('SUPERADMIN', 'GERENCIA', 'VENTAS'),
    obtenerVersionPorId
);

router.put(
    '/quote-versions/:id',
    autorizarRoles('SUPERADMIN', 'GERENCIA', 'VENTAS'),
    actualizarVersion
);

// ============================================================
// GESTIÓN DE PRODUCTOS DE UNA VERSIÓN
// ============================================================

router.post(
    '/quote-versions/:id/products',
    autorizarRoles('SUPERADMIN', 'GERENCIA', 'VENTAS'),
    agregarProductoVersion
);

router.delete(
    '/quote-versions/:id/products/:idDetalle',
    autorizarRoles('SUPERADMIN', 'GERENCIA', 'VENTAS'),
    eliminarProductoVersion
);

// ============================================================
// GESTIÓN DE SERVICIOS DE UNA VERSIÓN
// ============================================================

router.post(
    '/quote-versions/:id/services',
    autorizarRoles('SUPERADMIN', 'GERENCIA', 'VENTAS'),
    agregarServicioVersion
);

router.delete(
    '/quote-versions/:id/services/:idDetalle',
    autorizarRoles('SUPERADMIN', 'GERENCIA', 'VENTAS'),
    eliminarServicioVersion
);

// ============================================================
// FLUJO DE APROBACIÓN
// ============================================================

router.post(
    '/quote-versions/:id/enviar-aprobacion',
    autorizarRoles('SUPERADMIN', 'GERENCIA', 'VENTAS'),
    enviarAprobacion
);

router.patch(
    '/quote-versions/:id/aprobacion',
    autorizarRoles('SUPERADMIN', 'GERENCIA'),
    resolverAprobacion
);

// ============================================================
// ENVÍO AL CLIENTE
// ============================================================

router.post(
    '/quote-versions/:id/enviar-cliente',
    autorizarRoles('SUPERADMIN', 'GERENCIA'),
    enviarCotizacionAlCliente
);

module.exports = router;
