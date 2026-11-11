
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const pool = require('./config/database');

// ======================================================
// IMPORTAR RUTAS
// ======================================================

const healthRoutes = require('./routes/health.routes');
const categoriesRoutes = require('./routes/categories.routes');
const productsRoutes = require('./routes/products.routes');
const quotesRoutes = require('./routes/quotes.routes');
const authRoutes = require('./routes/auth.routes');

const adminQuotesRoutes = require('./routes/admin-quotes.routes');
const adminProductsRoutes = require('./routes/admin-products.routes');
const adminUsersRoutes = require('./routes/admin-users.routes');
const adminRoutes = require('./routes/admin.routes');
const quoteSettingsRoutes = require('./routes/quote-settings.routes');
const quoteVersionsRoutes = require('./routes/quote-versions.routes');
const servicesRoutes = require('./routes/services.routes');

// ======================================================
// SERVICIO DE CORREO
// ======================================================

const {
    iniciarReintentosAutomaticos,
    detenerReintentosAutomaticos
} = require('./services/email.service');

// ======================================================
// CONFIGURACIÓN
// ======================================================

const app = express();

const PORT = Number(process.env.PORT || 3000);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT debe ser un número entero válido entre 1 y 65535.');
}

const entornoProduccion = process.env.NODE_ENV === 'production';

// ======================================================
// ORÍGENES AUTORIZADOS PARA CORS
// ======================================================

function obtenerOrigenesPermitidos() {
    const configuracion = process.env.FRONTEND_URL ||
        'http://localhost:5173';

    const origenes = configuracion
        .split(',')
        .map(origen => origen.trim())
        .filter(Boolean);

    if (origenes.length === 0) {
        throw new Error(
            'FRONTEND_URL debe contener al menos un origen autorizado.'
        );
    }

    for (const origen of origenes) {
        let url;

        try {
            url = new URL(origen);
        } catch {
            throw new Error(
                `FRONTEND_URL contiene un origen inválido: ${origen}`
            );
        }

        if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.origin !== origen
        ) {
            throw new Error(
                `FRONTEND_URL debe contener orígenes completos sin rutas: ${origen}`
            );
        }

        if (
            entornoProduccion &&
            url.protocol !== 'https:'
        ) {
            throw new Error(
                'En producción, los orígenes de FRONTEND_URL deben utilizar HTTPS.'
            );
        }
    }

    return origenes;
}

const origenesPermitidos = obtenerOrigenesPermitidos();

// ======================================================
// SEGURIDAD Y REGISTRO DE SOLICITUDES
// ======================================================

app.disable('x-powered-by');

app.use((req, res, next) => {
    const inicio = Date.now();

    res.on('finish', () => {
        const duracion = Date.now() - inicio;

        console.log(
            `[${new Date().toISOString()}] ` +
            `${req.method} ${req.path} ` +
            `${res.statusCode} ${duracion}ms`
        );
    });

    next();
});

// ======================================================
// CONFIGURACIÓN GENERAL
// ======================================================

app.use(
    helmet({
        contentSecurityPolicy: entornoProduccion ? undefined : false
    })
);

app.use(
    cors({
        origin(origen, callback) {
            // Las solicitudes sin Origin incluyen algunos clientes
            // de servidor a servidor y herramientas de diagnóstico.
            if (!origen) {
                return callback(null, true);
            }

            if (origenesPermitidos.includes(origen)) {
                return callback(null, true);
            }

            const error = new Error(
                'Origen no autorizado por la política CORS.'
            );

            error.status = 403;

            return callback(error);
        },
        methods: [
            'GET',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'OPTIONS'
        ],
        allowedHeaders: [
            'Content-Type',
            'Authorization'
        ],
        credentials: false,
        maxAge: 86400
    })
);

app.use(express.json({
    limit: '1mb'
}));

app.use(express.urlencoded({
    extended: true,
    limit: '1mb'
}));

// ======================================================
// RUTA PRINCIPAL
// ======================================================

app.get('/', (req, res) => {
    res.json({
        proyecto: 'TUSA WOOD',
        mensaje: 'API comercial funcionando',
        estado: 'OK'
    });
});

// ======================================================
// RUTAS DE LA API
// ======================================================

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/services', servicesRoutes);

app.use('/api/quotes', quotesRoutes);

// ======================================================
// RUTAS ADMINISTRATIVAS
// ======================================================

