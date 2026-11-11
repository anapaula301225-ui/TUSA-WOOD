import { ArrowRight, ArrowUpRight } from "lucide-react";

const Footer = () => {
  const anioActual = new Date().getFullYear();

  const enlaces = [
    { nombre: "Inicio", href: "#inicio" },
    { nombre: "Nosotros", href: "#nosotros" },
    { nombre: "Productos", href: "#productos" },
    { nombre: "Servicios", href: "#servicios" },
    { nombre: "Ventajas", href: "#ventajas" },
    { nombre: "Contacto", href: "#contacto" },
  ];

  return (
    <footer className="tw-footer">
      <div className="tw-footer-container">
        {/* INFORMACIÓN DE LA EMPRESA */}
        <div className="tw-footer-main">
          <div className="tw-footer-brand">
            <a href="#inicio" className="tw-footer-logo">
              <img
  src="/logo1-completo.png"
  alt="Tusa Wood - Parihuelas y embalaje"
/>
            </a>

            <p className="tw-footer-description">
              Soluciones en parihuelas de madera, embalajes y
              productos especializados para las necesidades
              de tu empresa.
            </p>

            <a
              href="#contacto"
              className="tw-footer-cta"
            >
              Solicitar información
              <ArrowRight size={17} />
            </a>
          </div>

          {/* ENLACES */}
          <div className="tw-footer-links">
            <h3>Enlaces rápidos</h3>

            <ul>
              {enlaces.map((enlace) => (
                <li key={enlace.href}>
                  <a href={enlace.href}>
                    {enlace.nombre}
                    <ArrowUpRight size={14} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* CONTACTO */}
          <div className="tw-footer-contact">
            <h3>Contáctanos</h3>

            <p>
              ¿Necesitas parihuelas o soluciones de embalaje
              para tu negocio?
            </p>

            <a href="#contacto">
              Ponte en contacto con nosotros
              <ArrowUpRight size={15} />
            </a>
          </div>
        </div>

        {/* PIE INFERIOR */}
        <div className="tw-footer-bottom">
          <p>
            © {anioActual} TUSA WOOD. Todos los derechos
            reservados.
          </p>

          <a href="#inicio">
            Volver al inicio
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;