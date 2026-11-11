import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import './supervision-comercial.css';

interface ResumenSupervision {
  readonly total_solicitudes: number;
  readonly solicitudes_pendientes: number;
  readonly solicitudes_en_atencion: number;
  readonly versiones_pendientes_aprobacion: number;
  readonly versiones_devuelta: number;
  readonly versiones_aprobadas: number;
  readonly versiones_enviadas: number;
}

interface SolicitudSupervision {
  readonly id_cotizacion: number;
  readonly codigo: string;
  readonly nombre_contacto: string;
  readonly empresa: string | null;
  readonly correo: string;
  readonly telefono: string | null;
  readonly estado_solicitud: string;
  readonly origen: string | null;
  readonly solicitud_creada_en: string;
  readonly solicitud_actualizada_en: string;

  readonly id_version: number | null;
  readonly numero_version: number | null;
  readonly estado_version: string | null;
  readonly modo_igv: string | null;
  readonly tasa_igv: string | null;
  readonly subtotal: string | null;
  readonly importe_igv: string | null;
  readonly total: string | null;
  readonly version_creada_en: string | null;
  readonly version_actualizada_en: string | null;

  readonly id_responsable: number | null;
  readonly responsable_nombre: string | null;
  readonly responsable_correo: string | null;
  readonly responsable_rol: string | null;

  readonly id_aprobacion: number | null;
  readonly ultima_accion_aprobacion: string | null;
  readonly observaciones_aprobacion: string | null;
  readonly aprobacion_creada_en: string | null;
  readonly id_aprobador: number | null;
  readonly aprobador_nombre: string | null;
  readonly aprobador_rol: string | null;

  readonly id_notificacion: number | null;
  readonly estado_notificacion: string | null;
  readonly correo_destino: string | null;
  readonly intentos_notificacion: number | null;
  readonly error_notificacion: string | null;
  readonly correo_enviado_en: string | null;
  readonly notificacion_creada_en: string | null;
  readonly proximo_intento_en: string | null;
  readonly ultimo_intento_en: string | null;
}

interface PaginacionSupervision {
  readonly pagina: number;
  readonly limite: number;
  readonly total: number;
  readonly total_paginas: number;
}

interface RespuestaSupervision {
  readonly estado: string;
  readonly mensaje?: string;
  readonly resumen: ResumenSupervision;
  readonly solicitudes: SolicitudSupervision[];
  readonly paginacion: PaginacionSupervision;
}

interface FiltrosSupervision {
  readonly estado_solicitud?: string;
  readonly estado_version?: string;
  readonly buscar?: string;
  readonly pagina: number;
  readonly limite: number;
}

interface TarjetaIndicadorProps {
  readonly titulo: string;
  readonly valor: number;
  readonly descripcion: string;
  readonly tipo: string;
}

const API_BASE = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/+$/, '');

const RESUMEN_VACIO: ResumenSupervision = {
  total_solicitudes: 0,
  solicitudes_pendientes: 0,
  solicitudes_en_atencion: 0,
  versiones_pendientes_aprobacion: 0,
  versiones_devuelta: 0,
  versiones_aprobadas: 0,
  versiones_enviadas: 0,
};

const PAGINACION_VACIA: PaginacionSupervision = {
  pagina: 1,
  limite: 20,
  total: 0,
  total_paginas: 0,
};

function obtenerError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado.';
}

function formatoFecha(fecha: string | null): string {
  if (!fecha) {
    return '—';
  }

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(valor);
}

function formatoMoneda(valor: string | null): string {
  if (valor === null || valor === undefined) {
    return '—';
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return '—';
  }

  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(numero);
}

