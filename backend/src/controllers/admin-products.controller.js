
const pool = require('../config/database');

const CAMPOS_MEDIDA = [
    'largo_cm',
    'ancho_cm',
    'alto_cm',
    'capacidad_kg'
];

function validarId(id) {
    return /^\d+$/.test(String(id)) && Number(id) > 0;
}

function responderErrorBD(res, error, mensajeGeneral) {
    if (error.code === '23505') {
        return res.status(409).json({
            estado: 'ERROR',
            mensaje: 'Ya existe un producto con ese código.'
        });
    }

    if (error.code === '23503') {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'La categoría seleccionada no existe.'
        });
    }

    if (error.code === '23514' || error.code === '22P02') {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'Los datos proporcionados no cumplen las validaciones.'
        });
    }

    console.error('[TUSA WOOD] Error en productos:', error.message);

    return res.status(500).json({
        estado: 'ERROR',
        mensaje: mensajeGeneral
    });
}

// =====================================================
// VALIDAR DATOS DEL PRODUCTO
// =====================================================
function validarDatosProducto(body, parcial = false) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'El cuerpo de la solicitud debe ser un objeto JSON.';
    }

    const camposPermitidos = [
        'id_categoria',
        'codigo',
        'nombre',
        'descripcion',
        'material',
        'largo_cm',
        'ancho_cm',
        'alto_cm',
        'capacidad_kg',
        'imagen_url',
        'destacado',
        'activo'
    ];

    const desconocidos = Object.keys(body).filter(
        campo => !camposPermitidos.includes(campo)
    );

    if (desconocidos.length > 0) {
        return `Campo(s) no permitido(s): ${desconocidos.join(', ')}.`;
    }

    const obligatorios = ['codigo', 'nombre', 'material'];

    for (const campo of obligatorios) {
        if (!parcial && body[campo] === undefined) {
            return `El campo ${campo} es obligatorio.`;
        }

        if (
            body[campo] !== undefined &&
            (typeof body[campo] !== 'string' || !body[campo].trim())
        ) {
            return `El campo ${campo} debe contener texto.`;
        }
    }

    if (body.codigo !== undefined && body.codigo.trim().length > 30) {
        return 'El código no puede superar los 30 caracteres.';
    }

    if (body.nombre !== undefined && body.nombre.trim().length > 150) {
        return 'El nombre no puede superar los 150 caracteres.';
    }

    if (body.material !== undefined && body.material.trim().length > 100) {
        return 'El material no puede superar los 100 caracteres.';
    }

    for (const campo of ['descripcion', 'imagen_url']) {
        if (
            body[campo] !== undefined &&
            body[campo] !== null &&
            typeof body[campo] !== 'string'
        ) {
            return `El campo ${campo} debe ser texto o null.`;
        }
    }

    if (body.id_categoria !== undefined && body.id_categoria !== null) {
        if (!validarId(body.id_categoria)) {
            return 'El identificador de categoría no es válido.';
        }
    }

    for (const campo of CAMPOS_MEDIDA) {
        if (body[campo] === undefined || body[campo] === null) {
            continue;
        }

        const valor = body[campo];

        if (
            valor === '' ||
            (typeof valor !== 'number' && typeof valor !== 'string') ||
            !Number.isFinite(Number(valor)) ||
            Number(valor) <= 0
        ) {
            return `El campo ${campo} debe ser un número positivo o null.`;
        }
    }

    if (
        body.destacado !== undefined &&
        typeof body.destacado !== 'boolean'
    ) {
        return 'El campo destacado debe ser true o false.';
    }

    if (
        body.activo !== undefined &&
        typeof body.activo !== 'boolean'
    ) {
        return 'El campo activo debe ser true o false.';
    }

    return null;
}

