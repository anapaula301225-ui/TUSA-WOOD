
'use strict';

const path = require('path');

// =====================================================
// CONFIGURACIÓN DEL ENTORNO DE PRUEBAS
// =====================================================

require('dotenv').config({
    path: path.resolve(__dirname, '../.env')
});

// Esta prueba SIEMPRE debe utilizar la base independiente.
process.env.DB_NAME = 'tusa_wood_test_db';

// SMTP local cerrado: no permite enviar correos reales.
process.env.EMAIL_ENABLED = 'true';
process.env.NODE_ENV = 'development';
process.env.EMAIL_PROVIDER = 'smtp';

process.env.EMAIL_HOST = '127.0.0.1';
process.env.EMAIL_PORT = '1';
process.env.EMAIL_USER = 'prueba@localhost';
process.env.EMAIL_PASSWORD = 'clave-simulada';
process.env.EMAIL_SECURE = 'false';

process.env.EMAIL_FROM_NAME = 'TUSA WOOD - Pruebas';
process.env.EMAIL_FROM_ADDRESS = 'prueba@localhost';

// =====================================================
// IMPORTACIONES
// =====================================================

const pool = require('../src/config/database');

const {
    procesarReintentos
} = require('../src/services/email.service');

// =====================================================
// CONSTANTES
// =====================================================

const BASE_DATOS_ESPERADA = 'tusa_wood_test_db';

const DESTINATARIO_PRUEBA = 'prueba-reintentos@localhost';

const ASUNTO_PRUEBA = '[PRUEBA] Reintentos controlados TUSA WOOD';

const MAX_INTENTOS_ESPERADOS = 3;

// =====================================================
// VERIFICAR BASE DE DATOS
// =====================================================

async function verificarBaseDeDatos() {
    const resultado = await pool.query(
        `
            SELECT
                current_database() AS base_datos,
                COUNT(*) AS total_notificaciones
            FROM notificaciones_email
        `
    );

    const informacion = resultado.rows[0];

    console.log('\n======================================');
    console.log('VERIFICACIÓN DE BASE DE DATOS');
    console.log('======================================');

    console.log('Base conectada:', informacion.base_datos);
    console.log('Notificaciones existentes:', informacion.total_notificaciones);

    if (informacion.base_datos !== BASE_DATOS_ESPERADA) {
        throw new Error(
            'Conexión rechazada: la base de datos no es la base exclusiva de pruebas.'
        );
    }

    if (Number(informacion.total_notificaciones) !== 0) {
        throw new Error(
            'La base de pruebas contiene notificaciones previas. No se realizará ninguna modificación.'
        );
    }

    console.log('[OK] Base de datos independiente confirmada.');
}

// =====================================================
// CREAR NOTIFICACIÓN DE PRUEBA
// =====================================================

