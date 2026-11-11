
import {
  ArrowRight,
  Layers3,
  LoaderCircle,
  Ruler,
  Search,
  AlertCircle,
} from 'lucide-react';

import type { Producto } from '../services/api';

interface CatalogoProps {
  productos: Producto[];
  cargando: boolean;
  error: string;
  onReintentar: () => void;
  onCotizar: (producto: Producto) => void;
}

const imagenesReferencia = [
  'https://images.unsplash.com/photo-1590247813693-5541d1c609fd?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1519457431-44ccd64a579b?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=85',
];

function obtenerMedidas(producto: Producto): string {
  const { largo_cm, ancho_cm, alto_cm } = producto;

  if (
    largo_cm == null &&
    ancho_cm == null &&
    alto_cm == null
  ) {
    return 'Consultar medidas';
  }

  const largo = largo_cm ?? '?';
  const ancho = ancho_cm ?? '?';

  return alto_cm == null
    ? `${largo} × ${ancho} cm`
    : `${largo} × ${ancho} × ${alto_cm} cm`;
}

function Catalogo({
  productos,
  cargando,
  error,
  onReintentar,
  onCotizar,
}: CatalogoProps) {
  return (
    <div className="tw-catalog">

      {cargando ? (
        <div className="tw-catalog-notice">
          <LoaderCircle className="tw-spin" size={24} />
          <span>Cargando productos del catálogo...</span>
        </div>
      ) : error ? (
        <div className="tw-catalog-notice tw-catalog-error">
          <AlertCircle size={22} />

          <span>{error}</span>

          <button
            type="button"
            onClick={onReintentar}
          >
            Reintentar
          </button>
        </div>
      ) : productos.length === 0 ? (
        <div className="tw-catalog-notice">
          <Search size={22} />

          <span>
            No encontramos productos disponibles para mostrar.
          </span>
        </div>
      ) : (
        <div className="tw-product-grid">
          {productos.map((producto, index) => (
            <article
              className="tw-product-card"
              key={producto.id_producto}
            >
              <div className="tw-product-image">
                <img
                  src={
                    producto.imagen_url?.trim() ||
                    imagenesReferencia[
                      index % imagenesReferencia.length
                    ]
                  }
                  alt={producto.nombre}
                  loading="lazy"
                />

                <span className="tw-product-number">
                  {String(index + 1).padStart(2, '0')}
                </span>

                {producto.destacado && (
                  <span className="tw-product-featured">
                    DESTACADO
                  </span>
                )}

                <div className="tw-product-image-overlay" />

                <span className="tw-product-brand">
                  TUSA WOOD
                </span>
              </div>

              <div className="tw-product-info">

                <div className="tw-product-meta">
                  <span>
                    {producto.categoria || 'SOLUCIONES LOGÍSTICAS'}
                  </span>

                  <span>{producto.codigo}</span>
                </div>

                <h3>{producto.nombre}</h3>

                <p>
                  {producto.descripcion ||
                    'Consulta las características de este producto.'}
                </p>

                <div className="tw-product-specs">
                  <span>
                    <Layers3 size={15} />
                    {producto.material || 'Por consultar'}
                  </span>

                  <span>
                    <Ruler size={15} />
                    {obtenerMedidas(producto)}
                  </span>
                </div>

                <button
                  type="button"
                  className="tw-product-button"
                  onClick={() => onCotizar(producto)}
                >
                  Solicitar cotización
                  <ArrowRight size={17} />
                </button>

              </div>
            </article>
          ))}
        </div>
      )}

    </div>
  );
}

export default Catalogo;
