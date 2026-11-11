import { useEffect, useState, type FormEvent } from 'react';
import {
  obtenerPerfilAdmin,
  actualizarPerfilAdmin,
  cambiarPasswordAdmin,
  type PerfilAdministrador,
} from '../services/api';

import { alertas } from '../utils/alertas';
import './profile-admin.css';

interface Props {
  onPerfilActualizado?: (perfil: PerfilAdministrador) => void;
}

function obtenerMensajeError(error: unknown, mensajePredeterminado: string): string {
  return error instanceof Error ? error.message : mensajePredeterminado;
}

export default function PerfilAdmin({ onPerfilActualizado }: Props) {
  const [perfil, setPerfil] = useState<PerfilAdministrador | null>(null);

  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');

  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');

  const [cargando, setCargando] = useState(true);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [cambiandoPassword, setCambiandoPassword] = useState(false);

  useEffect(() => {
    let activo = true;

    async function cargarPerfil() {
      try {
        setCargando(true);

        const datos = await obtenerPerfilAdmin();

        if (!activo) return;

        setPerfil(datos);
        setNombre(datos.nombre ?? '');
        setCorreo(datos.correo ?? '');
      } catch (error) {
        if (activo) {
          await alertas.error(
            'No se pudo cargar el perfil',
            obtenerMensajeError(error, 'Ocurrió un error al obtener tus datos.')
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargarPerfil();

    return () => {
      activo = false;
    };
  }, []);

  async function guardarPerfil(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (guardandoPerfil) return;

    if (!nombre.trim() || !correo.trim()) {
      await alertas.advertencia(
        'Datos incompletos',
        'Completa el nombre y el correo electrónico.'
      );
      return;
    }

    try {
      setGuardandoPerfil(true);

      await actualizarPerfilAdmin({
        nombre: nombre.trim(),
        correo: correo.trim(),
      });

      const actualizado = await obtenerPerfilAdmin();

      setPerfil(actualizado);
      setNombre(actualizado.nombre ?? '');
      setCorreo(actualizado.correo ?? '');

      onPerfilActualizado?.(actualizado);

      await alertas.exito(
        'Perfil actualizado',
        'Los datos de tu cuenta se actualizaron correctamente.'
      );
    } catch (error) {
      await alertas.error(
        'No se pudo actualizar el perfil',
        obtenerMensajeError(error, 'Ocurrió un error al guardar tus datos.')
      );
    } finally {
      setGuardandoPerfil(false);
    }
  }

  async function guardarPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (cambiandoPassword) return;

    if (!passwordActual || !passwordNueva || !confirmarPassword) {
      await alertas.advertencia(
        'Campos incompletos',
        'Completa todos los campos de contraseña.'
      );
      return;
    }

    if (passwordNueva.length < 8) {
      await alertas.advertencia(
        'Contraseña no válida',
        'La nueva contraseña debe tener al menos 8 caracteres.'
      );
      return;
    }

    if (passwordNueva !== confirmarPassword) {
      await alertas.advertencia(
        'Las contraseñas no coinciden',
        'Verifica que la nueva contraseña y su confirmación sean iguales.'
      );
      return;
    }

    if (passwordActual === passwordNueva) {
      await alertas.advertencia(
        'Contraseña sin cambios',
        'La nueva contraseña debe ser diferente a la actual.'
      );
      return;
    }

    try {
      setCambiandoPassword(true);

      await cambiarPasswordAdmin({
        password_actual: passwordActual,
        password_nueva: passwordNueva,
        confirmar_password: confirmarPassword,
      });

      setPasswordActual('');
      setPasswordNueva('');
      setConfirmarPassword('');

      await alertas.exito(
        'Contraseña actualizada',
        'Tu contraseña se cambió correctamente.'
      );
    } catch (error) {
      await alertas.error(
        'No se pudo cambiar la contraseña',
        obtenerMensajeError(error, 'Ocurrió un error al actualizar tu contraseña.')
      );
    } finally {
      setCambiandoPassword(false);
    }
  }

  if (cargando) {
    return (
      <div className="tw-profile-loading" role="status">
        <span className="tw-profile-spinner" aria-hidden="true" />
        <span>Cargando perfil...</span>
      </div>
    );
  }

  return (
    <section className="tw-profile-page">
      <header className="tw-profile-heading">
        <div>
          <span className="tw-eyebrow">CUENTA Y SEGURIDAD</span>
          <h1>Mi perfil</h1>
          <p>Consulta tus datos personales y administra la seguridad de tu cuenta.</p>
        </div>

        <div className="tw-profile-heading-icon" aria-hidden="true">
          <span>♙</span>
        </div>
      </header>

      <div className="tw-profile-layout">
        <article className="tw-profile-card tw-profile-summary">
          <div className="tw-profile-avatar" aria-hidden="true">
            {(perfil?.nombre || perfil?.correo || 'A')
              .charAt(0)
              .toUpperCase()}
          </div>

          <span className="tw-eyebrow">USUARIO ADMINISTRATIVO</span>

          <h2>{perfil?.nombre || 'Administrador'}</h2>

          <p>{perfil?.correo || 'Sin correo registrado'}</p>

          <span className="tw-profile-role">
            {perfil?.rol || 'ADMIN'}
          </span>

          <div className="tw-profile-summary-footer">
            <span className="tw-profile-status-dot" />
            Cuenta administrativa
          </div>
        </article>

        <article className="tw-profile-card tw-profile-information">
          <div className="tw-profile-card-heading">
            <div className="tw-profile-card-icon orange" aria-hidden="true">
              <span>♙</span>
            </div>

            <div>
              <h2>Información personal</h2>
              <p>Actualiza los datos asociados a tu cuenta administrativa.</p>
            </div>
          </div>

          <form className="tw-profile-form" onSubmit={guardarPerfil}>
            <label>
              <span>Nombre completo <b>*</b></span>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoComplete="name"
                maxLength={120}
                placeholder="Ingresa tu nombre completo"
                required
              />
            </label>

            <label>
              <span>Correo electrónico <b>*</b></span>
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                autoComplete="email"
                maxLength={180}
                placeholder="ejemplo@tusawood.com"
                required
              />
            </label>

            <div className="tw-profile-actions">
              <button
                className="tw-profile-button"
                type="submit"
                disabled={guardandoPerfil}
              >
                {guardandoPerfil ? (
                  <>
                    <span className="tw-button-spinner" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">✓</span>
                    Guardar cambios
                  </>
                )}
              </button>
            </div>
          </form>
        </article>

        <article className="tw-profile-card tw-profile-password">
          <div className="tw-profile-card-heading">
            <div className="tw-profile-card-icon dark" aria-hidden="true">
              <span>⌑</span>
            </div>

            <div>
              <h2>Cambiar contraseña</h2>
              <p>
                Actualiza tu clave de acceso para mantener protegida tu cuenta.
              </p>
            </div>
          </div>

          <form className="tw-profile-form" onSubmit={guardarPassword}>
            <label>
              <span>Contraseña actual <b>*</b></span>
              <input
                type="password"
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña actual"
                required
              />
            </label>

            <label>
              <span>Nueva contraseña <b>*</b></span>
              <input
                type="password"
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                placeholder="Escribe una nueva contraseña"
                required
              />
              <small>Mínimo 8 caracteres.</small>
            </label>

            <label>
              <span>Confirmar nueva contraseña <b>*</b></span>
              <input
                type="password"
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                placeholder="Repite la nueva contraseña"
                required
              />
            </label>

            <div className="tw-profile-actions">
              <button
                className="tw-profile-button"
                type="submit"
                disabled={cambiandoPassword}
              >
                {cambiandoPassword ? (
                  <>
                    <span className="tw-button-spinner" />
                    Actualizando...
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">♧</span>
                    Cambiar contraseña
                  </>
                )}
              </button>
            </div>
          </form>
        </article>
      </div>
    </section>
  );
}