
const nodemailer = require('nodemailer');
const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

const {
    resolverRutaPdf
} = require('../config/storage');

const MAX_INTENTOS = 3;
const INTERVALO_REINTENTO_MINUTOS = 5;
const INTERVALO_PROCESADOR_MS = 60 * 1000;

// Tiempo durante el cual una notificación reclamada
// queda protegida frente a otros workers.
const INTERVALO_BLOQUEO_MINUTOS = 15;

const LIMITE_POR_PROCESO = 10;

// =====================================================
// IDENTIDAD VISUAL TUSA WOOD
// =====================================================

const COLORES = {
    carbon: '#22272C',
    naranja: '#F07832',
    blanco: '#FFFFFF',
    gris: '#F0F1F2',
    acero: '#454B52',
    madera: '#9B633B'
};

// =====================================================
// ESTADO INTERNO
// =====================================================

let cuentaEtherealPromise = null;
let transporterEtherealPromise = null;

let temporizadorReintentos = null;
let promesaProcesamiento = null;
let workerDeteniendose = false;

// =====================================================
// CONFIGURACIÓN
// =====================================================

function correoHabilitado() {
    return process.env.EMAIL_ENABLED === 'true';
}

function obtenerProveedorCorreo() {
    return String(process.env.EMAIL_PROVIDER || '')
        .trim()
        .toLowerCase();
}

function usarEthereal() {
    return (
        process.env.NODE_ENV === 'development' &&
        obtenerProveedorCorreo() === 'ethereal'
    );
}

// =====================================================
// UTILIDADES DE PRESENTACIÓN
// =====================================================

function escaparHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function generarContenidoHtml(texto) {
    return escaparHtml(texto || '')
        .split(/\r?\n/)
        .map(linea => {
            if (!linea.trim()) {
                return '<div style="height:8px;"></div>';
            }

            return `
                <p style="
                    margin:0 0 8px;
                    color:${COLORES.acero};
                    font-size:14px;
                    line-height:1.7;
                    overflow-wrap:anywhere;
                ">${linea}</p>
            `;
        })
        .join('');
}

