
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// =====================================================
// ROLES AUTORIZADOS DEL SISTEMA
// =====================================================

const ROLES_PERMITIDOS = [
    'SUPERADMIN',
    'GERENCIA',
    'VENTAS'
];

// =====================================================
// RESPUESTA DE ERROR
// =====================================================

function responderError(res, codigo, mensaje) {
    return res.status(codigo).json({
        estado: 'ERROR',
        mensaje
    });
}

// =====================================================
// NORMALIZAR ROL
// =====================================================

function normalizarRol(rol) {
    if (typeof rol !== 'string') {
        return '';
    }

    return rol.trim().toUpperCase();
}

// =====================================================
// VERIFICAR TOKEN Y ESTADO ACTUAL DE LA CUENTA
// =====================================================

async function verificarToken(req, res, next) {
    const encabezado = req.headers.authorization;

    if (
        typeof encabezado !== 'string' ||
        !encabezado.startsWith('Bearer ')
    ) {
        return responderError(
            res,
            401,
            'Debes iniciar sesión para acceder a este recurso.'
        );
    }

    const token = encabezado.slice(7).trim();

    if (!token) {
        return responderError(
            res,
            401,
            'Token de acceso no proporcionado.'
        );
    }

    const secreto = process.env.JWT_SECRET;

    if (
        typeof secreto !== 'string' ||
        secreto.length < 32
    ) {
        console.error(
            'JWT_SECRET no está configurado correctamente.'
        );

        return responderError(
            res,
            500,
            'La autenticación no está configurada correctamente.'
        );
    }

    try {
        // -------------------------------------------------
        // 1. VERIFICAR FIRMA Y VIGENCIA DEL TOKEN
        // -------------------------------------------------

        const datos = jwt.verify(token, secreto, {
            algorithms: ['HS256']
        });

        if (
            !datos ||
            typeof datos !== 'object' ||
            Array.isArray(datos)
        ) {
            return responderError(
                res,
                401,
                'El token no contiene información válida.'
            );
        }

        const idAdministrador = Number(
            datos.id_administrador
        );

        if (
            !Number.isSafeInteger(idAdministrador) ||
            idAdministrador < 1 ||
            typeof datos.correo !== 'string' ||
            !datos.correo.trim()
        ) {
            return responderError(
                res,
                401,
                'El token no contiene información válida.'
            );
        }

        // -------------------------------------------------
        // 2. CONSULTAR EL ESTADO ACTUAL DEL ADMINISTRADOR
        // -------------------------------------------------

        const resultado = await pool.query(
            `SELECT
                id_administrador,
                nombre,
                correo,
                rol,
                activo
             FROM administradores
             WHERE id_administrador = $1
             LIMIT 1`,
            [idAdministrador]
        );

        if (resultado.rows.length === 0) {
            return responderError(
                res,
                401,
                'La cuenta asociada a esta sesión ya no existe.'
            );
        }

        const administrador = resultado.rows[0];

        // -------------------------------------------------
        // 3. VERIFICAR SI LA CUENTA ESTÁ ACTIVA
        // -------------------------------------------------

        if (administrador.activo !== true) {
            return responderError(
                res,
                403,
                'Tu cuenta está desactivada.'
            );
        }

        // -------------------------------------------------
        // 4. VERIFICAR EL ROL ACTUAL
        // -------------------------------------------------

        const rolActual = normalizarRol(
            administrador.rol
        );

        if (!ROLES_PERMITIDOS.includes(rolActual)) {
            return responderError(
                res,
                403,
                'Tu cuenta no tiene un rol autorizado.'
            );
        }

        // -------------------------------------------------
        // 5. CARGAR LOS DATOS ACTUALES EN LA SOLICITUD
        // -------------------------------------------------

        req.administrador = {
            id_administrador: administrador.id_administrador,
            nombre: administrador.nombre,
            correo: administrador.correo,
            rol: rolActual
        };

        return next();

    } catch (error) {
        // -------------------------------------------------
        // ERRORES DEL TOKEN
        // -------------------------------------------------

        if (
            error.name === 'JsonWebTokenError' ||
            error.name === 'TokenExpiredError' ||
            error.name === 'NotBeforeError'
        ) {
            return responderError(
                res,
                401,
                'El token es inválido o ha expirado. Inicia sesión nuevamente.'
            );
        }

        // -------------------------------------------------
        // OTROS ERRORES
        // -------------------------------------------------

        console.error(
            'Error al verificar la sesión:',
            error.message
        );

        return responderError(
            res,
            500,
            'No se pudo verificar la sesión.'
        );
    }
}

// =====================================================
// AUTORIZAR POR ROLES
// Debe ejecutarse después de verificarToken.
// =====================================================

function autorizarRoles(...rolesPermitidos) {
    const rolesNormalizados = rolesPermitidos.map(
        normalizarRol
    );

    // -------------------------------------------------
    // VALIDAR CONFIGURACIÓN DE ROLES
    // -------------------------------------------------

    if (
        rolesNormalizados.length === 0 ||
        rolesNormalizados.some(rol => !rol)
    ) {
        throw new Error(
            'Debes configurar al menos un rol válido para esta ruta.'
        );
    }

    const rolesInvalidos = rolesNormalizados.filter(
        rol => !ROLES_PERMITIDOS.includes(rol)
    );

    if (rolesInvalidos.length > 0) {
        throw new Error(
            `Se intentó autorizar roles no permitidos: ${rolesInvalidos.join(', ')}`
        );
    }

    // -------------------------------------------------
    // MIDDLEWARE DE AUTORIZACIÓN
    // -------------------------------------------------

    return function (req, res, next) {
        if (!req.administrador) {
            return responderError(
                res,
                401,
                'Debes iniciar sesión para acceder a este recurso.'
            );
        }

        const rolActual = normalizarRol(
            req.administrador.rol
        );

        if (!rolesNormalizados.includes(rolActual)) {
            return responderError(
                res,
                403,
                'No tienes permisos para realizar esta acción.'
            );
        }

        return next();
    };
}

// =====================================================
// EXPORTAR MIDDLEWARES
// =====================================================

module.exports = {
    verificarToken,
    autorizarRoles
};
