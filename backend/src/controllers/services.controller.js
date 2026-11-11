
const pool = require('../config/database');

// ======================================================
// VALIDACIONES GENERALES
// ======================================================

function validarId(valor) {
    const id = Number(valor);

    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validarTexto(valor, longitudMaxima) {
    if (typeof valor !== 'string') {
        return null;
    }

    const texto = valor.trim();

    if (!texto || texto.length > longitudMaxima) {
        return null;
    }

    return texto;
}

function responderError(res, codigo, mensaje) {
    return res.status(codigo).json({
        estado: 'ERROR',
        mensaje
    });
}

// ======================================================
// LISTAR SERVICIOS ACTIVOS - PÚBLICO
// ======================================================

const listarServicios = async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT
                id_servicio,
                nombre,
                descripcion,
                activo
            FROM servicios
            WHERE activo = TRUE
            ORDER BY id_servicio ASC
        `);

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Servicios obtenidos correctamente.',
            servicios: resultado.rows
        });

    } catch (error) {
        console.error(
            '[SERVICIOS] Error al listar servicios:',
            error.message
        );

        return responderError(
            res,
            500,
            'No se pudieron obtener los servicios.'
        );
    }
};

// ======================================================
// LISTAR TODOS LOS SERVICIOS - ADMINISTRACIÓN
// ======================================================

const listarTodosServicios = async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT
                id_servicio,
                nombre,
                descripcion,
                activo,
                creado_en
            FROM servicios
            ORDER BY id_servicio DESC
        `);

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Servicios administrativos obtenidos correctamente.',
            servicios: resultado.rows
        });

    } catch (error) {
        console.error(
            '[SERVICIOS] Error al listar todos:',
            error.message
        );

        return responderError(
            res,
            500,
            'No se pudieron obtener los servicios.'
        );
    }
};

// ======================================================
// OBTENER SERVICIO POR ID
// ======================================================

const obtenerServicioPorId = async (req, res) => {
    try {
        const id = validarId(req.params.id);

        if (!id) {
            return responderError(
                res,
                400,
                'El ID del servicio no es válido.'
            );
        }

        const resultado = await pool.query(`
            SELECT
                id_servicio,
                nombre,
                descripcion,
                activo,
                creado_en
            FROM servicios
            WHERE id_servicio = $1
            LIMIT 1
        `, [id]);

        if (resultado.rows.length === 0) {
            return responderError(
                res,
                404,
                'El servicio solicitado no existe.'
            );
        }

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Servicio obtenido correctamente.',
            servicio: resultado.rows[0]
        });

    } catch (error) {
        console.error(
            '[SERVICIOS] Error al obtener servicio:',
            error.message
        );

        return responderError(
            res,
            500,
            'No se pudo obtener el servicio.'
        );
    }
};

// ======================================================
// CREAR SERVICIO
// ======================================================

const crearServicio = async (req, res) => {
    try {
        const nombre = validarTexto(req.body.nombre, 150);

        const descripcion =
            req.body.descripcion === undefined ||
            req.body.descripcion === null
                ? null
                : validarTexto(req.body.descripcion, 5000);

        if (!nombre) {
            return responderError(
                res,
                400,
                'El nombre es obligatorio y debe tener máximo 150 caracteres.'
            );
        }

        if (
            req.body.descripcion !== undefined &&
            req.body.descripcion !== null &&
            !descripcion
        ) {
            return responderError(
                res,
                400,
                'La descripción no puede estar vacía y debe tener máximo 5000 caracteres.'
            );
        }

        const duplicado = await pool.query(`
            SELECT id_servicio
            FROM servicios
            WHERE LOWER(nombre) = LOWER($1)
            LIMIT 1
        `, [nombre]);

        if (duplicado.rows.length > 0) {
            return responderError(
                res,
                409,
                'Ya existe un servicio con ese nombre.'
            );
        }

        const resultado = await pool.query(`
            INSERT INTO servicios (
                nombre,
                descripcion,
                activo
            )
            VALUES ($1, $2, TRUE)
            RETURNING
                id_servicio,
                nombre,
                descripcion,
                activo,
                creado_en
        `, [nombre, descripcion]);

        return res.status(201).json({
            estado: 'OK',
            mensaje: 'Servicio creado correctamente.',
            servicio: resultado.rows[0]
        });

    } catch (error) {
        if (error.code === '23505') {
            return responderError(
                res,
                409,
                'Ya existe un servicio con ese nombre.'
            );
        }

        console.error(
            '[SERVICIOS] Error al crear servicio:',
            error.message
        );

        return responderError(
            res,
            500,
            'No se pudo crear el servicio.'
        );
    }
};

