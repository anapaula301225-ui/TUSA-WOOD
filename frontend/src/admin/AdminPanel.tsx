import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Activity,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Tags,
  User,
  Users,
  Wrench,
} from 'lucide-react';

import {
  obtenerProductosAdmin,
  obtenerProductos,
  obtenerTotalProductosPublicos,
  obtenerTotalProductosGeneral,
  obtenerCategorias,
  obtenerCotizacionesAdmin,
  cerrarSesionAdmin,
  type Producto,
  type Categoria,
  type CotizacionAdmin,
} from '../services/api';

import Dashboard from '../dashboard/Dashboard';
import GestionProductos from '../productos/GestionProductos';
import GestionCategorias from '../categorias/GestionCategorias';
import GestionServicios from '../servicios/GestionServicios';
import GestionCotizaciones from '../cotizaciones/GestionCotizaciones';
import PerfilAdmin from '../perfil/PerfilAdmin';
import GestionAdministradores from '../administradores/GestionAdministradores';
import SupervisiónComercial from '../supervision/SupervisionComercial';
import './admin-panel.css';

/* Logo TW: archivo que ya tienes en la carpeta /public */
const LOGO_TW = '/monograma-tw.png';

type Rol = 'SUPERADMIN' | 'GERENCIA' | 'VENTAS';

type Seccion =
  | 'dashboard'
  | 'productos'
  | 'categorias'
  | 'servicios'
  | 'cotizaciones'
  | 'supervision'
  | 'perfil'
  | 'administradores';

interface AdminPanelProps {
  readonly onCerrarSesion: () => void;
}

interface AdministradorSesion {
  readonly correo?: string;
  readonly nombre?: string;
  readonly rol?: string;
}

function normalizarRol(rol?: string): Rol | null {
  const valor = (rol || '').trim().toUpperCase();

  if (
    valor === 'SUPERADMIN' ||
    valor === 'GERENCIA' ||
    valor === 'VENTAS'
  ) {
    return valor;
  }

  return null;
}

function errorMensaje(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado.';
}

