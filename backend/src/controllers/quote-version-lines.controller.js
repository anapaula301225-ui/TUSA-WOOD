
const pool = require('../config/database');

const ESTADOS_EDITABLES = ['BORRADOR', 'DEVUELTA'];
const ROLES_PERMITIDOS = ['SUPERADMIN', 'GERENCIA', 'VENTAS'];

const responderError = (res, status, mensaje) => {
    return res.status(status).json({
        estado: 'ERROR',
        mensaje
    });
};

const validarId = (valor) => {
    const id = Number(valor);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const validarNumero = (valor, permitirCero = true) => {
    if (
        valor === null ||
        valor === undefined ||
        valor === '' ||
        !Number.isFinite(Number(valor))
    ) {
        return false;
    }

    const numero = Number(valor);

    return (
        numero >= 0 &&
        (permitirCero || numero > 0) &&
        numero <= 999999999999
    );
};

const validarTexto = (valor, maximo, obligatorio = false) => {
    if (typeof valor !== 'string') return false;

    const texto = valor.trim();

    if (obligatorio && !texto) return false;

    return texto.length <= maximo;
};

const validarAcceso = (req, res) => {
    const rol = String(req.administrador?.rol || '').toUpperCase();

    if (!ROLES_PERMITIDOS.includes(rol)) {
        responderError(res, 403, 'No tienes permisos para modificar esta cotización.');
        return false;
    }

    return true;
};

const recalcularImportes = async (client, idVersion) => {
    const resultado = await client.query(
        `
            SELECT
                v.modo_igv,
                v.tasa_igv,
                COALESCE((
                    SELECT SUM(d.subtotal_linea)
                    FROM detalle_cotizacion_versiones d
                    WHERE d.id_version = v.id_version
                ), 0)
                +
                COALESCE((
                    SELECT SUM(s.subtotal_linea)
                    FROM detalle_servicios_versiones s
                    WHERE s.id_version = v.id_version
                ), 0) AS importe_lineas
            FROM cotizaciones_versiones v
            WHERE v.id_version = $1;
        `,
        [idVersion]
    );

    if (resultado.rows.length === 0) {
        throw new Error('No se encontró la versión de cotización.');
    }

    const { modo_igv, tasa_igv, importe_lineas } = resultado.rows[0];

    const calculo = await client.query(
        `
            SELECT
                CASE
                    WHEN $1 = 'INCLUIDO'
                    THEN ROUND($2::numeric / (1 + ($3::numeric / 100)), 2)
                    ELSE $2::numeric
                END AS subtotal,

                CASE
                    WHEN $1 = 'INCLUIDO'
                    THEN $2::numeric -
                        ROUND($2::numeric / (1 + ($3::numeric / 100)), 2)
                    ELSE ROUND($2::numeric * ($3::numeric / 100), 2)
                END AS importe_igv,

                CASE
                    WHEN $1 = 'INCLUIDO'
                    THEN $2::numeric
                    ELSE $2::numeric +
                        ROUND($2::numeric * ($3::numeric / 100), 2)
                END AS total;
        `,
        [modo_igv, importe_lineas, tasa_igv]
    );

    const importes = calculo.rows[0];

    await client.query(
        `
            UPDATE cotizaciones_versiones
            SET
                subtotal = $1,
                importe_igv = $2,
                total = $3,
                actualizado_en = CURRENT_TIMESTAMP
            WHERE id_version = $4;
        `,
        [
            importes.subtotal,
            importes.importe_igv,
            importes.total,
            idVersion
        ]
    );

    return importes;
};

const ejecutarOperacion = async (req, res, operacion) => {
    const idVersion = validarId(req.params.id);

    if (!idVersion) {
        return responderError(res, 400, 'El identificador de la versión no es válido.');
    }

    if (!validarAcceso(req, res)) return;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const resultadoVersion = await client.query(
            `
                SELECT id_version, estado
                FROM cotizaciones_versiones
                WHERE id_version = $1
                FOR UPDATE;
            `,
            [idVersion]
        );

        if (resultadoVersion.rows.length === 0) {
            await client.query('ROLLBACK');
            return responderError(res, 404, 'No se encontró la versión de cotización.');
        }

        const version = resultadoVersion.rows[0];

        if (!ESTADOS_EDITABLES.includes(version.estado)) {
            await client.query('ROLLBACK');

            return responderError(
                res,
                409,
                'Solo se pueden modificar versiones en estado BORRADOR o DEVUELTA.'
            );
        }

        const resultado = await operacion(client, idVersion);

        const importes = await recalcularImportes(client, idVersion);

        await client.query('COMMIT');

        return res.status(resultado.status || 200).json({
            estado: 'OK',
            mensaje: resultado.mensaje,
            detalle: resultado.detalle,
            importes
        });
    } catch (error) {
        await client.query('ROLLBACK');

        console.error('Error al modificar líneas de cotización:', error);

        if (error.code === '23505') {
            return responderError(
                res,
                409,
                'Este servicio ya está agregado a la versión.'
            );
        }

        if (error.code === '23503') {
            return responderError(
                res,
                400,
                'El producto o servicio seleccionado ya no está disponible.'
            );
        }

        if (error.status) {
            return responderError(res, error.status, error.message);
        }

        return responderError(
            res,
            500,
            'No se pudo completar la operación sobre la cotización.'
        );
    } finally {
        client.release();
    }
};

