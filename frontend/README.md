
# TUSA WOOD — Plataforma web comercial

Plataforma web para la presentación de la empresa TUSA WOOD, publicación de su catálogo de productos y gestión de solicitudes de cotización.

El proyecto incluye un sitio web público y un panel administrativo conectado a una API REST y una base de datos PostgreSQL.

## Funcionalidades

### Sitio web público
- Presentación institucional de TUSA WOOD.
- Catálogo de productos por categorías.
- Consulta de productos y servicios.
- Formulario de solicitud de cotización.
- Acceso a los canales de contacto de la empresa.

### Panel administrativo
- Inicio de sesión y control de acceso por roles.
- Dashboard de indicadores comerciales.
- Gestión de productos y categorías.
- Gestión de servicios.
- Administración de cotizaciones y sus versiones.
- Seguimiento de estados e historial de cotizaciones.
- Gestión de administradores según permisos.
- Supervisión comercial y configuración de cotizaciones.

### Backend
- API REST desarrollada con Node.js y Express.
- Conexión a PostgreSQL.
- Autenticación mediante JSON Web Tokens.
- Contraseñas protegidas mediante bcrypt.
- Generación de documentos PDF de cotizaciones.
- Envío y seguimiento de notificaciones por correo electrónico.

## Tecnologías

| Área | Tecnologías |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express |
| Base de datos | PostgreSQL |
| Autenticación | JWT, bcrypt |
| Estilos | CSS |
| Comunicación | API REST, Fetch |
| Documentos | PDFKit |
| Correo | Nodemailer |

## Estructura del proyecto

```text
TUSA_WOOD/
├── backend/
│   ├── scripts/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   └── services/
│   ├── storage/
│   ├── .env.example
│   └── package.json
├── database/
│   └── schema_actual.sql
├── frontend/
│   ├── public/
│   ├── src/
│   ├── .env.example
│   └── package.json
└── .gitignore
```

## Requisitos

- Node.js 22 o una versión compatible.
- npm.
- PostgreSQL 18 o una versión compatible.
- Git.

## Configuración local

### 1. Base de datos

Crea una base de datos PostgreSQL llamada `tusa_wood_db`.

Importa el esquema actualizado desde:

```text
database/schema_actual.sql
```

El archivo contiene la estructura de la base de datos. Los datos iniciales y las cuentas administrativas deben configurarse por separado.

### 2. Backend

Abre una terminal en la carpeta `backend`:

```bash
cd backend
npm install
```

Crea tu archivo `.env` tomando como referencia `.env.example` y configura las variables de entorno con tus propios valores.

Inicia el servidor en desarrollo:

```bash
npm run dev
```

El backend utiliza el puerto `3000` de forma predeterminada.

### 3. Frontend

Abre otra terminal en la carpeta `frontend`:

```bash
cd frontend
npm install
```

Crea tu archivo `.env` tomando como referencia `.env.example`.

Configura la URL de la API:

```dotenv
VITE_API_URL=http://localhost:3000/api
```

Inicia el entorno de desarrollo:

```bash
npm run dev
```

Vite mostrará la dirección local para acceder al sitio web.

## Compilación para producción

Desde la carpeta `frontend`:

```bash
npm run build
```

La compilación genera los archivos de producción en `frontend/dist`.

## Variables de entorno y seguridad

- No publiques archivos `.env`.
- No incluyas contraseñas, tokens ni credenciales SMTP en el repositorio.
- Utiliza `.env.example` como plantilla de configuración.
- Configura las URLs permitidas de frontend y backend para cada entorno.
- En producción, utiliza almacenamiento persistente para los documentos PDF.

## Estado del proyecto

Proyecto en etapa de preparación y revisión para despliegue.

## Propiedad

TUSA WOOD — Plataforma web comercial.
