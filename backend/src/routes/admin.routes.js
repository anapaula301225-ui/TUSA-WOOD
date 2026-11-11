
const express = require('express');

const {
    verificarToken,
    autorizarRoles
} = require('../middlewares/auth.middleware');

const router = express.Router();

// ======================================================
// AUTENTICACIÓN Y PERMISOS
// ======================================================

router.use(
    verificarToken,
    autorizarRoles(
        'SUPERADMIN',
        'GERENCIA',
        'VENTAS'
    )
);

// ======================================================
// NOTA:
// Las rutas de cotizaciones se gestionan exclusivamente
// desde admin-quotes.routes.js.
//
// Este archivo queda disponible para otras rutas
// administrativas que incorporemos posteriormente.
// ======================================================

module.exports = router;
