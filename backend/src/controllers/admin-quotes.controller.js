const pool = require('../config/database');
const { enviarCorreo } = require('../services/email.service');

// ============================================================
// CONFIGURACIÓN GENERAL
// ============================================================

const ESTADOS_VALIDOS = [
    'PENDIENTE',
    'EN_ATENCION',
    'COTIZADA',
    'ACEPTADA',
    'RECHAZADA',
    'CERRADA'
];

const ESTADOS_VERSION_VALIDOS = [
    'BORRADOR',
    'PENDIENTE_APROBACION',
    'DEVUELTA',
    'APROBADA',
    'ENVIADA'
];

const ROLES = {
    SUPERADMIN: 'SUPERADMIN',
    GERENCIA: 'GERENCIA',
    VENTAS: 'VENTAS'
};

const ESTADOS_PERMITIDOS_VENTAS = [
    'EN_ATENCION'
];

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

function validarId(id) {
    return /^\d+$/.test(String(id)) &&
        Number.isSafeInteger(Number(id)) &&
        Number(id) > 0;
}

function obtenerRolAdministrador(req) {
    return String(req.administrador?.rol || '')
        .trim()
        .toUpperCase();
}

function escaparHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function respuestaError(res, codigo, mensaje, adicionales = {}) {
    return res.status(codigo).json({
        estado: 'ERROR',
        mensaje,
        ...adicionales
    });
}

// ============================================================
// LISTAR COTIZACIONES
// GET /api/admin/quotes
// ============================================================

async function listarCotizaciones(req, res) {
    try {
        const {
            estado,
            buscar,
            pagina = '1',
            limite = '10'
        } = req.query;

        const numeroPagina = Number(pagina);
        const cantidad = Number(limite);

        if (
            !Number.isInteger(numeroPagina) ||
            numeroPagina < 1 ||
            !Number.isInteger(cantidad) ||
            cantidad < 1 ||
            cantidad > 100
        ) {
            return respuestaError(
                res,
                400,
                'La página o el límite no son válidos.'
            );
        }

        if (
            estado !== undefined &&
            (
                typeof estado !== 'string' ||
                !ESTADOS_VALIDOS.includes(
                    estado.trim().toUpperCase()
                )
            )
        ) {
            return respuestaError(
                res,
                400,
                'El estado solicitado no es válido.',
                { estados_validos: ESTADOS_VALIDOS }
            );
        }

        if (
            buscar !== undefined &&
            typeof buscar !== 'string'
        ) {
            return respuestaError(
                res,
                400,
                'El parámetro de búsqueda debe ser texto.'
            );
        }

        const condiciones = [];
        const parametros = [];

        if (estado !== undefined && estado.trim()) {
            parametros.push(estado.trim().toUpperCase());

            condiciones.push(
                `c.estado = $${parametros.length}`
            );
        }

        const terminoBusqueda = buscar?.trim();

        if (terminoBusqueda) {
            parametros.push(`%${terminoBusqueda}%`);

            const posicion = parametros.length;

            condiciones.push(`(
                c.codigo ILIKE $${posicion}
                OR c.nombre_contacto ILIKE $${posicion}
                OR c.empresa ILIKE $${posicion}
                OR c.correo ILIKE $${posicion}
                OR c.telefono ILIKE $${posicion}
            )`);
        }

        const where = condiciones.length
            ? `WHERE ${condiciones.join(' AND ')}`
            : '';

        const resultadoTotal = await pool.query(
            `SELECT COUNT(*)::INTEGER AS total
             FROM cotizaciones c
             ${where}`,
            parametros
        );

        const total = Number(resultadoTotal.rows[0].total);
        const offset = (numeroPagina - 1) * cantidad;

        const parametrosLista = [
            ...parametros,
            cantidad,
            offset
        ];

        const resultado = await pool.query(
            `SELECT
                c.id_cotizacion,
                c.codigo,
                c.nombre_contacto,
                c.empresa,
                c.correo,
                c.telefono,
                c.direccion_entrega,
                c.mensaje,
                c.estado,
                c.notas_internas,
                c.origen,
                c.creado_en,
                c.actualizado_en,

                COALESCE(dp.total_productos, 0)::INTEGER
                    AS total_productos,

                COALESCE(dp.total_unidades, 0)::NUMERIC
                    AS total_unidades,

                COALESCE(ds.total_servicios, 0)::INTEGER
                    AS total_servicios,

                (
                    COALESCE(dp.total_productos, 0) +
                    COALESCE(ds.total_servicios, 0)
                )::INTEGER AS total_items,

                uv.id_version AS id_version_actual,
                uv.numero_version AS numero_version_actual,
                uv.estado AS estado_version,
                uv.total AS total_version

             FROM cotizaciones c

             LEFT JOIN (
                SELECT
                    id_cotizacion,
                    COUNT(*) AS total_productos,
                    COALESCE(SUM(cantidad), 0) AS total_unidades
                FROM detalle_cotizacion
                GROUP BY id_cotizacion
             ) dp
                ON dp.id_cotizacion = c.id_cotizacion

             LEFT JOIN (
                SELECT
                    id_cotizacion,
                    COUNT(*) AS total_servicios
                FROM detalle_servicios_cotizacion
                GROUP BY id_cotizacion
             ) ds
                ON ds.id_cotizacion = c.id_cotizacion

             LEFT JOIN LATERAL (
                SELECT
                    v.id_version,
                    v.numero_version,
                    v.estado,
                    v.total
                FROM cotizaciones_versiones v
                WHERE v.id_cotizacion = c.id_cotizacion
                ORDER BY v.numero_version DESC
                LIMIT 1
             ) uv ON TRUE

             ${where}

             ORDER BY
                c.creado_en DESC,
                c.id_cotizacion DESC

             LIMIT $${parametrosLista.length - 1}
             OFFSET $${parametrosLista.length}`,
            parametrosLista
        );

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Cotizaciones obtenidas correctamente.',
            total,
            cotizaciones: resultado.rows,
            paginacion: {
                pagina: numeroPagina,
                limite: cantidad,
                total,
                total_paginas: Math.ceil(total / cantidad)
            }
        });

    } catch (error) {
        console.error(
            'Error al listar cotizaciones:',
            error.message
        );

        return respuestaError(
            res,
            500,
            'No se pudieron consultar las cotizaciones.'
        );
    }
}

