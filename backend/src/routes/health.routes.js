const express = require('express');
const pool = require('../config/database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        current_database() AS base_datos,
        NOW() AS fecha_servidor,
        version() AS version_postgresql
    `);

    res.status(200).json({
      estado: 'OK',
      mensaje: 'Backend conectado correctamente con PostgreSQL',
      baseDatos: resultado.rows[0].base_datos,
      fechaServidor: resultado.rows[0].fecha_servidor,
      versionPostgreSQL: resultado.rows[0].version_postgresql,
    });
  } catch (error) {
    console.error('Error al verificar PostgreSQL:', error.message);

    res.status(500).json({
      estado: 'ERROR',
      mensaje: 'No se pudo conectar con la base de datos',
    });
  }
});

module.exports = router;