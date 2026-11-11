
const bcrypt = require('bcrypt');
const pool = require('../config/database');

const ROLES_VALIDOS = ['SUPERADMIN', 'GERENCIA', 'VENTAS'];
const COSTO_BCRYPT = 12;

function responderError(res, codigo, mensaje) {
    return res.status(codigo).json({
        estado: 'ERROR',
        mensaje
    });
}

function normalizarCorreo(correo) {
    return String(correo || '').trim().toLowerCase();
}

function validarId(valor) {
    const id = Number(valor);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalizarRol(rol) {
    return String(rol || '').trim().toUpperCase();
}

function esSuperadmin(req) {
    return req.administrador?.rol === 'SUPERADMIN';
}

function validarNombre(nombre) {
    return typeof nombre === 'string' &&
        nombre.trim().length >= 2 &&
        nombre.trim().length <= 120;
}

function validarCorreo(correo) {
    return typeof correo === 'string' &&
        correo.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
}

function validarPassword(password) {
    return typeof password === 'string' &&
        password.length >= 8 &&
        password.length <= 72;
}

async function listarUsuarios(req, res) {
    try {
        const condiciones = [];
        const parametros = [];

        if (req.query.buscar) {
            parametros.push(`%${String(req.query.buscar).trim()}%`);
            condiciones.push(
                `(nombre ILIKE $${parametros.length} OR correo ILIKE $${parametros.length})`
            );
        }

        if (req.query.rol) {
            const rol = normalizarRol(req.query.rol);

            if (!ROLES_VALIDOS.includes(rol)) {
                return responderError(res, 400, 'El rol indicado no es válido.');
            }

            parametros.push(rol);
            condiciones.push(`rol = $${parametros.length}`);
        }

        if (req.query.activo !== undefined) {
            const activo = String(req.query.activo).toLowerCase();

            if (!['true', 'false'].includes(activo)) {
                return responderError(
                    res,
                    400,
                    'El filtro activo debe ser true o false.'
                );
            }

            parametros.push(activo === 'true');
            condiciones.push(`activo = $${parametros.length}`);
        }

        const where = condiciones.length
            ? `WHERE ${condiciones.join(' AND ')}`
            : '';

        const resultado = await pool.query(
            `SELECT id_administrador, nombre, correo, rol, activo, creado_en
             FROM administradores
             ${where}
             ORDER BY id_administrador DESC`,
            parametros
        );

        return res.json({
            estado: 'OK',
            mensaje: 'Usuarios obtenidos correctamente.',
            total: resultado.rows.length,
            usuarios: resultado.rows
        });
    } catch (error) {
        console.error('Error al listar usuarios:', error.message);
        return responderError(res, 500, 'No se pudieron obtener los usuarios.');
    }
}

async function obtenerUsuarioPorId(req, res) {
    const id = validarId(req.params.id);

    if (!id) {
        return responderError(res, 400, 'El identificador del usuario no es válido.');
    }

    try {
        const resultado = await pool.query(
            `SELECT id_administrador, nombre, correo, rol, activo, creado_en
             FROM administradores
             WHERE id_administrador = $1
             LIMIT 1`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return responderError(res, 404, 'El usuario no existe.');
        }

        return res.json({
            estado: 'OK',
            mensaje: 'Usuario obtenido correctamente.',
            usuario: resultado.rows[0]
        });
    } catch (error) {
        console.error('Error al obtener usuario:', error.message);
        return responderError(res, 500, 'No se pudo obtener el usuario.');
    }
}

async function crearUsuario(req, res) {
    const nombre = typeof req.body.nombre === 'string'
        ? req.body.nombre.trim()
        : '';
    const correo = normalizarCorreo(req.body.correo);
    const password = req.body.password;
    const rol = normalizarRol(req.body.rol);

    if (!validarNombre(nombre)) {
        return responderError(res, 400, 'El nombre debe tener entre 2 y 120 caracteres.');
    }

    if (!validarCorreo(correo)) {
        return responderError(res, 400, 'Ingresa un correo electrónico válido.');
    }

    if (!validarPassword(password)) {
        return responderError(res, 400, 'La contraseña debe tener entre 8 y 72 caracteres.');
    }

    if (!ROLES_VALIDOS.includes(rol)) {
        return responderError(res, 400, 'El rol indicado no es válido.');
    }

    if (rol === 'SUPERADMIN' && !esSuperadmin(req)) {
        return responderError(
            res,
            403,
            'Solo un SUPERADMIN puede crear otra cuenta SUPERADMIN.'
        );
    }

    try {
        const passwordHash = await bcrypt.hash(password, COSTO_BCRYPT);

        const resultado = await pool.query(
            `INSERT INTO administradores
                (nombre, correo, password_hash, rol, activo, creado_en)
             VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP)
             RETURNING id_administrador, nombre, correo, rol, activo, creado_en`,
            [nombre, correo, passwordHash, rol]
        );

        return res.status(201).json({
            estado: 'OK',
            mensaje: 'Usuario creado correctamente.',
            usuario: resultado.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return responderError(res, 409, 'Ya existe una cuenta con ese correo.');
        }

        console.error('Error al crear usuario:', error.message);
        return responderError(res, 500, 'No se pudo crear el usuario.');
    }
}

async function actualizarUsuario(req, res) {
    const id = validarId(req.params.id);

    if (!id) {
        return responderError(res, 400, 'El identificador del usuario no es válido.');
    }

    const campos = [];
    const valores = [];
    const cuerpo = req.body || {};

    if (Object.keys(cuerpo).length === 0) {
        return responderError(res, 400, 'Debes enviar al menos un campo para actualizar.');
    }

    if (cuerpo.nombre !== undefined) {
        if (!validarNombre(cuerpo.nombre)) {
            return responderError(res, 400, 'El nombre debe tener entre 2 y 120 caracteres.');
        }
        valores.push(cuerpo.nombre.trim());
        campos.push(`nombre = $${valores.length}`);
    }

    if (cuerpo.correo !== undefined) {
        const correo = normalizarCorreo(cuerpo.correo);

        if (!validarCorreo(correo)) {
            return responderError(res, 400, 'Ingresa un correo electrónico válido.');
        }

        valores.push(correo);
        campos.push(`correo = $${valores.length}`);
    }

    if (cuerpo.rol !== undefined) {
        const rol = normalizarRol(cuerpo.rol);

        if (!ROLES_VALIDOS.includes(rol)) {
            return responderError(res, 400, 'El rol indicado no es válido.');
        }

        if (rol === 'SUPERADMIN' && !esSuperadmin(req)) {
            return responderError(res, 403, 'Solo un SUPERADMIN puede asignar ese rol.');
        }

        if (id === req.administrador.id_administrador &&
            rol !== req.administrador.rol) {
            return responderError(
                res,
                400,
                'No puedes cambiar tu propio rol desde esta operación.'
            );
        }

        valores.push(rol);
        campos.push(`rol = $${valores.length}`);
    }

    if (cuerpo.password !== undefined && cuerpo.password !== '') {
        if (!validarPassword(cuerpo.password)) {
            return responderError(
                res,
                400,
                'La contraseña debe tener entre 8 y 72 caracteres.'
            );
        }

        try {
            const passwordHash = await bcrypt.hash(cuerpo.password, COSTO_BCRYPT);
            valores.push(passwordHash);
            campos.push(`password_hash = $${valores.length}`);
        } catch (error) {
            console.error('Error al cifrar contraseña:', error.message);
            return responderError(res, 500, 'No se pudo actualizar la contraseña.');
        }
    }

    if (campos.length === 0) {
        return responderError(res, 400, 'No hay campos válidos para actualizar.');
    }

    const esCambioDeRol = cuerpo.rol !== undefined;
    const nuevoRol = esCambioDeRol ? normalizarRol(cuerpo.rol) : null;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [83471021]);

        const actual = await client.query(
            `SELECT id_administrador, nombre, correo, rol, activo
             FROM administradores
             WHERE id_administrador = $1
             FOR UPDATE`,
            [id]
        );

        if (actual.rows.length === 0) {
            await client.query('ROLLBACK');
            return responderError(res, 404, 'El usuario no existe.');
        }

        const usuarioActual = actual.rows[0];

        if (!esSuperadmin(req) && usuarioActual.rol === 'SUPERADMIN') {
            await client.query('ROLLBACK');
            return responderError(res, 403, 'Solo un SUPERADMIN puede modificar esa cuenta.');
        }

        if (esCambioDeRol && usuarioActual.rol === 'SUPERADMIN' &&
            nuevoRol !== 'SUPERADMIN' && usuarioActual.activo) {
            const conteo = await client.query(
                `SELECT COUNT(*)::int AS total
                 FROM administradores
                 WHERE rol = 'SUPERADMIN' AND activo = TRUE`
            );

            if (conteo.rows[0].total <= 1) {
                await client.query('ROLLBACK');
                return responderError(
                    res,
                    409,
                    'No puedes cambiar el rol del último SUPERADMIN activo.'
                );
            }
        }

        valores.push(id);

        const resultado = await client.query(
            `UPDATE administradores
             SET ${campos.join(', ')}
             WHERE id_administrador = $${valores.length}
             RETURNING id_administrador, nombre, correo, rol, activo, creado_en`,
            valores
        );

        await client.query('COMMIT');

        return res.json({
            estado: 'OK',
            mensaje: 'Usuario actualizado correctamente.',
            usuario: resultado.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');

        if (error.code === '23505') {
            return responderError(res, 409, 'Ya existe una cuenta con ese correo.');
        }

        console.error('Error al actualizar usuario:', error.message);
        return responderError(res, 500, 'No se pudo actualizar el usuario.');
    } finally {
        client.release();
    }
}

async function cambiarEstadoUsuario(req, res) {
    const id = validarId(req.params.id);
    const activo = req.body?.activo;

    if (!id) {
        return responderError(res, 400, 'El identificador del usuario no es válido.');
    }

    if (typeof activo !== 'boolean') {
        return responderError(res, 400, 'El campo activo debe ser true o false.');
    }

    if (id === req.administrador.id_administrador && !activo) {
        return responderError(res, 400, 'No puedes desactivar tu propia cuenta.');
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [83471021]);

        const actual = await client.query(
            `SELECT id_administrador, nombre, correo, rol, activo
             FROM administradores
             WHERE id_administrador = $1
             FOR UPDATE`,
            [id]
        );

        if (actual.rows.length === 0) {
            await client.query('ROLLBACK');
            return responderError(res, 404, 'El usuario no existe.');
        }

        const usuario = actual.rows[0];

        if (!esSuperadmin(req) && usuario.rol === 'SUPERADMIN') {
            await client.query('ROLLBACK');
            return responderError(res, 403, 'Solo un SUPERADMIN puede modificar esa cuenta.');
        }

        if (usuario.rol === 'SUPERADMIN' && usuario.activo && !activo) {
            const conteo = await client.query(
                `SELECT COUNT(*)::int AS total
                 FROM administradores
                 WHERE rol = 'SUPERADMIN' AND activo = TRUE`
            );

            if (conteo.rows[0].total <= 1) {
                await client.query('ROLLBACK');
                return responderError(
                    res,
                    409,
                    'No puedes desactivar el último SUPERADMIN activo.'
                );
            }
        }

        const resultado = await client.query(
            `UPDATE administradores
             SET activo = $1
             WHERE id_administrador = $2
             RETURNING id_administrador, nombre, correo, rol, activo, creado_en`,
            [activo, id]
        );

        await client.query('COMMIT');

        return res.json({
            estado: 'OK',
            mensaje: activo
                ? 'Usuario activado correctamente.'
                : 'Usuario desactivado correctamente.',
            usuario: resultado.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al cambiar estado del usuario:', error.message);
        return responderError(res, 500, 'No se pudo cambiar el estado del usuario.');
    } finally {
        client.release();
    }
}

module.exports = {
    listarUsuarios,
    obtenerUsuarioPorId,
    crearUsuario,
    actualizarUsuario,
    cambiarEstadoUsuario
};
