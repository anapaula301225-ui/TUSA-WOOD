
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const ROLES_PERMITIDOS = [
    'SUPERADMIN',
    'GERENCIA',
    'VENTAS'
];

const COSTO_BCRYPT = 12;

// =====================================================
// UTILIDADES
// =====================================================

function responderErrorBD(res, error, mensajeGeneral) {
    if (error.code === '23505') {
        return res.status(409).json({
            estado: 'ERROR',
            mensaje: 'Ya existe una cuenta con ese correo.'
        });
    }

    if (error.code === '23503') {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'La operación hace referencia a un registro inexistente.'
        });
    }

    console.error('[TUSA WOOD] Error de autenticación:', error.message);

    return res.status(500).json({
        estado: 'ERROR',
        mensaje: mensajeGeneral
    });
}

function normalizarCorreo(correo) {
    return typeof correo === 'string'
        ? correo.trim().toLowerCase()
        : '';
}

function validarTexto(valor, minimo = 2, maximo = 100) {
    return (
        typeof valor === 'string' &&
        valor.trim().length >= minimo &&
        valor.trim().length <= maximo
    );
}

function validarPassword(password) {
    return (
        typeof password === 'string' &&
        password.length >= 8 &&
        password.length <= 72
    );
}

function validarCorreo(correo) {
    return (
        typeof correo === 'string' &&
        correo.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
    );
}

function obtenerIdAdministrador(req) {
    const id = Number(req.administrador?.id_administrador);

    return Number.isSafeInteger(id) && id > 0
        ? id
        : null;
}

function validarId(id) {
    return /^\d+$/.test(String(id)) && Number(id) > 0;
}

function esSuperAdmin(req) {
    return req.administrador?.rol === 'SUPERADMIN';
}

function validarRol(rol) {
    return (
        typeof rol === 'string' &&
        ROLES_PERMITIDOS.includes(rol.trim().toUpperCase())
    );
}

// =====================================================
// INICIAR SESIÓN
// POST /api/auth/login
// =====================================================

async function iniciarSesion(req, res) {
    try {
        const { correo, password } = req.body || {};

        if (
            typeof correo !== 'string' ||
            typeof password !== 'string' ||
            !correo.trim() ||
            !password
        ) {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: 'Debes ingresar tu correo y contraseña.'
            });
        }

        const correoNormalizado = normalizarCorreo(correo);

        const resultado = await pool.query(
            `SELECT
                id_administrador,
                nombre,
                correo,
                password_hash,
                rol,
                activo
             FROM administradores
             WHERE LOWER(correo) = $1
             LIMIT 1`,
            [correoNormalizado]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({
                estado: 'ERROR',
                mensaje: 'Correo o contraseña incorrectos.'
            });
        }

        const administrador = resultado.rows[0];

        if (!administrador.activo) {
            return res.status(403).json({
                estado: 'FORBIDDEN',
                mensaje: 'Tu cuenta está desactivada.'
            });
        }

        const passwordValido = await bcrypt.compare(
            password,
            administrador.password_hash
        );

        if (!passwordValido) {
            return res.status(401).json({
                estado: 'ERROR',
                mensaje: 'Correo o contraseña incorrectos.'
            });
        }

        const rol = String(administrador.rol || '')
            .trim()
            .toUpperCase();

        if (!ROLES_PERMITIDOS.includes(rol)) {
            return res.status(403).json({
                estado: 'FORBIDDEN',
                mensaje: 'Tu cuenta no tiene un rol autorizado.'
            });
        }

        const secreto = process.env.JWT_SECRET;

        if (
            typeof secreto !== 'string' ||
            secreto.length < 32
        ) {
            console.error(
                'JWT_SECRET no está configurado correctamente.'
            );

            return res.status(500).json({
                estado: 'ERROR',
                mensaje: 'La autenticación no está configurada correctamente.'
            });
        }

        const token = jwt.sign(
            {
                id_administrador: administrador.id_administrador,
                correo: administrador.correo,
                rol
            },
            secreto,
            {
                algorithm: 'HS256',
                expiresIn: '2h'
            }
        );

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Inicio de sesión exitoso.',
            token,
            administrador: {
                id_administrador: administrador.id_administrador,
                nombre: administrador.nombre,
                correo: administrador.correo,
                rol
            }
        });
    } catch (error) {
        console.error(
            'Error al iniciar sesión:',
            error.message
        );

        return res.status(500).json({
            estado: 'ERROR',
            mensaje: 'No se pudo iniciar sesión.'
        });
    }
}

