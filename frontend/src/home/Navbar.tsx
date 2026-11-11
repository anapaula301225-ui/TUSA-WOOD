import { useEffect, useState } from "react";
import {
  ArrowRight,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";


interface NavbarProps {
  onCotizar: () => void;
}

const Navbar = ({ onCotizar }: NavbarProps) => {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [navbarScrolleado, setNavbarScrolleado] = useState(false);

  useEffect(() => {
    const manejarScroll = () => {
      setNavbarScrolleado(window.scrollY > 30);
    };

    manejarScroll();

    window.addEventListener("scroll", manejarScroll);

    return () => {
      window.removeEventListener("scroll", manejarScroll);
    };
  }, []);

  const cerrarMenu = () => {
    setMenuAbierto(false);
  };

  const manejarCotizacion = () => {
    cerrarMenu();
    onCotizar();
  };

  const enlaces = [
    { nombre: "Inicio", href: "#inicio" },
    { nombre: "Nosotros", href: "#nosotros" },
    { nombre: "Productos", href: "#productos" },
    { nombre: "Servicios", href: "#servicios" },
    { nombre: "Ventajas", href: "#ventajas" },
    { nombre: "Contacto", href: "#contacto" },
  ];

  return (
    <header
      className={`tw-navbar ${
        navbarScrolleado ? "tw-navbar-scrolled" : ""
      }`}
    >
      <div className="tw-navbar-container">
        {/* LOGOTIPO */}
        <a
          href="#inicio"
          className="tw-navbar-brand"
          onClick={cerrarMenu}
          aria-label="TUSA WOOD - Inicio"
        >
          <img
  src="/logo-navbar.png"
  alt="TUSA WOOD"
  className="tw-navbar-logo"
/>

          <div className="tw-navbar-brand-text">
            <span className="tw-navbar-brand-name">
              TUSA <strong>WOOD</strong>
            </span>

            <span className="tw-navbar-brand-caption">
              PARIHUELAS Y SOLUCIONES LOGÍSTICAS
            </span>
          </div>
        </a>

        {/* BOTÓN MENÚ MÓVIL */}
        <button
          type="button"
          className="tw-navbar-toggle"
          onClick={() => setMenuAbierto(!menuAbierto)}
          aria-label={
            menuAbierto ? "Cerrar menú" : "Abrir menú"
          }
          aria-expanded={menuAbierto}
        >
          {menuAbierto ? <X size={25} /> : <Menu size={25} />}
        </button>

        {/* NAVEGACIÓN */}
        <nav
          className={`tw-navbar-menu ${
            menuAbierto ? "tw-navbar-menu-open" : ""
          }`}
        >
          <div className="tw-navbar-links">
            {enlaces.map((enlace) => (
              <a
                key={enlace.href}
                href={enlace.href}
                className="tw-navbar-link"
                onClick={cerrarMenu}
              >
                {enlace.nombre}
              </a>
            ))}
          </div>

          {/* ACCIONES */}
          <div className="tw-navbar-actions">
            <button
              type="button"
              className="tw-navbar-quote"
              onClick={manejarCotizacion}
            >
              <span>Solicitar cotización</span>
              <ArrowRight size={17} />
            </button>

            <a
              href="/admin/login"
              className="tw-navbar-admin"
              onClick={cerrarMenu}
              aria-label="Acceder al panel administrativo"
            >
              <ShieldCheck size={17} />
              <span>Administración</span>
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;