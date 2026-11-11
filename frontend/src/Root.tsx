
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import App from './App';
import AdminLogin from './auth/AdminLogin';
import AdminPanel from './admin/AdminPanel';

function AdminProtegido() {
  const token = localStorage.getItem('tusa_token');
  const administradorGuardado = localStorage.getItem('tusa_administrador');

  if (!token || !administradorGuardado) {
    localStorage.removeItem('tusa_token');
    localStorage.removeItem('tusa_administrador');

    return <Navigate to="/admin/login" replace />;
  }

  return <PanelAdministracion />;
}

function PanelAdministracion() {
  const navigate = useNavigate();

  function cerrarSesion() {
    localStorage.removeItem('tusa_token');
    localStorage.removeItem('tusa_administrador');

    navigate('/admin/login', { replace: true });
  }

  return <AdminPanel onCerrarSesion={cerrarSesion} />;
}

export default function Root() {
  const navigate = useNavigate();

  return (
    <Routes>
      {/* Página pública */}
      <Route path="/" element={<App />} />

      {/* Inicio de sesión administrativo */}
      <Route
        path="/admin/login"
        element={
          <AdminLogin
            onLoginExitoso={() => {
              navigate('/admin', { replace: true });
            }}
          />
        }
      />

      {/* Panel administrativo protegido */}
      <Route
        path="/admin"
        element={<AdminProtegido />}
      />

      {/* Rutas desconocidas */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}
