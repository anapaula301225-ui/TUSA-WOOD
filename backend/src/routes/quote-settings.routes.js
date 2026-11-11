
const express = require('express');

const {
    verificarToken,
    autorizarRoles
} = require('../middlewares/auth.middleware');

const {
    obtenerConfiguracionIGV,
    actualizarConfiguracionIGV
} = require('../controllers/quote-settings.controller');

const router = express.Router();

// ============================================================
// TODAS LAS RUTAS REQUIEREN AUTENTICACIÓN
// ============================================================

router.use(verificarToken);

// ============================================================
// CONSULTAR CONFIGURACIÓN DEL IGV
// GET /api/admin/quote-settings
// SUPERADMIN, GERENCIA y VENTAS
// ============================================================

router.get(
    '/',
    autorizarRoles('SUPERADMIN', 'GERENCIA', 'VENTAS'),
    obtenerConfiguracionIGV
);

// ============================================================
// ACTUALIZAR CONFIGURACIÓN DEL IGV
// PUT /api/admin/quote-settings
// SOLO SUPERADMIN y GERENCIA
// ============================================================

router.put(
    '/',
    autorizarRoles('SUPERADMIN', 'GERENCIA'),
    actualizarConfiguracionIGV
);

module.exports = router;
