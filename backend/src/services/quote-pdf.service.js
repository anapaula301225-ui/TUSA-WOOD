
const PDFDocument = require('pdfkit');
const pool = require('../config/database');

const fs = require('fs');

const {
    CARPETA_COTIZACIONES,
    RUTA_LOGO,
    prepararAlmacenamiento,
    obtenerRutaPdf,
    obtenerRutaRelativaPdf
} = require('../config/storage');

// ============================================================
// IDENTIDAD VISUAL TUSA WOOD
// ============================================================

const COLOR_CARBON = '#252A2E';
const COLOR_CARBON_SUAVE = '#343B40';
const COLOR_NARANJA = '#E87532';
const COLOR_MADERA = '#B58A5A';
const COLOR_GRIS = '#687078';
const COLOR_GRIS_CLARO = '#E5E7E8';
const COLOR_FONDO = '#F5F3EF';
const COLOR_FONDO_FILA = '#FAF9F6';
const COLOR_BLANCO = '#FFFFFF';

const MONEDA = 'S/';

// Evita generar simultáneamente el mismo PDF dentro
// de una misma instancia del backend.
const generacionesEnCurso = new Map();

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

const formatearImporte = (valor) => {
    return `${MONEDA} ${Number(valor || 0).toLocaleString('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
};

const formatearFecha = (fecha) => {
    if (!fecha) return '-';

    return new Intl.DateTimeFormat('es-PE', {
        dateStyle: 'long',
        timeZone: 'America/Lima'
    }).format(new Date(fecha));
};

const limpiarNombreArchivo = (valor) => {
    return String(valor || 'cotizacion')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 100);
};

const verificarArchivo = async (ruta) => {
    try {
        const estadisticas = await fs.promises.stat(ruta);

        return estadisticas.isFile() && estadisticas.size > 0;
    } catch {
        return false;
    }
};

// ============================================================
// CONSULTAR INFORMACIÓN HISTÓRICA DE LA VERSIÓN
// ============================================================

const obtenerDatosVersion = async (idVersion) => {
    const resultado = await pool.query(
        `
            SELECT
                v.id_version,
                v.id_cotizacion,
                v.numero_version,
                v.estado,
                v.modo_igv,
                v.tasa_igv,
                v.subtotal,
                v.importe_igv,
                v.total,
                v.condiciones_comerciales,
                v.pdf_ruta,
                v.creado_en,

                c.codigo,
                c.empresa,
                c.nombre_contacto,
                c.correo,
                c.telefono,
                c.direccion_entrega,

                admin.nombre AS administrador_creacion,

                (
                    SELECT a.nombre
                    FROM aprobaciones_cotizacion ap
                    INNER JOIN administradores a
                        ON a.id_administrador = ap.id_administrador
                    WHERE
                        ap.id_version = v.id_version
                        AND ap.accion = 'APROBADA'
                    ORDER BY
                        ap.creado_en DESC,
                        ap.id_aprobacion DESC
                    LIMIT 1
                ) AS administrador_aprobacion,

                (
                    SELECT ap.creado_en
                    FROM aprobaciones_cotizacion ap
                    WHERE
                        ap.id_version = v.id_version
                        AND ap.accion = 'APROBADA'
                    ORDER BY
                        ap.creado_en DESC,
                        ap.id_aprobacion DESC
                    LIMIT 1
                ) AS fecha_aprobacion

            FROM cotizaciones_versiones v

            INNER JOIN cotizaciones c
                ON c.id_cotizacion = v.id_cotizacion

            LEFT JOIN administradores admin
                ON admin.id_administrador = v.creado_por

            WHERE v.id_version = $1;
        `,
        [idVersion]
    );

    if (resultado.rows.length === 0) {
        throw new Error('No se encontró la versión de cotización.');
    }

    const version = resultado.rows[0];

    const productos = await pool.query(
        `
            SELECT
                nombre_producto,
                descripcion,
                cantidad,
                precio_unitario,
                subtotal_linea
            FROM detalle_cotizacion_versiones
            WHERE id_version = $1
            ORDER BY id_detalle_version ASC;
        `,
        [idVersion]
    );

    const servicios = await pool.query(
        `
            SELECT
                nombre_servicio,
                descripcion,
                cantidad,
                precio_unitario,
                subtotal_linea
            FROM detalle_servicios_versiones
            WHERE id_version = $1
            ORDER BY id_detalle_servicio_version ASC;
        `,
        [idVersion]
    );

    return {
        version,
        productos: productos.rows,
        servicios: servicios.rows
    };
};

// ============================================================
// GENERAR DOCUMENTO PDF
// ============================================================

const construirPDF = (rutaTemporal, datos) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: {
                top: 45,
                bottom: 55,
                left: 42,
                right: 42
            },
            bufferPages: true,
            info: {
                Title: `Cotización ${datos.version.codigo}`,
                Author: 'TUSA WOOD',
                Subject: `Cotización versión ${datos.version.numero_version}`,
                Creator: 'Sistema comercial TUSA WOOD'
            }
        });

        const archivo = fs.createWriteStream(rutaTemporal);

        let finalizado = false;

        const resolverUnaVez = (error = null) => {
            if (finalizado) return;

            finalizado = true;

            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };

        doc.pipe(archivo);

        archivo.on('error', resolverUnaVez);
        doc.on('error', resolverUnaVez);
        archivo.on('finish', () => resolverUnaVez());

        const anchoPagina = doc.page.width;
        const altoPagina = doc.page.height;

        const margenIzquierdo = 42;
        const margenDerecho = anchoPagina - 42;
        const anchoContenido = margenDerecho - margenIzquierdo;

        let numeroFila = 0;

        // ----------------------------------------------------
        // CABECERA CORPORATIVA
        // ----------------------------------------------------

        const dibujarCabecera = () => {
            doc.rect(0, 0, anchoPagina, 7)
                .fill(COLOR_NARANJA);

            if (fs.existsSync(RUTA_LOGO)) {
                doc.image(RUTA_LOGO, margenIzquierdo, 30, {
                    fit: [160, 65],
                    align: 'left',
                    valign: 'center'
                });
            } else {
                doc.font('Helvetica-Bold')
                    .fontSize(23)
                    .fillColor(COLOR_CARBON)
                    .text('TUSA WOOD', margenIzquierdo, 45);
            }

            doc.font('Helvetica-Bold')
                .fontSize(9)
                .fillColor(COLOR_CARBON)
                .text(
                    'SOLUCIONES INDUSTRIALES EN MADERA',
                    280,
                    43,
                    {
                        width: 270,
                        align: 'right'
                    }
                );

            doc.font('Helvetica')
                .fontSize(8)
                .fillColor(COLOR_GRIS)
                .text(
                    'Calidad | Resistencia | Confianza',
                    280,
                    60,
                    {
                        width: 270,
                        align: 'right'
                    }
                );

            doc.moveTo(margenIzquierdo, 112)
                .lineTo(margenDerecho, 112)
                .lineWidth(1.8)
                .strokeColor(COLOR_NARANJA)
                .stroke();

            doc.y = 130;
        };

        // ----------------------------------------------------
        // CONTROL DE ESPACIO
        // ----------------------------------------------------

        const verificarEspacio = (altura) => {
            if (doc.y + altura > altoPagina - 65) {
                doc.addPage();
                doc.y = 45;
            }
        };

        // ----------------------------------------------------
        // TÍTULOS DE SECCIÓN
        // ----------------------------------------------------

        const dibujarSeccion = (titulo) => {
            verificarEspacio(38);

            doc.moveDown(0.45);

            const y = doc.y;

            doc.roundedRect(
                margenIzquierdo,
                y,
                anchoContenido,
                23,
                3
            ).fill(COLOR_FONDO);

            doc.rect(
                margenIzquierdo,
                y,
                4,
                23
            ).fill(COLOR_NARANJA);

            doc.font('Helvetica-Bold')
                .fontSize(9)
                .fillColor(COLOR_CARBON)
                .text(
                    titulo.toUpperCase(),
                    margenIzquierdo + 13,
                    y + 7,
                    {
                        width: anchoContenido - 22
                    }
                );

            doc.y = y + 32;
        };

        // ----------------------------------------------------
        // CAMPOS INFORMATIVOS
        // ----------------------------------------------------

        const dibujarCampo = (etiqueta, valor, x, y, ancho) => {
            doc.font('Helvetica-Bold')
                .fontSize(7)
                .fillColor(COLOR_GRIS)
                .text(
                    etiqueta,
                    x,
                    y,
                    {
                        width: ancho
                    }
                );

            doc.font('Helvetica')
                .fontSize(9)
                .fillColor(COLOR_CARBON)
                .text(
                    String(valor || '-'),
                    x,
                    y + 13,
                    {
                        width: ancho
                    }
                );
        };

        // ----------------------------------------------------
        // TABLA DE DETALLES
        // ----------------------------------------------------

        const dibujarCabeceraTabla = () => {
            verificarEspacio(35);

            numeroFila = 0;

            const y = doc.y;

            doc.roundedRect(
                margenIzquierdo,
                y,
                anchoContenido,
                25,
                3
            ).fill(COLOR_CARBON);

            doc.font('Helvetica-Bold')
                .fontSize(7.5)
                .fillColor(COLOR_BLANCO);

            doc.text('DESCRIPCIÓN', 49, y + 9, {
                width: 225
            });

            doc.text('CANT.', 280, y + 9, {
                width: 48,
                align: 'right'
            });

            doc.text('P. UNITARIO', 334, y + 9, {
                width: 85,
                align: 'right'
            });

            doc.text('IMPORTE', 425, y + 9, {
                width: 120,
                align: 'right'
            });

            doc.y = y + 30;
        };

        const dibujarFila = (item, tipo) => {
            const nombre = tipo === 'producto'
                ? item.nombre_producto
                : item.nombre_servicio;

            const descripcion = item.descripcion || '';

            const texto = descripcion
                ? `${nombre}\n${descripcion}`
                : nombre;

            const anchoDescripcion = 225;

            const alturaTexto = doc.heightOfString(texto, {
                width: anchoDescripcion,
                font: 'Helvetica',
                fontSize: 8,
                lineGap: 2
            });

            const altura = Math.max(32, alturaTexto + 13);

            if (doc.y + altura > altoPagina - 65) {
                doc.addPage();
                doc.y = 45;
                dibujarCabeceraTabla();
            }

            const y = doc.y;

            if (numeroFila % 2 === 0) {
                doc.rect(
                    margenIzquierdo,
                    y,
                    anchoContenido,
                    altura
                ).fill(COLOR_FONDO_FILA);
            }

            doc.font('Helvetica-Bold')
                .fontSize(8)
                .fillColor(COLOR_CARBON)
                .text(
                    String(nombre || '-'),
                    49,
                    y + 6,
                    {
                        width: anchoDescripcion
                    }
                );

            if (descripcion) {
                const alturaNombre = doc.heightOfString(
                    String(nombre || '-'),
                    {
                        width: anchoDescripcion,
                        font: 'Helvetica-Bold',
                        fontSize: 8
                    }
                );

                doc.font('Helvetica')
                    .fontSize(7)
                    .fillColor(COLOR_GRIS)
                    .text(
                        descripcion,
                        49,
                        y + 7 + alturaNombre,
                        {
                            width: anchoDescripcion,
                            lineGap: 2
                        }
                    );
            }

            doc.font('Helvetica')
                .fontSize(8)
                .fillColor(COLOR_CARBON)
                .text(
                    String(item.cantidad),
                    280,
                    y + 9,
                    {
                        width: 48,
                        align: 'right'
                    }
                );

            doc.text(
                formatearImporte(item.precio_unitario),
                334,
                y + 9,
                {
                    width: 85,
                    align: 'right'
                }
            );

            doc.font('Helvetica-Bold')
                .text(
                    formatearImporte(item.subtotal_linea),
                    425,
                    y + 9,
                    {
                        width: 120,
                        align: 'right'
                    }
                );

            doc.moveTo(margenIzquierdo, y + altura)
                .lineTo(margenDerecho, y + altura)
                .lineWidth(0.5)
                .strokeColor(COLOR_GRIS_CLARO)
                .stroke();

            doc.y = y + altura;

            numeroFila++;
        };

        // ====================================================
        // INICIO DEL DOCUMENTO
        // ====================================================

        dibujarCabecera();

        const version = datos.version;

        doc.font('Helvetica-Bold')
            .fontSize(20)
            .fillColor(COLOR_CARBON)
            .text(
                'COTIZACIÓN COMERCIAL',
                margenIzquierdo,
                doc.y,
                {
                    width: anchoContenido,
                    align: 'center'
                }
            );

        doc.moveDown(0.35);

        const textoIdentificacion =
            `${version.codigo}  |  VERSIÓN ${version.numero_version}`;

        const anchoEtiqueta = 280;
        const xEtiqueta = (anchoPagina - anchoEtiqueta) / 2;
        const yEtiqueta = doc.y;

        doc.roundedRect(
            xEtiqueta,
            yEtiqueta,
            anchoEtiqueta,
            22,
            5
        ).fill(COLOR_FONDO);

        doc.font('Helvetica-Bold')
            .fontSize(8)
            .fillColor(COLOR_GRIS)
            .text(
                textoIdentificacion,
                xEtiqueta,
                yEtiqueta + 7,
                {
                    width: anchoEtiqueta,
                    align: 'center'
                }
            );

        doc.y = yEtiqueta + 31;

        // ====================================================
        // DATOS DEL CLIENTE
        // ====================================================

        dibujarSeccion('Datos del cliente');

        const inicioCliente = doc.y;

        doc.roundedRect(
            margenIzquierdo,
            inicioCliente - 5,
            anchoContenido,
            119,
            5
        ).fill(COLOR_FONDO_FILA);

        dibujarCampo(
            'EMPRESA',
            version.empresa,
            55,
            inicioCliente + 5,
            245
        );

        dibujarCampo(
            'CONTACTO',
            version.nombre_contacto,
            310,
            inicioCliente + 5,
            235
        );

        dibujarCampo(
            'CORREO ELECTRÓNICO',
            version.correo,
            55,
            inicioCliente + 45,
            245
        );

        dibujarCampo(
            'TELÉFONO',
            version.telefono,
            310,
            inicioCliente + 45,
            235
        );

        dibujarCampo(
            'DIRECCIÓN DE ENTREGA',
            version.direccion_entrega,
            55,
            inicioCliente + 85,
            anchoContenido - 25
        );

        doc.y = inicioCliente + 125;

        // ====================================================
        // INFORMACIÓN DE LA COTIZACIÓN
        // ====================================================

        dibujarSeccion('Información de la cotización');

        const inicioInfo = doc.y;

        dibujarCampo(
            'FECHA DE EMISIÓN',
            formatearFecha(version.creado_en),
            49,
            inicioInfo,
            155
        );

        dibujarCampo(
            'MODALIDAD IGV',
            version.modo_igv === 'INCLUIDO'
                ? 'IGV INCLUIDO'
                : 'IGV ADICIONAL',
            220,
            inicioInfo,
            145
        );

        dibujarCampo(
            'TASA IGV',
            `${Number(version.tasa_igv).toFixed(2)} %`,
            400,
            inicioInfo,
            145
        );

        doc.y = inicioInfo + 48;

        // ====================================================
        // PRODUCTOS
        // ====================================================

        if (datos.productos.length > 0) {
            dibujarSeccion('Productos');

            dibujarCabeceraTabla();

            for (const producto of datos.productos) {
                dibujarFila(producto, 'producto');
            }
        }

        // ====================================================
        // SERVICIOS
        // ====================================================

        if (datos.servicios.length > 0) {
            dibujarSeccion('Servicios');

            dibujarCabeceraTabla();

            for (const servicio of datos.servicios) {
                dibujarFila(servicio, 'servicio');
            }
        }

        // ====================================================
        // RESUMEN ECONÓMICO
        // ====================================================

        verificarEspacio(125);

        doc.moveDown(1);

        const anchoResumen = 235;
        const xResumen = margenDerecho - anchoResumen;
        const yResumen = doc.y;

        doc.roundedRect(
            xResumen - 12,
            yResumen - 10,
            anchoResumen + 24,
            111,
            5
        ).fill(COLOR_FONDO);

        doc.font('Helvetica')
            .fontSize(9)
            .fillColor(COLOR_GRIS)
            .text(
                'Subtotal:',
                xResumen,
                yResumen,
                {
                    width: 110
                }
            );

        doc.font('Helvetica-Bold')
            .fillColor(COLOR_CARBON)
            .text(
                formatearImporte(version.subtotal),
                xResumen + 110,
                yResumen,
                {
                    width: 125,
                    align: 'right'
                }
            );

        doc.font('Helvetica')
            .fontSize(9)
            .fillColor(COLOR_GRIS)
            .text(
                `IGV (${Number(version.tasa_igv).toFixed(2)} %):`,
                xResumen,
                yResumen + 23,
                {
                    width: 110
                }
            );

        doc.font('Helvetica-Bold')
            .fillColor(COLOR_CARBON)
            .text(
                formatearImporte(version.importe_igv),
                xResumen + 110,
                yResumen + 23,
                {
                    width: 125,
                    align: 'right'
                }
            );

        doc.roundedRect(
            xResumen - 12,
            yResumen + 49,
            anchoResumen + 24,
            38,
            4
        ).fill(COLOR_CARBON);

        doc.rect(
            xResumen - 12,
            yResumen + 49,
            4,
            38
        ).fill(COLOR_NARANJA);

        doc.font('Helvetica-Bold')
            .fontSize(10)
            .fillColor(COLOR_BLANCO)
            .text(
                'TOTAL:',
                xResumen,
                yResumen + 62,
                {
                    width: 100
                }
            );

        doc.font('Helvetica-Bold')
            .fontSize(11)
            .fillColor(COLOR_BLANCO)
            .text(
                formatearImporte(version.total),
                xResumen + 100,
                yResumen + 61,
                {
                    width: 125,
                    align: 'right'
                }
            );

        doc.y = yResumen + 105;

        // ====================================================
        // CONDICIONES COMERCIALES
        // ====================================================

        if (version.condiciones_comerciales) {
            const textoCondiciones = String(
                version.condiciones_comerciales
            );

            const alturaCondiciones = doc.heightOfString(
                textoCondiciones,
                {
                    width: anchoContenido - 28,
                    font: 'Helvetica',
                    fontSize: 8.5,
                    lineGap: 3
                }
            );

            verificarEspacio(alturaCondiciones + 65);

            dibujarSeccion('Condiciones comerciales');

            const yCondiciones = doc.y;

            const altoTarjeta = alturaCondiciones + 22;

            doc.roundedRect(
                margenIzquierdo,
                yCondiciones - 5,
                anchoContenido,
                altoTarjeta,
                4
            ).fill(COLOR_FONDO_FILA);

            doc.rect(
                margenIzquierdo,
                yCondiciones - 5,
                4,
                altoTarjeta
            ).fill(COLOR_MADERA);

            doc.font('Helvetica')
                .fontSize(8.5)
                .fillColor(COLOR_CARBON)
                .text(
                    textoCondiciones,
                    margenIzquierdo + 14,
                    yCondiciones + 5,
                    {
                        width: anchoContenido - 28,
                        lineGap: 3
                    }
                );

            doc.y = yCondiciones + altoTarjeta + 5;
        }

        // ====================================================
        // VALIDACIÓN INTERNA
        // ====================================================

        verificarEspacio(85);

        dibujarSeccion('Validación interna');

        const yAprobacion = doc.y;

        doc.roundedRect(
            margenIzquierdo,
            yAprobacion - 4,
            anchoContenido,
            55,
            4
        ).fill(COLOR_FONDO);

        doc.circle(
            margenIzquierdo + 16,
            yAprobacion + 12,
            5
        ).fill(COLOR_NARANJA);

        doc.font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(COLOR_CARBON)
            .text(
                'ESTADO: APROBADA',
                margenIzquierdo + 29,
                yAprobacion + 5
            );

        doc.font('Helvetica')
            .fontSize(8)
            .fillColor(COLOR_GRIS)
            .text(
                `Aprobada por: ${version.administrador_aprobacion || 'GERENCIA'}`,
                margenIzquierdo + 29,
                yAprobacion + 21,
                {
                    width: anchoContenido - 40
                }
            );

        if (version.fecha_aprobacion) {
            doc.text(
                `Fecha de aprobación: ${formatearFecha(version.fecha_aprobacion)}`,
                margenIzquierdo + 29,
                yAprobacion + 35,
                {
                    width: anchoContenido - 40
                }
            );
        }

        // ====================================================
        // PIE DE PÁGINA
        // ====================================================

        const rangoPaginas = doc.bufferedPageRange();

        for (let i = 0; i < rangoPaginas.count; i++) {
            doc.switchToPage(rangoPaginas.start + i);

            const margenInferiorOriginal = doc.page.margins.bottom;
            doc.page.margins.bottom = 15;

            const yPie = altoPagina - 38;

            doc.moveTo(margenIzquierdo, yPie - 8)
                .lineTo(margenDerecho, yPie - 8)
                .lineWidth(0.6)
                .strokeColor(COLOR_GRIS_CLARO)
                .stroke();

            doc.font('Helvetica')
                .fontSize(7)
                .fillColor(COLOR_GRIS)
                .text(
                    'TUSA WOOD | Cotización comercial',
                    margenIzquierdo,
                    yPie,
                    {
                        width: 300,
                        lineBreak: false
                    }
                );

            doc.text(
                `Página ${i + 1} de ${rangoPaginas.count}`,
                400,
                yPie,
                {
                    width: 145,
                    align: 'right',
                    lineBreak: false
                }
            );

            doc.page.margins.bottom = margenInferiorOriginal;
        }

        doc.end();
    });
};

// ============================================================
// GENERAR PDF DE UNA VERSIÓN APROBADA
// ============================================================

const generarPDFCotizacionInterno = async (idVersion) => {
    const id = Number(idVersion);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error('El identificador de versión no es válido.');
    }

    const datos = await obtenerDatosVersion(id);

    const version = datos.version;

    if (!['APROBADA', 'ENVIADA'].includes(version.estado)) {
        throw new Error(
            'Solo se pueden generar PDF de versiones aprobadas o enviadas al cliente.'
        );
    }

    if (
        datos.productos.length === 0 &&
        datos.servicios.length === 0
    ) {
        throw new Error(
            'No se puede generar una cotización sin productos ni servicios.'
        );
    }

    await prepararAlmacenamiento();

    const codigo = limpiarNombreArchivo(version.codigo);

    const nombreArchivo =
        `cotizacion-${codigo}-v${version.numero_version}.pdf`;

    const rutaFinal = obtenerRutaPdf(nombreArchivo);

    const rutaRelativa = obtenerRutaRelativaPdf(rutaFinal);

    // Reutilizar el documento si ya existe.
    if (await verificarArchivo(rutaFinal)) {
        await pool.query(
            `
                UPDATE cotizaciones_versiones
                SET pdf_ruta = $1
                WHERE id_version = $2;
            `,
            [rutaRelativa, id]
        );

        return {
            id_version: id,
            numero_version: version.numero_version,
            archivo: nombreArchivo,
            ruta: rutaFinal,
            ruta_relativa: rutaRelativa,
            generado: false,
            mensaje: 'Se reutilizó el PDF existente.'
        };
    }

    const rutaTemporal =
        `${rutaFinal}.tmp-${process.pid}-${Date.now()}`;

    try {
        await construirPDF(rutaTemporal, datos);

        if (!(await verificarArchivo(rutaTemporal))) {
            throw new Error(
                'El archivo PDF generado está vacío o no es válido.'
            );
        }

        await fs.promises.rename(rutaTemporal, rutaFinal);

        await pool.query(
            `
                UPDATE cotizaciones_versiones
                SET
                    pdf_ruta = $1,
                    actualizado_en = CURRENT_TIMESTAMP
                WHERE id_version = $2;
            `,
            [rutaRelativa, id]
        );

        return {
            id_version: id,
            numero_version: version.numero_version,
            archivo: nombreArchivo,
            ruta: rutaFinal,
            ruta_relativa: rutaRelativa,
            generado: true,
            mensaje: 'PDF de cotización generado correctamente.'
        };

    } catch (error) {
        try {
            await fs.promises.unlink(rutaTemporal);
        } catch {
            // El archivo temporal puede no existir.
        }

        throw error;
    }
};

// ============================================================
// CONTROL DE GENERACIONES SIMULTÁNEAS
// ============================================================

const generarPDFCotizacion = (idVersion) => {
    const id = Number(idVersion);

    if (!Number.isSafeInteger(id) || id <= 0) {
        return generarPDFCotizacionInterno(idVersion);
    }

    const generacionExistente = generacionesEnCurso.get(id);

    if (generacionExistente) {
        return generacionExistente;
    }

    const promesa = generarPDFCotizacionInterno(id)
        .finally(() => {
            generacionesEnCurso.delete(id);
        });

    generacionesEnCurso.set(id, promesa);

    return promesa;
};

// ============================================================
// EXPORTAR SERVICIO
// ============================================================

module.exports = {
    generarPDFCotizacion
};