function textoEstado(estado: string | null): string {
  if (!estado) {
    return 'Sin versión';
  }

  return estado
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function claseEstado(estado: string | null): string {
  if (!estado) {
    return 'sin-dato';
  }

  switch (estado.toUpperCase()) {
    case 'PENDIENTE':
    case 'PENDIENTE_APROBACION':
      return 'pendiente';
    case 'EN_ATENCION':
      return 'atencion';
    case 'BORRADOR':
      return 'borrador';
    case 'DEVUELTA':
    case 'RECHAZADA':
      return 'devuelta';
    case 'APROBADA':
    case 'ACEPTADA':
      return 'aprobada';
    case 'ENVIADA':
    case 'ENVIADO':
      return 'enviada';
    case 'CERRADA':
      return 'cerrada';
    default:
      return 'sin-dato';
  }
}

function TarjetaIndicador({
  titulo,
  valor,
  descripcion,
  tipo,
}: TarjetaIndicadorProps) {
  let icono = '▤';

  if (tipo === 'pendientes') icono = '◷';
  if (tipo === 'atencion') icono = '♙';
  if (tipo === 'aprobacion') icono = '✓';
  if (tipo === 'devueltas') icono = '↶';
  if (tipo === 'aprobadas') icono = '✓';
  if (tipo === 'enviadas') icono = '↗';

  return (
    <article className={`sc-kpi sc-kpi-${tipo}`}>
      <div className="sc-kpi-texto">
        <span>{titulo}</span>
        <strong>{valor}</strong>
        <small>{descripcion}</small>
      </div>

      <div className="sc-kpi-icono" aria-hidden="true">
        {icono}
      </div>
    </article>
  );
}

function construirUrl(filtros: FiltrosSupervision): string {
  const parametros = new URLSearchParams();

  if (filtros.estado_solicitud) {
    parametros.set('estado_solicitud', filtros.estado_solicitud);
  }

  if (filtros.estado_version) {
    parametros.set('estado_version', filtros.estado_version);
  }

  if (filtros.buscar) {
    parametros.set('buscar', filtros.buscar);
  }

  parametros.set('pagina', String(filtros.pagina));
  parametros.set('limite', String(filtros.limite));

  return `${API_BASE}/admin/quotes/supervision?${parametros.toString()}`;
}

async function consultarSupervision(
  filtros: FiltrosSupervision,
): Promise<RespuestaSupervision> {
  const token = localStorage.getItem('tusa_token');

  if (!token) {
    throw new Error('No se encontró el token de sesión. Inicia sesión nuevamente.');
  }

  const respuesta = await fetch(construirUrl(filtros), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const datos = await respuesta.json() as RespuestaSupervision & {
    mensaje?: string;
  };

  if (!respuesta.ok) {
    throw new Error(
      datos.mensaje || `Error del servidor: ${respuesta.status}`,
    );
  }

  if (datos.estado !== 'OK') {
    throw new Error(
      datos.mensaje || 'No se pudo obtener la supervisión comercial.',
    );
  }

  return datos;
}

function SupervisiónComercial() {
  const [resumen, setResumen] =
    useState<ResumenSupervision>(RESUMEN_VACIO);

  const [solicitudes, setSolicitudes] =
    useState<SolicitudSupervision[]>([]);

  const [paginacion, setPaginacion] =
    useState<PaginacionSupervision>(PAGINACION_VACIA);

  const [estadoSolicitud, setEstadoSolicitud] = useState('');
  const [estadoVersion, setEstadoVersion] = useState('');
  const [buscar, setBuscar] = useState('');

  const [filtrosAplicados, setFiltrosAplicados] =
    useState<FiltrosSupervision>({
      pagina: 1,
      limite: 20,
    });

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');

  const cargarSupervision = useCallback(async (
    filtros: FiltrosSupervision,
    mostrarCarga: boolean,
  ) => {
    if (mostrarCarga) {
      setCargando(true);
    } else {
      setActualizando(true);
    }

    setError('');

    try {
      const datos = await consultarSupervision(filtros);

      setResumen(datos.resumen || RESUMEN_VACIO);
      setSolicitudes(
        Array.isArray(datos.solicitudes) ? datos.solicitudes : [],
      );
      setPaginacion(datos.paginacion || PAGINACION_VACIA);
      setFiltrosAplicados(filtros);
    } catch (error_) {
      setError(obtenerError(error_));
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, []);

  useEffect(() => {
    void cargarSupervision(
      {
        pagina: 1,
        limite: 20,
      },
      true,
    );
  }, [cargarSupervision]);

  function aplicarFiltros() {
    void cargarSupervision(
      {
        estado_solicitud: estadoSolicitud || undefined,
        estado_version: estadoVersion || undefined,
        buscar: buscar.trim() || undefined,
        pagina: 1,
        limite: 20,
      },
      true,
    );
  }

  function limpiarFiltros() {
    setEstadoSolicitud('');
    setEstadoVersion('');
    setBuscar('');

    void cargarSupervision(
      {
        pagina: 1,
        limite: 20,
      },
      true,
    );
  }

  function cambiarPagina(nuevaPagina: number) {
    if (
      nuevaPagina < 1 ||
      nuevaPagina > paginacion.total_paginas
    ) {
      return;
    }

    void cargarSupervision(
      {
        ...filtrosAplicados,
        pagina: nuevaPagina,
      },
      false,
    );
  }

  function actualizar() {
    void cargarSupervision(filtrosAplicados, false);
  }

  return (
    <section className="sc-container">

      <div className="sc-header">
        <div>
          <span className="sc-eyebrow">
            CONTROL Y SEGUIMIENTO
          </span>

          <h1>Supervisión comercial</h1>

          <p>
            Consulta el estado de las solicitudes, el trabajo
            realizado por ventas y el seguimiento de las versiones
            de cotización.
          </p>
        </div>

        <button
          type="button"
          className="sc-btn sc-btn-refresh"
          onClick={actualizar}
          disabled={cargando || actualizando}
        >
          <span aria-hidden="true">↻</span>
          {actualizando ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      <div className="sc-section-heading">
        <div>
          <h2>Resumen general</h2>
          <p>Indicadores globales de la actividad comercial.</p>
        </div>
      </div>

      <div className="sc-kpi-grid">
        <TarjetaIndicador
          titulo="Solicitudes totales"
          valor={resumen.total_solicitudes}
          descripcion="Solicitudes registradas"
          tipo="solicitudes"
        />

        <TarjetaIndicador
          titulo="Pendientes"
          valor={resumen.solicitudes_pendientes}
          descripcion="Aún sin atención"
          tipo="pendientes"
        />

        <TarjetaIndicador
          titulo="En atención"
          valor={resumen.solicitudes_en_atencion}
          descripcion="En gestión comercial"
          tipo="atencion"
        />

        <TarjetaIndicador
          titulo="Pendientes de aprobación"
          valor={resumen.versiones_pendientes_aprobacion}
          descripcion="Esperando revisión de gerencia"
          tipo="aprobacion"
        />

        <TarjetaIndicador
          titulo="Devueltas"
          valor={resumen.versiones_devuelta}
          descripcion="Requieren correcciones"
          tipo="devueltas"
        />

        <TarjetaIndicador
          titulo="Aprobadas"
          valor={resumen.versiones_aprobadas}
          descripcion="Aprobación interna"
          tipo="aprobadas"
        />

        <TarjetaIndicador
          titulo="Enviadas"
          valor={resumen.versiones_enviadas}
          descripcion="Versiones enviadas al cliente"
          tipo="enviadas"
        />
      </div>

      <div className="sc-section-heading sc-list-heading">
        <div>
          <h2>Seguimiento de solicitudes</h2>
          <p>
            Revisa quién atiende cada solicitud y el estado de su
            última versión.
          </p>
        </div>
      </div>

      <div className="sc-filtros">

        <div className="sc-filtro">
          <label htmlFor="sc-buscar">
            Buscar solicitud
          </label>

          <input
            id="sc-buscar"
            type="search"
            placeholder="Código, cliente, empresa o correo..."
            value={buscar}
            onChange={(event) => setBuscar(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                aplicarFiltros();
              }
            }}
          />
        </div>

        <div className="sc-filtro">
          <label htmlFor="sc-estado-solicitud">
            Estado de solicitud
          </label>

          <select
            id="sc-estado-solicitud"
            value={estadoSolicitud}
            onChange={(event) => setEstadoSolicitud(event.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_ATENCION">En atención</option>
            <option value="COTIZADA">Cotizada</option>
            <option value="ACEPTADA">Aceptada</option>
            <option value="RECHAZADA">Rechazada</option>
            <option value="CERRADA">Cerrada</option>
          </select>
        </div>

        <div className="sc-filtro">
          <label htmlFor="sc-estado-version">
            Estado de versión
          </label>

          <select
            id="sc-estado-version"
            value={estadoVersion}
            onChange={(event) => setEstadoVersion(event.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="PENDIENTE_APROBACION">
              Pendiente de aprobación
            </option>
            <option value="DEVUELTA">Devuelta</option>
            <option value="APROBADA">Aprobada</option>
            <option value="ENVIADA">Enviada</option>
          </select>
        </div>

        <div className="sc-filtro-acciones">
          <button
            type="button"
            className="sc-btn sc-btn-primary"
            onClick={aplicarFiltros}
          >
            Buscar
          </button>

          <button
            type="button"
            className="sc-btn sc-btn-light"
            onClick={limpiarFiltros}
          >
            Limpiar
          </button>
        </div>
      </div>

      {error && (
        <div className="sc-error" role="alert">
          <strong>No se pudo cargar la supervisión.</strong>
          <span>{error}</span>

          <button type="button" onClick={actualizar}>
            Reintentar
          </button>
        </div>
      )}

      <div className="sc-table-card">

        <div className="sc-table-top">
          <div>
            <strong>Solicitudes registradas</strong>
            <span>{paginacion.total} resultado(s)</span>
          </div>

          <span className="sc-readonly">
            <span aria-hidden="true">◉</span>
            Solo lectura
          </span>
        </div>

        {cargando && (
          <output className="sc-loading">
            <span className="sc-spinner" aria-hidden="true" />
            <span>Cargando supervisión comercial...</span>
          </output>
        )}

        {!cargando && solicitudes.length === 0 && (
          <div className="sc-empty">
            <span aria-hidden="true">▤</span>
            <strong>No se encontraron solicitudes</strong>
            <p>No hay resultados para los filtros seleccionados.</p>
          </div>
        )}

        {!cargando && solicitudes.length > 0 && (
          <div className="sc-table-scroll">
            <table className="sc-table">
              <thead>
                <tr>
                  <th>Solicitud</th>
                  <th>Cliente</th>
                  <th>Estado solicitud</th>
                  <th>Responsable</th>
                  <th>Versión</th>
                  <th>Estado versión</th>
                  <th>Importes</th>
                  <th>Auditoría</th>
                  <th>Notificación</th>
                  <th>Fecha</th>
                </tr>
              </thead>

              <tbody>
                {solicitudes.map((solicitud) => (
                  <tr key={solicitud.id_cotizacion}>
                    <td>
                      <strong className="sc-code">
                        {solicitud.codigo}
                      </strong>
                      <small>ID: {solicitud.id_cotizacion}</small>
                    </td>

                    <td>
                      <strong>{solicitud.nombre_contacto}</strong>
                      <small>{solicitud.empresa || 'Sin empresa'}</small>
                      <small>{solicitud.correo}</small>
                    </td>

                    <td>
                      <span className={`sc-status sc-status-${claseEstado(solicitud.estado_solicitud)}`}>
                        {textoEstado(solicitud.estado_solicitud)}
                      </span>
                    </td>

                    <td>
                      {solicitud.responsable_nombre ? (
                        <>
                          <strong>{solicitud.responsable_nombre}</strong>
                          <small>{solicitud.responsable_rol || '—'}</small>
                          <small>{solicitud.responsable_correo || ''}</small>
                        </>
                      ) : (
                        <span className="sc-muted">Sin responsable</span>
                      )}
                    </td>

                    <td>
                      {solicitud.id_version !== null ? (
                        <>
                          <strong>Versión {solicitud.numero_version}</strong>
                          <small>IGV: {solicitud.modo_igv || '—'}</small>
                          <small>Tasa: {solicitud.tasa_igv || '—'}%</small>
                        </>
                      ) : (
                        <span className="sc-muted">Sin versión</span>
                      )}
                    </td>

                    <td>
                      <span className={`sc-status sc-status-${claseEstado(solicitud.estado_version)}`}>
                        {textoEstado(solicitud.estado_version)}
                      </span>
                    </td>

                    <td>
                      {solicitud.id_version !== null ? (
                        <>
                          <strong className="sc-money">
                            {formatoMoneda(solicitud.total)}
                          </strong>
                          <small>Subtotal: {formatoMoneda(solicitud.subtotal)}</small>
                          <small>IGV: {formatoMoneda(solicitud.importe_igv)}</small>
                        </>
                      ) : (
                        <span className="sc-muted">Sin importes</span>
                      )}
                    </td>

                    <td>
                      {solicitud.ultima_accion_aprobacion && (
                        <small>
                          Acción: {textoEstado(solicitud.ultima_accion_aprobacion)}
                        </small>
                      )}

                      {solicitud.aprobador_nombre && (
                        <small>
                          Aprobador: {solicitud.aprobador_nombre}
                        </small>
                      )}

                      {solicitud.aprobador_rol && (
                        <small>
                          Rol: {solicitud.aprobador_rol}
                        </small>
                      )}

                      {solicitud.aprobacion_creada_en && (
                        <small>
                          Fecha: {formatoFecha(solicitud.aprobacion_creada_en)}
                        </small>
                      )}

                      {solicitud.observaciones_aprobacion && (
                        <small>
                          Observaciones: {solicitud.observaciones_aprobacion}
                        </small>
                      )}

                      {!solicitud.ultima_accion_aprobacion &&
                        !solicitud.aprobador_nombre &&
                        !solicitud.observaciones_aprobacion && (
                          <span className="sc-muted">Sin registro</span>
                        )}
                    </td>

                    <td>
                      {solicitud.estado_notificacion ? (
                        <>
                          <span className={`sc-status sc-status-${claseEstado(solicitud.estado_notificacion)}`}>
                            {textoEstado(solicitud.estado_notificacion)}
                          </span>

                          <small>
                            {solicitud.correo_destino || 'Sin destinatario'}
                          </small>

                          {solicitud.intentos_notificacion !== null && (
                            <small>
                              Intentos: {solicitud.intentos_notificacion}
                            </small>
                          )}

                          {solicitud.correo_enviado_en && (
                            <small>
                              Enviado: {formatoFecha(solicitud.correo_enviado_en)}
                            </small>
                          )}

                          {solicitud.error_notificacion && (
                            <small className="sc-notification-error">
                              Error: {solicitud.error_notificacion}
                            </small>
                          )}
                        </>
                      ) : (
                        <span className="sc-muted">Sin notificación</span>
                      )}
                    </td>

                    <td>
                      {formatoFecha(solicitud.solicitud_creada_en)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!cargando && solicitudes.length > 0 && (
          <div className="sc-pagination">
            <span>
              Página {paginacion.pagina} de{' '}
              {Math.max(1, paginacion.total_paginas)}
            </span>

            <div>
              <button
                type="button"
                className="sc-btn sc-btn-light"
                disabled={paginacion.pagina <= 1 || actualizando}
                onClick={() => cambiarPagina(paginacion.pagina - 1)}
              >
                Anterior
              </button>

              <button
                type="button"
                className="sc-btn sc-btn-light"
                disabled={
                  paginacion.pagina >= paginacion.total_paginas ||
                  actualizando
                }
                onClick={() => cambiarPagina(paginacion.pagina + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="sc-audit-note">
        <strong>Información de seguimiento</strong>
        <p>
          Se muestra la última versión de cada solicitud. La aprobación
          interna y la notificación al cliente son registros independientes.
        </p>
        <p>
          Esta pantalla es de consulta: no aprueba, devuelve ni envía
          cotizaciones.
        </p>
      </div>

    </section>
  );
}

export default SupervisiónComercial;