// ======================================================
// ACTUALIZAR SERVICIO
// ======================================================

const actualizarServicio = async (req, res) => {
    try {
        const id = validarId(req.params.id);

        if (!id) {
            return responderError(
                res,
                400,
                'El ID del servicio no es válido.'
            );
        }

        const nombre = validarTexto(req.body.nombre, 150);

        const descripcion =
            req.body.descripcion === undefined ||
            req.body.descripcion === null
                ? null
                : validarTexto(req.body.descripcion, 5000);

        if (!nombre) {
            return responderError(
                res,
                400,
                'El nombre es obligatorio y debe tener máximo 150 caracteres.'
            );
        }

        if (
            req.body.descripcion !== undefined &&
            req.body.descripcion !== null &&
            !descripcion
        ) {
            return responderError(
                res,
                400,
                'La descripción no puede estar vacía y debe tener máximo 5000 caracteres.'
            );
        }

        const existente = await pool.query(`
            SELECT id_servicio
            FROM servicios
            WHERE id_servicio = $1
            LIMIT 1
        `, [id]);

        if (existente.rows.length === 0) {
            return responderError(
                res,
                404,
                'El servicio no existe.'
            );
        }

        const duplicado = await pool.query(`
            SELECT id_servicio
            FROM servicios
            WHERE LOWER(nombre) = LOWER($1)
              AND id_servicio <> $2
            LIMIT 1
        `, [nombre, id]);

        if (duplicado.rows.length > 0) {
            return responderError(
                res,
                409,
                'Ya existe otro servicio con ese nombre.'
            );
        }

        const resultado = await pool.query(`
            UPDATE servicios
            SET
                nombre = $1,
                descripcion = $2
            WHERE id_servicio = $3
            RETURNING
                id_servicio,
                nombre,
                descripcion,
                activo,
                creado_en
        `, [nombre, descripcion, id]);

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Servicio actualizado correctamente.',
            servicio: resultado.rows[0]
        });

    } catch (error) {
        if (error.code === '23505') {
            return responderError(
                res,
                409,
                'Ya existe otro servicio con ese nombre.'
            );
        }

        console.error(
            '[SERVICIOS] Error al actualizar servicio:',
            error.message
        );

        return responderError(
            res,
            500,
            'No se pudo actualizar el servicio.'
        );
    }
};

// ======================================================
// ACTIVAR / DESACTIVAR SERVICIO
// ======================================================

const cambiarEstadoServicio = async (req, res) => {
    try {
        const id = validarId(req.params.id);
        const { activo } = req.body;

        if (!id) {
            return responderError(
                res,
                400,
                'El ID del servicio no es válido.'
            );
        }

        if (typeof activo !== 'boolean') {
            return responderError(
                res,
                400,
                'El campo activo debe ser verdadero o falso.'
            );
        }

        const resultado = await pool.query(`
            UPDATE servicios
            SET activo = $1
            WHERE id_servicio = $2
            RETURNING
                id_servicio,
                nombre,
                descripcion,
                activo,
                creado_en
        `, [activo, id]);

        if (resultado.rows.length === 0) {
            return responderError(
                res,
                404,
                'El servicio no existe.'
            );
        }

        return res.status(200).json({
            estado: 'OK',
            mensaje: activo
                ? 'Servicio activado correctamente.'
                : 'Servicio desactivado correctamente.',
            servicio: resultado.rows[0]
        });

    } catch (error) {
        console.error(
            '[SERVICIOS] Error al cambiar estado:',
            error.message
        );

        return responderError(
            res,
            500,
            'No se pudo cambiar el estado del servicio.'
        );
    }
};

