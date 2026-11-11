import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  MoveUpRight,
  Sparkles,
} from 'lucide-react';

interface ContactoProps {
  onCotizar: () => void;
}

function Contacto({ onCotizar }: ContactoProps) {
  const seccionRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === 'undefined'
  );

  // Activa las animaciones cuando la sección entra en pantalla
  useEffect(() => {
    const elemento = seccionRef.current;

    if (!elemento || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observador.observe(elemento);

    return () => observador.disconnect();
  }, []);

  return (
    <section
      id="contacto"
      ref={seccionRef}
      className={`tw-contact ${visible ? 'tw-contact-visible' : ''}`}
    >
      <div className="tw-section-container">
        <div className="tw-contact-panel">

          <div className="tw-contact-copy">
            <span className="tw-section-label">04 / HABLEMOS</span>

            <h2>
              Tu próxima operación
              <br />
              empieza con una
              <br />
              <em>conversación.</em>
            </h2>

            <p>
              Cuéntanos qué necesitas y prepara tu solicitud de cotización
              directamente desde nuestro catálogo.
            </p>

            <button
              type="button"
              className="tw-button-primary"
              onClick={onCotizar}
            >
              Solicitar cotización
              <ArrowRight size={19} />
            </button>
          </div>

          <div className="tw-contact-details">

            <div className="tw-contact-art">
              <div className="tw-contact-art-square">
                <img src="/logo-navbar.png" alt="Tusa Wood" />
              </div>

              <span>
                TUSA WOOD
                <i />
                SOLUCIONES INDUSTRIALES
              </span>
            </div>

            <div className="tw-contact-points">
              <div>
                <span><Check size={17} /></span>
                <p>
                  <strong>Define lo que necesitas</strong>
                  <small>Tipo de producto, medidas o uso previsto.</small>
                </p>
              </div>

              <div>
                <span><Check size={17} /></span>
                <p>
                  <strong>Envía tu solicitud</strong>
                  <small>Registra tus datos y cantidad requerida.</small>
                </p>
              </div>

              <div>
                <span><Sparkles size={17} /></span>
                <p>
                  <strong>Prepara tu proyecto</strong>
                  <small>Tu solicitud quedará registrada para atención comercial.</small>
                </p>
              </div>
            </div>

            <button
              type="button"
              className="tw-contact-link"
              onClick={onCotizar}
            >
              Iniciar cotización
              <MoveUpRight size={17} />
            </button>

          </div>
        </div>
      </div>
    </section>
  );
}

export default Contacto;