// =====================================================
// LISTAR PRODUCTOS ADMINISTRATIVOS
// GET /api/admin/products
// =====================================================
async function listarProductosAdmin(req, res) {
    try {
        const {
            buscar,
            categoria,
            activo = 'todos',
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
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: 'La página o el límite no son válidos.'
            });
        }

        if (!['todos', 'true', 'false'].includes(activo)) {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: 'El filtro activo debe ser todos, true o false.'
            });
        }

        const condiciones = [];
        const parametros = [];

        if (activo !== 'todos') {
            parametros.push(activo === 'true');
            condiciones.push(`p.activo = $${parametros.length}`);
        }

        if (buscar && buscar.trim()) {
            parametros.push(`%${buscar.trim()}%`);

            condiciones.push(`(
                p.codigo ILIKE $${parametros.length}
                OR p.nombre ILIKE $${parametros.length}
                OR COALESCE(p.descripcion, '') ILIKE $${parametros.length}
                OR p.material ILIKE $${parametros.length}
            )`);
        }

        if (categoria !== undefined) {
            if (!validarId(categoria)) {
                return res.status(400).json({
                    estado: 'ERROR',
                    mensaje: 'El identificador de categoría no es válido.'
                });
            }

            parametros.push(Number(categoria));
            condiciones.push(`p.id_categoria = $${parametros.length}`);
        }

        const where = condiciones.length
            ? `WHERE ${condiciones.join(' AND ')}`
            : '';

        const consultaTotal = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM productos p
             ${where}`,
            parametros
        );

        const total = consultaTotal.rows[0].total;
        const offset = (numeroPagina - 1) * cantidad;

        const parametrosLista = [...parametros, cantidad, offset];

        const resultado = await pool.query(
            `SELECT
                p.id_producto,
                p.id_categoria,
                c.nombre AS categoria,
                p.codigo,
                p.nombre,
                p.descripcion,
                p.material,
                p.largo_cm,
                p.ancho_cm,
                p.alto_cm,
                p.capacidad_kg,
                p.imagen_url,
                p.destacado,
                p.activo,
                p.creado_en,
                p.actualizado_en
             FROM productos p
             LEFT JOIN categorias c
                ON c.id_categoria = p.id_categoria
             ${where}
             ORDER BY p.creado_en DESC, p.id_producto DESC
             LIMIT $${parametrosLista.length - 1}
             OFFSET $${parametrosLista.length}`,
            parametrosLista
        );

        return res.status(200).json({
            estado: 'OK',
            productos: resultado.rows,
            paginacion: {
                pagina: numeroPagina,
                limite: cantidad,
                total,
                total_paginas: Math.ceil(total / cantidad)
            }
        });
    } catch (error) {
        return responderErrorBD(
            res,
            error,
            'No se pudieron consultar los productos.'
        );
    }
}

// =====================================================
// OBTENER TOTAL GENERAL DE PRODUCTOS
// GET /api/admin/products/total
// Devuelve únicamente un conteo, sin exponer productos.
// =====================================================
async function obtenerTotalProductosAdmin(req, res) {
    try {
        const resultado = await pool.query(
            `SELECT COUNT(*)::INTEGER AS total
             FROM productos`
        );

        return res.status(200).json({
            estado: 'OK',
            total: resultado.rows[0].total
        });
    } catch (error) {
        return responderErrorBD(
            res,
            error,
            'No se pudo obtener el total general de productos.'
        );
    }
}

// =====================================================
// OBTENER PRODUCTO POR ID
// GET /api/admin/products/:id
// =====================================================
async function obtenerProductoAdmin(req, res) {
    const { id } = req.params;

    if (!validarId(id)) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'El identificador del producto no es válido.'
        });
    }

    try {
        const resultado = await pool.query(
            `SELECT
                p.id_producto,
                p.id_categoria,
                c.nombre AS categoria,
                p.codigo,
                p.nombre,
                p.descripcion,
                p.material,
                p.largo_cm,
                p.ancho_cm,
                p.alto_cm,
                p.capacidad_kg,
                p.imagen_url,
                p.destacado,
                p.activo,
                p.creado_en,
                p.actualizado_en
             FROM productos p
             LEFT JOIN categorias c
                ON c.id_categoria = p.id_categoria
             WHERE p.id_producto = $1`,
            [Number(id)]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                estado: 'ERROR',
                mensaje: 'No se encontró el producto.'
            });
        }

        return res.status(200).json({
            estado: 'OK',
            producto: resultado.rows[0]
        });
    } catch (error) {
        return responderErrorBD(
            res,
            error,
            'No se pudo consultar el producto.'
        );
    }
}

// =====================================================
// REGISTRAR PRODUCTO
// POST /api/admin/products
// =====================================================
async function crearProducto(req, res) {
    const errorValidacion = validarDatosProducto(req.body);

    if (errorValidacion) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: errorValidacion
        });
    }

    const {
        id_categoria = null,
        codigo,
        nombre,
        descripcion = null,
        material = 'Madera',
        largo_cm = null,
        ancho_cm = null,
        alto_cm = null,
        capacidad_kg = null,
        imagen_url = null,
        destacado = false,
        activo = true
    } = req.body;

    try {
        if (id_categoria !== null) {
            const categoria = await pool.query(
                `SELECT id_categoria
                 FROM categorias
                 WHERE id_categoria = $1 AND activo = TRUE`,
                [Number(id_categoria)]
            );

            if (categoria.rows.length === 0) {
                return res.status(400).json({
                    estado: 'ERROR',
                    mensaje: 'La categoría no existe o está inactiva.'
                });
            }
        }

        const resultado = await pool.query(
            `INSERT INTO productos (
                id_categoria,
                codigo,
                nombre,
                descripcion,
                material,
                largo_cm,
                ancho_cm,
                alto_cm,
                capacidad_kg,
                imagen_url,
                destacado,
                activo
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [
                id_categoria === null ? null : Number(id_categoria),
                codigo.trim(),
                nombre.trim(),
                descripcion?.trim() || null,
                material.trim(),
                largo_cm ?? null,
                ancho_cm ?? null,
                alto_cm ?? null,
                capacidad_kg ?? null,
                imagen_url?.trim() || null,
                destacado,
                activo
            ]
        );

        return res.status(201).json({
            estado: 'OK',
            mensaje: 'Producto registrado correctamente.',
            producto: resultado.rows[0]
        });
    } catch (error) {
        return responderErrorBD(
            res,
            error,
            'No se pudo registrar el producto.'
        );
    }
}

