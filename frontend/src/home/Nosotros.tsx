
import { ArrowRight, Boxes, CheckCircle2, Factory, ShieldCheck } from 'lucide-react';

interface NosotrosProps {
  onCotizar: () => void;
}

function Nosotros({ onCotizar }: NosotrosProps) {
  return (
    <section id="nosotros" className="tw-about">
      <div className="tw-section-container tw-about-grid">
        <div className="tw-about-heading">
          <span className="tw-section-label">01 / QUIÉNES SOMOS</span>
          <h2>
            La confianza
            <br />
            empieza desde
            <br />
            <em>la base.</em>
          </h2>
          <div className="tw-heading-decoration" />
        </div>

        <div className="tw-about-content">
          <span className="tw-about-overline">
            SOLUCIONES PARA CADA OPERACIÓN
          </span>

          <h3>Cada operación necesita una base confiable.</h3>

          <p>
            En TUSA WOOD orientamos nuestras soluciones a las necesidades
            de almacenamiento, traslado y organización de productos.
          </p>

          <p>
            Queremos ayudarte a encontrar una alternativa que responda
            a las condiciones y características de tu operación.
          </p>

          <button
            type="button"
            className="tw-text-button"
            onClick={onCotizar}
          >
            Conversemos sobre tu proyecto
            <ArrowRight size={18} />
          </button>

          <div className="tw-about-signature">
            <strong>TW<span>.</span></strong>
            <div>
              COMPROMISO CON
              <br />
              TU OPERACIÓN
            </div>
          </div>
        </div>

        <div className="tw-about-features">
          <div>
            <Factory />
            <span>Soluciones industriales</span>
          </div>
          <div>
            <Boxes />
            <span>Alternativas de producto</span>
          </div>
          <div>
            <ShieldCheck />
            <span>Enfoque funcional</span>
          </div>
          <div>
            <CheckCircle2 />
            <span>Atención comercial</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Nosotros;
