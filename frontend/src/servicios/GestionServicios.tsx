import { useEffect, useMemo, useState } from 'react';
import {
  obtenerServiciosAdmin,
  crearServicioAdmin,
  actualizarServicioAdmin,
  cambiarEstadoServicioAdmin,
  type Servicio,
} from '../services/api';
import './services-management.css';

type FiltroEstado = 'TODOS' | 'ACTIVOS' | 'INACTIVOS';

interface DatosFormulario {
  nombre: string;
  descripcion: string;
}

const FORMULARIO_VACIO: DatosFormulario = {
  nombre: '',
  descripcion: '',
};

function obtenerError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado. Inténtalo nuevamente.';
}

function formatearFecha(fecha?: string): string {
  if (!fecha) return 'No disponible';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) return 'No disponible';

  return valor.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function GestionServicios() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] =
    useState<FiltroEstado>('TODOS');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [servicioEditar, setServicioEditar] =
    useState<Servicio | null>(null);
  const [formulario, setFormulario] =
    useState<DatosFormulario>(FORMULARIO_VACIO);
  const [errorFormulario, setErrorFormulario] = useState('');

  async function cargarServicios(mostrarCarga = true) {
    try {
      if (mostrarCarga) setCargando(true);
      setError('');

      const respuesta = await obtenerServiciosAdmin();
      setServicios(respuesta);
    } catch (err) {
      setError(obtenerError(err));
    } finally {
      if (mostrarCarga) setCargando(false);
    }
  }

  useEffect(() => {
    void cargarServicios();
  }, []);

  const resumen = useMemo(() => ({
    total: servicios.length,
    activos: servicios.filter((servicio) => servicio.activo).length,
    inactivos: servicios.filter((servicio) => !servicio.activo).length,
  }), [servicios]);

  const serviciosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return servicios.filter((servicio) => {
      const coincideTexto =
        servicio.nombre.toLowerCase().includes(texto) ||
        (servicio.descripcion || '').toLowerCase().includes(texto);

      const coincideEstado =
        filtroEstado === 'TODOS' ||
        (filtroEstado === 'ACTIVOS' && servicio.activo) ||
        (filtroEstado === 'INACTIVOS' && !servicio.activo);

      return coincideTexto && coincideEstado;
    });
  }, [servicios, busqueda, filtroEstado]);

  function abrirCrear() {
    setServicioEditar(null);
    setFormulario(FORMULARIO_VACIO);
    setErrorFormulario('');
    setMensaje('');
    setModalAbierto(true);
  }

  function abrirEditar(servicio: Servicio) {
    setServicioEditar(servicio);
    setFormulario({
      nombre: servicio.nombre,
      descripcion: servicio.descripcion || '',
    });
    setErrorFormulario('');
    setMensaje('');
    setModalAbierto(true);
  }

  function cerrarModal() {
    if (guardando) return;
    setModalAbierto(false);
    setServicioEditar(null);
    setFormulario(FORMULARIO_VACIO);
    setErrorFormulario('');
  }

  function actualizarCampo(
    campo: keyof DatosFormulario,
    valor: string,
  ) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  async function guardarServicio(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const nombre = formulario.nombre.trim();
    const descripcion = formulario.descripcion.trim();

    if (!nombre) {
      setErrorFormulario('El nombre del servicio es obligatorio.');
      return;
    }

    if (nombre.length > 150) {
      setErrorFormulario('El nombre no puede superar los 150 caracteres.');
      return;
    }

    if (descripcion.length > 5000) {
      setErrorFormulario('La descripción no puede superar los 5000 caracteres.');
      return;
    }

    setGuardando(true);
    setErrorFormulario('');

    try {
      const datos = { nombre, descripcion };

      if (servicioEditar) {
        await actualizarServicioAdmin(
          servicioEditar.id_servicio,
          datos,
        );
        setMensaje('El servicio se actualizó correctamente.');
      } else {
        await crearServicioAdmin(datos);
        setMensaje('El servicio se registró correctamente.');
      }

      setModalAbierto(false);
      setServicioEditar(null);
      setFormulario(FORMULARIO_VACIO);
      await cargarServicios(false);
    } catch (err) {
      setErrorFormulario(obtenerError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function alternarEstado(servicio: Servicio) {
    const nuevoEstado = !servicio.activo;
    const accion = nuevoEstado ? 'activar' : 'desactivar';

    const confirmado = window.confirm(
      `¿Estás seguro de ${accion} el servicio "${servicio.nombre}"?`,
    );

    if (!confirmado) return;

    setError('');
    setMensaje('');

    try {
      await cambiarEstadoServicioAdmin(
        servicio.id_servicio,
        nuevoEstado,
      );

      setMensaje(
        nuevoEstado
          ? 'El servicio se activó correctamente.'
          : 'El servicio se desactivó correctamente.',
      );

      await cargarServicios(false);
    } catch (err) {
      setError(obtenerError(err));
    }
  }

  return (
    <section className="servicios-page">
      <header className="servicios-header">
        <div>
          <span className="servicios-eyebrow">ADMINISTRACIÓN DEL CATÁLOGO</span>
          <h1>Gestión de servicios</h1>
          <p>
            Administra los servicios adicionales que TUSA WOOD ofrece
            a sus clientes.
          </p>
        </div>

        <button
          type="button"
          className="servicios-btn-primary"
          onClick={abrirCrear}
        >
          <span aria-hidden="true">＋</span>
          Nuevo servicio
        </button>
      </header>

      <div className="servicios-resumen">
        <article className="servicios-resumen-card">
          <div className="servicios-resumen-icono total">▤</div>
          <div>
            <span>Total de servicios</span>
            <strong>{resumen.total}</strong>
          </div>
        </article>

        <article className="servicios-resumen-card">
          <div className="servicios-resumen-icono activo">✓</div>
          <div>
            <span>Servicios activos</span>
            <strong>{resumen.activos}</strong>
          </div>
        </article>

        <article className="servicios-resumen-card">
          <div className="servicios-resumen-icono inactivo">Ⅱ</div>
          <div>
            <span>Servicios inactivos</span>
            <strong>{resumen.inactivos}</strong>
          </div>
        </article>
      </div>

      {mensaje && (
        <div className="servicios-alerta servicios-alerta-exito">
          <span>✓</span>
          {mensaje}
          <button
            type="button"
            onClick={() => setMensaje('')}
            aria-label="Cerrar mensaje"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="servicios-alerta servicios-alerta-error">
          <span>!</span>
          {error}
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Cerrar mensaje"
          >
            ×
          </button>
        </div>
      )}

      <div className="servicios-panel">
        <div className="servicios-panel-header">
          <div>
            <h2>Servicios registrados</h2>
            <p>Consulta, edita y administra la disponibilidad de cada servicio.</p>
          </div>

          <button
            type="button"
            className="servicios-btn-secundario"
            onClick={() => void cargarServicios()}
            disabled={cargando}
          >
            ↻ Actualizar
          </button>
        </div>

        <div className="servicios-filtros">
          <div className="servicios-buscador">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Buscar por nombre o descripción..."
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
            />
          </div>

          <select
            className="servicios-filtro-estado"
            value={filtroEstado}
            onChange={(evento) =>
              setFiltroEstado(evento.target.value as FiltroEstado)
            }
            aria-label="Filtrar por estado"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="ACTIVOS">Solo activos</option>
            <option value="INACTIVOS">Solo inactivos</option>
          </select>
        </div>

        {cargando ? (
          <div className="servicios-estado-vacio">
            <div className="servicios-spinner" />
            <p>Cargando servicios...</p>
          </div>
        ) : serviciosFiltrados.length === 0 ? (
          <div className="servicios-estado-vacio">
            <span className="servicios-vacio-icono">▤</span>
            <h3>
              {servicios.length === 0
                ? 'Todavía no hay servicios registrados'
                : 'No se encontraron servicios'}
            </h3>
            <p>
              {servicios.length === 0
                ? 'Registra el primer servicio para comenzar a administrar el catálogo.'
                : 'Prueba con otro término de búsqueda o cambia el filtro.'}
            </p>

            {servicios.length === 0 && (
              <button
                type="button"
                className="servicios-btn-primary"
                onClick={abrirCrear}
              >
                ＋ Registrar primer servicio
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="servicios-tabla-contenedor">
              <table className="servicios-tabla">
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th>Descripción</th>
                    <th>Fecha de registro</th>
                    <th>Estado</th>
                    <th className="servicios-columna-acciones">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {serviciosFiltrados.map((servicio) => (
                    <tr key={servicio.id_servicio}>
                      <td>
                        <div className="servicios-nombre">
                          <span className="servicios-nombre-icono">▤</span>
                          <strong>{servicio.nombre}</strong>
                        </div>
                      </td>

                      <td>
                        <span className="servicios-descripcion">
                          {servicio.descripcion?.trim() ||
                            'Sin descripción'}
                        </span>
                      </td>

                      <td>{formatearFecha(servicio.creado_en)}</td>

                      <td>
                        <span
                          className={`servicios-estado ${
                            servicio.activo ? 'estado-activo' : 'estado-inactivo'
                          }`}
                        >
                          <span />
                          {servicio.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>

                      <td>
                        <div className="servicios-acciones">
                          <button
                            type="button"
                            className="servicios-accion editar"
                            onClick={() => abrirEditar(servicio)}
                            title="Editar servicio"
                            aria-label={`Editar ${servicio.nombre}`}
                          >
                            ✎
                          </button>

                          <button
                            type="button"
                            className={`servicios-accion ${
                              servicio.activo ? 'desactivar' : 'activar'
                            }`}
                            onClick={() => void alternarEstado(servicio)}
                            title={servicio.activo ? 'Desactivar' : 'Activar'}
                            aria-label={`${
                              servicio.activo ? 'Desactivar' : 'Activar'
                            } ${servicio.nombre}`}
                          >
                            {servicio.activo ? 'Ⅱ' : '✓'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="servicios-pie-tabla">
              Mostrando <strong>{serviciosFiltrados.length}</strong> de{' '}
              <strong>{servicios.length}</strong> servicios
            </div>
          </>
        )}
      </div>

      {modalAbierto && (
        <div
          className="servicios-modal-fondo"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) cerrarModal();
          }}
        >
          <section
            className="servicios-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="servicios-modal-titulo"
          >
            <header className="servicios-modal-header">
              <div>
                <span className="servicios-eyebrow">
                  CATÁLOGO DE SERVICIOS
                </span>
                <h2 id="servicios-modal-titulo">
                  {servicioEditar ? 'Editar servicio' : 'Nuevo servicio'}
                </h2>
                <p>
                  {servicioEditar
                    ? 'Modifica la información del servicio seleccionado.'
                    : 'Completa los datos para registrar un nuevo servicio.'}
                </p>
              </div>

              <button
                type="button"
                className="servicios-modal-cerrar"
                onClick={cerrarModal}
                disabled={guardando}
                aria-label="Cerrar ventana"
              >
                ×
              </button>
            </header>

            <form onSubmit={guardarServicio}>
              <div className="servicios-formulario">
                <label htmlFor="servicio-nombre">
                  Nombre del servicio <span>*</span>
                </label>
                <input
                  id="servicio-nombre"
                  type="text"
                  value={formulario.nombre}
                  onChange={(evento) =>
                    actualizarCampo('nombre', evento.target.value)
                  }
                  placeholder="Ej. Embalaje especializado"
                  maxLength={150}
                  required
                  autoFocus
                  disabled={guardando}
                />
                <small>{formulario.nombre.length}/150 caracteres</small>

                <label htmlFor="servicio-descripcion">
                  Descripción
                </label>
                <textarea
                  id="servicio-descripcion"
                  value={formulario.descripcion}
                  onChange={(evento) =>
                    actualizarCampo('descripcion', evento.target.value)
                  }
                  placeholder="Describe brevemente en qué consiste el servicio..."
                  maxLength={5000}
                  rows={5}
                  disabled={guardando}
                />
                <small>
                  {formulario.descripcion.length}/5000 caracteres
                </small>
              </div>

              {errorFormulario && (
                <div className="servicios-form-error">
                  {errorFormulario}
                </div>
              )}

              <footer className="servicios-modal-footer">
                <button
                  type="button"
                  className="servicios-btn-cancelar"
                  onClick={cerrarModal}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="servicios-btn-primary"
                  disabled={guardando}
                >
                  {guardando
                    ? 'Guardando...'
                    : servicioEditar
                      ? 'Guardar cambios'
                      : 'Registrar servicio'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}