// =====================================================
// ACTUALIZAR PRODUCTO
// PUT /api/admin/products/:id
// =====================================================
async function actualizarProducto(req, res) {
    const { id } = req.params;

    if (!validarId(id)) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'El identificador del producto no es válido.'
        });
    }

    // Obtener el producto existente
    try {
        const existente = await pool.query(
            `SELECT *
             FROM productos
             WHERE id_producto = $1`,
            [Number(id)]
        );

        if (existente.rows.length === 0) {
            return res.status(404).json({
                estado: 'ERROR',
                mensaje: 'No se encontró el producto.'
            });
        }

        const productoActual = existente.rows[0];

        // Campos que realmente se pueden modificar
        const camposEditables = [
            'id_categoria',
            'codigo',
            'nombre',
            'descripcion',
            'material',
            'largo_cm',
            'ancho_cm',
            'alto_cm',
            'capacidad_kg',
            'imagen_url',
            'destacado',
            'activo'
        ];

        // Eliminar los campos que devuelve la consulta
        // pero que no deben enviarse como datos editables.
        const {
            id_producto,
            categoria,
            creado_en,
            actualizado_en,
            ...datosRecibidos
        } = req.body || {};

        // Rechazar otros campos que no estén permitidos
        const desconocidos = Object.keys(datosRecibidos).filter(
            campo => !camposEditables.includes(campo)
        );

        if (desconocidos.length > 0) {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: `Campo(s) no permitido(s): ${desconocidos.join(', ')}.`
            });
        }

        // Combinar los datos existentes con los nuevos.
        // Así se conservan los campos que el formulario no envíe.
        const datos = {};

        for (const campo of camposEditables) {
            datos[campo] =
                datosRecibidos[campo] !== undefined
                    ? datosRecibidos[campo]
                    : productoActual[campo];
        }

        const errorValidacion = validarDatosProducto(datos);

        if (errorValidacion) {
            return res.status(400).json({
                estado: 'ERROR',
                mensaje: errorValidacion
            });
        }

        if (datos.id_categoria !== null) {
            if (!validarId(datos.id_categoria)) {
                return res.status(400).json({
                    estado: 'ERROR',
                    mensaje: 'El identificador de categoría no es válido.'
                });
            }

            const categoriaExiste = await pool.query(
                `SELECT id_categoria
                 FROM categorias
                 WHERE id_categoria = $1
                   AND activo = TRUE`,
                [Number(datos.id_categoria)]
            );

            if (categoriaExiste.rows.length === 0) {
                return res.status(400).json({
                    estado: 'ERROR',
                    mensaje: 'La categoría no existe o está inactiva.'
                });
            }
        }

        const resultado = await pool.query(
            `UPDATE productos
             SET id_categoria = $1,
                 codigo = $2,
                 nombre = $3,
                 descripcion = $4,
                 material = $5,
                 largo_cm = $6,
                 ancho_cm = $7,
                 alto_cm = $8,
                 capacidad_kg = $9,
                 imagen_url = $10,
                 destacado = $11,
                 activo = $12,
                 actualizado_en = CURRENT_TIMESTAMP
             WHERE id_producto = $13
             RETURNING *`,
            [
                datos.id_categoria === null
                    ? null
                    : Number(datos.id_categoria),
                datos.codigo.trim(),
                datos.nombre.trim(),
                datos.descripcion?.trim() || null,
                datos.material.trim(),
                datos.largo_cm ?? null,
                datos.ancho_cm ?? null,
                datos.alto_cm ?? null,
                datos.capacidad_kg ?? null,
                datos.imagen_url?.trim() || null,
                datos.destacado,
                datos.activo,
                Number(id)
            ]
        );

        return res.status(200).json({
            estado: 'OK',
            mensaje: 'Producto actualizado correctamente.',
            producto: resultado.rows[0]
        });
    } catch (error) {
        return responderErrorBD(
            res,
            error,
            'No se pudo actualizar el producto.'
        );
    }
}

