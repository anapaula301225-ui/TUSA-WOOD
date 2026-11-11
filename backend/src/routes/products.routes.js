
const express = require('express');
const pool = require('../config/database');

const router = express.Router();

// GET /api/products
// Ejemplos:
// /api/products
// /api/products?buscar=parihuela
// /api/products?categoria=1
// /api/products?destacados=true
// /api/products?limite=12&pagina=1
router.get('/', async (req, res) => {
  try {
    const buscar = String(req.query.buscar || '').trim();
    const categoria = req.query.categoria;
    const destacados = req.query.destacados;

    const limiteSolicitado = Number.parseInt(req.query.limite, 10);
    const paginaSolicitada = Number.parseInt(req.query.pagina, 10);

    const limite = Number.isInteger(limiteSolicitado)
      ? Math.min(Math.max(limiteSolicitado, 1), 50)
      : 12;

    const pagina = Number.isInteger(paginaSolicitada)
      ? Math.max(paginaSolicitada, 1)
      : 1;

    const offset = (pagina - 1) * limite;

    const condiciones = ['p.activo = TRUE'];
    const parametros = [];

    if (buscar) {
      parametros.push(`%${buscar}%`);
      const indice = parametros.length;

      condiciones.push(`
        (
          p.nombre ILIKE $${indice}
          OR p.codigo ILIKE $${indice}
          OR COALESCE(p.descripcion, '') ILIKE $${indice}
        )
      `);
    }

    if (categoria !== undefined && categoria !== '') {
      const categoriaId = Number(categoria);

      if (!Number.isInteger(categoriaId) || categoriaId < 1) {
        return res.status(400).json({
          estado: 'ERROR',
          mensaje: 'El identificador de categoría no es válido.',
        });
      }

      parametros.push(categoriaId);
      condiciones.push(
        `p.id_categoria = $${parametros.length}`
      );
    }

    if (destacados !== undefined) {
      if (!['true', 'false'].includes(String(destacados))) {
        return res.status(400).json({
          estado: 'ERROR',
          mensaje: 'El filtro destacados debe ser true o false.',
        });
      }

      parametros.push(destacados === 'true');
      condiciones.push(
        `p.destacado = $${parametros.length}`
      );
    }

    const where = condiciones.join(' AND ');

    // =====================================================
    // CONTAR PRODUCTOS ACTIVOS
    // =====================================================
    const consultaTotal = await pool.query(
      `
        SELECT COUNT(*)::INTEGER AS total
        FROM productos p
        WHERE ${where}
      `,
      parametros
    );

    const total = consultaTotal.rows[0].total;

    // =====================================================
    // LISTAR PRODUCTOS ACTIVOS
    // =====================================================
    const parametrosLista = [...parametros, limite, offset];

    const consultaProductos = await pool.query(
      `
        SELECT
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
          p.activo
        FROM productos p
        LEFT JOIN categorias c
          ON c.id_categoria = p.id_categoria
        WHERE ${where}
        ORDER BY p.destacado DESC, p.creado_en DESC
        LIMIT $${parametros.length + 1}
        OFFSET $${parametros.length + 2}
      `,
      parametrosLista
    );

    res.status(200).json({
      estado: 'OK',
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite),
      },
      productos: consultaProductos.rows,
    });

  } catch (error) {
    console.error(
      'Error al listar productos:',
      error.message
    );

    res.status(500).json({
      estado: 'ERROR',
      mensaje: 'No se pudo obtener el catálogo de productos.',
    });
  }
});

// GET /api/products/:idOrCode
// Busca un producto por su ID numérico o por su código.
router.get('/:idOrCode', async (req, res) => {
  try {
    const valor = req.params.idOrCode;

    let consulta;

    if (/^\d+$/.test(valor)) {
      consulta = await pool.query(
        `
          SELECT
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
            p.activo
          FROM productos p
          LEFT JOIN categorias c
            ON c.id_categoria = p.id_categoria
          WHERE p.id_producto = $1
            AND p.activo = TRUE
        `,
        [Number(valor)]
      );

    } else {
      consulta = await pool.query(
        `
          SELECT
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
            p.activo
          FROM productos p
          LEFT JOIN categorias c
            ON c.id_categoria = p.id_categoria
          WHERE p.codigo = $1
            AND p.activo = TRUE
        `,
        [valor]
      );
    }

    if (consulta.rowCount === 0) {
      return res.status(404).json({
        estado: 'ERROR',
        mensaje: 'Producto no encontrado.',
      });
    }

    res.status(200).json({
      estado: 'OK',
      producto: consulta.rows[0],
    });

  } catch (error) {
    console.error(
      'Error al consultar producto:',
      error.message
    );

    res.status(500).json({
      estado: 'ERROR',
      mensaje: 'No se pudo obtener el producto.',
    });
  }
});

module.exports = router;
