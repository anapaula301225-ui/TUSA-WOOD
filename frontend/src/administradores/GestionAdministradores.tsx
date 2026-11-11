import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';

import {
  obtenerAdministradoresAdmin,
  crearAdministradorAdmin,
  actualizarAdministradorAdmin,
  cambiarEstadoAdministradorAdmin,
  type AdministradorGestion,
} from '../services/api';

import { alertas } from '../utils/alertas';

import './admin-management.css';

type RolAdmin = 'SUPERADMIN' | 'ADMIN' | 'VENTAS' | 'GERENCIA';

interface FormularioAdmin {
  nombre: string;
  correo: string;
  password: string;
  rol: RolAdmin;
}

const formularioInicial: FormularioAdmin = {
  nombre: '',
  correo: '',
  password: '',
  rol: 'VENTAS',
};

const roles: RolAdmin[] = ['SUPERADMIN', 'ADMIN', 'VENTAS', 'GERENCIA'];

function mensajeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado.';
}

function GestionAdministradores() {
  const [administradores, setAdministradores] = useState<
    AdministradorGestion[]
  >([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState<number | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);

  const [adminEditar, setAdminEditar] =
    useState<AdministradorGestion | null>(null);

  const [formulario, setFormulario] =
    useState<FormularioAdmin>(formularioInicial);

  const cargarAdministradores = useCallback(async () => {
    setCargando(true);

    try {
      const datos = await obtenerAdministradoresAdmin();
      setAdministradores(datos);
    } catch (error) {
      await alertas.error(
        'Error al cargar administradores',
        mensajeError(error),
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarAdministradores();
  }, [cargarAdministradores]);

  // Bloquea el scroll del fondo mientras el modal está abierto
  useEffect(() => {
    if (!modalAbierto) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [modalAbierto]);

  const filtrados = administradores.filter((admin) =>
    `${admin.nombre ?? ''} ${admin.correo ?? ''} ${admin.rol ?? ''}`
      .toLowerCase()
      .includes(busqueda.toLowerCase().trim()),
  );

  function abrirCrear() {
    setAdminEditar(null);
    setFormulario(formularioInicial);
    setModalAbierto(true);
  }

  function abrirEditar(admin: AdministradorGestion) {
    setAdminEditar(admin);

    setFormulario({
      nombre: admin.nombre ?? '',
      correo: admin.correo ?? '',
      password: '',
      rol: admin.rol as RolAdmin,
    });

    setModalAbierto(true);
  }

  function cerrarModal() {
    if (guardando) return;

    setModalAbierto(false);
    setAdminEditar(null);
    setFormulario(formularioInicial);
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (guardando) return;

    if (!formulario.nombre.trim() || !formulario.correo.trim()) {
      await alertas.advertencia(
        'Campos obligatorios',
        'Completa el nombre y el correo electrónico.',
      );
      return;
    }

    if (!adminEditar && formulario.password.length < 8) {
      await alertas.advertencia(
        'Contraseña no válida',
        'La contraseña inicial debe tener al menos 8 caracteres.',
      );
      return;
    }

    setGuardando(true);

    try {
      if (adminEditar) {
        await actualizarAdministradorAdmin(adminEditar.id_administrador, {
          nombre: formulario.nombre.trim(),
          correo: formulario.correo.trim(),
          rol: formulario.rol,
        });

        setModalAbierto(false);
        setFormulario(formularioInicial);
        setAdminEditar(null);

        await alertas.exito(
          'Administrador actualizado',
          'Los datos del administrador se actualizaron correctamente.',
        );
      } else {
        await crearAdministradorAdmin({
          nombre: formulario.nombre.trim(),
          correo: formulario.correo.trim(),
          password: formulario.password,
          rol: formulario.rol,
        });

        setModalAbierto(false);
        setFormulario(formularioInicial);
        setAdminEditar(null);

        await alertas.exito(
          'Administrador registrado',
          'La nueva cuenta se creó correctamente.',
        );
      }

      await cargarAdministradores();
    } catch (error) {
      await alertas.error('No se pudo guardar', mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(admin: AdministradorGestion) {
    const nuevoEstado = !admin.activo;

    const confirmado = await alertas.confirmar(
      nuevoEstado ? '¿Activar cuenta?' : '¿Desactivar cuenta?',
      nuevoEstado
        ? `Se habilitará nuevamente el acceso de ${admin.nombre}.`
        : `Se deshabilitará el acceso de ${admin.nombre}.`,
      nuevoEstado ? 'Sí, activar' : 'Sí, desactivar',
    );

    if (!confirmado) return;

    setCambiandoEstado(admin.id_administrador);

    try {
      await cambiarEstadoAdministradorAdmin(
        admin.id_administrador,
        nuevoEstado,
      );

      await alertas.exito(
        nuevoEstado ? 'Cuenta activada' : 'Cuenta desactivada',
        nuevoEstado
          ? 'El administrador ya puede acceder al sistema.'
          : 'El acceso del administrador ha sido deshabilitado.',
      );

      await cargarAdministradores();
    } catch (error) {
      await alertas.error('No se pudo cambiar el estado', mensajeError(error));
    } finally {
      setCambiandoEstado(null);
    }
  }

  return (
    <>
      <section className="tw-admin-management">
        {/* ENCABEZADO */}
        <div className="tw-page-heading">
          <div>
            <span className="tw-eyebrow">CONTROL DE ACCESOS</span>
            <h1>Gestión de administradores</h1>
            <p>Administra las cuentas y los permisos del equipo.</p>
          </div>

          <button
            type="button"
            className="tw-button-primary"
            onClick={abrirCrear}
          >
            <span className="tw-button-icon">+</span>
            Nuevo administrador
          </button>
        </div>

        {/* PANEL PRINCIPAL */}
        <section className="tw-panel">
          <div className="tw-toolbar">
            <div className="tw-search-container">
              <span className="tw-search-icon" aria-hidden="true">
                ⌕
              </span>

              <input
                className="tw-search"
                type="search"
                aria-label="Buscar administradores"
                placeholder="Buscar por nombre, correo o rol..."
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
              />
            </div>

            <span className="tw-result-count">
              {filtrados.length} {filtrados.length === 1 ? 'cuenta' : 'cuentas'}
            </span>
          </div>

          {/* CARGA */}
          {cargando ? (
            <div className="tw-loading" role="status">
              <span className="tw-spinner" aria-hidden="true" />
              <span>Cargando administradores...</span>
            </div>
          ) : (
            <div className="tw-table-wrap">
              <table className="tw-table">
                <thead>
                  <tr>
                    <th scope="col">ADMINISTRADOR</th>
                    <th scope="col">ROL</th>
                    <th scope="col">ESTADO</th>
                    <th scope="col">ACCIONES</th>
                  </tr>
                </thead>

                <tbody>
                  {filtrados.map((admin) => (
                    <tr key={admin.id_administrador}>
                      <td>
                        <div className="tw-admin-user">
                          <span className="tw-admin-avatar">
                            {(
                              admin.nombre?.trim().charAt(0) || 'A'
                            ).toUpperCase()}
                          </span>

                          <div className="tw-admin-user-info">
                            <strong>{admin.nombre}</strong>
                            <small>{admin.correo}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`tw-role-badge tw-role-${admin.rol?.toLowerCase()}`}
                        >
                          {admin.rol}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`tw-status ${
                            admin.activo ? 'activo' : 'inactivo'
                          }`}
                        >
                          {admin.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>

                      <td>
                        <div className="tw-actions">
                          <button
                            type="button"
                            className="tw-action-button"
                            onClick={() => abrirEditar(admin)}
                            disabled={
                              cambiandoEstado === admin.id_administrador
                            }
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className={`tw-action-button ${
                              admin.activo ? 'danger' : 'success'
                            }`}
                            onClick={() => void cambiarEstado(admin)}
                            disabled={
                              cambiandoEstado === admin.id_administrador
                            }
                          >
                            {cambiandoEstado === admin.id_administrador
                              ? 'Procesando...'
                              : admin.activo
                                ? 'Desactivar'
                                : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <div className="tw-empty">
                          <span className="tw-empty-icon">⌕</span>
                          <strong>
                            {busqueda
                              ? 'No se encontraron resultados'
                              : 'No hay administradores registrados'}
                          </strong>
                          <p>
                            {busqueda
                              ? 'Prueba con otro nombre, correo o rol.'
                              : 'Registra una cuenta para comenzar a gestionar los accesos.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {/* MODAL (portal en document.body para cubrir toda la pantalla) */}
      {modalAbierto &&
        createPortal(
          <div
            className="twam-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                cerrarModal();
              }
            }}
          >
            <div
              className="twam-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tw-admin-modal-title"
            >
              <div className="twam-heading">
                <div>
                  <span className="twam-eyebrow">CUENTAS Y PERMISOS</span>

                  <h2 id="tw-admin-modal-title">
                    {adminEditar
                      ? 'Editar administrador'
                      : 'Nuevo administrador'}
                  </h2>

                  <p>
                    {adminEditar
                      ? 'Actualiza la información y el rol de la cuenta.'
                      : 'Completa los datos para crear una nueva cuenta de acceso.'}
                  </p>
                </div>

                <button
                  type="button"
                  className="twam-close"
                  onClick={cerrarModal}
                  disabled={guardando}
                  aria-label="Cerrar formulario"
                >
                  ×
                </button>
              </div>

              <form onSubmit={guardar}>
                <div className="twam-grid">
                  <label className="twam-full">
                    <span>Nombre completo *</span>

                    <input
                      type="text"
                      required
                      maxLength={120}
                      autoComplete="name"
                      placeholder="Ej. Juan Pérez"
                      value={formulario.nombre}
                      onChange={(event) =>
                        setFormulario((actual) => ({
                          ...actual,
                          nombre: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="twam-full">
                    <span>Correo electrónico *</span>

                    <input
                      type="email"
                      required
                      maxLength={180}
                      autoComplete="email"
                      placeholder="correo@tusawood.com"
                      value={formulario.correo}
                      onChange={(event) =>
                        setFormulario((actual) => ({
                          ...actual,
                          correo: event.target.value,
                        }))
                      }
                    />
                  </label>

                  {!adminEditar && (
                    <label className="twam-full">
                      <span>Contraseña inicial *</span>

                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="Mínimo 8 caracteres"
                        value={formulario.password}
                        onChange={(event) =>
                          setFormulario((actual) => ({
                            ...actual,
                            password: event.target.value,
                          }))
                        }
                      />

                      <small className="twam-hint">
                        La contraseña debe tener al menos 8 caracteres.
                      </small>
                    </label>
                  )}

                  <label className="twam-full">
                    <span>Rol del administrador *</span>

                    <select
                      required
                      value={formulario.rol}
                      onChange={(event) =>
                        setFormulario((actual) => ({
                          ...actual,
                          rol: event.target.value as RolAdmin,
                        }))
                      }
                    >
                      {roles.map((rol) => (
                        <option key={rol} value={rol}>
                          {rol}
                        </option>
                      ))}
                    </select>

                    <small className="twam-hint">
                      El rol determina los permisos de acceso de la cuenta.
                    </small>
                  </label>
                </div>

                <div className="twam-actions">
                  <button
                    type="button"
                    className="twam-btn-secondary"
                    disabled={guardando}
                    onClick={cerrarModal}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="twam-btn-primary"
                    disabled={guardando}
                  >
                    {guardando ? (
                      <>
                        <span className="twam-spinner" />
                        Guardando...
                      </>
                    ) : adminEditar ? (
                      'Guardar cambios'
                    ) : (
                      'Crear administrador'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default GestionAdministradores;