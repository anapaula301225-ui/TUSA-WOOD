
const crypto = require('crypto');
const pool = require('../config/database');
const { enviarCorreo } = require('../services/email.service');

function textoValido(valor, maximo) {
    return (
        typeof valor === 'string' &&
        valor.trim().length > 0 &&
        valor.trim().length <= maximo
    );
}

function generarCodigoCotizacion() {
    const fecha = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');

    const aleatorio = crypto.randomBytes(4).toString('hex').toUpperCase();

    return `TW-${fecha}-${aleatorio}`;
}

function respuestaError(res, mensaje) {
    return res.status(400).json({
        estado: 'ERROR',
        mensaje
    });
}

async function registrarCotizacion(req, res) {
    const {
        nombre_contacto,
        empresa,
        correo,
        telefono,
        direccion_entrega,
        mensaje,
        productos,
        servicios = []
    } = req.body || {};

    // =====================================================
    // VALIDAR DATOS DEL CLIENTE
    // =====================================================

    if (!textoValido(nombre_contacto, 120)) {
        return respuestaError(
            res,
            'El nombre del contacto es obligatorio y debe tener como máximo 120 caracteres.'
        );
    }

    if (!textoValido(correo, 150)) {
        return respuestaError(
            res,
            'El correo electrónico es obligatorio y debe tener como máximo 150 caracteres.'
        );
    }

    const correoNormalizado = correo.trim().toLowerCase();
    const formatoCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formatoCorreo.test(correoNormalizado)) {
        return respuestaError(
            res,
            'El formato del correo electrónico no es válido.'
        );
    }

    if (!textoValido(telefono, 30)) {
        return respuestaError(
            res,
            'El teléfono es obligatorio y debe tener como máximo 30 caracteres.'
        );
    }

    if (
        empresa !== undefined &&
        empresa !== null &&
        (typeof empresa !== 'string' || empresa.trim().length > 150)
    ) {
        return respuestaError(
            res,
            'El nombre de la empresa no puede superar los 150 caracteres.'
        );
    }

    if (
        direccion_entrega !== undefined &&
        direccion_entrega !== null &&
        (
            typeof direccion_entrega !== 'string' ||
            direccion_entrega.trim().length > 1000
        )
    ) {
        return respuestaError(
            res,
            'La dirección no puede superar los 1000 caracteres.'
        );
    }

    if (
        mensaje !== undefined &&
        mensaje !== null &&
        (
            typeof mensaje !== 'string' ||
            mensaje.trim().length > 3000
        )
    ) {
        return respuestaError(
            res,
            'El mensaje no puede superar los 3000 caracteres.'
        );
    }

    // =====================================================
    // VALIDAR PRODUCTOS
    // =====================================================

    if (!Array.isArray(productos) || productos.length === 0) {
        return respuestaError(
            res,
            'Debes seleccionar al menos un producto.'
        );
    }

    if (productos.length > 30) {
        return respuestaError(
            res,
            'Una solicitud puede contener como máximo 30 productos.'
        );
    }

    const productosNormalizados = [];

    for (const item of productos) {
        if (
            !item ||
            typeof item !== 'object' ||
            Array.isArray(item)
        ) {
            return respuestaError(
                res,
                'Uno de los productos enviados no tiene un formato válido.'
            );
        }

        const idProducto = Number(item.id_producto);
        const cantidad = Number(item.cantidad);

        if (
            !Number.isSafeInteger(idProducto) ||
            idProducto <= 0 ||
            !Number.isSafeInteger(cantidad) ||
            cantidad <= 0 ||
            cantidad > 1000000
        ) {
            return respuestaError(
                res,
                'Cada producto debe tener un identificador válido y una cantidad entera positiva.'
            );
        }

        const especificaciones = item.especificaciones ?? '';

        if (
            typeof especificaciones !== 'string' ||
            especificaciones.trim().length > 1000
        ) {
            return respuestaError(
                res,
                'Las especificaciones no pueden superar los 1000 caracteres.'
            );
        }

        productosNormalizados.push({
            id_producto: idProducto,
            cantidad,
            especificaciones: especificaciones.trim()
        });
    }

    const idsProductos = productosNormalizados.map(
        producto => producto.id_producto
    );

    if (new Set(idsProductos).size !== idsProductos.length) {
        return respuestaError(
            res,
            'No repitas un producto en la solicitud. Indica su cantidad en una sola línea.'
        );
    }

    // =====================================================
    // VALIDAR SERVICIOS ADICIONALES
    // =====================================================

    if (!Array.isArray(servicios)) {
        return respuestaError(
            res,
            'Los servicios adicionales deben enviarse como una lista.'
        );
    }

    if (servicios.length > 20) {
        return respuestaError(
            res,
            'Una solicitud puede contener como máximo 20 servicios.'
        );
    }

    const serviciosNormalizados = [];

    for (const item of servicios) {
        if (
            !item ||
            typeof item !== 'object' ||
            Array.isArray(item)
        ) {
            return respuestaError(
                res,
                'Uno de los servicios enviados no tiene un formato válido.'
            );
        }

        const idServicio = Number(item.id_servicio);
        const observaciones = item.observaciones ?? '';

        if (
            !Number.isSafeInteger(idServicio) ||
            idServicio <= 0
        ) {
            return respuestaError(
                res,
                'Cada servicio debe tener un identificador válido.'
            );
        }

        if (
            typeof observaciones !== 'string' ||
            observaciones.trim().length > 1000
        ) {
            return respuestaError(
                res,
                'Las observaciones de los servicios no pueden superar los 1000 caracteres.'
            );
        }

        serviciosNormalizados.push({
            id_servicio: idServicio,
            observaciones: observaciones.trim()
        });
    }

    const idsServicios = serviciosNormalizados.map(
        servicio => servicio.id_servicio
    );

    if (new Set(idsServicios).size !== idsServicios.length) {
        return respuestaError(
            res,
            'No repitas un servicio en la solicitud.'
        );
    }

    let conexion;
    let transaccionIniciada = false;

    try {
        // =================================================
        // VERIFICAR PRODUCTOS ACTIVOS
        // =================================================

        const resultadoProductos = await pool.query(
            `
                SELECT id_producto, nombre
                FROM productos
                WHERE id_producto = ANY($1::INTEGER[])
                  AND activo = TRUE
            `,
            [idsProductos]
        );

        if (resultadoProductos.rowCount !== idsProductos.length) {
            return respuestaError(
                res,
                'Uno o varios productos no existen o ya no están disponibles.'
            );
        }

        const productosDisponibles = new Map(
            resultadoProductos.rows.map(producto => [
                producto.id_producto,
                producto.nombre
            ])
        );

        // =================================================
        // VERIFICAR SERVICIOS ACTIVOS
        // =================================================

        let serviciosDisponibles = new Map();

        if (idsServicios.length > 0) {
            const resultadoServicios = await pool.query(
                `
                    SELECT id_servicio, nombre
                    FROM servicios
                    WHERE id_servicio = ANY($1::INTEGER[])
                      AND activo = TRUE
                `,
                [idsServicios]
            );

            if (resultadoServicios.rowCount !== idsServicios.length) {
                return respuestaError(
                    res,
                    'Uno o varios servicios no existen o ya no están disponibles.'
                );
            }

            serviciosDisponibles = new Map(
                resultadoServicios.rows.map(servicio => [
                    servicio.id_servicio,
                    servicio.nombre
                ])
            );

            // "Otro servicio" necesita una descripción.
            const otroServicio = resultadoServicios.rows.find(
                servicio => servicio.nombre === 'Otro servicio'
            );

            if (otroServicio) {
                const seleccionOtro = serviciosNormalizados.find(
                    servicio =>
                        servicio.id_servicio === otroServicio.id_servicio
                );

                if (!seleccionOtro.observaciones) {
                    return respuestaError(
                        res,
                        'Debes describir el servicio adicional que necesitas.'
                    );
                }
            }
        }

        // =================================================
        // INICIAR TRANSACCIÓN
        // =================================================

        conexion = await pool.connect();

        await conexion.query('BEGIN');
        transaccionIniciada = true;

        const codigo = generarCodigoCotizacion();

        const resultadoCotizacion = await conexion.query(
            `
                INSERT INTO cotizaciones (
                    codigo,
                    nombre_contacto,
                    empresa,
                    correo,
                    telefono,
                    direccion_entrega,
                    mensaje,
                    estado,
                    origen
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7,
                    'PENDIENTE',
                    'WEB'
                )
                RETURNING
                    id_cotizacion,
                    codigo,
                    estado,
                    creado_en
            `,
            [
                codigo,
                nombre_contacto.trim(),
                empresa?.trim() || null,
                correoNormalizado,
                telefono.trim(),
                direccion_entrega?.trim() || null,
                mensaje?.trim() || null
            ]
        );

        const cotizacion = resultadoCotizacion.rows[0];

        // =================================================
        // GUARDAR PRODUCTOS
        // =================================================

        for (const item of productosNormalizados) {
            await conexion.query(
                `
                    INSERT INTO detalle_cotizacion (
                        id_cotizacion,
                        id_producto,
                        nombre_producto,
                        cantidad,
                        especificaciones
                    )
                    VALUES ($1, $2, $3, $4, $5)
                `,
                [
                    cotizacion.id_cotizacion,
                    item.id_producto,
                    productosDisponibles.get(item.id_producto),
                    item.cantidad,
                    item.especificaciones || null
                ]
            );
        }

        // =================================================
        // GUARDAR SERVICIOS ADICIONALES
        // =================================================

        for (const item of serviciosNormalizados) {
            await conexion.query(
                `
                    INSERT INTO detalle_servicios_cotizacion (
                        id_cotizacion,
                        id_servicio,
                        nombre_servicio,
                        observaciones
                    )
                    VALUES ($1, $2, $3, $4)
                `,
                [
                    cotizacion.id_cotizacion,
                    item.id_servicio,
                    serviciosDisponibles.get(item.id_servicio),
                    item.observaciones || null
                ]
            );
        }

        // =================================================
        // REGISTRAR HISTORIAL INICIAL
        // =================================================

        await conexion.query(
            `
                INSERT INTO historial_cotizaciones (
                    id_cotizacion,
                    id_administrador,
                    estado_anterior,
                    estado_nuevo,
                    comentario
                )
                VALUES ($1, NULL, NULL, 'PENDIENTE', $2)
            `,
            [
                cotizacion.id_cotizacion,
                'Solicitud de cotización recibida desde la página web.'
            ]
        );

        await conexion.query('COMMIT');
        transaccionIniciada = false;

        // =================================================
        // PREPARAR INFORMACIÓN DE SERVICIOS PARA CORREOS
        // =================================================

        const textoServicios = serviciosNormalizados.length > 0
            ? serviciosNormalizados.map(item => {
                const nombre = serviciosDisponibles.get(item.id_servicio);

                return [
                    `- ${nombre}`,
                    item.observaciones
                        ? `  Observaciones: ${item.observaciones}`
                        : ''
                ].filter(Boolean).join('\n');
            }).join('\n')
            : 'No se solicitaron servicios adicionales.';

        const correoAdministrador =
            process.env.EMAIL_ADMIN || 'admin@tusawood.com';

        const asuntoAdministrador =
            `Nueva cotización ${cotizacion.codigo}`;

        const textoAdministrador = [
            'Se recibió una nueva solicitud de cotización en TUSA WOOD.',
            '',
            `Código: ${cotizacion.codigo}`,
            `Contacto: ${nombre_contacto.trim()}`,
            `Empresa: ${empresa?.trim() || 'No especificada'}`,
            `Correo: ${correoNormalizado}`,
            `Teléfono: ${telefono.trim()}`,
            `Estado: ${cotizacion.estado}`,
            '',
            `Cantidad de líneas de productos: ${productosNormalizados.length}`,
            `Cantidad de servicios adicionales: ${serviciosNormalizados.length}`,
            '',
            'SERVICIOS ADICIONALES:',
            textoServicios,
            '',
            'Ingresa al panel administrativo para revisar la solicitud.'
        ].join('\n');

        const asuntoCliente =
            `Recibimos tu solicitud ${cotizacion.codigo}`;

        const textoCliente = [
            `Hola ${nombre_contacto.trim()},`,
            '',
            'Hemos recibido tu solicitud de cotización en TUSA WOOD.',
            '',
            `Código de seguimiento: ${cotizacion.codigo}`,
            `Estado actual: ${cotizacion.estado}`,
            '',
            'Nuestro equipo revisará tu solicitud. Este mensaje confirma la recepción; no representa todavía una cotización económica.',
            '',
            'Gracias por contactar a TUSA WOOD.'
        ].join('\n');

        // =================================================
        // ENVIAR NOTIFICACIONES SIN REVERTIR LA COTIZACIÓN
        // =================================================

        const notificaciones = await Promise.allSettled([
            enviarCorreo({
                id_cotizacion: cotizacion.id_cotizacion,
                destinatario: correoAdministrador,
                asunto: asuntoAdministrador,
                texto: textoAdministrador
            }),
            enviarCorreo({
                id_cotizacion: cotizacion.id_cotizacion,
                destinatario: correoNormalizado,
                asunto: asuntoCliente,
                texto: textoCliente
            })
        ]);

        for (const resultado of notificaciones) {
            if (resultado.status === 'rejected') {
                console.error(
                    'No se pudo procesar una notificación:',
                    resultado.reason?.message || 'Error desconocido'
                );
            }
        }

        return res.status(201).json({
            estado: 'OK',
            mensaje: 'Solicitud de cotización registrada correctamente.',
            cotizacion: {
                id_cotizacion: cotizacion.id_cotizacion,
                codigo: cotizacion.codigo,
                estado: cotizacion.estado,
                creado_en: cotizacion.creado_en
            },
            total_productos: productosNormalizados.length,
            total_servicios: serviciosNormalizados.length
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
            'Error al registrar cotización:',
            error.message
        );

        return res.status(500).json({
            estado: 'ERROR',
            mensaje: 'No se pudo registrar la solicitud. Inténtalo nuevamente.'
        });

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

module.exports = {
    registrarCotizacion
};