// ======================================================
// ELIMINAR SERVICIO
// ELIMINACIÓN FÍSICA O DESACTIVACIÓN SEGÚN RELACIONES
// ======================================================

const eliminarServicio = async (req, res) => {
    const id = validarId(req.params.id);

    if (!id) {
        return responderError(
            res,
            400,
            'El ID del servicio no es válido.'
        );
    }

    const conexion = await pool.connect();

    try {
        await conexion.query('BEGIN');

        // Bloquear el servicio para evitar cambios concurrentes
        // mientras comprobamos sus relaciones.
        const existente = await conexion.query(`
            SELECT
                id_servicio,
                nombre,
                descripcion,
                activo,
                creado_en
            FROM servicios
            WHERE id_servicio = $1
            FOR UPDATE
        `, [id]);

        if (existente.rows.length === 0) {
            await conexion.query('ROLLBACK');

            return responderError(
                res,
                404,
                'El servicio no existe.'
            );
        }

        // Comprobar si el servicio aparece en alguna cotización.
        const relaciones = await conexion.query(`
            SELECT COUNT(*)::INTEGER AS total
            FROM detalle_servicios_cotizacion
            WHERE id_servicio = $1
        `, [id]);

        const totalCotizaciones = relaciones.rows[0].total;

        // Si tiene historial comercial, conservar el registro.
        if (totalCotizaciones > 0) {
            const resultado = await conexion.query(`
                UPDATE servicios
                SET activo = FALSE
                WHERE id_servicio = $1
                RETURNING
                    id_servicio,
                    nombre,
                    descripcion,
                    activo,
                    creado_en
            `, [id]);

            await conexion.query('COMMIT');

            return res.status(200).json({
                estado: 'OK',
                mensaje: 'El servicio tiene cotizaciones asociadas. Se desactivó y su historial se ha conservado.',
                tipo_eliminacion: 'LOGICA',
                total_cotizaciones: totalCotizaciones,
                servicio: resultado.rows[0]
            });
        }

        // Si no tiene relaciones, eliminar físicamente.
        const resultado = await conexion.query(`
            DELETE FROM servicios
            WHERE id_servicio = $1
            RETURNING
                id_servicio,
                nombre,
                descripcion,
                activo,
                creado_en
        `, [id]);

        if (resultado.rows.length === 0) {
            await conexion.query('ROLLBACK');

            return responderError(
                res,
                404,
                'El servicio no existe.'
            );
        }

        await conexion.query('COMMIT');

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Servicio eliminado correctamente.',
            tipo_eliminacion: 'FISICA',
            servicio_eliminado: resultado.rows[0]
        });

    } catch (error) {
        await conexion.query('ROLLBACK').catch(() => {});

        // Protección adicional de la llave foránea.
        if (error.code === '23503') {
            return responderError(
                res,
                409,
                'No se puede eliminar físicamente el servicio porque tiene registros relacionados. Intenta desactivarlo.'
            );
        }

        console.error(
            '[SERVICIOS] Error al eliminar servicio:',
            error.message
        );

        return responderError(
            res,
            500,
            'No se pudo eliminar el servicio.'
        );

    } finally {
        conexion.release();
    }
};

// ======================================================
// EXPORTAR CONTROLADORES
// ======================================================

module.exports = {
    listarServicios,
    listarTodosServicios,
    obtenerServicioPorId,
    crearServicio,
    actualizarServicio,
    cambiarEstadoServicio,
    eliminarServicio
};
