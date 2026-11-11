
// =====================================================
// CARGAR VARIABLES DE ENTORNO
// =====================================================

const path = require('path');

require('dotenv').config({
    path: path.resolve(__dirname, '../../.env')
});

// =====================================================
// IMPORTAR POSTGRESQL
// =====================================================

const { Pool } = require('pg');

// =====================================================
// CONFIGURACIÓN DEL PUERTO
// =====================================================

const puertoDB = Number(process.env.DB_PORT || 5432);

if (
    !Number.isInteger(puertoDB) ||
    puertoDB < 1 ||
    puertoDB > 65535
) {
    throw new Error(
        'DB_PORT debe ser un número entero válido entre 1 y 65535.'
    );
}

// =====================================================
// CONFIGURACIÓN SSL
// =====================================================

// En Neon: DB_SSL=true
// En PostgreSQL local: DB_SSL=false

const sslHabilitado =
    String(process.env.DB_SSL || 'false').toLowerCase() === 'true';

// =====================================================
// CONFIGURACIÓN DE CONEXIÓN
// =====================================================

const configuracion = {
    host: process.env.DB_HOST,
    port: puertoDB,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,

    // Configuración SSL para conexiones remotas.
    ssl: sslHabilitado
        ? { rejectUnauthorized: true }
        : false,

    // Límite máximo de conexiones simultáneas.
    max: 10,

    // Tiempo máximo de conexión inactiva.
    idleTimeoutMillis: 30000,

    // Tiempo máximo para obtener una conexión.
    connectionTimeoutMillis: 10000,

    // Identificador de la aplicación en PostgreSQL.
    application_name: 'TUSA_WOOD_API'
};

// =====================================================
// VALIDAR VARIABLES OBLIGATORIAS
// =====================================================

const variablesFaltantes = [];

if (
    typeof configuracion.host !== 'string' ||
    !configuracion.host.trim()
) {
    variablesFaltantes.push('DB_HOST');
}

if (
    typeof configuracion.database !== 'string' ||
    !configuracion.database.trim()
) {
    variablesFaltantes.push('DB_NAME');
}

if (
    typeof configuracion.user !== 'string' ||
    !configuracion.user.trim()
) {
    variablesFaltantes.push('DB_USER');
}

if (
    typeof configuracion.password !== 'string' ||
    configuracion.password.length === 0
) {
    variablesFaltantes.push('DB_PASSWORD');
}

if (variablesFaltantes.length > 0) {
    throw new Error(
        `Faltan variables de entorno para PostgreSQL: ${variablesFaltantes.join(', ')}. Revisa el archivo .env.`
    );
}

// =====================================================
// CREAR POOL DE CONEXIONES
// =====================================================

const pool = new Pool(configuracion);

// =====================================================
// CONTROLAR ERRORES DEL POOL
// =====================================================

pool.on('error', (error) => {
    console.error(
        '[TUSA WOOD] Error inesperado en el pool de PostgreSQL:',
        error.message
    );
});

// =====================================================
// EXPORTAR CONEXIÓN
// =====================================================

module.exports = pool;
