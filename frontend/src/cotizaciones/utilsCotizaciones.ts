
import type { HistorialCotizacion } from '../services/api';
import type {
  Cotizacion,
  Registro,
  RespuestaLista,
  VersionDetalle,
} from './tiposCotizaciones';

export const estadosSolicitud = [
  'PENDIENTE',
  'EN_ATENCION',
  'COTIZADA',
  'ACEPTADA',
  'RECHAZADA',
  'CERRADA',
];

const etiquetasVersion: Record<string, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  DEVUELTA: 'Devuelta para corrección',
  APROBADA: 'Aprobada',
  ENVIADA: 'Enviada al cliente',
  ANULADA: 'Anulada',
};

const camposRol = [
  'rol',
  'nombre_rol',
  'tipo_rol',
  'rol_administrador',
  'role',
  'perfil',
  'nombre_perfil',
  'codigo_rol',
  'codigo_perfil',
  'tipo',
];

const camposAnidados = [
  'administrador',
  'usuario',
  'data',
  'user',
  'admin',
  'perfil_administrador',
  'datos',
];

const rolesPermitidos = ['SUPERADMIN', 'GERENCIA', 'VENTAS'];

export function obtenerNombreCliente(cotizacion: Cotizacion): string {
  return (
    cotizacion.nombre_contacto ||
    cotizacion.nombre_cliente ||
    cotizacion.cliente ||
    'Cliente sin nombre'
  );
}

export function obtenerCodigo(cotizacion: Cotizacion): string {
  return cotizacion.codigo || `COT-${cotizacion.id_cotizacion}`;
}

export function obtenerFecha(cotizacion: Cotizacion): string {
  const fecha =
    cotizacion.creado_en ||
    cotizacion.fecha_creacion ||
    cotizacion.fecha;

  if (!fecha) return 'Sin fecha';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) return String(fecha);

  return valor.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function obtenerFechaHora(fecha?: string): string {
  if (!fecha) return 'Fecha no disponible';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) return fecha;

  return valor.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function normalizarEstado(estado?: string | null): string {
  return (estado || 'PENDIENTE').trim().toUpperCase();
}

export function formatearEstado(estado?: string | null): string {
  const etiquetas: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    EN_ATENCION: 'En atención',
    COTIZADA: 'Cotizada',
    ACEPTADA: 'Aceptada',
    RECHAZADA: 'Rechazada',
    CERRADA: 'Cerrada',
  };

  const valor = normalizarEstado(estado);

  return etiquetas[valor] || valor.replaceAll('_', ' ');
}

export function formatearEstadoVersion(estado?: string): string {
  const valor = normalizarEstado(estado);
  return etiquetasVersion[valor] || valor.replaceAll('_', ' ');
}

export function obtenerClaseEstado(estado?: string): string {
  const valor = normalizarEstado(estado);

  switch (valor) {
    case 'PENDIENTE':
      return 'pendiente';

    case 'EN_ATENCION':
    case 'PENDIENTE_APROBACION':
      return 'revision';

    case 'COTIZADA':
    case 'APROBADA':
    case 'ENVIADA':
    case 'ACEPTADA':
      return 'aprobada';

    case 'RECHAZADA':
    case 'DEVUELTA':
    case 'ANULADA':
      return 'rechazada';

    default:
      return 'pendiente';
  }
}

export function obtenerListaCotizaciones(
  respuesta: unknown,
): Cotizacion[] {
  if (Array.isArray(respuesta)) {
    return respuesta as Cotizacion[];
  }

  if (!respuesta || typeof respuesta !== 'object') {
    return [];
  }

  const datos = respuesta as RespuestaLista;

  if (Array.isArray(datos.cotizaciones)) {
    return datos.cotizaciones;
  }

  if (Array.isArray(datos.data)) {
    return datos.data;
  }

  return [];
}

export function obtenerDetalleCotizacion(
  respuesta: unknown,
): Cotizacion {
  if (
    !respuesta ||
    typeof respuesta !== 'object' ||
    Array.isArray(respuesta)
  ) {
    throw new Error(
      'La API devolvió un detalle de cotización inválido.',
    );
  }

  const datos = respuesta as Cotizacion;
  const resumen = datos.resumen;

  if (!datos.id_cotizacion) {
    throw new Error('No se encontraron los datos de la cotización.');
  }

  return {
    ...datos,
    resumen: resumen
      ? {
          total_productos: Number(resumen.total_productos ?? 0),
          total_unidades: Number(resumen.total_unidades ?? 0),
          total_servicios: Number(resumen.total_servicios ?? 0),
          total_items: Number(resumen.total_items ?? 0),
        }
      : {
          total_productos: Number(datos.total_productos ?? 0),
          total_unidades: Number(datos.total_unidades ?? 0),
          total_servicios: Number(datos.total_servicios ?? 0),
          total_items: Number(datos.total_items ?? 0),
        },
    productos: Array.isArray(datos.productos) ? datos.productos : [],
    servicios: Array.isArray(datos.servicios) ? datos.servicios : [],
    historial: Array.isArray(datos.historial) ? datos.historial : [],
  };
}