// ============================================================
// AGREGAR PRODUCTO
// POST /api/admin/quote-versions/:id/products
//
// Producto del catálogo:
// { id_producto, cantidad, precio_unitario, descripcion }
//
// Producto personalizado:
// { id_producto: null, nombre_producto, cantidad,
//   precio_unitario, descripcion }
// ============================================================

const agregarProductoVersion = async (req, res) => {
    const {
        id_producto,
        nombre_producto,
        descripcion,
        cantidad,
        precio_unitario
    } = req.body || {};

    if (
        !validarNumero(cantidad, false) ||
        !validarNumero(precio_unitario)
    ) {
        return responderError(
            res,
            400,
            'La cantidad debe ser mayor que cero y el precio no puede ser negativo.'
        );
    }

    if (
        descripcion !== undefined &&
        descripcion !== null &&
        !validarTexto(descripcion, 10000)
    ) {
        return responderError(res, 400, 'La descripción del producto no es válida.');
    }

    const idProducto = id_producto === null || id_producto === undefined || id_producto === ''
        ? null
        : validarId(id_producto);

    if (
        id_producto !== null &&
        id_producto !== undefined &&
        id_producto !== '' &&
        !idProducto
    ) {
        return responderError(res, 400, 'El identificador del producto no es válido.');
    }

    if (
        idProducto === null &&
        !validarTexto(nombre_producto, 200, true)
    ) {
        return responderError(
            res,
            400,
            'Para agregar un producto personalizado debes indicar un nombre válido.'
        );
    }

    return ejecutarOperacion(req, res, async (client, idVersion) => {
        let nombre = nombre_producto?.trim() || null;
        let descripcionFinal = descripcion ?? null;

        if (idProducto !== null) {
            const catalogo = await client.query(
                `
                    SELECT nombre, descripcion
                    FROM productos
                    WHERE id_producto = $1
                      AND activo = TRUE;
                `,
                [idProducto]
            );

            if (catalogo.rows.length === 0) {
                const error = new Error('El producto no existe o está inactivo.');
                error.status = 404;
                throw error;
            }

            nombre = catalogo.rows[0].nombre;

            if (descripcion === undefined) {
                descripcionFinal = catalogo.rows[0].descripcion;
            }
        }

        const insertado = await client.query(
            `
                INSERT INTO detalle_cotizacion_versiones (
                    id_version,
                    id_producto,
                    nombre_producto,
                    descripcion,
                    cantidad,
                    precio_unitario,
                    subtotal_linea
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6,
                    ROUND($5::numeric * $6::numeric, 2)
                )
                RETURNING *;
            `,
            [
                idVersion,
                idProducto,
                nombre,
                descripcionFinal,
                String(cantidad),
                String(precio_unitario)
            ]
        );

        return {
            status: 201,
            mensaje: 'Producto agregado correctamente a la versión.',
            detalle: insertado.rows[0]
        };
    });
};

// ============================================================
// ELIMINAR PRODUCTO
// DELETE /api/admin/quote-versions/:id/products/:idDetalle
// ============================================================

