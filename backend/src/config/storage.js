
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURACIÓN CENTRALIZADA DE ALMACENAMIENTO
// ============================================================

// STORAGE_PATH representa la carpeta raíz del almacenamiento.
// Si no se configura, se utiliza backend/storage.

const STORAGE_ROOT = path.resolve(
    process.env.STORAGE_PATH?.trim() ||
    path.resolve(__dirname, '../../storage')
);

// Carpeta exclusiva para documentos de cotizaciones.
const CARPETA_COTIZACIONES = path.join(
    STORAGE_ROOT,
    'cotizaciones'
);

// Logotipo corporativo.
const RUTA_LOGO = path.join(
    CARPETA_COTIZACIONES,
    'logo-tusa-wood.png'
);

// ============================================================
// VALIDAR QUE UNA RUTA PERTENEZCA A UNA CARPETA
// ============================================================

function rutaDentroDe(carpetaBase, rutaArchivo) {
    const base = path.resolve(carpetaBase);
    const archivo = path.resolve(rutaArchivo);

    const relativa = path.relative(base, archivo);

    return (
        relativa !== '' &&
        !relativa.startsWith('..') &&
        !path.isAbsolute(relativa)
    );
}

// ============================================================
// CREAR CARPETA DE COTIZACIONES
// ============================================================

async function prepararAlmacenamiento() {
    await fs.promises.mkdir(
        CARPETA_COTIZACIONES,
        { recursive: true }
    );

    return CARPETA_COTIZACIONES;
}

// ============================================================
// CONSTRUIR RUTA DE UN PDF
// ============================================================

function obtenerRutaPdf(nombreArchivo) {
    if (
        typeof nombreArchivo !== 'string' ||
        !nombreArchivo.trim()
    ) {
        throw new Error('El nombre del PDF no es válido.');
    }

    const nombre = path.basename(nombreArchivo);

    if (
        nombre !== nombreArchivo ||
        !nombre.toLowerCase().endsWith('.pdf')
    ) {
        throw new Error('El nombre del PDF contiene una ruta no permitida.');
    }

    const ruta = path.resolve(
        CARPETA_COTIZACIONES,
        nombre
    );

    if (!rutaDentroDe(CARPETA_COTIZACIONES, ruta)) {
        throw new Error('La ruta del PDF no está permitida.');
    }

    return ruta;
}

// ============================================================
// GENERAR RUTA RELATIVA PARA GUARDAR EN POSTGRESQL
// ============================================================

function obtenerRutaRelativaPdf(rutaArchivo) {
    const ruta = path.resolve(rutaArchivo);

    if (!rutaDentroDe(CARPETA_COTIZACIONES, ruta)) {
        throw new Error(
            'No se puede registrar un PDF fuera de la carpeta de cotizaciones.'
        );
    }

    return path.relative(STORAGE_ROOT, ruta)
        .split(path.sep)
        .join('/');
}

// ============================================================
// RESOLVER RUTA REGISTRADA EN POSTGRESQL
// ============================================================

function resolverRutaPdf(rutaRegistrada) {
    if (
        typeof rutaRegistrada !== 'string' ||
        !rutaRegistrada.trim()
    ) {
        throw new Error('La ruta registrada del PDF no es válida.');
    }

    const valor = rutaRegistrada.trim();

    // Compatibilidad con registros antiguos que contienen
    // rutas absolutas de la instalación local.
    if (path.isAbsolute(valor)) {
        const rutaAbsoluta = path.resolve(valor);

        if (!rutaDentroDe(CARPETA_COTIZACIONES, rutaAbsoluta)) {
            throw new Error(
                'La ruta histórica del PDF está fuera del almacenamiento permitido.'
            );
        }

        return rutaAbsoluta;
    }

    // Las nuevas rutas se guardan relativas a STORAGE_ROOT.
    const rutaResuelta = path.resolve(STORAGE_ROOT, valor);

    if (!rutaDentroDe(CARPETA_COTIZACIONES, rutaResuelta)) {
        throw new Error(
            'La ruta registrada intenta acceder fuera de la carpeta de cotizaciones.'
        );
    }

    return rutaResuelta;
}

// ============================================================
// EXPORTAR CONFIGURACIÓN Y FUNCIONES
// ============================================================

module.exports = {
    STORAGE_ROOT,
    CARPETA_COTIZACIONES,
    RUTA_LOGO,
    prepararAlmacenamiento,
    obtenerRutaPdf,
    obtenerRutaRelativaPdf,
    resolverRutaPdf
};