function normalizarEstado(
  estado: string | null | undefined,
): string {
  return (estado || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function formatoTiempoRestante(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const segundosFinales = segundos % 60;

  return `${minutos}:${String(segundosFinales).padStart(2, '0')}`;
}

function leerAdministrador(): AdministradorSesion {
  try {
    const guardado = localStorage.getItem('tusa_administrador');

    if (!guardado) {
      return {};
    }

    return JSON.parse(guardado) as AdministradorSesion;
  } catch {
    return {};
  }
}

function leerExpiracionToken(token: string): number {
  const partes = token.split('.');

  if (partes.length !== 3) {
    throw new Error('Token inválido');
  }

  const payloadToken = partes[1]
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(
      Math.ceil(partes[1].length / 4) * 4,
      '=',
    );

  const payload = JSON.parse(atob(payloadToken)) as {
    exp?: number;
  };

  if (
    typeof payload.exp !== 'number' ||
    !Number.isFinite(payload.exp)
  ) {
    throw new Error(
      'El token no contiene una expiración válida',
    );
  }

  return payload.exp;
}

function AdminPanel({
  onCerrarSesion,
}: AdminPanelProps) {

  const [seccion, setSeccion] = useState<Seccion>('dashboard');

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cotizaciones, setCotizaciones] = useState<CotizacionAdmin[]>([]);

  const [totalProductosPublicos, setTotalProductosPublicos] =
    useState<number | null>(null);

  const [totalProductosGeneral, setTotalProductosGeneral] =
    useState<number | null>(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [segundosRestantes, setSegundosRestantes] =
    useState<number | null>(null);

  const administrador = useMemo(
    () => leerAdministrador(),
    [],
  );

  const rol = normalizarRol(administrador.rol);
  const esSuperadmin = rol === 'SUPERADMIN';

  const puedeGestionarCatalogo =
    rol === 'SUPERADMIN' || rol === 'GERENCIA';

  const puedeVerSupervision =
    rol === 'SUPERADMIN' || rol === 'GERENCIA';

  const cotizacionesDashboard = useMemo(
    () =>
      cotizaciones.map((cotizacion) => ({
        ...cotizacion,
        empresa: cotizacion.empresa ?? undefined,
      })),
    [cotizaciones],
  );

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError('');

    try {
      const solicitudes = await Promise.allSettled([
        obtenerCotizacionesAdmin(),

        puedeGestionarCatalogo
          ? obtenerProductosAdmin()
          : obtenerProductos(),

        obtenerCategorias(),

        puedeGestionarCatalogo
          ? Promise.resolve(null)
          : obtenerTotalProductosPublicos(),

        obtenerTotalProductosGeneral(),
      ]);

      const errores: string[] = [];

      const resultadoCotizaciones = solicitudes[0];

      if (resultadoCotizaciones.status === 'fulfilled') {
        setCotizaciones(
          resultadoCotizaciones.value as CotizacionAdmin[],
        );
      } else {
        setCotizaciones([]);
        errores.push(
          `Cotizaciones: ${errorMensaje(resultadoCotizaciones.reason)}`,
        );
      }

      const resultadoProductos = solicitudes[1];

      if (resultadoProductos.status === 'fulfilled') {
        const productosCargados =
          resultadoProductos.value as Producto[];

        setProductos(
          puedeGestionarCatalogo
            ? productosCargados
            : productosCargados.map((producto) => ({
                ...producto,
                activo: true,
              })),
        );
      } else {
        setProductos([]);
        errores.push(
          `Productos: ${errorMensaje(resultadoProductos.reason)}`,
        );
      }

      const resultadoCategorias = solicitudes[2];

      if (resultadoCategorias.status === 'fulfilled') {
        setCategorias(
          resultadoCategorias.value as Categoria[],
        );
      } else {
        setCategorias([]);
        errores.push(
          `Categorías: ${errorMensaje(resultadoCategorias.reason)}`,
        );
      }

      const resultadoTotalPublico = solicitudes[3];

      if (!puedeGestionarCatalogo) {
        if (
          resultadoTotalPublico.status === 'fulfilled' &&
          resultadoTotalPublico.value !== null
        ) {
          setTotalProductosPublicos(
            resultadoTotalPublico.value as number,
          );
        } else {
          setTotalProductosPublicos(null);

          if (resultadoTotalPublico.status === 'rejected') {
            errores.push(
              `Total de productos activos: ${errorMensaje(resultadoTotalPublico.reason)}`,
            );
          }
        }
      } else {
        setTotalProductosPublicos(null);
      }

      const resultadoTotalGeneral = solicitudes[4];

      if (resultadoTotalGeneral.status === 'fulfilled') {
        setTotalProductosGeneral(
          resultadoTotalGeneral.value as number,
        );
      } else {
        setTotalProductosGeneral(null);
        errores.push(
          `Total general de productos: ${errorMensaje(resultadoTotalGeneral.reason)}`,
        );
      }

      if (errores.length > 0) {
        setError(
          'No se pudo cargar parte de la información. ' +
          errores.join(' | '),
        );
      }
    } catch (errorInesperado) {
      setError(
        `Error al cargar la información: ${errorMensaje(errorInesperado)}`,
      );
    } finally {
      setCargando(false);
    }
  }, [puedeGestionarCatalogo]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    let cerrandoSesion = false;

    function finalizarSesion() {
      if (cerrandoSesion) {
        return;
      }

      cerrandoSesion = true;
      setSegundosRestantes(0);
      cerrarSesionAdmin();
      onCerrarSesion();
    }

    function comprobarExpiracion() {
      if (cerrandoSesion) {
        return;
      }

      try {
        const tokenActual = localStorage.getItem('tusa_token');

        if (!tokenActual) {
          finalizarSesion();
          return;
        }

        const expiracion = leerExpiracionToken(tokenActual);

        const segundos = Math.max(
          0,
          Math.ceil(expiracion - Date.now() / 1000),
        );

        setSegundosRestantes(segundos);

        if (segundos <= 0) {
          finalizarSesion();
        }
      } catch {
        finalizarSesion();
      }
    }

    comprobarExpiracion();

    const intervalo = window.setInterval(
      comprobarExpiracion,
      1000,
    );

    return () => {
      window.clearInterval(intervalo);
    };
  }, [onCerrarSesion]);

  const pendientes = useMemo(
    () =>
      cotizaciones.filter(
        (cotizacion) =>
          normalizarEstado(cotizacion.estado) === 'PENDIENTE',
      ).length,
    [cotizaciones],
  );

  const titulosSeccion: Record<Seccion, string> = {
    dashboard: 'Dashboard',
    productos: 'Productos',
    categorias: 'Categorías',
    servicios: 'Servicios',
    cotizaciones: 'Cotizaciones',
    supervision: 'Supervisión comercial',
    perfil: 'Mi perfil',
    administradores: 'Gestión de administradores',
  };

  function cambiarSeccion(nueva: Seccion) {
    if (nueva === 'administradores' && !esSuperadmin) {
      return;
    }

    if (
      (
        nueva === 'productos' ||
        nueva === 'categorias' ||
        nueva === 'servicios'
      ) &&
      !puedeGestionarCatalogo
    ) {
      return;
    }

    if (nueva === 'supervision' && !puedeVerSupervision) {
      return;
    }

    setSeccion(nueva);
    setError('');
  }

  function cerrarSesion() {
    cerrarSesionAdmin();
    onCerrarSesion();
  }

  return (
    <main className="tw-admin">

      <aside className="tw-sidebar">

        <a href="/" className="tw-brand" aria-label="TUSA WOOD, ir al inicio">
          <span className="tw-brand-mark">
            <img
              src={LOGO_TW}
              alt=""
              width={52}
              height={51}
              decoding="async"
              draggable={false}
            />
          </span>

          <span className="tw-brand-copy">
            <strong>
              TUSA <span>WOOD</span>
            </strong>
            <small>ADMINISTRACIÓN</small>
          </span>
        </a>

        <div className="tw-sidebar-label">
          MENÚ PRINCIPAL
        </div>

        <nav
          className="tw-side-nav"
          aria-label="Menú administrativo"
        >

          <button
            type="button"
            className={seccion === 'dashboard' ? 'active' : ''}
            aria-current={seccion === 'dashboard' ? 'page' : undefined}
            onClick={() => cambiarSeccion('dashboard')}
          >
            <span aria-hidden="true"><LayoutDashboard /></span>
            <span>Dashboard</span>
          </button>

          {puedeGestionarCatalogo && (
            <>
              <button
                type="button"
                className={seccion === 'productos' ? 'active' : ''}
                aria-current={seccion === 'productos' ? 'page' : undefined}
                onClick={() => cambiarSeccion('productos')}
              >
                <span aria-hidden="true"><Package /></span>
                <span>Productos</span>
              </button>

              <button
                type="button"
                className={seccion === 'categorias' ? 'active' : ''}
                aria-current={seccion === 'categorias' ? 'page' : undefined}
                onClick={() => cambiarSeccion('categorias')}
              >
                <span aria-hidden="true"><Tags /></span>
                <span>Categorías</span>
              </button>

              <button
                type="button"
                className={seccion === 'servicios' ? 'active' : ''}
                aria-current={seccion === 'servicios' ? 'page' : undefined}
                onClick={() => cambiarSeccion('servicios')}
              >
                <span aria-hidden="true"><Wrench /></span>
                <span>Servicios</span>
              </button>
            </>
          )}

          <button
            type="button"
            className={seccion === 'cotizaciones' ? 'active' : ''}
            aria-current={seccion === 'cotizaciones' ? 'page' : undefined}
            onClick={() => cambiarSeccion('cotizaciones')}
          >
            <span aria-hidden="true"><FileText /></span>
            <span>Cotizaciones</span>

            {pendientes > 0 && (
              <span className="tw-nav-count">
                {pendientes}
              </span>
            )}
          </button>

          {puedeVerSupervision && (
            <button
              type="button"
              className={seccion === 'supervision' ? 'active' : ''}
              aria-current={seccion === 'supervision' ? 'page' : undefined}
              onClick={() => cambiarSeccion('supervision')}
            >
              <span aria-hidden="true"><Activity /></span>
              <span>Supervisión comercial</span>
            </button>
          )}

        </nav>

        <div className="tw-sidebar-label">
          CUENTA
        </div>

        <nav
          className="tw-side-nav"
          aria-label="Cuenta y administración"
        >

          <button
            type="button"
            className={seccion === 'perfil' ? 'active' : ''}
            aria-current={seccion === 'perfil' ? 'page' : undefined}
            onClick={() => cambiarSeccion('perfil')}
          >
            <span aria-hidden="true"><User /></span>
            <span>Mi perfil</span>
          </button>

          {esSuperadmin && (
            <button
              type="button"
              className={seccion === 'administradores' ? 'active' : ''}
              aria-current={seccion === 'administradores' ? 'page' : undefined}
              onClick={() => cambiarSeccion('administradores')}
            >
              <span aria-hidden="true"><Users /></span>
              <span>Administradores</span>
            </button>
          )}

        </nav>

        <div className="tw-sidebar-bottom">

          <div className="tw-user-avatar" aria-hidden="true">
            {(administrador.nombre || administrador.correo || 'A')
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="tw-user-info">
            <strong>
              {administrador.nombre || 'Administrador'}
            </strong>

            <small>
              {rol || 'Rol no identificado'}
            </small>
          </div>

          <button
            type="button"
            className="tw-logout-icon"
            onClick={cerrarSesion}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut aria-hidden="true" />
          </button>

        </div>

      </aside>

      <section className="tw-admin-content">

        {segundosRestantes !== null &&
          segundosRestantes > 0 &&
          segundosRestantes <= 300 && (
            <div className="tw-session-warning" role="alert">
              <strong>Tu sesión está por expirar.</strong>

              <span>
                Tiempo restante:{' '}
                {formatoTiempoRestante(segundosRestantes)}.
                Guarda tus cambios antes de que termine.
              </span>
            </div>
          )}

        <header className="tw-topbar">
          <div className="tw-topbar-title">
            <span className="tw-breadcrumb">
              TUSA WOOD /
            </span>

            <strong>{titulosSeccion[seccion]}</strong>
          </div>
        </header>

        <div className="tw-page">

          {error && (
            <div className="tw-alert tw-alert-error" role="alert">
              <span>{error}</span>

              <button
                type="button"
                onClick={() => setError('')}
                aria-label="Cerrar error"
              >
                ×
              </button>
            </div>
          )}

          {seccion === 'dashboard' && (
            <>
              {cargando ? (
                <div className="tw-loading">
                  <span className="tw-spinner" aria-hidden="true" />
                  <span>Cargando información del sistema...</span>
                </div>
              ) : (
                <Dashboard
                  productos={productos}
                  categorias={categorias}
                  cotizaciones={cotizacionesDashboard}
                  puedeGestionarProductos={puedeGestionarCatalogo}
                  totalProductosPublicos={totalProductosPublicos}
                  totalProductosGeneral={totalProductosGeneral}
                  onNuevoProducto={() => {
                    if (puedeGestionarCatalogo) {
                      cambiarSeccion('productos');
                    }
                  }}
                  onVerDetalle={() => {
                    cambiarSeccion('cotizaciones');
                  }}
                />
              )}
            </>
          )}

          {seccion === 'productos' && puedeGestionarCatalogo && (
            <GestionProductos />
          )}

          {seccion === 'categorias' && puedeGestionarCatalogo && (
            <GestionCategorias />
          )}

          {seccion === 'servicios' && puedeGestionarCatalogo && (
            <GestionServicios />
          )}

          {seccion === 'cotizaciones' && (
            <GestionCotizaciones />
          )}

          {seccion === 'supervision' && puedeVerSupervision && (
            <SupervisiónComercial />
          )}

          {seccion === 'perfil' && (
            <PerfilAdmin />
          )}

          {seccion === 'administradores' && esSuperadmin && (
            <GestionAdministradores />
          )}

        </div>
      </section>
    </main>
  );
}

export default AdminPanel;