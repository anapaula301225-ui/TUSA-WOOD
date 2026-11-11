import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  FileText,
  Inbox,
  Info,
  Package,
  Plus,
} from 'lucide-react';
import './dashboard.css';

interface Producto {
  id_producto: number;
  nombre: string;
  activo: boolean | number | string;
}

interface Categoria {
  id_categoria: number;
  nombre: string;
  activo?: boolean | number;
}

interface CotizacionAdmin {
  id_cotizacion: number;
  codigo?: string;
  nombre_contacto?: string;
  empresa?: string;
  correo?: string;
  estado: string;
  fecha_creacion?: string;
  creado_en?: string;
}

interface DashboardProps {
  productos: Producto[];
  categorias: Categoria[];
  cotizaciones: CotizacionAdmin[];
  puedeGestionarProductos: boolean;
  totalProductosPublicos: number | null;
  totalProductosGeneral: number | null;
  onNuevoProducto: () => void;
  onVerDetalle: (cotizacion: CotizacionAdmin) => void;
}

const colores = {
  naranja: '#F07832',
  oscuro: '#22272C',
  gris: '#8B9299',
  verde: '#239B75',
  azul: '#3B7BBF',
  rojo: '#D9534F',
  amarillo: '#E0932B',
  morado: '#7B55B5',
};

/* Radio para que la circunferencia del círculo SVG sea exactamente 100 */
const RADIO_DONUT = 15.9155;

function normalizarEstado(estado?: string): string {
  return (estado || '').trim().toUpperCase().replace(/\s+/g, '_');
}

function mostrarEstado(estado?: string): string {
  const estados: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    EN_ATENCION: 'En atención',
    COTIZADA: 'Cotizada',
    ACEPTADA: 'Aceptada',
    RECHAZADA: 'Rechazada',
    CERRADA: 'Cerrada',
  };

  const valor = normalizarEstado(estado);
  return estados[valor] || estado || 'Sin estado';
}

