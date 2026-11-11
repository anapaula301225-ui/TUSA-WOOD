
const pool = require('../config/database');

// ============================================================
// CONFIGURACIÓN TRIBUTARIA
// ============================================================

const TASA_IGV = 18;

const MODOS_IGV = [
    'INCLUIDO',
    'ADICIONAL'
];

// ============================================================
// VALIDAR ROL
// ============================================================

const obtenerRol = (req) => {
    return String(req.administrador?.rol || '').toUpperCase();
};

// ============================================================
// CONSULTAR CONFIGURACIÓN DEL IGV
// GET /api/admin/quote-settings
// SUPERADMIN, GERENCIA y VENTAS
// ============================================================

const obtenerConfiguracionIGV = async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT
                c.id_configuracion,
                c.modo_igv,
                c.tasa_igv,
                c.actualizado_por,
                c.actualizado_en,
                a.nombre AS administrador_actualizacion,
                a.correo AS correo_administrador
            FROM configuracion_cotizaciones c
            LEFT JOIN administradores a
                ON a.id_administrador = c.actualizado_por
            WHERE c.id_configuracion = 1
            LIMIT 1;
        `);

        if (resultado.rows.length === 0) {
            return res.status(200).json({
                estado: 'SIN_CONFIGURACION',
                mensaje: 'La modalidad del IGV todavía no ha sido configurada.',
                configuracion: null,
                tasa_igv: TASA_IGV
            });
        }

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Configuración tributaria obtenida correctamente',
            configuracion: resultado.rows[0]
        });

    } catch (error) {
        console.error('Error al consultar configuración IGV:', error);

        return res.status(500).json({
            estado: 'ERROR',
            mensaje: 'No se pudo obtener la configuración tributaria'
        });
    }
};

// ============================================================
// ACTUALIZAR CONFIGURACIÓN DEL IGV
// PUT /api/admin/quote-settings
// SUPERADMIN y GERENCIA
// ============================================================

const actualizarConfiguracionIGV = async (req, res) => {
    const rol = obtenerRol(req);

    if (!['SUPERADMIN', 'GERENCIA'].includes(rol)) {
        return res.status(403).json({
            estado: 'ERROR',
            mensaje: 'No tienes permisos para modificar la configuración tributaria'
        });
    }

    const { modo_igv } = req.body || {};

    if (
        typeof modo_igv !== 'string' ||
        !MODOS_IGV.includes(modo_igv.trim().toUpperCase())
    ) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'La modalidad debe ser INCLUIDO o ADICIONAL'
        });
    }

    const modoNormalizado = modo_igv.trim().toUpperCase();

    const idAdministrador =
        req.administrador?.id_administrador;

    if (
        !Number.isSafeInteger(Number(idAdministrador)) ||
        Number(idAdministrador) <= 0
    ) {
        return res.status(401).json({
            estado: 'ERROR',
            mensaje: 'No se pudo identificar al administrador que realiza el cambio'
        });
    }

    try {
        const resultado = await pool.query(
            `
                INSERT INTO configuracion_cotizaciones (
                    id_configuracion,
                    modo_igv,
                    tasa_igv,
                    actualizado_por,
                    actualizado_en
                )
                VALUES (1, $1, $2, $3, CURRENT_TIMESTAMP)

                ON CONFLICT (id_configuracion)
                DO UPDATE SET
                    modo_igv = EXCLUDED.modo_igv,
                    tasa_igv = EXCLUDED.tasa_igv,
                    actualizado_por = EXCLUDED.actualizado_por,
                    actualizado_en = CURRENT_TIMESTAMP

                RETURNING
                    id_configuracion,
                    modo_igv,
                    tasa_igv,
                    actualizado_por,
                    actualizado_en;
            `,
            [
                modoNormalizado,
                TASA_IGV,
                Number(idAdministrador)
            ]
        );

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Configuración tributaria actualizada correctamente',
            configuracion: resultado.rows[0]
        });

    } catch (error) {
        console.error('Error al actualizar configuración IGV:', error);

        return res.status(500).json({
            estado: 'ERROR',
            mensaje: 'No se pudo actualizar la configuración tributaria'
        });
    }
};

// ============================================================
// EXPORTAR FUNCIONES
// ============================================================

module.exports = {
    obtenerConfiguracionIGV,
    actualizarConfiguracionIGV
};