function crearPlantillaCorporativa({ asunto, texto }) {
    const contenido = generarContenidoHtml(texto);

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escaparHtml(asunto)}</title>
    </head>

    <body style="
        margin:0;
        padding:0;
        background:${COLORES.gris};
        font-family:Arial,Helvetica,sans-serif;
        color:${COLORES.carbon};
    ">

        <table role="presentation" width="100%" cellspacing="0"
            cellpadding="0" border="0"
            style="background:${COLORES.gris};padding:30px 12px;">

            <tr>
                <td align="center">

                    <table role="presentation" width="600"
                        cellspacing="0" cellpadding="0" border="0"
                        style="
                            width:100%;
                            max-width:600px;
                            background:${COLORES.blanco};
                            border-radius:10px;
                            overflow:hidden;
                        ">

                        <tr>
                            <td style="
                                background:${COLORES.carbon};
                                padding:30px 32px;
                                border-bottom:5px solid ${COLORES.naranja};
                            ">
                                <h1 style="
                                    margin:0;
                                    color:${COLORES.blanco};
                                    font-size:27px;
                                    letter-spacing:2px;
                                    font-weight:800;
                                ">
                                    TUSA <span style="color:${COLORES.naranja};">WOOD</span>
                                </h1>

                                <p style="
                                    margin:9px 0 0;
                                    color:#D0D3D6;
                                    font-size:12px;
                                    letter-spacing:1.5px;
                                    text-transform:uppercase;
                                ">
                                    Soluciones industriales en madera
                                </p>
                            </td>
                        </tr>

                        <tr>
                            <td style="padding:32px;">

                                <div style="
                                    width:42px;
                                    height:4px;
                                    background:${COLORES.naranja};
                                    margin-bottom:20px;
                                "></div>

                                <h2 style="
                                    margin:0 0 22px;
                                    color:${COLORES.carbon};
                                    font-size:20px;
                                    line-height:1.4;
                                ">
                                    ${escaparHtml(asunto)}
                                </h2>

                                <div style="
                                    padding:22px;
                                    background:#FAFAFA;
                                    border:1px solid #E5E6E7;
                                    border-left:4px solid ${COLORES.naranja};
                                    border-radius:5px;
                                ">
                                    ${contenido}
                                </div>

                                <p style="
                                    margin:25px 0 0;
                                    color:${COLORES.acero};
                                    font-size:13px;
                                    line-height:1.6;
                                ">
                                    Gracias por confiar en TUSA WOOD.
                                    Estamos comprometidos con brindarte
                                    soluciones industriales de calidad.
                                </p>

                            </td>
                        </tr>

                        <tr>
                            <td style="
                                background:${COLORES.carbon};
                                padding:22px 30px;
                                text-align:center;
                            ">
                                <p style="
                                    margin:0;
                                    color:${COLORES.blanco};
                                    font-size:13px;
                                    font-weight:bold;
                                    letter-spacing:1px;
                                ">
                                    TUSA WOOD
                                </p>

                                <p style="
                                    margin:8px 0 0;
                                    color:#BFC3C7;
                                    font-size:11px;
                                    line-height:1.6;
                                ">
                                    Este es un mensaje automático.
                                    Por favor, no respondas directamente
                                    a este correo.
                                </p>

                                <p style="
                                    margin:12px 0 0;
                                    color:${COLORES.naranja};
                                    font-size:11px;
                                ">
                                    Soluciones industriales en madera
                                </p>
                            </td>
                        </tr>

                    </table>

                </td>
            </tr>
        </table>

    </body>
    </html>
    `;
}

// =====================================================
// OBTENER PDF DE UNA VERSIÓN
// =====================================================

async function obtenerAdjuntoCotizacion(idVersion) {
    if (idVersion === null || idVersion === undefined) {
        return null;
    }

    const resultado = await pool.query(
        `
            SELECT
                id_version,
                estado,
                pdf_ruta
            FROM cotizaciones_versiones
            WHERE id_version = $1
            LIMIT 1
        `,
        [idVersion]
    );

    if (!resultado.rows.length) {
        throw new Error(
            'No existe la versión de cotización asociada al correo.'
        );
    }

    const version = resultado.rows[0];

    if (!['APROBADA', 'ENVIADA'].includes(version.estado)) {
        throw new Error(
            'Solo se puede adjuntar el PDF de una cotización aprobada o enviada.'
        );
    }

    if (!version.pdf_ruta) {
        throw new Error(
            'La versión de cotización todavía no tiene un PDF registrado.'
        );
    }

    const rutaArchivo = resolverRutaPdf(version.pdf_ruta);

    let informacion;

    try {
        informacion = await fs.promises.stat(rutaArchivo);
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(
                'No se encontró el archivo PDF de la cotización.'
            );
        }

        throw error;
    }

    if (!informacion.isFile() || informacion.size <= 0) {
        throw new Error(
            'El archivo registrado para la cotización no es válido.'
        );
    }

    return {
        filename: path.basename(rutaArchivo),
        path: rutaArchivo,
        contentType: 'application/pdf'
    };
}

// =====================================================
// TRANSPORTADORES
// =====================================================

async function obtenerTransporterEthereal() {
    if (!cuentaEtherealPromise) {
        cuentaEtherealPromise = nodemailer.createTestAccount();
    }

    const cuenta = await cuentaEtherealPromise;

    if (!transporterEtherealPromise) {
        transporterEtherealPromise = Promise.resolve(
            nodemailer.createTransport({
                host: cuenta.smtp.host,
                port: cuenta.smtp.port,
                secure: cuenta.smtp.secure,
                auth: {
                    user: cuenta.user,
                    pass: cuenta.pass
                }
            })
        );
    }

    return transporterEtherealPromise;
}

async function obtenerTransporterSMTP() {
    const host = process.env.EMAIL_HOST;
    const usuario = process.env.EMAIL_USER;
    const password = process.env.EMAIL_PASSWORD;
    const puerto = Number(process.env.EMAIL_PORT || 587);

    if (!host || !usuario || !password) {
        throw new Error(
            'Falta configurar EMAIL_HOST, EMAIL_USER o EMAIL_PASSWORD.'
        );
    }

    if (!Number.isInteger(puerto) || puerto <= 0 || puerto > 65535) {
        throw new Error('EMAIL_PORT no contiene un puerto SMTP válido.');
    }

    return nodemailer.createTransport({
        host,
        port: puerto,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: usuario,
            pass: password
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000
    });
}

// =====================================================
// REGISTRAR NOTIFICACIÓN
// =====================================================

async function registrarNotificacion({
    id_cotizacion = null,
    id_version = null,
    id_administrador = null,
    destinatario,
    asunto,
    texto,
    html
}) {
    const resultado = await pool.query(
        `
            INSERT INTO notificaciones_email (
                id_cotizacion,
                id_version,
                id_administrador,
                destinatario,
                asunto,
                estado,
                error_detalle,
                intentos,
                enviado_en,
                creado_en,
                texto,
                html,
                proximo_intento_en,
                ultimo_intento_en
            )
            VALUES (
                $1, $2, $3, $4, $5, 'PENDIENTE',
                NULL, 0, NULL, NOW(), $6, $7, NULL, NULL
            )
            RETURNING id_notificacion
        `,
        [
            id_cotizacion,
            id_version,
            id_administrador,
            destinatario,
            asunto,
            texto || null,
            html || null
        ]
    );

    return resultado.rows[0].id_notificacion;
}

// =====================================================
// REGISTRAR ENVÍO EXITOSO Y ACTUALIZAR VERSIÓN
// =====================================================

async function registrarEnvioExitoso(idNotificacion) {
    const conexion = await pool.connect();

    try {
        await conexion.query('BEGIN');

        const resultadoNotificacion = await conexion.query(
            `
                SELECT
                    id_notificacion,
                    id_cotizacion,
                    id_version,
                    id_administrador,
                    destinatario,
                    estado
                FROM notificaciones_email
                WHERE id_notificacion = $1
                FOR UPDATE
            `,
            [idNotificacion]
        );

        if (!resultadoNotificacion.rows.length) {
            throw new Error(
                'No se encontró la notificación para confirmar el envío.'
            );
        }

        const notificacion = resultadoNotificacion.rows[0];

        if (notificacion.estado === 'ENVIADO') {
            await conexion.query('COMMIT');

            return {
                estado: 'ENVIADO',
                repetido: true
            };
        }

        if (notificacion.estado !== 'PENDIENTE') {
            throw new Error(
                'La notificación ya no se encuentra pendiente de confirmación.'
            );
        }

        if (notificacion.id_version !== null) {
            if (!notificacion.id_administrador) {
                throw new Error(
                    'La notificación no tiene registrado al administrador que inició el envío.'
                );
            }

            const resultadoVersion = await conexion.query(
                `
                    SELECT
                        id_version,
                        id_cotizacion,
                        numero_version,
                        estado
                    FROM cotizaciones_versiones
                    WHERE id_version = $1
                    FOR UPDATE
                `,
                [notificacion.id_version]
            );

            if (!resultadoVersion.rows.length) {
                throw new Error(
                    'No existe la versión asociada a la notificación.'
                );
            }

            const version = resultadoVersion.rows[0];

            if (version.estado === 'APROBADA') {
                await conexion.query(
                    `
                        UPDATE cotizaciones_versiones
                        SET estado = 'ENVIADA',
                            actualizado_en = NOW()
                        WHERE id_version = $1
                          AND estado = 'APROBADA'
                    `,
                    [version.id_version]
                );

                const comentario =
                    `Envío al cliente de la versión ${version.numero_version}. ` +
                    `Destinatario: ${notificacion.destinatario}. ` +
                    `El servidor SMTP aceptó el correo y el PDF fue adjuntado.`;

                await conexion.query(
                    `
                        INSERT INTO historial_cotizaciones (
                            id_cotizacion,
                            id_administrador,
                            estado_anterior,
                            estado_nuevo,
                            comentario,
                            creado_en
                        )
                        VALUES ($1, $2, 'APROBADA', 'ENVIADA', $3, NOW())
                    `,
                    [
                        version.id_cotizacion,
                        notificacion.id_administrador,
                        comentario
                    ]
                );

            } else if (version.estado !== 'ENVIADA') {
                throw new Error(
                    `No se puede confirmar el envío porque la versión está en estado ${version.estado}.`
                );
            }
        }

        await conexion.query(
            `
                UPDATE notificaciones_email
                SET estado = 'ENVIADO',
                    error_detalle = NULL,
                    enviado_en = NOW(),
                    ultimo_intento_en = NOW(),
                    proximo_intento_en = NULL
                WHERE id_notificacion = $1
                  AND estado = 'PENDIENTE'
            `,
            [idNotificacion]
        );

        await conexion.query('COMMIT');

        return {
            estado: 'ENVIADO',
            repetido: false
        };

    } catch (error) {
        try {
            await conexion.query('ROLLBACK');
        } catch (errorRollback) {
            console.error(
                '[TUSA WOOD] Error al revertir confirmación de envío:',
                errorRollback.message
            );
        }

        throw error;

    } finally {
        conexion.release();
    }
}

// =====================================================
// EVITAR REENVÍO AUTOMÁTICO SI SMTP YA ACEPTÓ EL CORREO
// PERO FALLÓ EL REGISTRO EN BASE DE DATOS
// =====================================================

async function marcarErrorConfirmacion(idNotificacion, error) {
    const detalle = (
        'El servidor SMTP aceptó el correo, pero no se pudo confirmar ' +
        'el envío en la base de datos. Requiere revisión manual. Detalle: ' +
        String(error?.message || error || 'Error desconocido')
    ).slice(0, 4000);

    await pool.query(
        `
            UPDATE notificaciones_email
            SET estado = 'ERROR',
                error_detalle = $2,
                proximo_intento_en = NULL,
                ultimo_intento_en = NOW()
            WHERE id_notificacion = $1
              AND estado = 'PENDIENTE'
        `,
        [idNotificacion, detalle]
    );
}

// =====================================================
// REGISTRAR ERROR DE ENVÍO
// =====================================================

async function actualizarError(idNotificacion, error, intentos) {
    const agotados = intentos >= MAX_INTENTOS;

    const detalle = String(
        error?.message || error || 'Error desconocido'
    ).slice(0, 4000);

    await pool.query(
        `
            UPDATE notificaciones_email
            SET estado = $2,
                error_detalle = $3,
                intentos = $4,
                ultimo_intento_en = NOW(),
                proximo_intento_en = CASE
                    WHEN $5 THEN NULL
                    ELSE NOW() + ($6 * INTERVAL '1 minute')
                END
            WHERE id_notificacion = $1
              AND estado = 'PENDIENTE'
        `,
        [
            idNotificacion,
            agotados ? 'ERROR' : 'PENDIENTE',
            detalle,
            intentos,
            agotados,
            INTERVALO_REINTENTO_MINUTOS
        ]
    );
}

// =====================================================
// REALIZAR ENVÍO
// =====================================================

async function realizarEnvio(notificacion) {
    const intentosActuales = Number(notificacion.intentos || 0);
    const siguienteIntento = intentosActuales + 1;

    if (!correoHabilitado()) {
        await pool.query(
            `
                UPDATE notificaciones_email
                SET estado = 'PENDIENTE',
                    error_detalle = $2,
                    proximo_intento_en = NOW() +
                        ($3 * INTERVAL '1 minute')
                WHERE id_notificacion = $1
                  AND estado = 'PENDIENTE'
            `,
            [
                notificacion.id_notificacion,
                'Envío desactivado. Pendiente de reintento al habilitar el correo.',
                INTERVALO_REINTENTO_MINUTOS
            ]
        );

        return {
            estado: 'CORREO_DESACTIVADO',
            id_notificacion: notificacion.id_notificacion
        };
    }

    let transporter;
    let cerrarTransporter = false;
    let correoAceptadoPorSMTP = false;
    let info;

    try {
        const adjunto = await obtenerAdjuntoCotizacion(
            notificacion.id_version
        );

        if (usarEthereal()) {
            transporter = await obtenerTransporterEthereal();
        } else {
            const proveedor = obtenerProveedorCorreo();

            if (!['smtp', 'gmail'].includes(proveedor)) {
                throw new Error(
                    'Proveedor no válido. Configura EMAIL_PROVIDER=smtp, EMAIL_PROVIDER=gmail o Ethereal en desarrollo.'
                );
            }

            transporter = await obtenerTransporterSMTP();
            cerrarTransporter = true;

            await transporter.verify();
        }

        const remitente = process.env.EMAIL_FROM_ADDRESS ||
            process.env.EMAIL_USER;

        if (!remitente) {
            throw new Error(
                'Falta configurar EMAIL_FROM_ADDRESS o EMAIL_USER.'
            );
        }

        const htmlCorporativo = crearPlantillaCorporativa({
            asunto: notificacion.asunto,
            texto: notificacion.texto || 'Gracias por contactar a TUSA WOOD.'
        });

        const opcionesCorreo = {
            from: {
                name: process.env.EMAIL_FROM_NAME || 'TUSA WOOD',
                address: remitente
            },
            to: notificacion.destinatario,
            subject: notificacion.asunto,
            text: notificacion.texto || '',
            html: htmlCorporativo
        };

        if (adjunto) {
            opcionesCorreo.attachments = [adjunto];
        }

        info = await transporter.sendMail(opcionesCorreo);

        if (!info.accepted || info.accepted.length === 0) {
            throw new Error(
                'El servidor SMTP no confirmó ningún destinatario aceptado.'
            );
        }

        correoAceptadoPorSMTP = true;

        await registrarEnvioExitoso(
            notificacion.id_notificacion
        );

        if (usarEthereal()) {
            console.log('[TUSA WOOD] Correo de prueba generado.');
            console.log('Destinatario:', notificacion.destinatario);
            console.log('Asunto:', notificacion.asunto);
            console.log(
                'Vista previa:',
                nodemailer.getTestMessageUrl(info)
            );
        } else {
            console.log('[TUSA WOOD] Servidor SMTP aceptó el correo.');
            console.log('Destinatario:', notificacion.destinatario);
            console.log('Asunto:', notificacion.asunto);
            console.log('ID de notificación:', notificacion.id_notificacion);
        }

        if (adjunto) {
            console.log(
                '[TUSA WOOD] PDF adjuntado:',
                adjunto.filename
            );
        }

        return {
            estado: 'ENVIADO',
            id_notificacion: notificacion.id_notificacion
        };

    } catch (error) {
        console.error(
            `[TUSA WOOD] Falló el envío ${siguienteIntento}/${MAX_INTENTOS}:`,
            error.message
        );

        if (correoAceptadoPorSMTP) {
            try {
                await marcarErrorConfirmacion(
                    notificacion.id_notificacion,
                    error
                );
            } catch (errorBD) {
                console.error(
                    '[TUSA WOOD] No se pudo registrar el fallo de confirmación:',
                    errorBD.message
                );
            }

            return {
                estado: 'ENVIADO_PENDIENTE_REGISTRO',
                id_notificacion: notificacion.id_notificacion,
                mensaje: 'El correo fue aceptado por SMTP, pero requiere revisión del registro en la base de datos.'
            };
        }

        try {
            await actualizarError(
                notificacion.id_notificacion,
                error,
                siguienteIntento
            );
        } catch (errorBD) {
            console.error(
                '[TUSA WOOD] No se pudo registrar el error del correo:',
                errorBD.message
            );
        }

        return {
            estado: siguienteIntento >= MAX_INTENTOS
                ? 'ERROR_ENVIO'
                : 'PENDIENTE_REINTENTO',
            id_notificacion: notificacion.id_notificacion
        };

    } finally {
        if (cerrarTransporter && transporter) {
            transporter.close();
        }
    }
}

// =====================================================
// FUNCIÓN PRINCIPAL DE ENVÍO
// =====================================================

async function enviarCorreo({
    id_cotizacion = null,
    id_version = null,
    id_administrador = null,
    destinatario,
    asunto,
    texto,
    html
}) {
    if (
        typeof destinatario !== 'string' ||
        !destinatario.trim() ||
        typeof asunto !== 'string' ||
        !asunto.trim()
    ) {
        console.error('[TUSA WOOD] Destinatario o asunto inválido.');

        return {
            estado: 'DATOS_INVALIDOS'
        };
    }

    if (
        id_version !== null &&
        (
            !Number.isInteger(Number(id_version)) ||
            Number(id_version) <= 0
        )
    ) {
        return {
            estado: 'DATOS_INVALIDOS',
            mensaje: 'El ID de versión no es válido.'
        };
    }

    if (
        id_version !== null &&
        (
            !Number.isInteger(Number(id_administrador)) ||
            Number(id_administrador) <= 0
        )
    ) {
        return {
            estado: 'DATOS_INVALIDOS',
            mensaje: 'Se requiere el administrador que inició el envío.'
        };
    }

    let idNotificacion;

    try {
        idNotificacion = await registrarNotificacion({
            id_cotizacion,
            id_version,
            id_administrador,
            destinatario: destinatario.trim(),
            asunto: asunto.trim(),
            texto,
            html
        });

        const resultado = await pool.query(
            `
                SELECT *
                FROM notificaciones_email
                WHERE id_notificacion = $1
            `,
            [idNotificacion]
        );

        if (!resultado.rows.length) {
            throw new Error(
                'No se encontró la notificación recién registrada.'
            );
        }

        return await realizarEnvio(resultado.rows[0]);

    } catch (error) {
        console.error(
            '[TUSA WOOD] No se pudo registrar/procesar el correo:',
            error.message
        );

        return {
            estado: 'ERROR_PROCESAMIENTO',
            id_notificacion: idNotificacion || null
        };
    }
}

// =====================================================
// EJECUCIÓN INTERNA DEL PROCESADOR
// =====================================================

async function ejecutarProcesamientoReintentos() {
    let conexion;
    let notificaciones = [];

    try {
        conexion = await pool.connect();

        await conexion.query('BEGIN');

        const resultado = await conexion.query(
            `
                SELECT *
                FROM notificaciones_email
                WHERE estado = 'PENDIENTE'
                  AND proximo_intento_en IS NOT NULL
                  AND proximo_intento_en <= NOW()
                  AND intentos < $1
                ORDER BY proximo_intento_en ASC
                LIMIT $2
                FOR UPDATE SKIP LOCKED
            `,
            [MAX_INTENTOS, LIMITE_POR_PROCESO]
        );

        notificaciones = resultado.rows;

        // Reclamar las notificaciones antes de liberar
        // la transacción para que otro worker no las tome.
        for (const notificacion of notificaciones) {
            await conexion.query(
                `
                    UPDATE notificaciones_email
                    SET proximo_intento_en = NOW() +
                        ($2 * INTERVAL '1 minute')
                    WHERE id_notificacion = $1
                      AND estado = 'PENDIENTE'
                `,
                [
                    notificacion.id_notificacion,
                    INTERVALO_BLOQUEO_MINUTOS
                ]
            );
        }

        await conexion.query('COMMIT');

    } catch (error) {
        if (conexion) {
            try {
                await conexion.query('ROLLBACK');
            } catch (errorRollback) {
                console.error(
                    '[TUSA WOOD] Error al revertir selección de reintentos:',
                    errorRollback.message
                );
            }
        }

        console.error(
            '[TUSA WOOD] Error al seleccionar reintentos:',
            error.message
        );

        return;

    } finally {
        if (conexion) {
            conexion.release();
        }
    }

    for (const notificacion of notificaciones) {
        try {
            await realizarEnvio(notificacion);
        } catch (error) {
            console.error(
                '[TUSA WOOD] Error inesperado procesando la notificación:',
                notificacion.id_notificacion,
                error.message
            );
        }
    }
}

// =====================================================
// PROCESAR REINTENTOS AUTOMÁTICOS
// =====================================================

function procesarReintentos() {
    if (!correoHabilitado() || workerDeteniendose) {
        return Promise.resolve();
    }

    // Evita que dos ejecuciones locales procesen
    // simultáneamente el mismo lote.
    if (promesaProcesamiento) {
        return promesaProcesamiento;
    }

    promesaProcesamiento = ejecutarProcesamientoReintentos()
        .catch(error => {
            console.error(
                '[TUSA WOOD] Error inesperado en el procesador:',
                error.message
            );
        })
        .finally(() => {
            promesaProcesamiento = null;
        });

    return promesaProcesamiento;
}

// =====================================================
// INICIAR PROCESADOR AUTOMÁTICO
// =====================================================

function iniciarReintentosAutomaticos() {
    if (temporizadorReintentos) {
        return;
    }

    workerDeteniendose = false;

    temporizadorReintentos = setInterval(() => {
        procesarReintentos().catch(error => {
            console.error(
                '[TUSA WOOD] Error inesperado en reintentos:',
                error.message
            );
        });
    }, INTERVALO_PROCESADOR_MS);

    if (typeof temporizadorReintentos.unref === 'function') {
        temporizadorReintentos.unref();
    }

    console.log(
        '[TUSA WOOD] Reintentos automáticos habilitados: cada 60 segundos.'
    );

    // Ejecutar también al iniciar el worker, sin esperar
    // al primer intervalo de 60 segundos.
    procesarReintentos().catch(error => {
        console.error(
            '[TUSA WOOD] Error al iniciar reintentos:',
            error.message
        );
    });
}

// =====================================================
// DETENER PROCESADOR AUTOMÁTICO
// =====================================================

async function detenerReintentosAutomaticos() {
    workerDeteniendose = true;

    if (temporizadorReintentos) {
        clearInterval(temporizadorReintentos);
        temporizadorReintentos = null;

        console.log(
            '[TUSA WOOD] Temporizador de reintentos detenido.'
        );
    }

    // Esperar el procesamiento que ya estaba en ejecución
    // antes de permitir que el servidor cierre PostgreSQL.
    if (promesaProcesamiento) {
        console.log(
            '[TUSA WOOD] Esperando que termine el procesamiento de correos...'
        );

        try {
            await promesaProcesamiento;
        } catch (error) {
            console.error(
                '[TUSA WOOD] Error al esperar el cierre del procesador:',
                error.message
            );
        }
    }

    console.log(
        '[TUSA WOOD] Procesador de reintentos detenido correctamente.'
    );
}

// =====================================================
// EXPORTAR FUNCIONES
// =====================================================

module.exports = {
    enviarCorreo,
    procesarReintentos,
    iniciarReintentosAutomaticos,
    detenerReintentosAutomaticos
};