// ============================================================
// SUPERVISIÓN COMERCIAL
// GET /api/admin/quotes/supervision
//
// Exclusivo para SUPERADMIN y GERENCIA.
//
// El resumen es global.
// Los filtros solo afectan al listado paginado.
// No modifica registros ni envía correos.
// ============================================================

async function obtenerSupervisionComercial(req, res) {
    try {
        const {
            estado_solicitud,
            estado_version,
            buscar,
            pagina = '1',
            limite = '20'
        } = req.query;

        const numeroPagina = Number(pagina);
        const cantidad = Number(limite);

        // ----------------------------------------------------
        // Validar paginación
        // ----------------------------------------------------

        if (
            !Number.isInteger(numeroPagina) ||
            numeroPagina < 1 ||
            !Number.isInteger(cantidad) ||
            cantidad < 1 ||
            cantidad > 100
        ) {
            return respuestaError(
                res,
                400,
                'La página o el límite no son válidos.'
            );
        }

        // ----------------------------------------------------
        // Validar estado de solicitud
        // ----------------------------------------------------

        if (
            estado_solicitud !== undefined &&
            (
                typeof estado_solicitud !== 'string' ||
                !ESTADOS_VALIDOS.includes(
                    estado_solicitud.trim().toUpperCase()
                )
            )
        ) {
            return respuestaError(
                res,
                400,
                'El estado de solicitud no es válido.',
                {
                    estados_validos: ESTADOS_VALIDOS
                }
            );
        }

        // ----------------------------------------------------
        // Validar estado de versión
        // ----------------------------------------------------

        if (
            estado_version !== undefined &&
            (
                typeof estado_version !== 'string' ||
                !ESTADOS_VERSION_VALIDOS.includes(
                    estado_version.trim().toUpperCase()
                )
            )
        ) {
            return respuestaError(
                res,
                400,
                'El estado de versión no es válido.',
                {
                    estados_validos: ESTADOS_VERSION_VALIDOS
                }
            );
        }

        // ----------------------------------------------------
        // Validar búsqueda
        // ----------------------------------------------------

        if (
            buscar !== undefined &&
            typeof buscar !== 'string'
        ) {
            return respuestaError(
                res,
                400,
                'El parámetro de búsqueda debe ser texto.'
            );
        }

        const terminoBusqueda = buscar?.trim() || '';

        if (terminoBusqueda.length > 200) {
            return respuestaError(
                res,
                400,
                'El texto de búsqueda supera los 200 caracteres.'
            );
        }

        // ----------------------------------------------------
        // RESUMEN GLOBAL
        //
        // Se utiliza la última versión de cada solicitud.
        // No se cuentan versiones históricas anteriores.
        // ----------------------------------------------------

        const resultadoResumen = await pool.query(
            `SELECT
                COUNT(*)::INTEGER AS total_solicitudes,

                COUNT(*) FILTER (
                    WHERE c.estado = 'PENDIENTE'
                )::INTEGER AS solicitudes_pendientes,

                COUNT(*) FILTER (
                    WHERE c.estado = 'EN_ATENCION'
                )::INTEGER AS solicitudes_en_atencion,

                COUNT(*) FILTER (
                    WHERE ultima.estado = 'PENDIENTE_APROBACION'
                )::INTEGER AS versiones_pendientes_aprobacion,

                COUNT(*) FILTER (
                    WHERE ultima.estado = 'DEVUELTA'
                )::INTEGER AS versiones_devuelta,

                COUNT(*) FILTER (
                    WHERE ultima.estado = 'APROBADA'
                )::INTEGER AS versiones_aprobadas,

                COUNT(*) FILTER (
                    WHERE ultima.estado = 'ENVIADA'
                )::INTEGER AS versiones_enviadas

             FROM cotizaciones c

             LEFT JOIN LATERAL (
                SELECT
                    v.id_version,
                    v.numero_version,
                    v.estado
                FROM cotizaciones_versiones v
                WHERE v.id_cotizacion = c.id_cotizacion
                ORDER BY
                    v.numero_version DESC,
                    v.id_version DESC
                LIMIT 1
             ) ultima ON TRUE`
        );

        const resumen = resultadoResumen.rows[0];

        // ----------------------------------------------------
        // FILTROS DEL LISTADO
        // ----------------------------------------------------

        const condiciones = [];
        const parametros = [];

        if (
            estado_solicitud !== undefined &&
            estado_solicitud.trim()
        ) {
            parametros.push(
                estado_solicitud.trim().toUpperCase()
            );

            condiciones.push(
                `c.estado = $${parametros.length}`
            );
        }

        if (
            estado_version !== undefined &&
            estado_version.trim()
        ) {
            parametros.push(
                estado_version.trim().toUpperCase()
            );

            condiciones.push(
                `ultima.estado = $${parametros.length}`
            );
        }

        if (terminoBusqueda) {
            parametros.push(`%${terminoBusqueda}%`);

            const posicion = parametros.length;

            condiciones.push(`(
                c.codigo ILIKE $${posicion}
                OR c.nombre_contacto ILIKE $${posicion}
                OR c.empresa ILIKE $${posicion}
                OR c.correo ILIKE $${posicion}
                OR c.telefono ILIKE $${posicion}
            )`);
        }

        const where = condiciones.length
            ? `WHERE ${condiciones.join(' AND ')}`
            : '';

        // ----------------------------------------------------
        // TOTAL DEL LISTADO FILTRADO
        // ----------------------------------------------------

        const resultadoTotal = await pool.query(
            `SELECT COUNT(*)::INTEGER AS total
             FROM cotizaciones c

             LEFT JOIN LATERAL (
                SELECT
                    v.id_version,
                    v.numero_version,
                    v.estado
                FROM cotizaciones_versiones v
                WHERE v.id_cotizacion = c.id_cotizacion
                ORDER BY
                    v.numero_version DESC,
                    v.id_version DESC
                LIMIT 1
             ) ultima ON TRUE

             ${where}`,
            parametros
        );

        const total = Number(resultadoTotal.rows[0].total);
        const offset = (numeroPagina - 1) * cantidad;

        const parametrosLista = [
            ...parametros,
            cantidad,
            offset
        ];

        // ----------------------------------------------------
        // LISTADO CONSOLIDADO
        // ----------------------------------------------------

        const resultadoSolicitudes = await pool.query(
            `SELECT
                c.id_cotizacion,
                c.codigo,
                c.nombre_contacto,
                c.empresa,
                c.correo,
                c.telefono,
                c.estado AS estado_solicitud,
                c.origen,
                c.creado_en AS solicitud_creada_en,
                c.actualizado_en AS solicitud_actualizada_en,

                -- Última versión
                ultima.id_version,
                ultima.numero_version,
                ultima.estado AS estado_version,
                ultima.modo_igv,
                ultima.tasa_igv,
                ultima.subtotal,
                ultima.importe_igv,
                ultima.total,
                ultima.creado_en AS version_creada_en,
                ultima.actualizado_en AS version_actualizada_en,

                -- Responsable de preparación
                ultima.creado_por AS id_responsable,
                responsable.nombre AS responsable_nombre,
                responsable.correo AS responsable_correo,
                responsable.rol AS responsable_rol,

                -- Última aprobación de la versión
                aprobacion.id_aprobacion,
                aprobacion.accion AS ultima_accion_aprobacion,
                aprobacion.observaciones AS observaciones_aprobacion,
                aprobacion.creado_en AS aprobacion_creada_en,
                aprobacion.id_administrador AS id_aprobador,
                aprobador.nombre AS aprobador_nombre,
                aprobador.rol AS aprobador_rol,

                -- Última notificación de la versión
                notificacion.id_notificacion,
                notificacion.estado AS estado_notificacion,
                notificacion.destinatario AS correo_destino,
                notificacion.intentos AS intentos_notificacion,
                notificacion.error_detalle AS error_notificacion,
                notificacion.enviado_en AS correo_enviado_en,
                notificacion.creado_en AS notificacion_creada_en,
                notificacion.proximo_intento_en,
                notificacion.ultimo_intento_en

             FROM cotizaciones c

             -- Obtener la última versión de cada solicitud
             LEFT JOIN LATERAL (
                SELECT
                    v.id_version,
                    v.id_cotizacion,
                    v.numero_version,
                    v.estado,
                    v.modo_igv,
                    v.tasa_igv,
                    v.subtotal,
                    v.importe_igv,
                    v.total,
                    v.creado_por,
                    v.creado_en,
                    v.actualizado_en
                FROM cotizaciones_versiones v
                WHERE v.id_cotizacion = c.id_cotizacion
                ORDER BY
                    v.numero_version DESC,
                    v.id_version DESC
                LIMIT 1
             ) ultima ON TRUE

             -- Administrador que preparó la última versión
             LEFT JOIN administradores responsable
                ON responsable.id_administrador = ultima.creado_por

             -- Última aprobación asociada a esa versión
             LEFT JOIN LATERAL (
                SELECT
                    ap.id_aprobacion,
                    ap.id_administrador,
                    ap.accion,
                    ap.observaciones,
                    ap.creado_en
                FROM aprobaciones_cotizacion ap
                WHERE ap.id_version = ultima.id_version
                ORDER BY
                    ap.creado_en DESC,
                    ap.id_aprobacion DESC
                LIMIT 1
             ) aprobacion ON TRUE

             LEFT JOIN administradores aprobador
                ON aprobador.id_administrador = aprobacion.id_administrador

             -- Última notificación relacionada con la versión
             LEFT JOIN LATERAL (
                SELECT
                    n.id_notificacion,
                    n.estado,
                    n.destinatario,
                    n.intentos,
                    n.error_detalle,
                    n.enviado_en,
                    n.creado_en,
                    n.proximo_intento_en,
                    n.ultimo_intento_en
                FROM notificaciones_email n
                WHERE
                    n.id_cotizacion = c.id_cotizacion
                    AND (
                        n.id_version = ultima.id_version
                        OR (
                            ultima.id_version IS NULL
                            AND n.id_version IS NULL
                        )
                    )
                ORDER BY
                    n.creado_en DESC,
                    n.id_notificacion DESC
                LIMIT 1
             ) notificacion ON TRUE

             ${where}

             ORDER BY
                c.creado_en DESC,
                c.id_cotizacion DESC

             LIMIT $${parametrosLista.length - 1}
             OFFSET $${parametrosLista.length}`,
            parametrosLista
        );

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Supervisión comercial obtenida correctamente.',

            resumen: {
                total_solicitudes: Number(
                    resumen.total_solicitudes
                ),

                solicitudes_pendientes: Number(
                    resumen.solicitudes_pendientes
                ),

                solicitudes_en_atencion: Number(
                    resumen.solicitudes_en_atencion
                ),

                versiones_pendientes_aprobacion: Number(
                    resumen.versiones_pendientes_aprobacion
                ),

                versiones_devuelta: Number(
                    resumen.versiones_devuelta
                ),

                versiones_aprobadas: Number(
                    resumen.versiones_aprobadas
                ),

                versiones_enviadas: Number(
                    resumen.versiones_enviadas
                )
            },

            solicitudes: resultadoSolicitudes.rows,

            paginacion: {
                pagina: numeroPagina,
                limite: cantidad,
                total,
                total_paginas: Math.ceil(total / cantidad)
            }
        });

    } catch (error) {
        console.error(
            'Error al obtener supervisión comercial:',
            error.message
        );

        return respuestaError(
            res,
            500,
            'No se pudo obtener la supervisión comercial.'
        );
    }
}