export function obtenerMensajeError(
  error: unknown,
  mensajePredeterminado: string,
): string {
  if (!error || typeof error !== 'object') {
    return mensajePredeterminado;
  }

  const errorApi = error as Registro;

  const mensajeServidor =
    errorApi.response?.data?.mensaje ||
    errorApi.response?.data?.message ||
    errorApi.data?.mensaje ||
    errorApi.data?.message ||
    errorApi.mensaje;

  if (mensajeServidor) return mensajeServidor;

  if (!errorApi.message) return mensajePredeterminado;

  try {
    const posibleJson = JSON.parse(errorApi.message);

    if (posibleJson?.mensaje) return posibleJson.mensaje;
    if (posibleJson?.message) return posibleJson.message;
  } catch {
    // El mensaje no contiene JSON.
  }

  return errorApi.message;
}

export function obtenerDatosRespuesta(
  respuesta: unknown,
): Registro {
  if (!respuesta || typeof respuesta !== 'object') return {};
  return respuesta as Registro;
}

export function obtenerClaveHistorial(
  item: HistorialCotizacion,
): string {
  if (item.id_historial !== undefined) {
    return `historial-${item.id_historial}`;
  }

  return [
    item.creado_en || '',
    item.estado_anterior || '',
    item.estado_nuevo || '',
    item.id_administrador || '',
    item.comentario || '',
  ].join('-');
}

export function obtenerEtiquetaRol(
  rol?: string | null,
): string {
  const valor = normalizarRol(rol);

  const etiquetas: Record<string, string> = {
    SUPERADMIN: 'Superadministrador',
    GERENCIA: 'Gerencia',
    VENTAS: 'Ventas',
  };

  return etiquetas[valor] || 'Sin rol';
}

export function normalizarRol(valor: unknown): string {
  if (typeof valor !== 'string') return '';

  return valor
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');
}

export function extraerRol(
  origen: unknown,
  profundidad = 0,
): string {
  if (profundidad > 5 || !origen || typeof origen !== 'object') {
    return '';
  }

  const datos = origen as Registro;

  for (const campo of camposRol) {
    const rol = normalizarRol(datos[campo]);

    if (rolesPermitidos.includes(rol)) {
      return rol;
    }
  }

  for (const campo of camposAnidados) {
    const rol = extraerRol(datos[campo], profundidad + 1);

    if (rol) return rol;
  }

  return '';
}

export function obtenerRolDesdeToken(): string {
  try {
    const token = localStorage.getItem('tusa_token');

    if (!token) return '';

    const partes = token.split('.');

    if (partes.length !== 3) return '';

    const contenido = partes[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const decodificado = atob(
      contenido.padEnd(
        contenido.length + ((4 - (contenido.length % 4)) % 4),
        '=',
      ),
    );

    const payload = JSON.parse(decodificado);

    return extraerRol(payload);
  } catch {
    return '';
  }
}

export function obtenerRolActual(): string {
  try {
    const administrador = localStorage.getItem('tusa_administrador');

    if (administrador) {
      const datos = JSON.parse(administrador);
      const rol = extraerRol(datos);

      if (rol) return rol;
    }
  } catch {
    // Se intenta obtener el rol desde el token.
  }

  return obtenerRolDesdeToken();
}

export function formatearMoneda(valor: unknown): string {
  const numero = Number(valor ?? 0);

  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numero) ? numero : 0);
}

export function obtenerNombreVersion(version: Registro): string {
  const numero = version.numero_version ?? version.version ?? '';
  return `Versión ${numero}`;
}

export function obtenerIdVersion(version: Registro): number {
  return Number(version.id_version ?? version.id ?? 0);
}

export function obtenerRespuestaVersionDetalle(
  respuesta: unknown,
): VersionDetalle {
  const datos = obtenerDatosRespuesta(respuesta);
  const contenido = datos.version || datos.data || datos;

  if (!contenido || typeof contenido !== 'object') {
    throw new Error('No se pudo obtener el detalle de la versión.');
  }

  const version = contenido.version || contenido;

  return {
    version,
    productos: Array.isArray(contenido.productos)
      ? contenido.productos
      : Array.isArray(datos.productos)
        ? datos.productos
        : [],
    servicios: Array.isArray(contenido.servicios)
      ? contenido.servicios
      : Array.isArray(datos.servicios)
        ? datos.servicios
        : [],
    aprobaciones: Array.isArray(contenido.aprobaciones)
      ? contenido.aprobaciones
      : Array.isArray(datos.aprobaciones)
        ? datos.aprobaciones
        : [],
  };
}
