
const pool = require('../config/database');

// =====================================================
// LISTAR CATEGORÍAS ACTIVAS
// =====================================================
async function listarCategorias(req, res) {
    try {
        const resultado = await pool.query(`
            SELECT id_categoria, nombre, descripcion, activo
            FROM categorias
            WHERE activo = TRUE
            ORDER BY nombre ASC
        `);

        return res.status(200).json({
            estado: 'OK',
            total: resultado.rowCount,
            categorias: resultado.rows
        });
    } catch (error) {
        console.error('Error al listar categorías:', error.message);

        return res.status(500).json({
            estado: 'ERROR',
            mensaje: 'No se pudieron obtener las categorías.'
        });
    }
}

// =====================================================
// OBTENER CATEGORÍA POR ID
// =====================================================
async function obtenerCategoriaPorId(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: 'El ID de la categoría no es válido.'
            });
        }

        const resultado = await pool.query(
            `SELECT id_categoria, nombre, descripcion, activo
             FROM categorias
             WHERE id_categoria = $1
             LIMIT 1`,
            [id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                estado: 'ERROR',
                mensaje: 'La categoría no existe.'
            });
        }

        return res.status(200).json({
            estado: 'OK',
            categoria: resultado.rows[0]
        });
    } catch (error) {
        console.error('Error al obtener categoría:', error.message);

        return res.status(500).json({
            estado: 'ERROR',
            mensaje: 'No se pudo obtener la categoría.'
        });
    }
}

// =====================================================
// CREAR CATEGORÍA
// =====================================================
async function crearCategoria(req, res) {
    try {
        const nombre = typeof req.body.nombre === 'string'
            ? req.body.nombre.trim()
            : '';

        const descripcion = typeof req.body.descripcion === 'string'
            ? req.body.descripcion.trim()
            : '';

        if (!nombre) {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: 'El nombre de la categoría es obligatorio.'
            });
        }

        if (nombre.length > 100) {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: 'El nombre no puede superar los 100 caracteres.'
            });
        }

        if (descripcion.length > 500) {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: 'La descripción no puede superar los 500 caracteres.'
            });
        }

        const duplicada = await pool.query(
            `SELECT id_categoria
             FROM categorias
             WHERE LOWER(TRIM(nombre)) = LOWER($1)
             LIMIT 1`,
            [nombre]
        );

        if (duplicada.rowCount > 0) {
            return res.status(409).json({
                estado: 'ERROR',
                mensaje: 'Ya existe una categoría con ese nombre.'
            });
        }

        const resultado = await pool.query(
            `INSERT INTO categorias (nombre, descripcion, activo)
             VALUES ($1, $2, TRUE)
             RETURNING id_categoria, nombre, descripcion, activo`,
            [nombre, descripcion || null]
        );

        return res.status(201).json({
            estado: 'OK',
            mensaje: 'Categoría creada correctamente.',
            categoria: resultado.rows[0]
        });
    } catch (error) {
        console.error('Error al crear categoría:', error.message);

        return res.status(500).json({
            estado: 'ERROR',
            mensaje: 'No se pudo crear la categoría.'
        });
    }
}

// =====================================================
// ACTUALIZAR CATEGORÍA
// =====================================================
async function actualizarCategoria(req, res) {
    try {
        const id = Number(req.params.id);
        const nombre = typeof req.body.nombre === 'string'
            ? req.body.nombre.trim()
            : '';

        const descripcion = typeof req.body.descripcion === 'string'
            ? req.body.descripcion.trim()
            : '';

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: 'El ID de la categoría no es válido.'
            });
        }

        if (!nombre) {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: 'El nombre de la categoría es obligatorio.'
            });
        }

        if (nombre.length > 100 || descripcion.length > 500) {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: 'El nombre o la descripción superan la longitud permitida.'
            });
        }

        const existente = await pool.query(
            `SELECT id_categoria
             FROM categorias
             WHERE id_categoria = $1
             LIMIT 1`,
            [id]
        );

        if (existente.rowCount === 0) {
            return res.status(404).json({
                estado: 'ERROR',
                mensaje: 'La categoría no existe.'
            });
        }

        const duplicada = await pool.query(
            `SELECT id_categoria
             FROM categorias
             WHERE LOWER(TRIM(nombre)) = LOWER($1)
               AND id_categoria <> $2
             LIMIT 1`,
            [nombre, id]
        );

        if (duplicada.rowCount > 0) {
            return res.status(409).json({
                estado: 'ERROR',
                mensaje: 'Otra categoría ya utiliza ese nombre.'
            });
        }

        const resultado = await pool.query(
            `UPDATE categorias
             SET nombre = $1,
                 descripcion = $2
             WHERE id_categoria = $3
             RETURNING id_categoria, nombre, descripcion, activo`,
            [nombre, descripcion || null, id]
        );

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Categoría actualizada correctamente.',
            categoria: resultado.rows[0]
        });
    } catch (error) {
        console.error('Error al actualizar categoría:', error.message);

        return res.status(500).json({
            estado: 'ERROR',
            mensaje: 'No se pudo actualizar la categoría.'
        });
    }
}

