const pool = require('../config/database');

const {
    generarPDFCotizacion
} = require('../services/quote-pdf.service');

const {
    enviarCorreo
} = require('../services/email.service');

// ============================================================
// CONFIGURACIÓN
// ============================================================

const TASA_IGV_PREDETERMINADA = 18;

const MODOS_IGV = ['INCLUIDO', 'ADICIONAL'];

const ESTADOS_EDITABLES = ['BORRADOR', 'DEVUELTA'];

const ESTADOS_QUE_PERMITEN_NUEVA_VERSION = ['APROBADA', 'ENVIADA'];

const ROLES_CONSULTA = ['SUPERADMIN', 'GERENCIA', 'VENTAS'];

const ROLES_APROBACION = ['SUPERADMIN', 'GERENCIA'];

// Quienes arman la cotización (precios, condiciones, envío a aprobación).
const ROLES_ARMADO = ['SUPERADMIN', 'VENTAS'];

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

const obtenerRol = (req) => {
    return String(req.administrador?.rol || '').toUpperCase();
};

const obtenerIdAdministrador = (req) => {
    const id = Number(req.administrador?.id_administrador);

    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

// Mantiene el estado de la solicitud alineado con el avance de la cotización.
// Solo cambia si la solicitud está en alguno de los estados de origen y deja
// el movimiento en el historial. Recibe un client (transacción) o el pool.
const sincronizarEstadoSolicitud = async (
    db,
    idCotizacion,
    idAdministrador,
    estadoNuevo,
    estadosOrigen,
    comentario
) => {
    const actual = await db.query(
        `SELECT estado FROM cotizaciones WHERE id_cotizacion = $1 FOR UPDATE;`,
        [idCotizacion]
    );

    if (actual.rows.length === 0) return;

    const estadoAnterior = actual.rows[0].estado;

    if (!estadosOrigen.includes(estadoAnterior)) return;

    await db.query(
        `
            UPDATE cotizaciones
            SET estado = $1, actualizado_en = CURRENT_TIMESTAMP
            WHERE id_cotizacion = $2;
        `,
        [estadoNuevo, idCotizacion]
    );

    await db.query(
        `
            INSERT INTO historial_cotizaciones (
                id_cotizacion,
                id_administrador,
                estado_anterior,
                estado_nuevo,
                comentario
            )
            VALUES ($1, $2, $3, $4, $5);
        `,
        [
            idCotizacion,
            idAdministrador,
            estadoAnterior,
            estadoNuevo,
            comentario
        ]
    );
};

const validarId = (valor) => {
    const id = Number(valor);

    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const validarImporte = (valor, permitirCero = true) => {
    if (
        valor === null ||
        valor === undefined ||
        valor === '' ||
        !Number.isFinite(Number(valor))
    ) {
        return false;
    }

    const numero = Number(valor);

    if (numero < 0 || (!permitirCero && numero === 0)) {
        return false;
    }

    return numero <= 999999999999;
};

const responderError = (res, status, mensaje) => {
    return res.status(status).json({
        estado: 'ERROR',
        mensaje
    });
};

// ============================================================
// RECALCULAR IMPORTES DE UNA VERSIÓN
// Los cálculos se realizan en PostgreSQL usando NUMERIC.
// ============================================================

const recalcularImportes = async (client, idVersion) => {
    const resultado = await client.query(
        `
            SELECT
                v.modo_igv,
                v.tasa_igv,

                COALESCE(
                    (
                        SELECT SUM(d.subtotal_linea)
                        FROM detalle_cotizacion_versiones d
                        WHERE d.id_version = v.id_version
                    ),
                    0
                )
                +
                COALESCE(
                    (
                        SELECT SUM(s.subtotal_linea)
                        FROM detalle_servicios_versiones s
                        WHERE s.id_version = v.id_version
                    ),
                    0
                ) AS importe_lineas

            FROM cotizaciones_versiones v
            WHERE v.id_version = $1;
        `,
        [idVersion]
    );

    if (resultado.rows.length === 0) {
        throw new Error('No se encontró la versión de cotización.');
    }

    const version = resultado.rows[0];

    const calculo = await client.query(
        `
            SELECT
                CASE
                    WHEN $1 = 'INCLUIDO'
                    THEN ROUND(
                        $2::numeric / (1 + ($3::numeric / 100)),
                        2
                    )
                    ELSE $2::numeric
                END AS subtotal,

                CASE
                    WHEN $1 = 'INCLUIDO'
                    THEN $2::numeric -
                        ROUND(
                            $2::numeric / (1 + ($3::numeric / 100)),
                            2
                        )
                    ELSE ROUND(
                        $2::numeric * ($3::numeric / 100),
                        2
                    )
                END AS importe_igv,

                CASE
                    WHEN $1 = 'INCLUIDO'
                    THEN $2::numeric
                    ELSE $2::numeric +
                        ROUND(
                            $2::numeric * ($3::numeric / 100),
                            2
                        )
                END AS total;
        `,
        [
            version.modo_igv,
            version.importe_lineas,
            version.tasa_igv
        ]
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

// ============================================================
// CREAR PRIMERA VERSIÓN O UNA NUEVA VERSIÓN
// POST /api/admin/quotes/:id/versions
// ============================================================

const crearPrimeraVersion = async (req, res) => {
    const idCotizacion = validarId(req.params.id);
    const idAdministrador = obtenerIdAdministrador(req);

    if (!idCotizacion) {
        return responderError(
            res,
            400,
            'El identificador de la solicitud no es válido.'
        );
    }

    if (!idAdministrador) {
        return responderError(
            res,
            401,
            'No se pudo identificar al administrador.'
        );
    }

    if (!ROLES_ARMADO.includes(obtenerRol(req))) {
        return responderError(
            res,
            403,
            'Solo VENTAS o SUPERADMIN pueden armar cotizaciones.'
        );
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const solicitud = await client.query(
            `
                SELECT id_cotizacion
                FROM cotizaciones
                WHERE id_cotizacion = $1
                FOR UPDATE;
            `,
            [idCotizacion]
        );

        if (solicitud.rows.length === 0) {
            await client.query('ROLLBACK');

            return responderError(
                res,
                404,
                'No se encontró la solicitud.'
            );
        }

        const versionExistente = await client.query(
            `
                SELECT *
                FROM cotizaciones_versiones
                WHERE id_cotizacion = $1
                ORDER BY numero_version DESC
                LIMIT 1;
            `,
            [idCotizacion]
        );

        // ====================================================
        // CASO 1: PRIMERA VERSIÓN
        // ====================================================

        if (versionExistente.rows.length === 0) {
            const configuracion = await client.query(
                `
                    SELECT modo_igv, tasa_igv
                    FROM configuracion_cotizaciones
                    WHERE id_configuracion = 1;
                `
            );

            const modoIGV = configuracion.rows.length > 0
                ? configuracion.rows[0].modo_igv
                : null;

            const tasaIGV = configuracion.rows.length > 0
                ? configuracion.rows[0].tasa_igv
                : TASA_IGV_PREDETERMINADA;

            if (!MODOS_IGV.includes(modoIGV)) {
                await client.query('ROLLBACK');

                return responderError(
                    res,
                    400,
                    'Primero debe configurarse la modalidad del IGV desde el módulo tributario.'
                );
            }

            const nuevaVersion = await client.query(
                `
                    INSERT INTO cotizaciones_versiones (
                        id_cotizacion,
                        numero_version,
                        estado,
                        modo_igv,
                        tasa_igv,
                        subtotal,
                        importe_igv,
                        total,
                        creado_por
                    )
                    VALUES (
                        $1,
                        1,
                        'BORRADOR',
                        $2,
                        $3,
                        0,
                        0,
                        0,
                        $4
                    )
                    RETURNING *;
                `,
                [
                    idCotizacion,
                    modoIGV,
                    tasaIGV,
                    idAdministrador
                ]
            );

            const version = nuevaVersion.rows[0];

            await client.query(
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
                    SELECT
                        $1,
                        d.id_producto,
                        d.nombre_producto,
                        d.especificaciones,
                        d.cantidad,
                        0,
                        0
                    FROM detalle_cotizacion d
                    WHERE d.id_cotizacion = $2;
                `,
                [version.id_version, idCotizacion]
            );

            await client.query(
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
                    SELECT
                        $1,
                        s.id_servicio,
                        s.nombre_servicio,
                        s.observaciones,
                        1,
                        0,
                        0
                    FROM detalle_servicios_cotizacion s
                    WHERE s.id_cotizacion = $2;
                `,
                [version.id_version, idCotizacion]
            );

            await sincronizarEstadoSolicitud(
                client,
                idCotizacion,
                idAdministrador,
                'EN_ATENCION',
                ['PENDIENTE'],
                'Se comenzó a armar la cotización.'
            );

            await client.query('COMMIT');

            return res.status(201).json({
                estado: 'OK',
                mensaje: 'Primera versión de cotización creada correctamente.',
                version
            });
        }

        // ====================================================
        // CASO 2: VERSIONES POSTERIORES
        // ====================================================

        const ultimaVersion = versionExistente.rows[0];

        if (
            !ESTADOS_QUE_PERMITEN_NUEVA_VERSION.includes(
                ultimaVersion.estado
            )
        ) {
            await client.query('ROLLBACK');

            return res.status(409).json({
                estado: 'ERROR',
                mensaje:
                    'No se puede crear una nueva versión porque la última versión todavía no ha sido aprobada o enviada al cliente.',
                ultima_version: {
                    id_version: ultimaVersion.id_version,
                    numero_version: ultimaVersion.numero_version,
                    estado: ultimaVersion.estado
                }
            });
        }

        const siguienteNumero = Number(ultimaVersion.numero_version) + 1;

        const nuevaVersion = await client.query(
            `
                INSERT INTO cotizaciones_versiones (
                    id_cotizacion,
                    numero_version,
                    estado,
                    modo_igv,
                    tasa_igv,
                    subtotal,
                    importe_igv,
                    total,
                    condiciones_comerciales,
                    observaciones_internas,
                    creado_por
                )
                VALUES (
                    $1,
                    $2,
                    'BORRADOR',
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10
                )
                RETURNING *;
            `,
            [
                idCotizacion,
                siguienteNumero,
                ultimaVersion.modo_igv,
                ultimaVersion.tasa_igv,
                ultimaVersion.subtotal,
                ultimaVersion.importe_igv,
                ultimaVersion.total,
                ultimaVersion.condiciones_comerciales,
                ultimaVersion.observaciones_internas,
                idAdministrador
            ]
        );

        const version = nuevaVersion.rows[0];

        await client.query(
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
                SELECT
                    $1,
                    d.id_producto,
                    d.nombre_producto,
                    d.descripcion,
                    d.cantidad,
                    d.precio_unitario,
                    d.subtotal_linea
                FROM detalle_cotizacion_versiones d
                WHERE d.id_version = $2;
            `,
            [
                version.id_version,
                ultimaVersion.id_version
            ]
        );

        await client.query(
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
                SELECT
                    $1,
                    s.id_servicio,
                    s.nombre_servicio,
                    s.descripcion,
                    s.cantidad,
                    s.precio_unitario,
                    s.subtotal_linea
                FROM detalle_servicios_versiones s
                WHERE s.id_version = $2;
            `,
            [
                version.id_version,
                ultimaVersion.id_version
            ]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            estado: 'OK',
            mensaje: `Versión ${siguienteNumero} creada correctamente a partir de la versión ${ultimaVersion.numero_version}.`,
            version,
            version_anterior: {
                id_version: ultimaVersion.id_version,
                numero_version: ultimaVersion.numero_version,
                estado: ultimaVersion.estado
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error('Error al crear versión de cotización:', error);

        return responderError(
            res,
            500,
            'No se pudo crear la versión de cotización.'
        );

    } finally {
        client.release();
    }
};

// ============================================================
// LISTAR VERSIONES DE UNA SOLICITUD
// GET /api/admin/quotes/:id/versions
// ============================================================

const listarVersiones = async (req, res) => {
    const idCotizacion = validarId(req.params.id);

    if (!idCotizacion) {
        return responderError(
            res,
            400,
            'El identificador de la solicitud no es válido.'
        );
    }

    try {
        const resultado = await pool.query(
            `
                SELECT
                    v.*,
                    a.nombre AS administrador_creacion,

                    (
                        SELECT COUNT(*)
                        FROM detalle_cotizacion_versiones d
                        WHERE d.id_version = v.id_version
                    ) AS total_productos,

                    (
                        SELECT COUNT(*)
                        FROM detalle_servicios_versiones s
                        WHERE s.id_version = v.id_version
                    ) AS total_servicios

                FROM cotizaciones_versiones v

                LEFT JOIN administradores a
                    ON a.id_administrador = v.creado_por

                WHERE v.id_cotizacion = $1

                ORDER BY v.numero_version DESC;
            `,
            [idCotizacion]
        );

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Versiones consultadas correctamente.',
            versiones: resultado.rows
        });

    } catch (error) {
        console.error('Error al listar versiones:', error);

        return responderError(
            res,
            500,
            'No se pudieron consultar las versiones.'
        );
    }
};

// ============================================================
// CONSULTAR UNA VERSIÓN
// GET /api/admin/quote-versions/:id
// ============================================================

const obtenerVersionPorId = async (req, res) => {
    const idVersion = validarId(req.params.id);

    if (!idVersion) {
        return responderError(
            res,
            400,
            'El identificador de la versión no es válido.'
        );
    }

    try {
        const version = await pool.query(
            `
                SELECT
                    v.*,
                    a.nombre AS administrador_creacion,
                    c.codigo AS codigo_cotizacion,
                    c.empresa,
                    c.nombre_contacto,
                    c.correo,
                    c.telefono,
                    c.direccion_entrega AS direccion

                FROM cotizaciones_versiones v

                INNER JOIN cotizaciones c
                    ON c.id_cotizacion = v.id_cotizacion

                LEFT JOIN administradores a
                    ON a.id_administrador = v.creado_por

                WHERE v.id_version = $1;
            `,
            [idVersion]
        );

        if (version.rows.length === 0) {
            return responderError(
                res,
                404,
                'No se encontró la versión.'
            );
        }

        const productos = await pool.query(
            `
                SELECT *
                FROM detalle_cotizacion_versiones
                WHERE id_version = $1
                ORDER BY id_detalle_version ASC;
            `,
            [idVersion]
        );

        const servicios = await pool.query(
            `
                SELECT *
                FROM detalle_servicios_versiones
                WHERE id_version = $1
                ORDER BY id_detalle_servicio_version ASC;
            `,
            [idVersion]
        );

        const aprobaciones = await pool.query(
            `
                SELECT
                    ap.id_aprobacion,
                    ap.id_administrador,
                    ap.accion,
                    ap.observaciones,
                    ap.creado_en,
                    a.nombre AS administrador

                FROM aprobaciones_cotizacion ap

                INNER JOIN administradores a
                    ON a.id_administrador = ap.id_administrador

                WHERE ap.id_version = $1
                ORDER BY ap.creado_en DESC, ap.id_aprobacion DESC;
            `,
            [idVersion]
        );

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Versión consultada correctamente.',
            version: version.rows[0],
            productos: productos.rows,
            servicios: servicios.rows,
            aprobaciones: aprobaciones.rows
        });

    } catch (error) {
        console.error('Error al consultar versión:', error);

        return responderError(
            res,
            500,
            'No se pudo obtener el detalle de la versión.'
        );
    }
};

// ============================================================
// ACTUALIZAR UNA VERSIÓN
// PUT /api/admin/quote-versions/:id
// ============================================================

const actualizarVersion = async (req, res) => {
    const idVersion = validarId(req.params.id);
    const rol = obtenerRol(req);

    if (!idVersion) {
        return responderError(
            res,
            400,
            'El identificador de la versión no es válido.'
        );
    }

    if (!ROLES_ARMADO.includes(rol)) {
        return responderError(
            res,
            403,
            'Solo VENTAS o SUPERADMIN pueden modificar los precios de una cotización.'
        );
    }

    const {
        productos,
        servicios,
        condiciones_comerciales,
        observaciones_internas
    } = req.body || {};

    if (productos !== undefined && !Array.isArray(productos)) {
        return responderError(
            res,
            400,
            'El campo productos debe ser una lista.'
        );
    }

    if (servicios !== undefined && !Array.isArray(servicios)) {
        return responderError(
            res,
            400,
            'El campo servicios debe ser una lista.'
        );
    }

    const listaProductos = productos || [];
    const listaServicios = servicios || [];

    const idsProductos = listaProductos.map(
        item => item.id_detalle_version
    );

    const idsServicios = listaServicios.map(
        item => item.id_detalle_servicio_version
    );

    if (
        new Set(idsProductos).size !== idsProductos.length ||
        new Set(idsServicios).size !== idsServicios.length
    ) {
        return responderError(
            res,
            400,
            'No se permiten líneas repetidas en la actualización.'
        );
    }

    for (const item of listaProductos) {
        if (
            !validarId(item.id_detalle_version) ||
            !validarImporte(item.cantidad, false) ||
            !validarImporte(item.precio_unitario)
        ) {
            return responderError(
                res,
                400,
                'Los datos de uno de los productos no son válidos.'
            );
        }

        if (
            item.nombre_producto !== undefined &&
            (
                typeof item.nombre_producto !== 'string' ||
                !item.nombre_producto.trim() ||
                item.nombre_producto.trim().length > 200
            )
        ) {
            return responderError(
                res,
                400,
                'El nombre de un producto no es válido.'
            );
        }

        if (
            item.descripcion !== undefined &&
            item.descripcion !== null &&
            typeof item.descripcion !== 'string'
        ) {
            return responderError(
                res,
                400,
                'La descripción de un producto no es válida.'
            );
        }
    }

    for (const item of listaServicios) {
        if (
            !validarId(item.id_detalle_servicio_version) ||
            !validarImporte(item.cantidad, false) ||
            !validarImporte(item.precio_unitario)
        ) {
            return responderError(
                res,
                400,
                'Los datos de uno de los servicios no son válidos.'
            );
        }

        if (
            item.descripcion !== undefined &&
            item.descripcion !== null &&
            typeof item.descripcion !== 'string'
        ) {
            return responderError(
                res,
                400,
                'La descripción de un servicio no es válida.'
            );
        }
    }

    if (
        condiciones_comerciales !== undefined &&
        condiciones_comerciales !== null &&
        typeof condiciones_comerciales !== 'string'
    ) {
        return responderError(
            res,
            400,
            'Las condiciones comerciales no son válidas.'
        );
    }

    if (
        observaciones_internas !== undefined &&
        observaciones_internas !== null &&
        typeof observaciones_internas !== 'string'
    ) {
        return responderError(
            res,
            400,
            'Las observaciones internas no son válidas.'
        );
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const resultadoVersion = await client.query(
            `
                SELECT *
                FROM cotizaciones_versiones
                WHERE id_version = $1
                FOR UPDATE;
            `,
            [idVersion]
        );

        if (resultadoVersion.rows.length === 0) {
            await client.query('ROLLBACK');

            return responderError(
                res,
                404,
                'No se encontró la versión.'
            );
        }

        const version = resultadoVersion.rows[0];

        if (!ESTADOS_EDITABLES.includes(version.estado)) {
            await client.query('ROLLBACK');

            return responderError(
                res,
                409,
                'Esta versión no puede modificarse porque ya fue enviada a aprobación o tiene un estado final.'
            );
        }

        for (const item of listaProductos) {
            const resultado = await client.query(
                `
                    UPDATE detalle_cotizacion_versiones
                    SET
                        nombre_producto = COALESCE($1, nombre_producto),
                        descripcion = CASE
                            WHEN $2::boolean THEN $3
                            ELSE descripcion
                        END,
                        cantidad = $4,
                        precio_unitario = $5,
                        subtotal_linea = ROUND(
                            $4::numeric * $5::numeric,
                            2
                        )
                    WHERE
                        id_detalle_version = $6
                        AND id_version = $7;
                `,
                [
                    item.nombre_producto === undefined
                        ? null
                        : item.nombre_producto.trim(),
                    item.descripcion !== undefined,
                    item.descripcion ?? null,
                    String(item.cantidad),
                    String(item.precio_unitario),
                    item.id_detalle_version,
                    idVersion
                ]
            );

            if (resultado.rowCount !== 1) {
                throw new Error(
                    `No se encontró el producto ${item.id_detalle_version} en esta versión.`
                );
            }
        }

        for (const item of listaServicios) {
            const resultado = await client.query(
                `
                    UPDATE detalle_servicios_versiones
                    SET
                        descripcion = CASE
                            WHEN $1::boolean THEN $2
                            ELSE descripcion
                        END,
                        cantidad = $3,
                        precio_unitario = $4,
                        subtotal_linea = ROUND(
                            $3::numeric * $4::numeric,
                            2
                        )
                    WHERE
                        id_detalle_servicio_version = $5
                        AND id_version = $6;
                `,
                [
                    item.descripcion !== undefined,
                    item.descripcion ?? null,
                    String(item.cantidad),
                    String(item.precio_unitario),
                    item.id_detalle_servicio_version,
                    idVersion
                ]
            );

            if (resultado.rowCount !== 1) {
                throw new Error(
                    `No se encontró el servicio ${item.id_detalle_servicio_version} en esta versión.`
                );
            }
        }

        await client.query(
            `
                UPDATE cotizaciones_versiones
                SET
                    condiciones_comerciales = CASE
                        WHEN $1::boolean THEN $2
                        ELSE condiciones_comerciales
                    END,

                    observaciones_internas = CASE
                        WHEN $3::boolean THEN $4
                        ELSE observaciones_internas
                    END,

                    actualizado_en = CURRENT_TIMESTAMP

                WHERE id_version = $5;
            `,
            [
                condiciones_comerciales !== undefined,
                condiciones_comerciales ?? null,
                observaciones_internas !== undefined,
                observaciones_internas ?? null,
                idVersion
            ]
        );

        const importes = await recalcularImportes(
            client,
            idVersion
        );

        const versionActualizada = await client.query(
            `
                SELECT *
                FROM cotizaciones_versiones
                WHERE id_version = $1;
            `,
            [idVersion]
        );

        await client.query('COMMIT');

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Versión actualizada correctamente.',
            version: versionActualizada.rows[0],
            importes
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error('Error al actualizar versión:', error);

        return responderError(
            res,
            400,
            error.message || 'No se pudo actualizar la versión.'
        );

    } finally {
        client.release();
    }
};

// ============================================================
// ENVIAR VERSIÓN A APROBACIÓN
// POST /api/admin/quote-versions/:id/enviar-aprobacion
// ============================================================

const enviarAprobacion = async (req, res) => {
    const idVersion = validarId(req.params.id);

    if (!idVersion) {
        return responderError(
            res,
            400,
            'El identificador de la versión no es válido.'
        );
    }

    if (!ROLES_ARMADO.includes(obtenerRol(req))) {
        return responderError(
            res,
            403,
            'Solo VENTAS o SUPERADMIN pueden enviar cotizaciones a aprobación.'
        );
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const resultado = await client.query(
            `
                SELECT *
                FROM cotizaciones_versiones
                WHERE id_version = $1
                FOR UPDATE;
            `,
            [idVersion]
        );

        if (resultado.rows.length === 0) {
            await client.query('ROLLBACK');

            return responderError(
                res,
                404,
                'No se encontró la versión.'
            );
        }

        const version = resultado.rows[0];

        if (!ESTADOS_EDITABLES.includes(version.estado)) {
            await client.query('ROLLBACK');

            return responderError(
                res,
                409,
                'La versión no se encuentra disponible para enviar a aprobación.'
            );
        }

        const cantidades = await client.query(
            `
                SELECT
                    (
                        SELECT COUNT(*)
                        FROM detalle_cotizacion_versiones
                        WHERE id_version = $1
                    ) AS productos,

                    (
                        SELECT COUNT(*)
                        FROM detalle_servicios_versiones
                        WHERE id_version = $1
                    ) AS servicios;
            `,
            [idVersion]
        );

        const totalLineas =
            Number(cantidades.rows[0].productos) +
            Number(cantidades.rows[0].servicios);

        if (totalLineas === 0) {
            await client.query('ROLLBACK');

            return responderError(
                res,
                400,
                'No se puede enviar una cotización sin productos ni servicios.'
            );
        }

        const sinPrecio = await client.query(
            `
                SELECT
                    (
                        SELECT COUNT(*)
                        FROM detalle_cotizacion_versiones
                        WHERE id_version = $1
                          AND COALESCE(precio_unitario, 0) <= 0
                    )
                    +
                    (
                        SELECT COUNT(*)
                        FROM detalle_servicios_versiones
                        WHERE id_version = $1
                          AND COALESCE(precio_unitario, 0) <= 0
                    ) AS total;
            `,
            [idVersion]
        );

        if (Number(sinPrecio.rows[0].total) > 0) {
            await client.query('ROLLBACK');

            return responderError(
                res,
                400,
                'Todos los productos y servicios deben tener un precio mayor que cero antes de enviar la cotización a aprobación.'
            );
        }

        await recalcularImportes(client, idVersion);

        const actualizacion = await client.query(
            `
                UPDATE cotizaciones_versiones
                SET
                    estado = 'PENDIENTE_APROBACION',
                    actualizado_en = CURRENT_TIMESTAMP
                WHERE id_version = $1
                RETURNING *;
            `,
            [idVersion]
        );

        // La solicitud pasa a EN_ATENCION si todavía estaba PENDIENTE.
        await sincronizarEstadoSolicitud(
            client,
            actualizacion.rows[0].id_cotizacion,
            obtenerIdAdministrador(req),
            'EN_ATENCION',
            ['PENDIENTE'],
            'La cotización fue enviada a GERENCIA para su aprobación.'
        );

        await client.query('COMMIT');

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'La cotización fue enviada a GERENCIA para su aprobación.',
            version: actualizacion.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error('Error al enviar versión a aprobación:', error);

        return responderError(
            res,
            500,
            'No se pudo enviar la versión a aprobación.'
        );

    } finally {
        client.release();
    }
};

// ============================================================
// APROBAR O DEVOLVER UNA VERSIÓN
// PATCH /api/admin/quote-versions/:id/aprobacion
// ============================================================

const resolverAprobacion = async (req, res) => {
    const idVersion = validarId(req.params.id);
    const rol = obtenerRol(req);
    const idAdministrador = obtenerIdAdministrador(req);

    if (!idVersion) {
        return responderError(
            res,
            400,
            'El identificador de la versión no es válido.'
        );
    }

    if (!ROLES_APROBACION.includes(rol)) {
        return responderError(
            res,
            403,
            'Solo GERENCIA o SUPERADMIN pueden aprobar o devolver cotizaciones.'
        );
    }

    if (!idAdministrador) {
        return responderError(
            res,
            401,
            'No se pudo identificar al administrador.'
        );
    }

    const { accion, observaciones } = req.body || {};

    if (!['APROBADA', 'DEVUELTA'].includes(accion)) {
        return responderError(
            res,
            400,
            'La acción debe ser APROBADA o DEVUELTA.'
        );
    }

    if (
        observaciones !== undefined &&
        observaciones !== null &&
        typeof observaciones !== 'string'
    ) {
        return responderError(
            res,
            400,
            'Las observaciones no son válidas.'
        );
    }

    if (
        accion === 'DEVUELTA' &&
        !String(observaciones || '').trim()
    ) {
        return responderError(
            res,
            400,
            'Debes indicar el motivo de la devolución.'
        );
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const resultado = await client.query(
            `
                SELECT *
                FROM cotizaciones_versiones
                WHERE id_version = $1
                FOR UPDATE;
            `,
            [idVersion]
        );

        if (resultado.rows.length === 0) {
            await client.query('ROLLBACK');

            return responderError(
                res,
                404,
                'No se encontró la versión.'
            );
        }

        const version = resultado.rows[0];

        if (version.estado !== 'PENDIENTE_APROBACION') {
            await client.query('ROLLBACK');

            return responderError(
                res,
                409,
                'Solo se pueden aprobar o devolver versiones pendientes de aprobación.'
            );
        }

        const aprobacion = await client.query(
            `
                INSERT INTO aprobaciones_cotizacion (
                    id_version,
                    id_administrador,
                    accion,
                    observaciones
                )
                VALUES ($1, $2, $3, $4)
                RETURNING *;
            `,
            [
                idVersion,
                idAdministrador,
                accion,
                observaciones?.trim() || null
            ]
        );

        const actualizacion = await client.query(
            `
                UPDATE cotizaciones_versiones
                SET
                    estado = $1,
                    actualizado_en = CURRENT_TIMESTAMP
                WHERE id_version = $2
                RETURNING *;
            `,
            [accion, idVersion]
        );

        await client.query('COMMIT');

        return res.status(200).json({
            estado: 'OK',
            mensaje: accion === 'APROBADA'
                ? 'La cotización fue aprobada correctamente.'
                : 'La cotización fue devuelta para su corrección.',
            version: actualizacion.rows[0],
            aprobacion: aprobacion.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error('Error al resolver aprobación:', error);

        return responderError(
            res,
            500,
            'No se pudo registrar la decisión de aprobación.'
        );

    } finally {
        client.release();
    }
};

// ============================================================
// ENVIAR COTIZACIÓN APROBADA AL CLIENTE
// POST /api/admin/quote-versions/:id/enviar-cliente
//
// Solo GERENCIA y SUPERADMIN.
// El correo se obtiene de la solicitud original.
// El PDF corresponde a la versión aprobada.
// ============================================================

const enviarCotizacionAlCliente = async (req, res) => {
    const idVersion = validarId(req.params.id);
    const idAdministrador = obtenerIdAdministrador(req);
    const rol = obtenerRol(req);

    if (!idVersion) {
        return responderError(
            res,
            400,
            'El identificador de la versión no es válido.'
        );
    }

    if (!ROLES_APROBACION.includes(rol)) {
        return responderError(
            res,
            403,
            'Solo GERENCIA o SUPERADMIN pueden enviar cotizaciones al cliente.'
        );
    }

    if (!idAdministrador) {
        return responderError(
            res,
            401,
            'No se pudo identificar al administrador que realiza el envío.'
        );
    }

    try {
        const resultado = await pool.query(
            `
                SELECT
                    v.id_version,
                    v.id_cotizacion,
                    v.numero_version,
                    v.estado,
                    v.total,
                    c.codigo,
                    c.nombre_contacto,
                    c.empresa,
                    c.correo

                FROM cotizaciones_versiones v

                INNER JOIN cotizaciones c
                    ON c.id_cotizacion = v.id_cotizacion

                WHERE v.id_version = $1
                LIMIT 1;
            `,
            [idVersion]
        );

        if (resultado.rows.length === 0) {
            return responderError(
                res,
                404,
                'No se encontró la versión de cotización.'
            );
        }

        const version = resultado.rows[0];

        if (version.estado !== 'APROBADA') {
            return res.status(409).json({
                estado: 'ERROR',
                mensaje:
                    'Solo se pueden enviar al cliente cotizaciones que hayan sido aprobadas por GERENCIA.',
                estado_actual: version.estado
            });
        }

        const destinatario = String(version.correo || '').trim();

        const patronCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!patronCorreo.test(destinatario)) {
            return responderError(
                res,
                400,
                'La solicitud no tiene una dirección de correo válida para el cliente.'
            );
        }

        // Generar o recuperar el PDF de esta versión.

        const pdf = await generarPDFCotizacion(idVersion);

        if (!pdf || !pdf.ruta) {
            throw new Error(
                'No se pudo generar o recuperar el PDF de la cotización.'
            );
        }

        const numeroVersion = Number(version.numero_version);

        const asunto =
            `Cotización ${version.codigo} - Versión ${numeroVersion} | TUSA WOOD`;

        const nombreCliente =
            version.nombre_contacto ||
            version.empresa ||
            'Estimado cliente';

        const texto = [
            `Estimado/a ${nombreCliente}:`,
            '',
            'Es un gusto saludarte.',
            '',
            'Adjuntamos nuestra propuesta comercial correspondiente a tu solicitud.',
            '',
            `Código de cotización: ${version.codigo}`,
            `Versión: ${numeroVersion}`,
            `Importe total: S/ ${Number(version.total).toFixed(2)}`,
            '',
            'En el documento PDF encontrarás el detalle de los productos, servicios, importes y condiciones comerciales de nuestra propuesta.',
            '',
            'Si tienes alguna consulta o deseas realizar alguna coordinación, estaremos encantados de atenderte.',
            '',
            'Gracias por considerar a TUSA WOOD.',
            '',
            'Atentamente,',
            'Equipo comercial',
            'TUSA WOOD'
        ].join('\n');

        const resultadoEnvio = await enviarCorreo({
            id_cotizacion: version.id_cotizacion,
            id_version: version.id_version,
            id_administrador: idAdministrador,
            destinatario,
            asunto,
            texto
        });

        if (resultadoEnvio.estado === 'ENVIADO') {
            try {
                await sincronizarEstadoSolicitud(
                    pool,
                    version.id_cotizacion,
                    idAdministrador,
                    'COTIZADA',
                    ['PENDIENTE', 'EN_ATENCION'],
                    `Cotización versión ${numeroVersion} enviada al cliente.`
                );
            } catch (errorEstado) {
                console.error(
                    'No se pudo actualizar el estado de la solicitud:',
                    errorEstado.message
                );
            }

            return res.status(200).json({
                estado: 'OK',
                mensaje: 'La cotización fue enviada correctamente al cliente.',
                cotizacion: {
                    id_cotizacion: version.id_cotizacion,
                    codigo: version.codigo,
                    id_version: version.id_version,
                    numero_version: numeroVersion,
                    estado: 'ENVIADA',
                    destinatario
                },
                notificacion: {
                    id_notificacion: resultadoEnvio.id_notificacion,
                    estado: 'ENVIADO'
                }
            });
        }

        if (
            resultadoEnvio.estado === 'PENDIENTE_REINTENTO' ||
            resultadoEnvio.estado === 'CORREO_DESACTIVADO'
        ) {
            return res.status(202).json({
                estado: 'PENDIENTE',
                mensaje:
                    resultadoEnvio.estado === 'CORREO_DESACTIVADO'
                        ? 'El envío de correos está desactivado. La notificación quedó pendiente.'
                        : 'No se pudo enviar el correo en este intento. Se programó un reintento automático.',
                cotizacion: {
                    id_cotizacion: version.id_cotizacion,
                    codigo: version.codigo,
                    id_version: version.id_version,
                    numero_version: numeroVersion,
                    estado: 'APROBADA'
                },
                notificacion: {
                    id_notificacion: resultadoEnvio.id_notificacion,
                    estado: resultadoEnvio.estado
                }
            });
        }

        if (resultadoEnvio.estado === 'ERROR_ENVIO') {
            return res.status(502).json({
                estado: 'ERROR',
                mensaje:
                    'Se agotaron los intentos automáticos de envío. La cotización continúa aprobada y requiere revisión.',
                id_notificacion: resultadoEnvio.id_notificacion
            });
        }

        if (
            resultadoEnvio.estado === 'ENVIADO_PENDIENTE_REGISTRO'
        ) {
            return res.status(500).json({
                estado: 'REVISION_REQUERIDA',
                mensaje:
                    'El servidor de correo aceptó el mensaje, pero no se pudo confirmar el registro del envío en el sistema. Requiere revisión manual. No vuelvas a enviarlo todavía.',
                id_notificacion: resultadoEnvio.id_notificacion
            });
        }

        return res.status(500).json({
            estado: 'ERROR',
            mensaje:
                resultadoEnvio.mensaje ||
                'No se pudo procesar el envío de la cotización.',
            id_notificacion: resultadoEnvio.id_notificacion || null
        });

    } catch (error) {
        console.error(
            'Error al enviar cotización al cliente:',
            error
        );

        return responderError(
            res,
            500,
            error.message ||
                'No se pudo preparar el envío de la cotización.'
        );
    }
};

// ============================================================
// EXPORTAR CONTROLADORES
// ============================================================

module.exports = {
    crearPrimeraVersion,
    listarVersiones,
    obtenerVersionPorId,
    actualizarVersion,
    enviarAprobacion,
    resolverAprobacion,
    enviarCotizacionAlCliente
};