// =====================================================
// CONSULTAR PERFIL PROPIO
// GET /api/auth/perfil
// =====================================================

async function obtenerPerfil(req, res) {
    const id = obtenerIdAdministrador(req);

    if (!id) {
        return res.status(401).json({
            estado: 'ERROR',
            mensaje: 'No se pudo identificar tu sesión.'
        });
    }

    try {
        const resultado = await pool.query(
            `SELECT
                id_administrador,
                nombre,
                correo,
                rol,
                activo,
                creado_en
             FROM administradores
             WHERE id_administrador = $1`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                estado: 'ERROR',
                mensaje: 'No se encontró tu perfil.'
            });
        }

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Perfil obtenido correctamente.',
            administrador: resultado.rows[0]
        });
    } catch (error) {
        return responderErrorBD(
            res,
            error,
            'No se pudo consultar tu perfil.'
        );
    }
}

// =====================================================
// ACTUALIZAR PERFIL PROPIO
// PUT /api/auth/perfil
// =====================================================

async function actualizarPerfil(req, res) {
    const id = obtenerIdAdministrador(req);

    if (!id) {
        return res.status(401).json({
            estado: 'ERROR',
            mensaje: 'No se pudo identificar tu sesión.'
        });
    }

    const body = req.body || {};
    const permitidos = ['nombre', 'correo'];

    const desconocidos = Object.keys(body).filter(
        campo => !permitidos.includes(campo)
    );

    if (desconocidos.length > 0) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: `No puedes modificar estos campos: ${desconocidos.join(', ')}.`
        });
    }

    if (Object.keys(body).length === 0) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'Debes proporcionar al menos un campo para actualizar.'
        });
    }

    if (
        body.nombre !== undefined &&
        !validarTexto(body.nombre, 2, 120)
    ) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'El nombre debe tener entre 2 y 120 caracteres.'
        });
    }

    const correo = body.correo !== undefined
        ? normalizarCorreo(body.correo)
        : undefined;

    if (
        correo !== undefined &&
        !validarCorreo(correo)
    ) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'Debes ingresar un correo válido.'
        });
    }

    try {
        const actual = await pool.query(
            `SELECT id_administrador
             FROM administradores
             WHERE id_administrador = $1`,
            [id]
        );

        if (actual.rows.length === 0) {
            return res.status(404).json({
                estado: 'ERROR',
                mensaje: 'No se encontró tu cuenta.'
            });
        }

        const nombre = body.nombre?.trim();

        const resultado = await pool.query(
            `UPDATE administradores
             SET nombre = COALESCE($1, nombre),
                 correo = COALESCE($2, correo)
             WHERE id_administrador = $3
             RETURNING
                id_administrador,
                nombre,
                correo,
                rol,
                activo,
                creado_en`,
            [
                nombre === undefined ? null : nombre,
                correo === undefined ? null : correo,
                id
            ]
        );

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Perfil actualizado correctamente.',
            administrador: resultado.rows[0]
        });
    } catch (error) {
        return responderErrorBD(
            res,
            error,
            'No se pudo actualizar tu perfil.'
        );
    }
}

// =====================================================
// CAMBIAR CONTRASEÑA PROPIA
// PATCH /api/auth/perfil/password
// =====================================================

