import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  ShieldCheck,
  Truck,
  Wrench,
} from 'lucide-react';

import type { Servicio } from '../services/api';

interface ServiciosProps {
  servicios: Servicio[];
  cargando: boolean;
  error: string;
  onReintentar: () => void;
  onCotizar: () => void;
}

const iconosServicios = [
  PackageCheck,
  Wrench,
  ShieldCheck,
  Truck,
  Boxes,
  ClipboardCheck,
];

function Servicios({
  servicios,
  cargando,
  error,
  onReintentar,
  onCotizar,
}: ServiciosProps) {
  return (
    <section
      id="servicios"
      className="tw-services"
      aria-labelledby="tw-services-title"
    >
      <div className="container">
        <div className="tw-services-heading">
          <div>
            <span className="section-kicker">
              03 / SERVICIOS COMPLEMENTARIOS
            </span>

            <h2 id="tw-services-title">
              Soluciones que acompañan
              <br />
              cada <em>operación.</em>
            </h2>
          </div>

          <div className="tw-services-intro">
            <p>
              Complementamos nuestros productos con servicios
              especializados para atender los requerimientos de
              almacenamiento, transporte y operación de tu empresa.
            </p>

            <button
              type="button"
              className="tw-services-link"
              onClick={onCotizar}
            >
              Consultar servicios
              <ArrowRight size={17} />
            </button>
          </div>
        </div>

        {cargando ? (
          <div className="tw-services-state" role="status">
            <span className="tw-services-loader" />
            <p>Cargando nuestros servicios...</p>
          </div>
        ) : error ? (
          <div className="tw-services-state tw-services-error" role="alert">
            <p>{error}</p>

            <button
              type="button"
              className="tw-services-retry"
              onClick={onReintentar}
            >
              Intentar nuevamente
              <ArrowRight size={16} />
            </button>
          </div>
        ) : servicios.length === 0 ? (
          <div className="tw-services-state">
            <p>
              Actualmente no tenemos servicios publicados.
              Puedes contactarnos para consultar otras soluciones.
            </p>

            <button
              type="button"
              className="tw-services-retry"
              onClick={onCotizar}
            >
              Contactar con el área comercial
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <div className="tw-services-grid">
            {servicios.map((servicio, indice) => {
              const Icono =
                iconosServicios[indice % iconosServicios.length];

              return (
                <article
                  className="tw-service-card"
                  key={servicio.id_servicio}
                >
                  <div className="tw-service-card-top">
                    <span className="tw-service-number">
                      {String(indice + 1).padStart(2, '0')}
                    </span>

                    <span className="tw-service-icon">
                      <Icono size={25} strokeWidth={1.7} />
                    </span>
                  </div>

                  <div className="tw-service-content">
                    <h3>{servicio.nombre}</h3>

                    <p>
                      {servicio.descripcion?.trim() ||
                        'Consulta con nuestro equipo comercial los detalles de este servicio.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="tw-service-action"
                    onClick={onCotizar}
                    aria-label={`Solicitar cotización de ${servicio.nombre}`}
                  >
                    Consultar este servicio
                    <ArrowRight size={17} />
                  </button>

                  <span className="tw-service-decoration">
                    <CheckCircle2 size={18} />
                  </span>
                </article>
              );
            })}
          </div>
        )}

        <div className="tw-services-bottom">
          <div>
            <span className="tw-services-bottom-kicker">
              ATENCIÓN PERSONALIZADA
            </span>

            <h3>
              ¿Necesitas una solución para tu operación?
            </h3>

            <p>
              Cuéntanos qué necesitas. Nuestro equipo podrá ayudarte
              a identificar los productos y servicios adecuados.
            </p>
          </div>

          <button
            type="button"
            className="button button-orange"
            onClick={onCotizar}
          >
            Solicitar cotización
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}

export default Servicios;