// ============================================================
// OBTENER COTIZACIÓN POR ID
// GET /api/admin/quotes/:id
// ============================================================

async function obtenerCotizacionPorId(req, res) {
    const { id } = req.params;

    if (!validarId(id)) {
        return respuestaError(
            res,
            400,
            'El identificador de cotización no es válido.'
        );
    }

    try {
        const idCotizacion = Number(id);

        const resultadoCotizacion = await pool.query(
            `SELECT
                c.id_cotizacion,
                c.codigo,
                c.nombre_contacto,
                c.empresa,
                c.correo,
                c.telefono,
                c.direccion_entrega,
                c.mensaje,
                c.estado,
                c.notas_internas,
                c.origen,
                c.creado_en,
                c.actualizado_en
             FROM cotizaciones c
             WHERE c.id_cotizacion = $1`,
            [idCotizacion]
        );

        if (resultadoCotizacion.rows.length === 0) {
            return respuestaError(
                res,
                404,
                'No se encontró la cotización.'
            );
        }

        const [
            resultadoProductos,
            resultadoServicios,
            resultadoHistorial,
            resultadoResumen
        ] = await Promise.all([

            pool.query(
                `SELECT
                    id_detalle,
                    id_cotizacion,
                    id_producto,
                    nombre_producto,
                    cantidad,
                    especificaciones,
                    creado_en
                 FROM detalle_cotizacion
                 WHERE id_cotizacion = $1
                 ORDER BY id_detalle ASC`,
                [idCotizacion]
            ),

            pool.query(
                `SELECT
                    id_detalle_servicio,
                    id_cotizacion,
                    id_servicio,
                    nombre_servicio,
                    observaciones,
                    creado_en
                 FROM detalle_servicios_cotizacion
                 WHERE id_cotizacion = $1
                 ORDER BY id_detalle_servicio ASC`,
                [idCotizacion]
            ),

            pool.query(
                `SELECT
                    h.id_historial,
                    h.id_cotizacion,
                    h.id_administrador,
                    COALESCE(
                        a.nombre,
                        'Registro del sistema'
                    ) AS administrador,
                    a.correo AS correo_administrador,
                    a.rol AS rol_administrador,
                    h.estado_anterior,
                    h.estado_nuevo,
                    h.comentario,
                    h.creado_en
                 FROM historial_cotizaciones h
                 LEFT JOIN administradores a
                    ON a.id_administrador = h.id_administrador
                 WHERE h.id_cotizacion = $1
                 ORDER BY
                    h.creado_en DESC,
                    h.id_historial DESC`,
                [idCotizacion]
            ),

            pool.query(
                `SELECT
                    (
                        SELECT COUNT(*)::INTEGER
                        FROM detalle_cotizacion
                        WHERE id_cotizacion = $1
                    ) AS total_productos,

                    (
                        SELECT COALESCE(SUM(cantidad), 0)
                        FROM detalle_cotizacion
                        WHERE id_cotizacion = $1
                    ) AS total_unidades,

                    (
                        SELECT COUNT(*)::INTEGER
                        FROM detalle_servicios_cotizacion
                        WHERE id_cotizacion = $1
                    ) AS total_servicios`,
                [idCotizacion]
            )
        ]);

        const totalProductos = Number(
            resultadoResumen.rows[0].total_productos
        );

        const totalServicios = Number(
            resultadoResumen.rows[0].total_servicios
        );

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Detalle de cotización obtenido correctamente.',

            cotizacion: resultadoCotizacion.rows[0],

            resumen: {
                total_productos: totalProductos,
                total_unidades: Number(
                    resultadoResumen.rows[0].total_unidades
                ),
                total_servicios: totalServicios,
                total_items: totalProductos + totalServicios
            },

            productos: resultadoProductos.rows,
            servicios: resultadoServicios.rows,
            historial: resultadoHistorial.rows
        });

    } catch (error) {
        console.error(
            'Error al obtener cotización:',
            error.message
        );

        return respuestaError(
            res,
            500,
            'No se pudo consultar el detalle de la cotización.'
        );
    }
}