async function cambiarPassword(req, res) {
    const id = obtenerIdAdministrador(req);

    if (!id) {
        return res.status(401).json({
            estado: 'ERROR',
            mensaje: 'No se pudo identificar tu sesión.'
        });
    }

    const {
        password_actual,
        password_nueva,
        confirmar_password
    } = req.body || {};

    if (
        typeof password_actual !== 'string' ||
        !password_actual ||
        !validarPassword(password_nueva) ||
        password_nueva !== confirmar_password
    ) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'Verifica la contraseña actual, la nueva contraseña y su confirmación. La nueva debe tener entre 8 y 72 caracteres.'
        });
    }

    if (password_actual === password_nueva) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'La nueva contraseña debe ser diferente de la actual.'
        });
    }

    try {
        const resultado = await pool.query(
            `SELECT password_hash
             FROM administradores
             WHERE id_administrador = $1
               AND activo = TRUE`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                estado: 'ERROR',
                mensaje: 'No se encontró una cuenta activa.'
            });
        }

        const coincide = await bcrypt.compare(
            password_actual,
            resultado.rows[0].password_hash
        );

        if (!coincide) {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: 'La contraseña actual es incorrecta.'
            });
        }

        const nuevoHash = await bcrypt.hash(
            password_nueva,
            COSTO_BCRYPT
        );

        await pool.query(
            `UPDATE administradores
             SET password_hash = $1
             WHERE id_administrador = $2`,
            [nuevoHash, id]
        );

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Contraseña actualizada correctamente. Por seguridad, vuelve a iniciar sesión.'
        });
    } catch (error) {
        return responderErrorBD(
            res,
            error,
            'No se pudo cambiar la contraseña.'
        );
    }
}

// =====================================================
// LISTAR ADMINISTRADORES
// GET /api/auth/administradores
// Solo SUPERADMIN.
// =====================================================

async function listarAdministradores(req, res) {
    try {
        const resultado = await pool.query(
            `SELECT
                id_administrador,
                nombre,
                correo,
                rol,
                activo,
                creado_en
             FROM administradores
             ORDER BY creado_en DESC, id_administrador DESC`
        );

        return res.status(200).json({
            estado: 'OK',
            administradores: resultado.rows
        });
    } catch (error) {
        return responderErrorBD(
            res,
            error,
            'No se pudieron consultar los administradores.'
        );
    }
}

// =====================================================
// OBTENER ADMINISTRADOR POR ID
// GET /api/auth/administradores/:id
// Solo SUPERADMIN.
// =====================================================

async function obtenerAdministrador(req, res) {
    const { id } = req.params;

    if (!validarId(id)) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'El identificador no es válido.'
        });
    }

    try {
        const resultado = await pool.query(
            `SELECT
                id_administrador,
                nombre,
                correo,
                rol,
                activo,
                creado_en
             FROM administradores
             WHERE id_administrador = $1`,
            [Number(id)]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                estado: 'ERROR',
                mensaje: 'No se encontró el administrador.'
            });
        }

        return res.status(200).json({
            estado: 'OK',
            administrador: resultado.rows[0]
        });
    } catch (error) {
        return responderErrorBD(
            res,
            error,
            'No se pudo consultar el administrador.'
        );
    }
}

// =====================================================
// CREAR ADMINISTRADOR
// POST /api/auth/administradores
// Solo SUPERADMIN.
// =====================================================