async function crearNotificacionPrueba() {
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
                NULL,
                NULL,
                NULL,
                $1,
                $2,
                'PENDIENTE',
                NULL,
                0,
                NULL,
                NOW(),
                $3,
                NULL,
                NOW(),
                NULL
            )
            RETURNING id_notificacion
        `,
        [
            DESTINATARIO_PRUEBA,
            ASUNTO_PRUEBA,
            'Mensaje ficticio para verificar los reintentos automáticos.'
        ]
    );

    const id = resultado.rows[0].id_notificacion;

    console.log('\n[OK] Notificación de prueba creada.');
    console.log('ID:', id);

    return id;
}

// =====================================================
// CONSULTAR RESULTADO DE UN INTENTO
// =====================================================

async function obtenerResultado(idNotificacion) {
    const resultado = await pool.query(
        `
            SELECT
                id_notificacion,
                destinatario,
                estado,
                intentos,
                ultimo_intento_en,
                proximo_intento_en,
                error_detalle
            FROM notificaciones_email
            WHERE id_notificacion = $1
              AND destinatario = $2
              AND asunto = $3
        `,
        [
            idNotificacion,
            DESTINATARIO_PRUEBA,
            ASUNTO_PRUEBA
        ]
    );

    if (!resultado.rows.length) {
        throw new Error(
            'No se encontró la notificación creada por esta prueba.'
        );
    }

    return resultado.rows[0];
}

// =====================================================
// EJECUTAR TRES INTENTOS CONTROLADOS
// =====================================================

async function ejecutarPruebas(idNotificacion) {
    console.log('\n======================================');
    console.log('INICIANDO PRUEBA DE REINTENTOS');
    console.log('======================================');

    console.log('SMTP configurado: 127.0.0.1:1');
    console.log('Correos reales: DESACTIVADOS');
    console.log('Intentos esperados:', MAX_INTENTOS_ESPERADOS);

    for (
        let numero = 1;
        numero <= MAX_INTENTOS_ESPERADOS;
        numero++
    ) {
        console.log(`\n---------- INTENTO ${numero} DE 3 ----------`);

        // Solo se modifica la fecha de nuestra notificación.
        // Así no esperamos los cinco minutos de producción.
        if (numero > 1) {
            await pool.query(
                `
                    UPDATE notificaciones_email
                    SET proximo_intento_en = NOW()
                    WHERE id_notificacion = $1
                      AND destinatario = $2
                      AND asunto = $3
                      AND estado = 'PENDIENTE'
                `,
                [
                    idNotificacion,
                    DESTINATARIO_PRUEBA,
                    ASUNTO_PRUEBA
                ]
            );
        }

        // El procesador real trabaja exclusivamente
        // sobre la base de datos independiente.
        await procesarReintentos();

        const fila = await obtenerResultado(idNotificacion);

        console.log('Estado:', fila.estado);
        console.log('Intentos registrados:', fila.intentos);
        console.log('Último intento:', fila.ultimo_intento_en);
        console.log('Error SMTP:', fila.error_detalle);

        if (Number(fila.intentos) !== numero) {
            throw new Error(
                `Se esperaba el intento ${numero}, pero se registraron ${fila.intentos}.`
            );
        }

        if (numero < MAX_INTENTOS_ESPERADOS) {
            if (fila.estado !== 'PENDIENTE') {
                throw new Error(
                    `Estado inesperado en el intento ${numero}: ${fila.estado}.`
                );
            }

            console.log('[OK] Reintento pendiente correctamente registrado.');

        } else {
            if (fila.estado !== 'ERROR') {
                throw new Error(
                    `Se esperaba ERROR al tercer intento. Estado obtenido: ${fila.estado}.`
                );
            }

            console.log('[OK] Se alcanzó el estado ERROR después del tercer intento.');
        }
    }
}

// =====================================================
// LIMPIAR ÚNICAMENTE EL REGISTRO DE ESTA PRUEBA
// =====================================================

async function limpiarNotificacion(idNotificacion) {
    if (!idNotificacion) {
        return;
    }

    const resultado = await pool.query(
        `
            DELETE FROM notificaciones_email
            WHERE id_notificacion = $1
              AND destinatario = $2
              AND asunto = $3
        `,
        [
            idNotificacion,
            DESTINATARIO_PRUEBA,
            ASUNTO_PRUEBA
        ]
    );

    if (resultado.rowCount !== 1) {
        throw new Error(
            'No se pudo confirmar la eliminación exclusiva del registro de prueba.'
        );
    }

    console.log('\n[OK] Notificación de prueba eliminada.');
}

// =====================================================
// EJECUCIÓN PRINCIPAL
// =====================================================

async function probarReintentos() {
    let idNotificacion = null;
    let pruebaCorrecta = false;

    try {
        await verificarBaseDeDatos();

        idNotificacion = await crearNotificacionPrueba();

        await ejecutarPruebas(idNotificacion);

        pruebaCorrecta = true;

        console.log('\n======================================');
        console.log('PRUEBA COMPLETADA CORRECTAMENTE');
        console.log('======================================');

        console.log('Intentos verificados: 3');
        console.log('Estado final verificado: ERROR');
        console.log('Envíos reales realizados: 0');

    } catch (error) {
        console.error('\n======================================');
        console.error('ERROR EN LA PRUEBA');
        console.error('======================================');

        console.error(error.message);

        process.exitCode = 1;

    } finally {
        try {
            await limpiarNotificacion(idNotificacion);
        } catch (error) {
            console.error(
                '[ERROR] No se pudo limpiar el registro de prueba:',
                error.message
            );

            process.exitCode = 1;
        }

        try {
            await pool.end();
        } catch (error) {
            console.error(
                '[ERROR] No se pudo cerrar la conexión:',
                error.message
            );

            process.exitCode = 1;
        }

        if (pruebaCorrecta && process.exitCode !== 1) {
            console.log('\n[OK] Conexión cerrada correctamente.');
            console.log('[OK] Base de pruebas lista para verificaciones posteriores.');
        }
    }
}

probarReintentos();
