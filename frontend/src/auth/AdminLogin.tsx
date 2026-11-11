import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { iniciarSesion } from '../services/api';
import { alertas } from '../utils/alertas';
import './admin.css';

interface AdminLoginProps {
  onLoginExitoso: () => void;
}

/* Archivo que ya tienes en la carpeta /public */
const LOGO_TW = '/monograma-tw.png';

export default function AdminLogin({ onLoginExitoso }: AdminLoginProps) {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function manejarInicioSesion(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (cargando) return;

    const correoNormalizado = correo.trim();

    if (!correoNormalizado || !password.trim()) {
      const mensaje = 'Completa tu correo y contraseña para continuar.';
      setError(mensaje);
      await alertas.advertencia(mensaje);
      return;
    }

    setError('');
    setCargando(true);

    try {
      const respuesta = await iniciarSesion({
        correo: correoNormalizado,
        password,
      });

      if (!respuesta.token) {
        throw new Error('El servidor no devolvió un token de acceso.');
      }

      localStorage.setItem('tusa_token', respuesta.token);

      if (respuesta.administrador) {
        localStorage.setItem(
          'tusa_administrador',
          JSON.stringify(respuesta.administrador),
        );
      }

      await alertas.exito(
        '¡Bienvenido!',
        'Has iniciado sesión correctamente.',
      );

      onLoginExitoso();
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar sesión. Inténtalo nuevamente.';

      setError(mensaje);
      await alertas.error('No se pudo iniciar sesión', mensaje);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="admin-login">
      <section className="admin-login-visual">
        <div className="admin-login-overlay" />

        <a className="admin-login-brand" href="/" aria-label="TUSA WOOD, ir al inicio">
          <span className="admin-login-logo">
            <img
              src={LOGO_TW}
              alt=""
              width={62}
              height={61}
              decoding="async"
              draggable={false}
            />
          </span>

          <span>
            <strong>
              TUSA <span>WOOD</span>
            </strong>
            <small>SOLUCIONES EN MADERA</small>
          </span>
        </a>

        <div className="admin-login-message">
          <span className="admin-eyebrow">
            <span className="admin-status-dot" />
            PLATAFORMA DE GESTIÓN
          </span>

          <h1>
            Gestiona tu negocio.
            <br />
            <span>Construye el futuro.</span>
          </h1>

          <p>
            Administra tus productos y cotizaciones desde un único espacio
            de trabajo.
          </p>

          <div className="admin-login-feature">
            <ShieldCheck size={21} />
            <span>Acceso exclusivo para personal autorizado</span>
          </div>
        </div>

        <div className="admin-login-footer">
          © {new Date().getFullYear()} TUSA WOOD. Todos los derechos reservados.
        </div>
      </section>

      <section className="admin-login-panel">
        <div className="admin-login-form-wrap">
          <div className="admin-login-mobile-brand">
            <span className="admin-login-logo">
              <img
                src={LOGO_TW}
                alt=""
                width={51}
                height={50}
                decoding="async"
                draggable={false}
              />
            </span>
            <strong>
              TUSA <span>WOOD</span>
            </strong>
          </div>

          <div className="admin-form-heading">
            <span className="admin-form-icon">
              <LockKeyhole size={24} />
            </span>

            <span className="admin-eyebrow">PANEL ADMINISTRATIVO</span>

            <h2>Bienvenido de nuevo</h2>
            <p>Ingresa tus credenciales para continuar.</p>
          </div>

          <form
            onSubmit={manejarInicioSesion}
            className="admin-login-form"
          >
            <label htmlFor="admin-correo">Correo electrónico</label>
            <input
              id="admin-correo"
              type="email"
              autoComplete="username"
              placeholder="admin@tusawood.com"
              value={correo}
              onChange={(event) => setCorreo(event.target.value)}
              required
              disabled={cargando}
            />

            <label htmlFor="admin-password">Contraseña</label>

            <div className="admin-password-field">
              <input
                id="admin-password"
                type={mostrarPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={cargando}
              />

              <button
                type="button"
                className="admin-password-toggle"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                aria-label={
                  mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
                disabled={cargando}
              >
                {mostrarPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            {error && (
              <div className="admin-login-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="admin-login-submit"
              disabled={cargando}
            >
              <span>
                {cargando ? 'Verificando acceso...' : 'Iniciar sesión'}
              </span>
              {!cargando && <ArrowRight size={19} />}
            </button>
          </form>

          <div className="admin-login-security">
            <LockKeyhole size={15} />
            <span>
              Conexión protegida mediante autenticación administrativa
            </span>
          </div>

          <a href="/" className="admin-back-home">
            ← Volver al sitio web
          </a>
        </div>
      </section>
    </main>
  );
}