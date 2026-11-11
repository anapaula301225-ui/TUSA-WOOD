
import {
  ArrowUpRight,
  Ruler,
  ShieldCheck,
  Truck,
} from 'lucide-react';

const ventajas = [
  {
    numero: '01',
    icono: ShieldCheck,
    titulo: 'Enfoque en la funcionalidad',
    descripcion:
      'Alternativas pensadas para apoyar el almacenamiento y movimiento de productos.',
  },
  {
    numero: '02',
    icono: Ruler,
    titulo: 'Atención al requerimiento',
    descripcion:
      'Consideramos las características que tu operación necesita al evaluar las opciones.',
  },
  {
    numero: '03',
    icono: Truck,
    titulo: 'Orientación comercial',
    descripcion:
      'Explora opciones y conoce las características de los productos que buscas.',
  },
];

function Ventajas() {
  return (
    <section id="ventajas" className="tw-advantages">
      <div className="tw-section-container">

        <div className="tw-advantages-heading">
          <div>
            <span className="tw-section-label">03 / POR QUÉ TUSA WOOD</span>
            <h2>
              Lo que tu operación
              <br />
              necesita, <em>bien resuelto.</em>
            </h2>
          </div>

          <p>
            Una solución útil comienza por entender el trabajo que debe
            realizar. Por eso ponemos el foco en tus necesidades y en
            los detalles de cada requerimiento.
          </p>
        </div>

        <div className="tw-advantages-grid">
          {ventajas.map((ventaja) => {
            const Icono = ventaja.icono;

            return (
              <article className="tw-advantage-card" key={ventaja.numero}>
                <span className="tw-advantage-number">
                  {ventaja.numero}
                </span>

                <div className="tw-advantage-icon">
                  <Icono size={30} />
                </div>

                <h3>{ventaja.titulo}</h3>
                <p>{ventaja.descripcion}</p>

                <span className="tw-advantage-arrow">
                  <ArrowUpRight size={20} />
                </span>
              </article>
            );
          })}
        </div>

      </div>
    </section>
  );
}

export default Ventajas;