function obtenerFecha(cotizacion: CotizacionAdmin): Date | null {
  const valor = cotizacion.creado_en || cotizacion.fecha_creacion;

  if (!valor) return null;

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function formatoFecha(fecha?: string): string {
  if (!fecha) return '—';

  const fechaConvertida = new Date(fecha);

  if (Number.isNaN(fechaConvertida.getTime())) {
    return '—';
  }

  return fechaConvertida.toLocaleString('es-PE');
}

function esActivo(valor: boolean | number | string): boolean {
  return (
    valor === true ||
    valor === 1 ||
    String(valor).trim().toLowerCase() === 'true' ||
    String(valor).trim() === '1'
  );
}

/* Cuenta de 0 al valor con una animación suave.
   Si el sistema tiene "reducir movimiento", muestra el valor directamente. */
function Contador({
  valor,
  sufijo = '',
}: {
  valor: number;
  sufijo?: string;
}) {
  const [mostrado, setMostrado] = useState(0);
  const desde = useRef(0);

  useEffect(() => {
    const reducir = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    const inicio = performance.now();
    const origen = desde.current;
    const duracion = reducir ? 1 : 750;
    let frame = 0;

    const paso = (ahora: number) => {
      const avance = Math.min(1, (ahora - inicio) / duracion);
      const suavizado = 1 - Math.pow(1 - avance, 3);
      const actual = Math.round(origen + (valor - origen) * suavizado);

      desde.current = actual;
      setMostrado(actual);

      if (avance < 1) {
        frame = requestAnimationFrame(paso);
      }
    };

    frame = requestAnimationFrame(paso);

    return () => cancelAnimationFrame(frame);
  }, [valor]);

  return (
    <>
      {mostrado}
      {sufijo}
    </>
  );
}

function Dashboard({
  productos,
  categorias,
  cotizaciones,
  puedeGestionarProductos,
  totalProductosPublicos,
  totalProductosGeneral,
  onNuevoProducto,
  onVerDetalle,
}: DashboardProps) {

  const [estadoHover, setEstadoHover] = useState<string | null>(null);

  // ============================================================
  // PRODUCTOS ACTIVOS
  // ============================================================

  // Para SUPERADMIN y GERENCIA se cuenta el estado real.
  // Para VENTAS se utiliza el total público del backend.

  const productosActivos = useMemo(() => {

    if (
      !puedeGestionarProductos &&
      totalProductosPublicos !== null &&
      Number.isFinite(Number(totalProductosPublicos))
    ) {
      return Number(totalProductosPublicos);
    }

    return productos.filter((producto) =>
      esActivo(producto.activo)
    ).length;

  }, [
    productos,
    puedeGestionarProductos,
    totalProductosPublicos,
  ]);

  // ============================================================
  // TOTAL GENERAL DE PRODUCTOS
  // ============================================================

  // El total general incluye productos activos e inactivos.
  // Se obtiene directamente desde el endpoint administrativo.

  const totalProductos = useMemo(() => {

    if (
      totalProductosGeneral !== null &&
      Number.isFinite(Number(totalProductosGeneral))
    ) {
      return Number(totalProductosGeneral);
    }

    // Respaldo mientras no se obtiene el total del backend.
    if (puedeGestionarProductos) {
      return productos.length;
    }

    return totalProductosPublicos ?? productos.length;

  }, [
    totalProductosGeneral,
    puedeGestionarProductos,
    productos,
    totalProductosPublicos,
  ]);

  // ============================================================
  // PRODUCTOS INACTIVOS
  // ============================================================

  const productosInactivos = Math.max(
    0,
    totalProductos - productosActivos
  );

  // ============================================================
  // COTIZACIONES PENDIENTES
  // ============================================================

  const pendientes = useMemo(
    () =>
      cotizaciones.filter(
        (cotizacion) =>
          normalizarEstado(cotizacion.estado) === 'PENDIENTE'
      ).length,
    [cotizaciones]
  );

  // ============================================================
  // COTIZACIONES RECIENTES
  // ============================================================

  const cotizacionesRecientes = useMemo(
    () =>
      [...cotizaciones]
        .sort((a, b) => {
          const fechaA = obtenerFecha(a)?.getTime() ?? 0;
          const fechaB = obtenerFecha(b)?.getTime() ?? 0;
          return fechaB - fechaA;
        })
        .slice(0, 5),
    [cotizaciones]
  );

  // ============================================================
  // DISTRIBUCIÓN DE COTIZACIONES POR ESTADO
  // ============================================================

  // Las claves coinciden con los estados reales del sistema.
  // Se mantienen algunos estados antiguos como respaldo.

  const estados = useMemo(() => {
    const configuracion: Record<
      string,
      { nombre: string; color: string }
    > = {
      PENDIENTE: { nombre: 'Pendiente', color: colores.amarillo },
      EN_ATENCION: { nombre: 'En atención', color: colores.azul },
      COTIZADA: { nombre: 'Cotizada', color: colores.morado },
      ACEPTADA: { nombre: 'Aceptada', color: colores.verde },
      RECHAZADA: { nombre: 'Rechazada', color: colores.rojo },
      CERRADA: { nombre: 'Cerrada', color: colores.gris },

      // Estados anteriores (respaldo)
      EN_REVISION: { nombre: 'En revisión', color: colores.azul },
      APROBADA: { nombre: 'Aprobada', color: colores.verde },
      ATENDIDA: { nombre: 'Atendida', color: colores.morado },
      COMPLETADA: { nombre: 'Completada', color: '#287A61' },
      CANCELADA: { nombre: 'Cancelada', color: colores.gris },
      CONTACTADO: { nombre: 'Contactado', color: colores.amarillo },
    };

    const conteo: Record<string, number> = {};

    cotizaciones.forEach((cotizacion) => {
      const estado =
        normalizarEstado(cotizacion.estado) || 'SIN_ESTADO';

      conteo[estado] = (conteo[estado] || 0) + 1;
    });

    return Object.entries(conteo)
      .map(([clave, cantidad]) => ({
        clave,
        nombre:
          configuracion[clave]?.nombre || mostrarEstado(clave),
        cantidad,
        color: configuracion[clave]?.color || colores.gris,
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [cotizaciones]);

  // ============================================================
  // EVOLUCIÓN MENSUAL DE COTIZACIONES
  // ============================================================

  const evolucionMensual = useMemo(() => {
    const ahora = new Date();

    const meses = Array.from({ length: 6 }, (_, indice) => {
      const fecha = new Date(
        ahora.getFullYear(),
        ahora.getMonth() - 5 + indice,
        1
      );

      return {
        clave: `${fecha.getFullYear()}-${fecha.getMonth()}`,
        nombre: fecha.toLocaleDateString('es-PE', {
          month: 'short',
        }),
        cantidad: 0,
        esActual: indice === 5,
      };
    });

    const mapa = new Map(meses.map((mes) => [mes.clave, mes]));

    cotizaciones.forEach((cotizacion) => {
      const fecha = obtenerFecha(cotizacion);
      if (!fecha) return;

      const clave = `${fecha.getFullYear()}-${fecha.getMonth()}`;
      const mes = mapa.get(clave);

      if (mes) mes.cantidad += 1;
    });

    return meses;
  }, [cotizaciones]);

  const maxCotizaciones = Math.max(
    1,
    ...evolucionMensual.map((mes) => mes.cantidad)
  );

  const cotizacionesMes =
    evolucionMensual[evolucionMensual.length - 1]?.cantidad ?? 0;

  // ============================================================
  // PORCENTAJE DE PRODUCTOS ACTIVOS
  // ============================================================

  const porcentajeActivos =
    totalProductos > 0
      ? Math.min(
          100,
          Math.round((productosActivos / totalProductos) * 100)
        )
      : 0;

  // ============================================================
  // GRÁFICO CIRCULAR DE COTIZACIONES (SVG)
  // ============================================================

  const totalEstados = estados.reduce(
    (total, estado) => total + estado.cantidad,
    0
  );

  const arcos = useMemo(() => {
    let inicio = 0;

    return estados.map((estado) => {
      const porcentaje =
        totalEstados > 0 ? (estado.cantidad / totalEstados) * 100 : 0;

      const arco = { ...estado, porcentaje, inicio };
      inicio += porcentaje;

      return arco;
    });
  }, [estados, totalEstados]);

  const arcoActivo = arcos.find(
    (arco) => arco.clave === estadoHover
  );

  // ============================================================
  // RENDERIZADO
  // ============================================================

  return (
    <div className="dashboard-container">

      <div className="tw-page-heading dashboard-heading">

        <div>
          <span className="tw-eyebrow">RESUMEN GENERAL</span>
          <h1>Panel de control</h1>
          <p>Indicadores y actividad comercial de TUSA WOOD.</p>
        </div>

        {puedeGestionarProductos && (
          <button
            type="button"
            className="tw-button-primary"
            onClick={onNuevoProducto}
          >
            <Plus size={17} aria-hidden="true" />
            Nuevo producto
          </button>
        )}

      </div>

      {/* INDICADORES COMPACTOS */}

      <section className="dashboard-kpi-grid">

        <article className="dashboard-kpi">
          <span className="dashboard-kpi-icon">
            <Package aria-hidden="true" />
          </span>

          <div>
            <span>Total de productos</span>
            <strong>
              <Contador valor={totalProductos} />
            </strong>
            <small>
              {puedeGestionarProductos
                ? `${productosInactivos} inactivos`
                : 'En el catálogo'}
            </small>
          </div>
        </article>

        <article className="dashboard-kpi">
          <span className="dashboard-kpi-icon green">
            <BadgeCheck aria-hidden="true" />
          </span>

          <div>
            <span>Productos activos</span>
            <strong>
              <Contador valor={productosActivos} />
            </strong>
            <small>{porcentajeActivos}% del catálogo</small>
          </div>
        </article>

        <article className="dashboard-kpi">
          <span className="dashboard-kpi-icon blue">
            <FileText aria-hidden="true" />
          </span>

          <div>
            <span>Cotizaciones recibidas</span>
            <strong>
              <Contador valor={cotizaciones.length} />
            </strong>
            <small>{cotizacionesMes} este mes</small>
          </div>
        </article>

        <article className="dashboard-kpi">
          <span
            className={`dashboard-kpi-icon amber${
              pendientes > 0 ? ' pulse' : ''
            }`}
          >
            <Clock aria-hidden="true" />
          </span>

          <div>
            <span>Pendientes de revisión</span>
            <strong>
              <Contador valor={pendientes} />
            </strong>
            <small>
              {pendientes > 0 ? 'Requieren atención' : 'Todo al día'}
            </small>
          </div>
        </article>

      </section>

      {/* GRÁFICOS PRINCIPALES */}

      <section className="dashboard-charts-grid">

        {/* EVOLUCIÓN DE COTIZACIONES */}

        <article className="dashboard-chart-card dashboard-chart-evolution">

          <div className="dashboard-chart-heading">

            <div>
              <span className="tw-eyebrow">TENDENCIA</span>
              <h2>Evolución de cotizaciones</h2>
              <p>Solicitudes recibidas por mes</p>
            </div>

            <span className="dashboard-chart-badge">
              Últimos 6 meses
            </span>

          </div>

          <div className="dashboard-bar-chart">

            {evolucionMensual.map((mes) => (
              <div
                className={`dashboard-bar-column${
                  mes.esActual ? ' actual' : ''
                }`}
                key={mes.clave}
              >

                <span className="dashboard-bar-value">
                  {mes.cantidad}
                </span>

                <div className="dashboard-bar-track">
                  <div
                    className={`dashboard-bar-fill${
                      mes.cantidad === 0 ? ' vacio' : ''
                    }`}
                    style={{
                      height: `${(mes.cantidad / maxCotizaciones) * 100}%`,
                    }}
                    title={`${mes.nombre}: ${mes.cantidad} cotizaciones`}
                  />
                </div>

                <span className="dashboard-bar-label">
                  {mes.nombre}
                </span>

              </div>
            ))}

          </div>

          <div className="dashboard-chart-footer">

            <span>
              <i className="dashboard-legend-dot" />
              Cotizaciones registradas
            </span>

            <strong>{cotizaciones.length} en total</strong>

          </div>

        </article>

        {/* ESTADO DE COTIZACIONES */}

        <article className="dashboard-chart-card">

          <div className="dashboard-chart-heading">
            <div>
              <span className="tw-eyebrow">SEGUIMIENTO</span>
              <h2>Estado de cotizaciones</h2>
              <p>Distribución de solicitudes</p>
            </div>
          </div>

          <div className="dashboard-donut-layout">

            <div
              className="dashboard-donut"
              role="img"
              aria-label={`Distribución de ${totalEstados} cotizaciones por estado`}
            >

              <svg
                className="dashboard-donut-svg"
                viewBox="0 0 42 42"
                aria-hidden="true"
              >
                <circle
                  className="dashboard-donut-base"
                  cx="21"
                  cy="21"
                  r={RADIO_DONUT}
                />

                {arcos.map((arco) => (
                  <circle
                    key={arco.clave}
                    className={`dashboard-donut-segment${
                      estadoHover && estadoHover !== arco.clave
                        ? ' atenuado'
                        : ''
                    }${estadoHover === arco.clave ? ' activo' : ''}`}
                    cx="21"
                    cy="21"
                    r={RADIO_DONUT}
                    stroke={arco.color}
                    strokeDasharray={`${Math.max(
                      0,
                      arco.porcentaje - (arcos.length > 1 ? 0.8 : 0)
                    )} ${
                      100 -
                      Math.max(
                        0,
                        arco.porcentaje - (arcos.length > 1 ? 0.8 : 0)
                      )
                    }`}
                    strokeDashoffset={25 - arco.inicio}
                    onMouseEnter={() => setEstadoHover(arco.clave)}
                    onMouseLeave={() => setEstadoHover(null)}
                  />
                ))}
              </svg>

              <div className="dashboard-donut-center">
                <strong>
                  <Contador
                    valor={
                      arcoActivo
                        ? arcoActivo.cantidad
                        : cotizaciones.length
                    }
                  />
                </strong>
                <span>
                  {arcoActivo ? arcoActivo.nombre : 'Solicitudes'}
                </span>
              </div>

            </div>

            <div className="dashboard-donut-legend">

              {arcos.length > 0 ? (

                arcos.map((arco) => (
                  <div
                    className={`dashboard-legend-row${
                      estadoHover === arco.clave ? ' activo' : ''
                    }`}
                    key={arco.clave}
                    onMouseEnter={() => setEstadoHover(arco.clave)}
                    onMouseLeave={() => setEstadoHover(null)}
                  >

                    <span
                      className="dashboard-legend-color"
                      style={{ background: arco.color }}
                    />

                    <span className="dashboard-legend-name">
                      {arco.nombre}
                    </span>

                    <strong>{arco.cantidad}</strong>

                    <span className="dashboard-legend-percent">
                      {Math.round(arco.porcentaje)}%
                    </span>

                  </div>
                ))

              ) : (

                <p className="dashboard-chart-empty">
                  Todavía no hay cotizaciones.
                </p>

              )}

            </div>

          </div>

        </article>

        {/* DISPONIBILIDAD DE PRODUCTOS */}

        <article className="dashboard-chart-card">

          <div className="dashboard-chart-heading">

            <div>
              <span className="tw-eyebrow">CATÁLOGO</span>
              <h2>Disponibilidad de productos</h2>
              <p>
                Productos activos frente al total registrado
              </p>
            </div>

          </div>

          <div className="dashboard-availability">

            <div className="dashboard-availability-number">
              <strong>
                <Contador valor={porcentajeActivos} sufijo="%" />
              </strong>
              <span>del catálogo está activo</span>
            </div>

            <div
              className="dashboard-progress-track"
              role="progressbar"
              aria-label="Porcentaje de productos activos"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={porcentajeActivos}
            >

              <div
                className="dashboard-progress-fill"
                style={{ width: `${porcentajeActivos}%` }}
              />

            </div>

            <div className="dashboard-availability-details">

              <div>
                <span className="dashboard-legend-color active" />
                <span>Activos</span>
                <strong>{productosActivos}</strong>
              </div>

              {/* Los inactivos solo son visibles para SUPERADMIN y GERENCIA */}

              {puedeGestionarProductos && (
                <div>
                  <span className="dashboard-legend-color inactive" />
                  <span>Inactivos</span>
                  <strong>{productosInactivos}</strong>
                </div>
              )}

            </div>

          </div>

          <div className="dashboard-chart-note">
            <Info size={16} aria-hidden="true" />

            <p>
              Se muestra el estado de publicación de los productos,
              no el stock disponible.
            </p>
          </div>

        </article>

        {/* CATEGORÍAS REGISTRADAS */}

        <article className="dashboard-chart-card">

          <div className="dashboard-chart-heading">

            <div>
              <span className="tw-eyebrow">ORGANIZACIÓN</span>
              <h2>Categorías registradas</h2>
              <p>Resumen del catálogo comercial</p>
            </div>

          </div>

          <div className="dashboard-category-summary">

            <div className="dashboard-category-total">
              <strong>
                <Contador valor={categorias.length} />
              </strong>

              <span>
                {categorias.length === 1
                  ? 'Categoría registrada'
                  : 'Categorías registradas'}
              </span>
            </div>

            {categorias.length > 0 ? (

              <div className="dashboard-category-list">

                {categorias.slice(0, 5).map((categoria, indice) => (
                  <div
                    className="dashboard-category-item"
                    key={categoria.id_categoria}
                  >

                    <span
                      className={`dashboard-category-number category-color-${indice % 5}`}
                    >
                      {String(indice + 1).padStart(2, '0')}
                    </span>

                    <span>{categoria.nombre}</span>

                    {categoria.activo !== undefined && (
                      <small
                        className={`dashboard-pill ${
                          esActivo(categoria.activo) ? 'on' : 'off'
                        }`}
                      >
                        {esActivo(categoria.activo)
                          ? 'Activa'
                          : 'Inactiva'}
                      </small>
                    )}

                  </div>
                ))}

                {categorias.length > 5 && (
                  <p className="dashboard-category-more">
                    Y {categorias.length - 5} categorías más
                  </p>
                )}

              </div>

            ) : (

              <p className="dashboard-chart-empty">
                Todavía no hay categorías registradas.
              </p>

            )}

          </div>

        </article>

      </section>

      {/* TABLA DE COTIZACIONES RECIENTES */}

      <section className="dashboard-recent-section">

        <div className="dashboard-section-heading">

          <div>
            <span className="tw-eyebrow">ACTIVIDAD COMERCIAL</span>
            <h2>Cotizaciones recientes</h2>
            <p>Últimas solicitudes recibidas por la empresa.</p>
          </div>

        </div>

        <div className="dashboard-table-container">

          <table className="dashboard-table">

            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Detalle</th>
              </tr>
            </thead>

            <tbody>

              {cotizacionesRecientes.length > 0 ? (

                cotizacionesRecientes.map((cotizacion) => {
                  const estado = normalizarEstado(
                    cotizacion.estado
                  );

                  const nombreCliente =
                    cotizacion.nombre_contacto || 'Sin nombre';

                  return (
                    <tr key={cotizacion.id_cotizacion}>

                      <td>
                        <strong className="dashboard-quote-code">
                          {cotizacion.codigo ||
                            `COT-${cotizacion.id_cotizacion}`}
                        </strong>
                      </td>

                      <td>
                        <div className="dashboard-client">

                          <span
                            className="dashboard-client-avatar"
                            aria-hidden="true"
                          >
                            {nombreCliente.charAt(0).toUpperCase()}
                          </span>

                          <div>
                            <strong>{nombreCliente}</strong>

                            <small>
                              {cotizacion.empresa ||
                                cotizacion.correo ||
                                '—'}
                            </small>
                          </div>

                        </div>
                      </td>

                      <td>
                        {formatoFecha(
                          cotizacion.creado_en ||
                            cotizacion.fecha_creacion
                        )}
                      </td>

                      <td>
                        <span
                          className={`dashboard-status status-${estado.toLowerCase()}`}
                        >
                          {mostrarEstado(cotizacion.estado)}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="dashboard-detail-button"
                          onClick={() => onVerDetalle(cotizacion)}
                        >
                          Ver detalle
                          <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      </td>

                    </tr>
                  );
                })

              ) : (

                <tr>
                  <td colSpan={5} className="dashboard-empty">
                    <span className="dashboard-empty-icon">
                      <Inbox size={26} aria-hidden="true" />
                    </span>

                    <strong>
                      No hay cotizaciones registradas
                    </strong>

                    <small>
                      Cuando recibas solicitudes, aparecerán aquí.
                    </small>
                  </td>
                </tr>

              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}

export default Dashboard;