async function crearAdministrador(req, res) {
    const {
        nombre,
        correo,
        password,
        rol
    } = req.body || {};

    const nombreLimpio = typeof nombre === 'string'
        ? nombre.trim()
        : '';

    const correoLimpio = normalizarCorreo(correo);
    const rolLimpio = typeof rol === 'string'
        ? rol.trim().toUpperCase()
        : '';

    if (!validarTexto(nombreLimpio, 2, 120)) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'El nombre debe tener entre 2 y 120 caracteres.'
        });
    }

    if (!validarCorreo(correoLimpio)) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'Debes ingresar un correo válido.'
        });
    }

    if (!validarPassword(password)) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'La contraseña debe tener entre 8 y 72 caracteres.'
        });
    }

    if (!validarRol(rolLimpio)) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'Debes seleccionar un rol válido: SUPERADMIN, GERENCIA o VENTAS.'
        });
    }

    if (
        !esSuperAdmin(req) &&
        rolLimpio === 'SUPERADMIN'
    ) {
        return res.status(403).json({
            estado: 'ERROR',
            mensaje: 'No tienes permiso para asignar ese rol.'
        });
    }

    try {
        const hash = await bcrypt.hash(password, COSTO_BCRYPT);

        const resultado = await pool.query(
            `INSERT INTO administradores (
                nombre,
                correo,
                password_hash,
                rol,
                activo
             )
             VALUES ($1, $2, $3, $4, TRUE)
             RETURNING
                id_administrador,
                nombre,
                correo,
                rol,
                activo,
                creado_en`,
            [nombreLimpio, correoLimpio, hash, rolLimpio]
        );

        return res.status(201).json({
            estado: 'OK',
            mensaje: 'Administrador creado correctamente.',
            administrador: resultado.rows[0]
        });
    } catch (error) {
        return responderErrorBD(
            res,
            error,
            'No se pudo crear el administrador.'
        );
    }
}

// =====================================================
// ACTUALIZAR ADMINISTRADOR
// PUT /api/auth/administradores/:id
// Solo SUPERADMIN.
// =====================================================

async function actualizarAdministrador(req, res) {
    const { id } = req.params;

    if (!validarId(id)) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'El identificador no es válido.'
        });
    }

    const body = req.body || {};
    const permitidos = ['nombre', 'correo', 'rol'];

    const desconocidos = Object.keys(body).filter(
        campo => !permitidos.includes(campo)
    );

    if (desconocidos.length > 0) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: `Campo(s) no permitido(s): ${desconocidos.join(', ')}.`
        });
    }

    if (Object.keys(body).length === 0) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'Debes proporcionar al menos un campo para actualizar.'
        });
    }

    if (
        body.nombre !== undefined &&
        !validarTexto(body.nombre, 2, 120)
    ) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'El nombre debe tener entre 2 y 120 caracteres.'
        });
    }

    const correo = body.correo !== undefined
        ? normalizarCorreo(body.correo)
        : undefined;

    if (
        correo !== undefined &&
        !validarCorreo(correo)
    ) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'Debes ingresar un correo válido.'
        });
    }

    const rol = body.rol !== undefined
        ? String(body.rol).trim().toUpperCase()
        : undefined;

    if (rol !== undefined && !validarRol(rol)) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'El rol seleccionado no es válido.'
        });
    }

    try {
        const conexion = await pool.connect();

        try {
            await conexion.query('BEGIN');

            const resultadoActual = await conexion.query(
                `SELECT id_administrador, rol, activo
                 FROM administradores
                 WHERE id_administrador = $1
                 FOR UPDATE`,
                [Number(id)]
            );

            if (resultadoActual.rows.length === 0) {
                await conexion.query('ROLLBACK');

                return res.status(404).json({
                    estado: 'ERROR',
                    mensaje: 'No se encontró el administrador.'
                });
            }

            const actual = resultadoActual.rows[0];

            if (!esSuperAdmin(req) && rol === 'SUPERADMIN') {
                await conexion.query('ROLLBACK');

                return res.status(403).json({
                    estado: 'ERROR',
                    mensaje: 'No tienes permiso para asignar ese rol.'
                });
            }

            if (
                actual.rol === 'SUPERADMIN' &&
                actual.activo &&
                rol !== undefined &&
                rol !== 'SUPERADMIN'
            ) {
                const cantidad = await conexion.query(
                    `SELECT COUNT(*)::int AS total
                     FROM administradores
                     WHERE rol = 'SUPERADMIN'
                       AND activo = TRUE`
                );

                if (cantidad.rows[0].total <= 1) {
                    await conexion.query('ROLLBACK');

                    return res.status(409).json({
                        estado: 'ERROR',
                        mensaje: 'No puedes quitar el rol al único SUPERADMIN activo.'
                    });
                }
            }

            const resultado = await conexion.query(
                `UPDATE administradores
                 SET nombre = COALESCE($1, nombre),
                     correo = COALESCE($2, correo),
                     rol = COALESCE($3, rol)
                 WHERE id_administrador = $4
                 RETURNING
                    id_administrador,
                    nombre,
                    correo,
                    rol,
                    activo,
                    creado_en`,
                [
                    body.nombre === undefined
                        ? null
                        : body.nombre.trim(),
                    correo === undefined ? null : correo,
                    rol === undefined ? null : rol,
                    Number(id)
                ]
            );

            await conexion.query('COMMIT');

            return res.status(200).json({
                estado: 'OK',
                mensaje: 'Administrador actualizado correctamente.',
                administrador: resultado.rows[0]
            });
        } catch (error) {
            await conexion.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            conexion.release();
        }
    } catch (error) {
        return responderErrorBD(
            res,
            error,
            'No se pudo actualizar el administrador.'
        );
    }
}

