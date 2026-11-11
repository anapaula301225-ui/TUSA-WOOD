
const express = require('express');

const {
    registrarCotizacion
} = require('../controllers/quotes.controller');

const router = express.Router();

// POST /api/quotes
router.post('/', registrarCotizacion);

module.exports = router;