// =====================================================
// ACTIVAR / DESACTIVAR PRODUCTO
// PATCH /api/admin/products/:id/estado
// =====================================================
async function cambiarEstadoProducto(req, res) {
    const { id } = req.params;
    const { activo } = req.body || {};

    if (!validarId(id)) {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'El identificador del producto no es válido.'
        });
    }

    if (typeof activo !== 'boolean') {
        return res.status(400).json({
            estado: 'ERROR',
            mensaje: 'El campo activo debe ser true o false.'
        });
    }

    try {
        const resultado = await pool.query(
            `UPDATE productos
             SET activo = $1,
                 actualizado_en = CURRENT_TIMESTAMP
             WHERE id_producto = $2
             RETURNING
                id_producto,
                codigo,
                nombre,
                activo,
                actualizado_en`,
            [activo, Number(id)]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                estado: 'ERROR',
                mensaje: 'No se encontró el producto.'
            });
        }

        return res.status(200).json({
            estado: 'OK',
            mensaje: activo
                ? 'Producto activado correctamente.'
                : 'Producto desactivado correctamente.',
            producto: resultado.rows[0]
        });
    } catch (error) {
        return responderErrorBD(
            res,
            error,
            'No se pudo cambiar el estado del producto.'
        );
    }
}

module.exports = {
    listarProductosAdmin,
    obtenerProductoAdmin,
    crearProducto,
    actualizarProducto,
    cambiarEstadoProducto,
    obtenerTotalProductosAdmin
};