// =====================================================
// ACTIVAR / DESACTIVAR ADMINISTRADOR
// PATCH /api/auth/administradores/:id/estado
// Solo SUPERADMIN.
// =====================================================

async function cambiarEstadoAdministrador(req, res) {
    const { id } = req.params;
    const { activo } = req.body || {};
    const idSesion = obtenerIdAdministrador(req);

    if (!validarId(id)) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'El identificador no es válido.'
        });
    }

    if (typeof activo !== 'boolean') {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'El campo activo debe ser true o false.'
        });
    }

    if (Number(id) === idSesion && activo === false) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'No puedes desactivar tu propia cuenta desde esta operación.'
        });
    }

    const conexion = await pool.connect();

    try {
        await conexion.query('BEGIN');

        const resultadoActual = await conexion.query(
            `SELECT id_administrador, rol, activo
             FROM administradores
             WHERE id_administrador = $1
             FOR UPDATE`,
            [Number(id)]
        );

        if (resultadoActual.rows.length === 0) {
            await conexion.query('ROLLBACK');

            return res.status(404).json({
                estado: 'ERROR',
                mensaje: 'No se encontró el administrador.'
            });
        }

        const actual = resultadoActual.rows[0];

        if (
            actual.rol === 'SUPERADMIN' &&
            actual.activo &&
            activo === false
        ) {
            const cantidad = await conexion.query(
                `SELECT COUNT(*)::int AS total
                 FROM administradores
                 WHERE rol = 'SUPERADMIN'
                   AND activo = TRUE`
            );

            if (cantidad.rows[0].total <= 1) {
                await conexion.query('ROLLBACK');

                return res.status(409).json({
                    estado: 'ERROR',
                    mensaje: 'No puedes desactivar el único SUPERADMIN activo.'
                });
            }
        }

        const resultado = await conexion.query(
            `UPDATE administradores
             SET activo = $1
             WHERE id_administrador = $2
             RETURNING
                id_administrador,
                nombre,
                correo,
                rol,
                activo,
                creado_en`,
            [activo, Number(id)]
        );

        await conexion.query('COMMIT');

        return res.status(200).json({
            estado: 'OK',
            mensaje: activo
                ? 'Administrador activado correctamente.'
                : 'Administrador desactivado correctamente.',
            administrador: resultado.rows[0]
        });
    } catch (error) {
        await conexion.query('ROLLBACK').catch(() => {});

        return responderErrorBD(
            res,
            error,
            'No se pudo cambiar el estado del administrador.'
        );
    } finally {
        conexion.release();
    }
}

// =====================================================
// EXPORTACIONES
// =====================================================

module.exports = {
    iniciarSesion,
    obtenerPerfil,
    actualizarPerfil,
    cambiarPassword,
    listarAdministradores,
    obtenerAdministrador,
    crearAdministrador,
    actualizarAdministrador,
    cambiarEstadoAdministrador
};