const eliminarProductoVersion = async (req, res) => {
    const idDetalle = validarId(req.params.idDetalle);

    if (!idDetalle) {
        return responderError(res, 400, 'El identificador del detalle de producto no es válido.');
    }

    return ejecutarOperacion(req, res, async (client, idVersion) => {
        const eliminado = await client.query(
            `
                DELETE FROM detalle_cotizacion_versiones
                WHERE id_detalle_version = $1
                  AND id_version = $2
                RETURNING *;
            `,
            [idDetalle, idVersion]
        );

        if (eliminado.rows.length === 0) {
            const error = new Error('No se encontró ese producto dentro de la versión indicada.');
            error.status = 404;
            throw error;
        }

        return {
            mensaje: 'Producto eliminado correctamente de la versión.',
            detalle: eliminado.rows[0]
        };
    });
};

// ============================================================
// AGREGAR SERVICIO
// POST /api/admin/quote-versions/:id/services
// { id_servicio, cantidad, precio_unitario, descripcion }
// ============================================================

const agregarServicioVersion = async (req, res) => {
    const {
        id_servicio,
        cantidad = 1,
        precio_unitario,
        descripcion
    } = req.body || {};

    const idServicio = validarId(id_servicio);

    if (!idServicio) {
        return responderError(res, 400, 'Debes seleccionar un servicio válido.');
    }

    if (
        !validarNumero(cantidad, false) ||
        !validarNumero(precio_unitario)
    ) {
        return responderError(
            res,
            400,
            'La cantidad debe ser mayor que cero y el precio no puede ser negativo.'
        );
    }

    if (
        descripcion !== undefined &&
        descripcion !== null &&
        !validarTexto(descripcion, 10000)
    ) {
        return responderError(res, 400, 'La descripción del servicio no es válida.');
    }

    return ejecutarOperacion(req, res, async (client, idVersion) => {
        const catalogo = await client.query(
            `
                SELECT nombre, descripcion
                FROM servicios
                WHERE id_servicio = $1
                  AND activo = TRUE;
            `,
            [idServicio]
        );

        if (catalogo.rows.length === 0) {
            const error = new Error('El servicio no existe o está inactivo.');
            error.status = 404;
            throw error;
        }

        const descripcionFinal = descripcion === undefined
            ? catalogo.rows[0].descripcion
            : descripcion;

        const insertado = await client.query(
            `
                INSERT INTO detalle_servicios_versiones (
                    id_version,
                    id_servicio,
                    nombre_servicio,
                    descripcion,
                    cantidad,
                    precio_unitario,
                    subtotal_linea
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6,
                    ROUND($5::numeric * $6::numeric, 2)
                )
                RETURNING *;
            `,
            [
                idVersion,
                idServicio,
                catalogo.rows[0].nombre,
                descripcionFinal,
                String(cantidad),
                String(precio_unitario)
            ]
        );

        return {
            status: 201,
            mensaje: 'Servicio agregado correctamente a la versión.',
            detalle: insertado.rows[0]
        };
    });
};

// ============================================================
// ELIMINAR SERVICIO
// DELETE /api/admin/quote-versions/:id/services/:idDetalle
// ============================================================

const eliminarServicioVersion = async (req, res) => {
    const idDetalle = validarId(req.params.idDetalle);

    if (!idDetalle) {
        return responderError(res, 400, 'El identificador del detalle de servicio no es válido.');
    }

    return ejecutarOperacion(req, res, async (client, idVersion) => {
        const eliminado = await client.query(
            `
                DELETE FROM detalle_servicios_versiones
                WHERE id_detalle_servicio_version = $1
                  AND id_version = $2
                RETURNING *;
            `,
            [idDetalle, idVersion]
        );

        if (eliminado.rows.length === 0) {
            const error = new Error('No se encontró ese servicio dentro de la versión indicada.');
            error.status = 404;
            throw error;
        }

        return {
            mensaje: 'Servicio eliminado correctamente de la versión.',
            detalle: eliminado.rows[0]
        };
    });
};

module.exports = {
    agregarProductoVersion,
    eliminarProductoVersion,
    agregarServicioVersion,
    eliminarServicioVersion
};
