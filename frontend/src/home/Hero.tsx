import {
  ArrowRight,
  ArrowDownRight,
  Factory,
  ShieldCheck,
} from 'lucide-react';

interface HeroProps {
  onCotizar: () => void;
}

function Hero({ onCotizar }: HeroProps) {
  return (
    <section id="inicio" className="tw-hero">

      <div className="tw-hero-background" />

      <div className="tw-hero-container">

        <div className="tw-hero-content">

          <div className="tw-hero-eyebrow">
            <span className="tw-eyebrow-line" />
            FABRICACIÓN Y SOLUCIONES INDUSTRIALES
          </div>

          <h1 className="tw-hero-title">
            Una base sólida
            <br />
            para mover tu
            <br />
            <em>mundo.</em>
          </h1>

          <p className="tw-hero-description">
            Parihuelas y soluciones de madera pensadas para acompañar
            las exigencias de almacenamiento, traslado y distribución
            de tu empresa.
          </p>

          <div className="tw-hero-actions">

            <a href="#productos" className="tw-button-primary">
              Explorar productos
              <ArrowRight size={19} />
            </a>

            <button
              type="button"
              className="tw-button-secondary"
              onClick={onCotizar}
            >
              Hablemos de tu proyecto
              <ArrowDownRight size={18} />
            </button>

          </div>

          <div className="tw-hero-proof">
            <span className="tw-proof-icon">
              <ShieldCheck size={23} />
            </span>

            <div>
              <strong>Soluciones según tu necesidad</strong>
              <small>
                Atención orientada a requerimientos empresariales
              </small>
            </div>
          </div>

        </div>

        <div className="tw-hero-visual">

          <div className="tw-hero-image-frame tw-hero-logo-frame">
            <div className="tw-hero-logo-glow" />

            <img
              src="/logo1-completo.png"
              alt="Tusa Wood - Parihuelas y embalaje"
              className="tw-hero-logo-img"
            />

            <div className="tw-hero-image-index">
              01 <span>/</span> TUSA WOOD
            </div>
          </div>

          <div className="tw-hero-orange-corner" />

          <div className="tw-hero-stamp">
            <Factory size={27} />
            <span>
              HECHO PARA
              <strong>EL TRABAJO REAL</strong>
            </span>
          </div>

          <div className="tw-hero-caption">
            <span>RESISTENCIA</span>
            <i />
            <span>FUNCIONALIDAD</span>
            <i />
            <span>CONFIANZA</span>
          </div>

        </div>

      </div>

      <a href="#nosotros" className="tw-hero-scroll">
        DESCUBRE TUSA WOOD
        <span>↓</span>
      </a>

    </section>
  );
}

export default Hero;