// =====================================================
// ACTIVAR / DESACTIVAR CATEGORÍA
// =====================================================
async function cambiarEstadoCategoria(req, res) {
    try {
        const id = Number(req.params.id);
        const { activo } = req.body;

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: 'El ID de la categoría no es válido.'
            });
        }

        if (typeof activo !== 'boolean') {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: 'El campo activo debe ser true o false.'
            });
        }

        const resultado = await pool.query(
            `UPDATE categorias
             SET activo = $1
             WHERE id_categoria = $2
             RETURNING id_categoria, nombre, descripcion, activo`,
            [activo, id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                estado: 'ERROR',
                mensaje: 'La categoría no existe.'
            });
        }

        return res.status(200).json({
            estado: 'OK',
            mensaje: activo
                ? 'Categoría activada correctamente.'
                : 'Categoría desactivada correctamente.',
            categoria: resultado.rows[0]
        });
    } catch (error) {
        console.error('Error al cambiar estado:', error.message);

        return res.status(500).json({
            estado: 'ERROR',
            mensaje: 'No se pudo cambiar el estado de la categoría.'
        });
    }
}

// =====================================================
// ELIMINAR CATEGORÍA
// =====================================================
async function eliminarCategoria(req, res) {
    const cliente = await pool.connect();

    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: 'El ID de la categoría no es válido.'
            });
        }

        await cliente.query('BEGIN');

        const categoria = await cliente.query(
            `SELECT id_categoria
             FROM categorias
             WHERE id_categoria = $1
             FOR UPDATE`,
            [id]
        );

        if (categoria.rowCount === 0) {
            await cliente.query('ROLLBACK');

            return res.status(404).json({
                estado: 'ERROR',
                mensaje: 'La categoría no existe.'
            });
        }

        // No eliminar una categoría que tenga productos asociados.
        const productos = await cliente.query(
            `SELECT 1
             FROM productos
             WHERE id_categoria = $1
             LIMIT 1`,
            [id]
        );

        if (productos.rowCount > 0) {
            await cliente.query('ROLLBACK');

            return res.status(409).json({
                estado: 'ERROR',
                mensaje: 'La categoría tiene productos asociados. Desactívala en lugar de eliminarla.'
            });
        }

        await cliente.query(
            `DELETE FROM categorias
             WHERE id_categoria = $1`,
            [id]
        );

        await cliente.query('COMMIT');

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Categoría eliminada correctamente.'
        });
    } catch (error) {
        await cliente.query('ROLLBACK');

        console.error('Error al eliminar categoría:', error.message);

        return res.status(500).json({
            estado: 'ERROR',
            mensaje: 'No se pudo eliminar la categoría.'
        });
    } finally {
        cliente.release();
    }
}

async function listarTodasCategorias(req, res) {
    try {
        const resultado = await pool.query(`
            SELECT
                c.id_categoria,
                c.nombre,
                c.descripcion,
                c.activo,
                COUNT(p.id_producto)::INTEGER AS total_productos
            FROM categorias c
            LEFT JOIN productos p
                ON p.id_categoria = c.id_categoria
            GROUP BY
                c.id_categoria,
                c.nombre,
                c.descripcion,
                c.activo
            ORDER BY c.nombre ASC
        `);

        return res.status(200).json({
            estado: 'OK',
            total: resultado.rowCount,
            categorias: resultado.rows
        });
    } catch (error) {
        console.error('Error al listar todas las categorías:', error.message);

        return res.status(500).json({
            estado: 'ERROR',
            mensaje: 'No se pudieron obtener las categorías administrativas.'
        });
    }
}

module.exports = {
    listarCategorias,
    listarTodasCategorias,
    obtenerCategoriaPorId,
    crearCategoria,
    actualizarCategoria,
    cambiarEstadoCategoria,
    eliminarCategoria
};