// ============================================================
// PREPARAR CORREO DE CAMBIO DE ESTADO
// ============================================================

function crearCorreoCambioEstado(
    cotizacion,
    estadoAnterior,
    estadoNuevo,
    comentario
) {
    const mensajes = {
        EN_ATENCION: {
            titulo: 'Estamos revisando tu solicitud',
            descripcion:
                'Nuestro equipo está revisando los detalles de tu solicitud.'
        },

        ACEPTADA: {
            titulo: 'Cotización aceptada',
            descripcion:
                'Tu cotización ha sido marcada como aceptada. Nuestro equipo podrá coordinar los siguientes pasos contigo.'
        },

        RECHAZADA: {
            titulo: 'Actualización de tu solicitud',
            descripcion:
                'El estado de tu solicitud de cotización ha cambiado a rechazada. Si necesitas más información, puedes comunicarte con nuestro equipo.'
        },

        CERRADA: {
            titulo: 'Solicitud cerrada',
            descripcion:
                'Tu solicitud de cotización ha sido marcada como cerrada.'
        }
    };

    const informacion = mensajes[estadoNuevo];

    if (!informacion) {
        throw new Error(
            `No existe una plantilla de correo para el estado ${estadoNuevo}.`
        );
    }

    const nombre = cotizacion.nombre_contacto || 'Cliente';
    const codigo = cotizacion.codigo;

    const comentarioTexto = comentario
        ? `\nComentario del equipo: ${comentario}`
        : '';

    const texto = [
        `Hola ${nombre}:`,
        '',
        `Te informamos que el estado de tu solicitud ${codigo} ha cambiado.`,
        '',
        `Estado anterior: ${estadoAnterior}`,
        `Estado actual: ${estadoNuevo}`,
        '',
        informacion.descripcion,
        comentarioTexto,
        '',
        'Gracias por confiar en TUSA WOOD.',
        '',
        'Este mensaje es una notificación automática.'
    ].join('\n');

    const comentarioHtml = comentario
        ? `<p><strong>Comentario del equipo:</strong><br>${escaparHtml(comentario).replace(/\n/g, '<br>')}</p>`
        : '';

    const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${escaparHtml(informacion.titulo)}</title>
        </head>

        <body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,sans-serif;color:#263238;">

            <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">

                <div style="background:#234b38;color:#ffffff;padding:24px;">
                    <h1 style="margin:0;font-size:24px;">TUSA WOOD</h1>
                    <p style="margin:8px 0 0;">Actualización de solicitud</p>
                </div>

                <div style="padding:24px;">

                    <h2 style="color:#234b38;">
                        Hola ${escaparHtml(nombre)}
                    </h2>

                    <p>
                        Te informamos que tu solicitud ha sido actualizada.
                    </p>

                    <div style="padding:16px;background:#f4f6f8;border-radius:8px;">

                        <p>
                            <strong>Código:</strong>
                            ${escaparHtml(codigo)}
                        </p>

                        <p>
                            <strong>Estado anterior:</strong>
                            ${escaparHtml(estadoAnterior)}
                        </p>

                        <p>
                            <strong>Estado actual:</strong>
                            ${escaparHtml(estadoNuevo)}
                        </p>

                    </div>

                    <h3>${escaparHtml(informacion.titulo)}</h3>

                    <p>${escaparHtml(informacion.descripcion)}</p>

                    ${comentarioHtml}

                    <p style="margin-top:28px;">
                        Gracias por confiar en TUSA WOOD.
                    </p>

                </div>

                <div style="padding:16px 24px;background:#f4f6f8;color:#607078;font-size:12px;">
                    Mensaje automático. Por favor, no respondas directamente a este correo.
                </div>

            </div>

        </body>
        </html>
    `;

    return {
        asunto: `Actualización de tu solicitud ${codigo}: ${informacion.titulo}`,
        texto,
        html
    };
}

// ============================================================
// ACTUALIZAR ESTADO DE COTIZACIÓN
// PATCH /api/admin/quotes/:id/estado
// ============================================================

async function actualizarEstadoCotizacion(req, res) {
    const { id } = req.params;

    if (!validarId(id)) {
        return respuestaError(
            res,
            400,
            'El identificador de cotización no es válido.'
        );
    }

    if (
        !req.body ||
        typeof req.body !== 'object' ||
        Array.isArray(req.body)
    ) {
        return respuestaError(
            res,
            400,
            'El cuerpo de la solicitud debe ser un objeto JSON.'
        );
    }

    const {
        estado,
        comentario,
        notas_internas
    } = req.body;

    const idAdministrador =
        req.administrador?.id_administrador;

    const rolAdministrador = obtenerRolAdministrador(req);

    if (!validarId(idAdministrador)) {
        return respuestaError(
            res,
            401,
            'No se pudo identificar al administrador.'
        );
    }

    if (!Object.values(ROLES).includes(rolAdministrador)) {
        return respuestaError(
            res,
            403,
            'Tu rol no tiene permisos para realizar esta operación.'
        );
    }

    const estadoNuevo = typeof estado === 'string'
        ? estado.trim().toUpperCase()
        : '';

    if (!ESTADOS_VALIDOS.includes(estadoNuevo)) {
        return respuestaError(
            res,
            400,
            'El nuevo estado no es válido.',
            { estados_validos: ESTADOS_VALIDOS }
        );
    }

    if (
        rolAdministrador === ROLES.VENTAS &&
        !ESTADOS_PERMITIDOS_VENTAS.includes(estadoNuevo)
    ) {
        return respuestaError(
            res,
            403,
            'VENTAS solamente puede marcar una solicitud como EN_ATENCION. La gestión de los demás estados corresponde a GERENCIA o SUPERADMIN.'
        );
    }

    if (
        comentario !== undefined &&
        comentario !== null &&
        typeof comentario !== 'string'
    ) {
        return respuestaError(
            res,
            400,
            'El comentario debe ser texto.'
        );
    }

    if (
        notas_internas !== undefined &&
        notas_internas !== null &&
        typeof notas_internas !== 'string'
    ) {
        return respuestaError(
            res,
            400,
            'Las notas internas deben ser texto.'
        );
    }

    const comentarioLimpio =
        typeof comentario === 'string'
            ? comentario.trim()
            : '';

    const notasLimpias =
        typeof notas_internas === 'string'
            ? notas_internas.trim() || null
            : null;

    if (
        comentarioLimpio.length > 5000 ||
        (
            typeof notas_internas === 'string' &&
            notas_internas.length > 10000
        )
    ) {
        return respuestaError(
            res,
            400,
            'El comentario o las notas internas superan la longitud permitida.'
        );
    }

    let conexion;
    let transaccionIniciada = false;

    let cotizacionActualizada = null;
    let estadoAnterior = null;
    let cambioEstadoRealizado = false;
    let cambioNotasRealizado = false;

    try {
        conexion = await pool.connect();

        await conexion.query('BEGIN');
        transaccionIniciada = true;

        const resultado = await conexion.query(
            `SELECT
                id_cotizacion,
                codigo,
                nombre_contacto,
                correo,
                estado,
                notas_internas
             FROM cotizaciones
             WHERE id_cotizacion = $1
             FOR UPDATE`,
            [Number(id)]
        );

        if (resultado.rows.length === 0) {
            await conexion.query('ROLLBACK');
            transaccionIniciada = false;

            return respuestaError(
                res,
                404,
                'No se encontró la cotización.'
            );
        }

        const cotizacion = resultado.rows[0];

        estadoAnterior = cotizacion.estado;

        cambioEstadoRealizado =
            estadoAnterior !== estadoNuevo;

        const notasAnteriores =
            cotizacion.notas_internas || null;

        cambioNotasRealizado =
            notas_internas !== undefined &&
            notasAnteriores !== notasLimpias;

        if (
            !cambioEstadoRealizado &&
            !cambioNotasRealizado &&
            !comentarioLimpio
        ) {
            await conexion.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(200).json({
                estado: 'OK',
                mensaje: 'La cotización no tenía cambios pendientes.',

                cotizacion: {
                    id_cotizacion: Number(id),
                    estado_anterior: estadoAnterior,
                    estado_nuevo: estadoNuevo,
                    cambio_estado: false,
                    cambio_notas: false
                },

                notificacion_correo: 'NO_APLICA'
            });
        }

        const resultadoActualizacion = await conexion.query(
            `UPDATE cotizaciones
             SET
                estado = $1,

                notas_internas = CASE
                    WHEN $2::BOOLEAN THEN $3::TEXT
                    ELSE notas_internas
                END,

                actualizado_en = CURRENT_TIMESTAMP

             WHERE id_cotizacion = $4

             RETURNING *`,
            [
                estadoNuevo,
                notas_internas !== undefined,
                notasLimpias,
                Number(id)
            ]
        );

        cotizacionActualizada =
            resultadoActualizacion.rows[0];

        let comentarioHistorial =
            comentarioLimpio || null;

        if (cambioNotasRealizado) {
            const mensajeNotas =
                'Se actualizaron las notas internas.';

            comentarioHistorial = comentarioHistorial
                ? `${comentarioHistorial} ${mensajeNotas}`
                : mensajeNotas;
        }

        await conexion.query(
            `INSERT INTO historial_cotizaciones (
                id_cotizacion,
                id_administrador,
                estado_anterior,
                estado_nuevo,
                comentario
            )
            VALUES ($1, $2, $3, $4, $5)`,
            [
                Number(id),
                Number(idAdministrador),
                estadoAnterior,
                estadoNuevo,
                comentarioHistorial
            ]
        );

        await conexion.query('COMMIT');
        transaccionIniciada = false;

        // La transacción ya quedó confirmada.
        // La notificación no revierte la actualización.

        let notificacionCorreo = 'NO_APLICA';

        const estadosConNotificacion = [
            'EN_ATENCION',
            'ACEPTADA',
            'RECHAZADA',
            'CERRADA'
        ];

        if (
            cambioEstadoRealizado &&
            cotizacion.correo &&
            estadosConNotificacion.includes(estadoNuevo)
        ) {
            try {
                const correo = crearCorreoCambioEstado(
                    cotizacion,
                    estadoAnterior,
                    estadoNuevo,
                    comentarioLimpio
                );

                const resultadoCorreo = await enviarCorreo({
                    id_cotizacion: Number(id),
                    destinatario: cotizacion.correo,
                    asunto: correo.asunto,
                    texto: correo.texto,
                    html: correo.html
                });

                notificacionCorreo =
                    resultadoCorreo?.estado ||
                    'RESULTADO_DESCONOCIDO';

                if (notificacionCorreo !== 'ENVIADO') {
                    console.warn(
                        `[TUSA WOOD] Cotización ${id} actualizada. Estado del correo: ${notificacionCorreo}`
                    );
                }

            } catch (errorCorreo) {
                notificacionCorreo = 'ERROR_PROCESAMIENTO';

                console.error(
                    `[TUSA WOOD] Error al procesar el correo de la cotización ${id}:`,
                    errorCorreo.message
                );
            }
        }

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Cotización actualizada correctamente.',

            cotizacion: {
                ...cotizacionActualizada,
                estado_anterior: estadoAnterior,
                cambio_estado: cambioEstadoRealizado,
                cambio_notas: cambioNotasRealizado
            },

            historial: {
                id_administrador: Number(idAdministrador),
                estado_anterior: estadoAnterior,
                estado_nuevo: estadoNuevo,
                comentario: comentarioLimpio || null,
                registrado: true
            },

            notificacion_correo: notificacionCorreo
        });

    } catch (error) {
        if (conexion && transaccionIniciada) {
            try {
                await conexion.query('ROLLBACK');
            } catch (errorRollback) {
                console.error(
                    'Error al revertir la transacción:',
                    errorRollback.message
                );
            }
        }

        console.error(
            'Error al actualizar cotización:',
            error.message
        );

        return respuestaError(
            res,
            500,
            'No se pudo actualizar la cotización.'
        );

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

// ============================================================
// EXPORTAR CONTROLADORES
// ============================================================

module.exports = {
    listarCotizaciones,
    obtenerSupervisionComercial,
    obtenerCotizacionPorId,
    actualizarEstadoCotizacion
};