app.use('/api/admin/quotes', adminQuotesRoutes);
app.use('/api/admin/products', adminProductsRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/quote-settings', quoteSettingsRoutes);
app.use('/api/admin', quoteVersionsRoutes);
app.use('/api/admin', adminRoutes);

// ======================================================
// RUTA NO ENCONTRADA
// ======================================================

app.use((req, res) => {
    res.status(404).json({
        estado: 'ERROR',
        mensaje: 'No se encontró el recurso solicitado.'
    });
});

// ======================================================
// MANEJADOR GENERAL DE ERRORES
// ======================================================

app.use((error, req, res, next) => {
    console.error('[TUSA WOOD] Error del servidor:', {
        metodo: req.method,
        ruta: req.path,
        mensaje: error.message,
        fecha: new Date().toISOString()
    });

    if (res.headersSent) {
        return next(error);
    }

    const estado = Number(error.status || error.statusCode);

    if (estado === 413) {
        return res.status(413).json({
            estado: 'ERROR',
            mensaje: 'La información enviada es demasiado grande.'
        });
    }

    if (estado === 400 || error.type === 'entity.parse.failed') {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'No pudimos procesar la información enviada.'
        });
    }

    if (estado === 403) {
        return res.status(403).json({
            estado: 'ERROR',
            mensaje: 'El origen de la solicitud no está autorizado.'
        });
    }

    return res.status(500).json({
        estado: 'ERROR',
        mensaje: 'Ocurrió un inconveniente al procesar tu solicitud.'
    });
});

// ======================================================
// INICIAR SERVIDOR
// ======================================================

let servidor = null;
let apagadoEnCurso = false;

async function iniciarServidor() {
    if (servidor) {
        return servidor;
    }

    try {
        await pool.query('SELECT 1');

        servidor = await new Promise((resolve, reject) => {
            const instancia = app.listen(PORT);

            instancia.once('listening', () => {
                resolve(instancia);
            });

            instancia.once('error', reject);
        });

        console.log('');
        console.log('======================================');
        console.log('       TUSA WOOD - BACKEND API');
        console.log('======================================');
        console.log(`Puerto: ${PORT}`);
        console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
        console.log('Base de datos: PostgreSQL conectada');
        console.log('Estado: API disponible');
        console.log('======================================');
        console.log('');

        try {
            iniciarReintentosAutomaticos();

            console.log(
                '[CORREO] Procesador automático de reintentos iniciado.'
            );
        } catch (error) {
            console.error(
                '[CORREO] No se pudo iniciar el procesador:',
                error.message
            );
        }

        return servidor;

    } catch (error) {
        console.error(
            '[INICIO] No se pudo iniciar el backend:',
            error.message
        );

        if (servidor) {
            await new Promise(resolve => {
                servidor.close(() => resolve());
            });

            servidor = null;
        }

        throw error;
    }
}

// ======================================================
// CIERRE ORDENADO
// ======================================================

async function cerrarServidor(signal = 'MANUAL') {
    if (apagadoEnCurso) {
        console.log(
            '[CIERRE] Ya existe un proceso de apagado en ejecución.'
        );

        return;
    }

    apagadoEnCurso = true;

    console.log('');
    console.log('======================================');
    console.log(`[CIERRE] Señal recibida: ${signal}`);
    console.log('[CIERRE] Deteniendo TUSA WOOD...');
    console.log('======================================');

    let errorCierre = false;

    // 1. Detener el worker y esperar los correos en proceso.
    try {
        await detenerReintentosAutomaticos();
    } catch (error) {
        errorCierre = true;

        console.error(
            '[CIERRE] Error al detener el procesador de correos:',
            error.message
        );
    }

    // 2. Cerrar el servidor HTTP.
    if (servidor) {
        try {
            await new Promise((resolve, reject) => {
                servidor.close(error => {
                    if (error) {
                        return reject(error);
                    }

                    resolve();
                });
            });

            servidor = null;

            console.log(
                '[CIERRE] Servidor HTTP cerrado correctamente.'
            );
        } catch (error) {
            errorCierre = true;

            console.error(
                '[CIERRE] Error al cerrar el servidor HTTP:',
                error.message
            );
        }
    }

    // 3. Cerrar el pool de PostgreSQL.
    try {
        await pool.end();

        console.log(
            '[CIERRE] Conexiones PostgreSQL cerradas correctamente.'
        );
    } catch (error) {
        errorCierre = true;

        console.error(
            '[CIERRE] Error al cerrar PostgreSQL:',
            error.message
        );
    }

    console.log('======================================');

    if (errorCierre) {
        console.error(
            '[CIERRE] El servidor terminó con errores de apagado.'
        );

        process.exitCode = 1;
    } else {
        console.log(
            '[CIERRE] TUSA WOOD se cerró correctamente.'
        );
    }

    console.log('======================================');
}

// ======================================================
// MANEJO DE SEÑALES DEL SISTEMA
// ======================================================

process.on('SIGINT', () => {
    cerrarServidor('SIGINT').catch(error => {
        console.error(
            '[CIERRE] Error inesperado:',
            error.message
        );

        process.exitCode = 1;
    });
});

process.on('SIGTERM', () => {
    cerrarServidor('SIGTERM').catch(error => {
        console.error(
            '[CIERRE] Error inesperado:',
            error.message
        );

        process.exitCode = 1;
    });
});

// ======================================================
// INICIO AUTOMÁTICO AL EJECUTAR ESTE ARCHIVO
// ======================================================

if (require.main === module) {
    iniciarServidor().catch(error => {
        console.error(
            '[INICIO] Error fatal:',
            error.message
        );

        process.exitCode = 1;
    });
}

// ======================================================
// EXPORTAR APLICACIÓN Y FUNCIONES
// ======================================================

module.exports = {
    app,
    iniciarServidor,
    cerrarServidor
};
