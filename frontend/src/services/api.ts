const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/+$/, '');

// ======================================================
// INTERFACES GENERALES
// ======================================================

export interface Categoria {
  id_categoria: number;
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
}

export interface Producto {
  id_producto: number;
  id_categoria: number | null;
  categoria?: string | null;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  material: string;
  largo_cm: number | string | null;
  ancho_cm: number | string | null;
  alto_cm: number | string | null;
  capacidad_kg: number | string | null;
  imagen_url: string | null;
  destacado: boolean;
  activo: boolean;
}

export interface Servicio {
  id_servicio: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creado_en?: string;
}

export interface ServicioCotizacion {
  id_servicio: number;
  observaciones?: string;
}

export interface ProductoCotizacion {
  id_producto: number;
  cantidad: number;
  especificaciones?: string;
}

export interface DatosCotizacion {
  nombre_contacto: string;
  empresa?: string;
  correo: string;
  telefono: string;
  direccion_entrega?: string;
  mensaje?: string;
  productos: ProductoCotizacion[];
  servicios?: ServicioCotizacion[];
}

export interface RespuestaCotizacion {
  estado: string;
  mensaje?: string;
  cotizacion?: {
    id_cotizacion?: number;
    codigo?: string;
    estado?: string;
  };
  [clave: string]: unknown;
}

interface RespuestaCategorias {
  estado: string;
  categorias: Categoria[];
}

interface RespuestaProductos {
  estado: string;
  productos: Producto[];
  paginacion?: {
    pagina: number;
    limite: number;
    total: number;
    total_paginas?: number;
    totalPaginas?: number;
  };
}

interface RespuestaServicios {
  estado: string;
  mensaje?: string;
  servicios: Servicio[];
}

interface ErrorAPI {
  estado?: string;
  mensaje?: string;
  error?: string;
}

// ======================================================
// MENSAJES DE ERROR
// ======================================================

function obtenerMensajeAmigable(
  ruta: string,
  estadoHTTP?: number,
): string {
  if (estadoHTTP === 401) {
    return 'Tu sesión ha expirado. Inicia sesión nuevamente.';
  }

  if (estadoHTTP === 403) {
    return 'No tienes permiso para realizar esta acción.';
  }

  if (estadoHTTP === 404) {
    return 'No encontramos la información solicitada.';
  }

  if (estadoHTTP !== undefined && estadoHTTP >= 500) {
    return 'Estamos teniendo dificultades para atender tu solicitud. Inténtalo nuevamente más tarde.';
  }

  if (ruta.includes('/auth/login')) {
    return 'No pudimos iniciar sesión. Verifica tus datos e inténtalo nuevamente.';
  }

  if (ruta.includes('/quotes')) {
    return 'No pudimos procesar tu cotización. Revisa los datos e inténtalo nuevamente.';
  }

  if (ruta.includes('/products')) {
    return 'No pudimos cargar los productos en este momento.';
  }

  if (ruta.includes('/categories')) {
    return 'No pudimos cargar las categorías en este momento.';
  }

  return 'No pudimos completar la solicitud. Inténtalo nuevamente.';
}

// ======================================================
// FUNCIÓN CENTRAL PARA CONSUMIR LA API
// ======================================================

async function solicitar<T>(
  ruta: string,
  opciones: RequestInit = {},
): Promise<T> {
  let respuesta: Response;

  try {
    const headers = new Headers(opciones.headers);

    if (
      !(opciones.body instanceof FormData) &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json');
    }

    respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
      ...opciones,
      headers,
    });
  } catch (error) {
    console.error('[TUSA WOOD] Error de conexión con la API:', {
      ruta,
      detalle:
        error instanceof Error
          ? error.message
          : 'Error de conexión desconocido',
    });

    throw new Error(
      'No podemos conectar con nuestros servicios en este momento. Inténtalo nuevamente más tarde.',
    );
  }

  const datos: unknown = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    console.error('[TUSA WOOD] Solicitud fallida:', {
      ruta,
      estadoHTTP: respuesta.status,
    });

    if (datos !== null && typeof datos === 'object') {
      const errorDatos = datos as ErrorAPI;

      if (
        typeof errorDatos.mensaje === 'string' &&
        errorDatos.mensaje.trim()
      ) {
        throw new Error(errorDatos.mensaje);
      }
    }

    throw new Error(
      obtenerMensajeAmigable(ruta, respuesta.status),
    );
  }

  if (datos === null) {
    throw new Error('El servidor devolvió una respuesta vacía o inválida.');
  }

  return datos as T;
}

// ======================================================
// CATEGORÍAS PÚBLICAS
// ======================================================

export async function obtenerCategorias(): Promise<Categoria[]> {
  const respuesta =
    await solicitar<RespuestaCategorias>('/categories');

  if (
    respuesta?.estado !== 'OK' ||
    !Array.isArray(respuesta.categorias)
  ) {
    throw new Error(
      'No pudimos cargar las categorías en este momento.',
    );
  }

  return respuesta.categorias;
}

// ======================================================
// CATEGORÍAS ADMINISTRATIVAS
// ======================================================

export interface CategoriaAdmin extends Categoria {
  activo: boolean;
  total_productos?: number;
}

interface RespuestaCategoriaAdmin {
  estado: string;
  mensaje?: string;
  categorias?: CategoriaAdmin[];
  categoria?: CategoriaAdmin;
}

async function validarRespuestaCategoria(
  respuesta: RespuestaCategoriaAdmin,
): Promise<RespuestaCategoriaAdmin> {
  if (respuesta.estado !== 'OK') {
    throw new Error(
      respuesta.mensaje ||
        'No se pudo completar la operación de categoría.',
    );
  }

  return respuesta;
}

export async function obtenerCategoriasAdmin(): Promise<CategoriaAdmin[]> {
  const respuesta = await solicitarAdmin<RespuestaCategoriaAdmin>(
    '/categories/admin/list',
  );

  await validarRespuestaCategoria(respuesta);

  if (!Array.isArray(respuesta.categorias)) {
    throw new Error(
      'La API no devolvió una lista válida de categorías.',
    );
  }

  return respuesta.categorias;
}

export async function crearCategoriaAdmin(
  datos: { nombre: string; descripcion: string },
): Promise<CategoriaAdmin> {
  const respuesta = await solicitarAdmin<RespuestaCategoriaAdmin>(
    '/categories',
    {
      method: 'POST',
      body: JSON.stringify(datos),
    },
  );

  await validarRespuestaCategoria(respuesta);

  if (!respuesta.categoria) {
    throw new Error('La API no devolvió la categoría creada.');
  }

  return respuesta.categoria;
}

export async function actualizarCategoriaAdmin(
  id: number,
  datos: { nombre: string; descripcion: string },
): Promise<CategoriaAdmin> {
  const respuesta = await solicitarAdmin<RespuestaCategoriaAdmin>(
    `/categories/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(datos),
    },
  );

  await validarRespuestaCategoria(respuesta);

  if (!respuesta.categoria) {
    throw new Error('La API no devolvió la categoría actualizada.');
  }

  return respuesta.categoria;
}

export async function cambiarEstadoCategoriaAdmin(
  id: number,
  activo: boolean,
): Promise<CategoriaAdmin> {
  const respuesta = await solicitarAdmin<RespuestaCategoriaAdmin>(
    `/categories/${id}/estado`,
    {
      method: 'PATCH',
      body: JSON.stringify({ activo }),
    },
  );

  await validarRespuestaCategoria(respuesta);

  if (!respuesta.categoria) {
    throw new Error('La API no devolvió el estado actualizado.');
  }

  return respuesta.categoria;
}

export async function eliminarCategoriaAdmin(
  id: number,
): Promise<void> {
  const respuesta = await solicitarAdmin<RespuestaCategoriaAdmin>(
    `/categories/${id}`,
    { method: 'DELETE' },
  );

  await validarRespuestaCategoria(respuesta);
}

// ======================================================
// SERVICIOS ADMINISTRATIVOS
// ======================================================

interface RespuestaServicioAdmin {
  estado: string;
  mensaje?: string;
  servicios?: Servicio[];
  servicio?: Servicio;
}

async function validarRespuestaServicio(
  respuesta: RespuestaServicioAdmin,
): Promise<RespuestaServicioAdmin> {
  if (respuesta?.estado !== 'OK') {
    throw new Error(
      respuesta?.mensaje || 'No se pudo completar la operación de servicio.',
    );
  }

  return respuesta;
}

/** Lista todos los servicios, activos e inactivos. */
export async function obtenerServiciosAdmin(): Promise<Servicio[]> {
  const respuesta = await solicitarAdmin<RespuestaServicioAdmin>(
    '/services/admin/list',
  );

  await validarRespuestaServicio(respuesta);

  if (!Array.isArray(respuesta.servicios)) {
    throw new Error('La API no devolvió una lista válida de servicios.');
  }

  return respuesta.servicios;
}

/** Obtiene un servicio por su identificador. */
export async function obtenerServicioAdmin(
  id: number,
): Promise<Servicio> {
  const respuesta = await solicitarAdmin<RespuestaServicioAdmin>(
    `/services/${id}`,
  );

  await validarRespuestaServicio(respuesta);

  if (!respuesta.servicio) {
    throw new Error('La API no devolvió el servicio solicitado.');
  }

  return respuesta.servicio;
}

/** Registra un nuevo servicio. */
export async function crearServicioAdmin(
  datos: { nombre: string; descripcion: string },
): Promise<Servicio> {
  const respuesta = await solicitarAdmin<RespuestaServicioAdmin>(
    '/services',
    {
      method: 'POST',
      body: JSON.stringify(datos),
    },
  );

  await validarRespuestaServicio(respuesta);

  if (!respuesta.servicio) {
    throw new Error('La API no devolvió el servicio creado.');
  }

  return respuesta.servicio;
}

/** Actualiza los datos de un servicio. */
export async function actualizarServicioAdmin(
  id: number,
  datos: { nombre: string; descripcion: string },
): Promise<Servicio> {
  const respuesta = await solicitarAdmin<RespuestaServicioAdmin>(
    `/services/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(datos),
    },
  );

  await validarRespuestaServicio(respuesta);

  if (!respuesta.servicio) {
    throw new Error('La API no devolvió el servicio actualizado.');
  }

  return respuesta.servicio;
}

/** Activa o desactiva un servicio sin eliminarlo. */
export async function cambiarEstadoServicioAdmin(
  id: number,
  activo: boolean,
): Promise<Servicio> {
  const respuesta = await solicitarAdmin<RespuestaServicioAdmin>(
    `/services/${id}/estado`,
    {
      method: 'PATCH',
      body: JSON.stringify({ activo }),
    },
  );

  await validarRespuestaServicio(respuesta);

  if (!respuesta.servicio) {
    throw new Error('La API no devolvió el estado actualizado.');
  }

  return respuesta.servicio;
}

// ======================================================
// PRODUCTOS PÚBLICOS
// ======================================================

export async function obtenerProductos(): Promise<Producto[]> {
  const respuesta = await solicitar<RespuestaProductos>(
    '/products?limite=50&pagina=1',
  );

  if (
    respuesta?.estado !== 'OK' ||
    !Array.isArray(respuesta.productos)
  ) {
    throw new Error(
      'No pudimos cargar los productos en este momento.',
    );
  }

  return respuesta.productos.filter(
    (producto) => producto.activo !== false,
  );
}

// ======================================================
// SERVICIOS PÚBLICOS
// ======================================================

export async function obtenerServicios(): Promise<Servicio[]> {
  const respuesta = await solicitar<RespuestaServicios>('/services');

  if (
    respuesta?.estado !== 'OK' ||
    !Array.isArray(respuesta.servicios)
  ) {
    throw new Error(
      'No pudimos cargar los servicios en este momento.',
    );
  }

  return respuesta.servicios.filter(
    (servicio) => servicio.activo !== false,
  );
}

export async function obtenerTotalProductosPublicos(): Promise<number> {
  const respuesta = await solicitar<RespuestaProductos>(
    '/products?limite=1&pagina=1',
  );

  const total = respuesta.paginacion?.total;

  if (
    respuesta.estado !== 'OK' ||
    typeof total !== 'number' ||
    !Number.isFinite(total)
  ) {
    throw new Error(
      'No pudimos obtener el total de productos publicados.',
    );
  }

  return total;
}

// ======================================================
// COTIZACIONES PÚBLICAS
// ======================================================

export async function enviarCotizacion(
  datos: DatosCotizacion,
): Promise<RespuestaCotizacion> {
  const respuesta = await solicitar<RespuestaCotizacion>(
    '/quotes',
    {
      method: 'POST',
      body: JSON.stringify(datos),
    },
  );

  if (respuesta.estado !== 'OK') {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos registrar tu cotización. Inténtalo nuevamente.',
    );
  }

  return respuesta;
}

// ======================================================
// AUTENTICACIÓN ADMINISTRATIVA
// ======================================================

export interface DatosLogin {
  correo: string;
  password: string;
}

export interface Administrador {
  id_administrador: number;
  correo: string;
  nombre?: string;
  rol: 'ADMIN' | 'SUPERADMIN' | 'VENTAS' | 'GERENCIA';
}

export interface RespuestaLogin {
  estado: string;
  mensaje?: string;
  token?: string;
  administrador?: Administrador;
  [clave: string]: unknown;
}

export async function iniciarSesion(
  datos: DatosLogin,
): Promise<RespuestaLogin> {
  const respuesta = await solicitar<RespuestaLogin>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(datos),
    },
  );

  if (
    respuesta.estado !== 'OK' ||
    !respuesta.token ||
    !respuesta.administrador
  ) {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos iniciar sesión. Verifica tus datos e inténtalo nuevamente.',
    );
  }

  return respuesta;
}

// ======================================================
// TIPOS ADMINISTRATIVOS DE COTIZACIONES
// ======================================================

export interface ProductoDetalleCotizacion {
  id_detalle: number;
  id_producto: number | null;
  nombre_producto: string;
  cantidad: number;
  especificaciones?: string | null;
  creado_en?: string;
}

export interface ServicioDetalleCotizacion {
  id_detalle_servicio: number;
  id_servicio: number;
  nombre_servicio: string;
  observaciones?: string | null;
  creado_en?: string;
}

export interface ResumenCotizacion {
  total_productos: number;
  total_unidades: number;
  total_servicios: number;
  total_items: number;
}

export interface HistorialCotizacion {
  id_historial: number;
  id_administrador: number | null;
  estado_anterior: string | null;
  estado_nuevo: string;
  comentario?: string | null;
  creado_en: string;
  administrador?: string | null;
  correo_administrador?: string | null;
  rol_administrador?: string | null;
}

export interface CotizacionAdmin {
  id_cotizacion: number;
  codigo?: string;
  nombre_contacto?: string;
  empresa?: string | null;
  correo?: string;
  telefono?: string;
  direccion_entrega?: string | null;
  mensaje?: string | null;
  estado: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  creado_en?: string;
  actualizado_en?: string;
  total?: number | string | null;
  total_items?: number;
  total_productos?: number;
  total_unidades?: number;
  total_servicios?: number;
  resumen?: ResumenCotizacion;
  origen?: string | null;
  notas_internas?: string | null;
  productos?: ProductoDetalleCotizacion[];
  servicios?: ServicioDetalleCotizacion[];
  historial?: HistorialCotizacion[];
  [clave: string]: unknown;
}

// ======================================================
// SESIÓN Y AUTENTICACIÓN ADMINISTRATIVA
// ======================================================

function obtenerToken(): string {
  const token = localStorage.getItem('tusa_token');

  if (!token) {
    throw new Error(
      'Tu sesión administrativa ha expirado. Inicia sesión nuevamente.',
    );
  }

  return token;
}

async function solicitarAdmin<T>(
  ruta: string,
  opciones: RequestInit = {},
): Promise<T> {
  const token = obtenerToken();
  const headers = new Headers(opciones.headers);

  headers.set('Authorization', `Bearer ${token}`);

  return solicitar<T>(ruta, {
    ...opciones,
    headers,
  });
}

// ======================================================
// NORMALIZACIÓN DE COTIZACIONES
// ======================================================

function obtenerTexto(
  objeto: Record<string, unknown>,
  campos: string[],
): string | undefined {
  for (const campo of campos) {
    const valor = objeto[campo];

    if (
      typeof valor === 'string' &&
      valor.trim() !== ''
    ) {
      return valor.trim();
    }

    if (typeof valor === 'number') {
      return String(valor);
    }
  }

  return undefined;
}

function normalizarCotizacion(
  dato: unknown,
): CotizacionAdmin {
  if (
    dato === null ||
    typeof dato !== 'object' ||
    Array.isArray(dato)
  ) {
    throw new Error(
      'La API devolvió una cotización con formato inválido.',
    );
  }

  const original = dato as Record<string, unknown>;

  const id = Number(
    original['id_cotizacion'] ??
      original['id'] ??
      original['id_quote'],
  );

  const nombreContacto = obtenerTexto(original, [
    'nombre_contacto',
    'nombre',
    'cliente',
    'nombre_cliente',
    'contacto',
    'contact_name',
  ]);

  const empresa = obtenerTexto(original, [
    'empresa',
    'nombre_empresa',
    'razon_social',
    'company',
  ]);

  const correo = obtenerTexto(original, [
    'correo',
    'email',
    'correo_contacto',
    'email_contact',
  ]);

  const telefono = obtenerTexto(original, [
    'telefono',
    'celular',
    'phone',
    'telefono_contacto',
  ]);

  const fechaCreacion = obtenerTexto(original, [
    'creado_en',
    'fecha_creacion',
    'created_at',
    'fecha_registro',
    'createdAt',
  ]);

  const fechaActualizacion = obtenerTexto(original, [
    'actualizado_en',
    'fecha_actualizacion',
    'updated_at',
    'updatedAt',
  ]);

  const totalProductos = Number(
    original['total_productos'] ?? 0,
  );

  const totalUnidades = Number(
    original['total_unidades'] ?? 0,
  );

  const totalServicios = Number(
    original['total_servicios'] ?? 0,
  );

  const totalItems = Number(
    original['total_items'] ??
      totalProductos + totalServicios,
  );

  return {
    ...original,

    id_cotizacion: Number.isFinite(id) ? id : 0,

    codigo: obtenerTexto(original, [
      'codigo',
      'codigo_cotizacion',
      'numero_cotizacion',
      'code',
    ]),

    nombre_contacto: nombreContacto,
    empresa: empresa ?? null,
    correo,
    telefono,

    direccion_entrega:
      obtenerTexto(original, [
        'direccion_entrega',
        'direccion',
        'delivery_address',
      ]) ?? null,

    mensaje:
      obtenerTexto(original, [
        'mensaje',
        'observaciones',
        'comentario',
        'message',
      ]) ?? null,

    estado:
      obtenerTexto(original, ['estado', 'status']) ??
      'PENDIENTE',

    creado_en: fechaCreacion,
    fecha_creacion: fechaCreacion,
    actualizado_en: fechaActualizacion,
    fecha_actualizacion: fechaActualizacion,

    total:
      (original['total'] ??
        original['monto_total'] ??
        original['importe_total'] ??
        null) as number | string | null,

    total_productos: Number.isFinite(totalProductos)
      ? totalProductos
      : 0,

    total_unidades: Number.isFinite(totalUnidades)
      ? totalUnidades
      : 0,

    total_servicios: Number.isFinite(totalServicios)
      ? totalServicios
      : 0,

    total_items: Number.isFinite(totalItems)
      ? totalItems
      : 0,

    origen:
      obtenerTexto(original, ['origen', 'source']) ?? null,

    notas_internas:
      obtenerTexto(original, [
        'notas_internas',
        'notas',
        'internal_notes',
      ]) ?? null,

    productos: Array.isArray(original['productos'])
      ? (original['productos'] as ProductoDetalleCotizacion[])
      : [],

    servicios: Array.isArray(original['servicios'])
      ? (original['servicios'] as ServicioDetalleCotizacion[])
      : [],

    historial: Array.isArray(original['historial'])
      ? (original['historial'] as HistorialCotizacion[])
      : [],
  };
}

// ======================================================
// COTIZACIONES ADMINISTRATIVAS
// ======================================================

/**
 * Obtiene TODAS las solicitudes de cotización.
 * El backend pagina (máximo 100 por página); aquí se recorren las
 * páginas para que VENTAS y GERENCIA vean todas las solicitudes.
 * Cada solicitud incluye estado_version (estado de su última versión).
 */
export async function obtenerCotizacionesAdmin(): Promise<
  CotizacionAdmin[]
> {
  const LIMITE = 100;
  const token = obtenerToken();

  interface PaginaCotizaciones {
    estado: string;
    mensaje?: string;
    cotizaciones?: unknown[];
    paginacion?: { total_paginas?: number };
  }

  const pedirPagina = (pagina: number) =>
    solicitar<PaginaCotizaciones>(
      `/admin/quotes?limite=${LIMITE}&pagina=${pagina}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

  const primera = await pedirPagina(1);

  if (
    primera?.estado !== 'OK' ||
    !Array.isArray(primera.cotizaciones)
  ) {
    console.error(
      '[TUSA WOOD] Respuesta inesperada al cargar cotizaciones:',
      primera,
    );

    throw new Error(
      primera?.mensaje ||
        'No pudimos cargar las cotizaciones administrativas.',
    );
  }

  let todas: unknown[] = [...primera.cotizaciones];

  const totalPaginas = Math.min(
    Number(primera.paginacion?.total_paginas ?? 1),
    50,
  );

  for (let pagina = 2; pagina <= totalPaginas; pagina++) {
    const siguiente = await pedirPagina(pagina);

    if (Array.isArray(siguiente.cotizaciones)) {
      todas = todas.concat(siguiente.cotizaciones);
    }
  }

  return todas.map(normalizarCotizacion);
}

// ======================================================
// SUPERVISIÓN COMERCIAL
// ======================================================

export interface ResumenSupervisionComercial {
  total_solicitudes: number;
  solicitudes_pendientes: number;
  solicitudes_en_atencion: number;
  versiones_pendientes_aprobacion: number;
  versiones_devuelta: number;
  versiones_aprobadas: number;
  versiones_enviadas: number;
}

export interface FiltrosSupervisionComercial {
  estado_solicitud?: string;
  estado_version?: string;
  buscar?: string;
  pagina?: number;
  limite?: number;
}

export interface PaginacionSupervisionComercial {
  pagina: number;
  limite: number;
  total: number;
  total_paginas: number;
}

export interface SolicitudSupervisionComercial {
  [clave: string]: unknown;
}

export interface RespuestaSupervisionComercial {
  estado: string;
  mensaje?: string;
  resumen: ResumenSupervisionComercial;
  solicitudes: SolicitudSupervisionComercial[];
  paginacion: PaginacionSupervisionComercial;
}

// ======================================================
// DETALLE DE COTIZACIÓN
// ======================================================

export async function obtenerCotizacionAdmin(
  id: number,
): Promise<CotizacionAdmin> {
  const respuesta = await solicitarAdmin<{
    estado: string;
    mensaje?: string;
    cotizacion: CotizacionAdmin;
    resumen?: ResumenCotizacion;
    productos?: ProductoDetalleCotizacion[];
    servicios?: ServicioDetalleCotizacion[];
    historial?: HistorialCotizacion[];
  }>(`/admin/quotes/${id}`);

  if (
    respuesta?.estado !== 'OK' ||
    !respuesta.cotizacion
  ) {
    throw new Error(
      respuesta?.mensaje ||
        'No pudimos obtener el detalle de la cotización.',
    );
  }

  const cotizacion = respuesta.cotizacion;

  const resumen: ResumenCotizacion = {
    total_productos: Number(
      respuesta.resumen?.total_productos ?? 0,
    ),
    total_unidades: Number(
      respuesta.resumen?.total_unidades ?? 0,
    ),
    total_servicios: Number(
      respuesta.resumen?.total_servicios ?? 0,
    ),
    total_items: Number(
      respuesta.resumen?.total_items ?? 0,
    ),
  };

  return {
    ...cotizacion,

    resumen,

    total_productos: resumen.total_productos,
    total_unidades: resumen.total_unidades,
    total_servicios: resumen.total_servicios,
    total_items: resumen.total_items,

    productos: Array.isArray(respuesta.productos)
      ? respuesta.productos
      : cotizacion.productos ?? [],

    servicios: Array.isArray(respuesta.servicios)
      ? respuesta.servicios
      : cotizacion.servicios ?? [],

    historial: Array.isArray(respuesta.historial)
      ? respuesta.historial
      : cotizacion.historial ?? [],
  };
}

// ======================================================
// ACTUALIZAR ESTADO DE COTIZACIÓN
// ======================================================

export async function actualizarEstadoCotizacion(
  id: number,
  estado: string,
  observacion?: string,
): Promise<unknown> {
  return solicitarAdmin(`/admin/quotes/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({
      estado,
      comentario: observacion,
    }),
  });
}

// ======================================================
// VERSIONES DE COTIZACIONES
// ======================================================

export type EstadoVersionCotizacion =
  | 'BORRADOR'
  | 'PENDIENTE_APROBACION'
  | 'DEVUELTA'
  | 'APROBADA'
  | 'ENVIADA'
  | 'ANULADA';

export type ModoIGV = 'INCLUIDO' | 'ADICIONAL';

export type AccionAprobacion = 'APROBADA' | 'DEVUELTA';

export interface VersionCotizacion {
  id_version: number;
  id_cotizacion: number;
  numero_version: number;
  estado: EstadoVersionCotizacion;
  modo_igv: ModoIGV;
  tasa_igv: number | string;
  subtotal: number | string;
  importe_igv: number | string;
  total: number | string;
  condiciones_comerciales?: string | null;
  observaciones_internas?: string | null;
  pdf_ruta?: string | null;
  creado_por: number;
  creado_en: string;
  actualizado_en?: string;
  administrador_creacion?: string | null;
  total_productos?: number | string;
  total_servicios?: number | string;
}

export interface ProductoVersionCotizacion {
  id_detalle_version: number;
  id_version: number;
  id_producto: number | null;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number | string;
  precio_unitario: number | string;
  subtotal_linea: number | string;
  creado_en?: string;
}

export interface ServicioVersionCotizacion {
  id_detalle_servicio_version: number;
  id_version: number;
  id_servicio: number;
  nombre_servicio: string;
  descripcion: string | null;
  cantidad: number | string;
  precio_unitario: number | string;
  subtotal_linea: number | string;
  creado_en?: string;
}

export interface AprobacionVersionCotizacion {
  id_aprobacion: number;
  id_version: number;
  id_administrador: number;
  accion: AccionAprobacion;
  observaciones: string | null;
  creado_en: string;
  administrador?: string;
}

export interface DetalleVersionCotizacion {
  estado: string;
  mensaje?: string;
  version: VersionCotizacion & {
    codigo_cotizacion?: string;
    empresa?: string | null;
    nombre_contacto?: string;
    correo?: string;
    telefono?: string;
    direccion?: string | null;
  };
  productos: ProductoVersionCotizacion[];
  servicios: ServicioVersionCotizacion[];
  aprobaciones: AprobacionVersionCotizacion[];
}

export interface RespuestaVersionCotizacion {
  estado: string;
  mensaje?: string;
  version: VersionCotizacion;
  version_anterior?: {
    id_version: number;
    numero_version: number;
    estado: string;
  };
}

export interface RespuestaListaVersiones {
  estado: string;
  mensaje?: string;
  versiones: VersionCotizacion[];
}

export interface DatosActualizarVersion {
  productos?: Array<{
    id_detalle_version: number;
    nombre_producto?: string;
    descripcion?: string | null;
    cantidad: number;
    precio_unitario: number;
  }>;
  servicios?: Array<{
    id_detalle_servicio_version: number;
    descripcion?: string | null;
    cantidad: number;
    precio_unitario: number;
  }>;
  condiciones_comerciales?: string | null;
  observaciones_internas?: string | null;
}

// ======================================================
// NUEVOS TIPOS: AGREGAR Y ELIMINAR LÍNEAS
// ======================================================

export interface DatosAgregarProductoVersion {
  id_producto?: number | null;
  nombre_producto?: string;
  descripcion?: string | null;
  cantidad: number;
  precio_unitario: number;
}

export interface DatosAgregarServicioVersion {
  id_servicio: number;
  descripcion?: string | null;
  cantidad: number;
  precio_unitario: number;
}

export interface RespuestaLineaVersion {
  estado: string;
  mensaje?: string;
  detalle?: ProductoVersionCotizacion | ServicioVersionCotizacion;
  producto?: ProductoVersionCotizacion;
  servicio?: ServicioVersionCotizacion;
  importes?: {
    subtotal: number | string;
    importe_igv: number | string;
    total: number | string;
  };
}

export interface RespuestaEliminarLineaVersion {
  estado: string;
  mensaje?: string;
  importes?: {
    subtotal: number | string;
    importe_igv: number | string;
    total: number | string;
  };
}

export interface RespuestaActualizarVersion {
  estado: string;
  mensaje?: string;
  version: VersionCotizacion;
  importes: {
    subtotal: number | string;
    importe_igv: number | string;
    total: number | string;
  };
}

export interface RespuestaAprobacionVersion {
  estado: string;
  mensaje?: string;
  version: VersionCotizacion;
  aprobacion: AprobacionVersionCotizacion;
}

export interface RespuestaEnvioCliente {
  estado: 'OK' | 'PENDIENTE' | 'ERROR' | 'REVISION_REQUERIDA' | string;
  mensaje?: string;
  cotizacion?: {
    id_cotizacion: number;
    codigo: string;
    id_version: number;
    numero_version: number;
    estado: string;
    destinatario?: string;
  };
  notificacion?: {
    id_notificacion: number;
    estado: string;
  };
  id_notificacion?: number;
}

/** Lista todas las versiones de una solicitud (más reciente primero). */
export async function obtenerVersionesCotizacionAdmin(
  idCotizacion: number,
): Promise<VersionCotizacion[]> {
  const respuesta = await solicitarAdmin<RespuestaListaVersiones>(
    `/admin/quotes/${idCotizacion}/versions`,
  );

  if (
    respuesta.estado !== 'OK' ||
    !Array.isArray(respuesta.versiones)
  ) {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos cargar las versiones de esta cotización.',
    );
  }

  return respuesta.versiones;
}

/** Crea la primera versión o una nueva versión de una cotización. */
export async function crearVersionCotizacionAdmin(
  idCotizacion: number,
): Promise<RespuestaVersionCotizacion> {
  const respuesta = await solicitarAdmin<RespuestaVersionCotizacion>(
    `/admin/quotes/${idCotizacion}/versions`,
    {
      method: 'POST',
    },
  );

  if (
    respuesta.estado !== 'OK' ||
    !respuesta.version
  ) {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos crear la versión de cotización.',
    );
  }

  return respuesta;
}

/** Obtiene los datos, productos, servicios y aprobaciones de una versión. */
export async function obtenerVersionCotizacionAdmin(
  idVersion: number,
): Promise<DetalleVersionCotizacion> {
  const respuesta = await solicitarAdmin<DetalleVersionCotizacion>(
    `/admin/quote-versions/${idVersion}`,
  );

  if (
    respuesta.estado !== 'OK' ||
    !respuesta.version
  ) {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos obtener el detalle de esta versión.',
    );
  }

  return {
    ...respuesta,
    productos: Array.isArray(respuesta.productos)
      ? respuesta.productos
      : [],
    servicios: Array.isArray(respuesta.servicios)
      ? respuesta.servicios
      : [],
    aprobaciones: Array.isArray(respuesta.aprobaciones)
      ? respuesta.aprobaciones
      : [],
  };
}

/** Actualiza precios, cantidades, descripciones y condiciones de una versión. */
export async function actualizarVersionCotizacionAdmin(
  idVersion: number,
  datos: DatosActualizarVersion,
): Promise<RespuestaActualizarVersion> {
  const respuesta = await solicitarAdmin<RespuestaActualizarVersion>(
    `/admin/quote-versions/${idVersion}`,
    {
      method: 'PUT',
      body: JSON.stringify(datos),
    },
  );

  if (
    respuesta.estado !== 'OK' ||
    !respuesta.version
  ) {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos actualizar la versión de cotización.',
    );
  }

  return respuesta;
}

// ======================================================
// AGREGAR Y ELIMINAR PRODUCTOS DE UNA VERSIÓN
// ======================================================

/**
 * Agrega un producto a una versión editable.
 * id_producto puede ser null para productos personalizados.
 */
export async function agregarProductoVersionAdmin(
  idVersion: number,
  datos: DatosAgregarProductoVersion,
): Promise<RespuestaLineaVersion> {
  const respuesta = await solicitarAdmin<RespuestaLineaVersion>(
    `/admin/quote-versions/${idVersion}/products`,
    {
      method: 'POST',
      body: JSON.stringify(datos),
    },
  );

  if (respuesta.estado !== 'OK') {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos agregar el producto a la versión.',
    );
  }

  return respuesta;
}

/** Elimina un producto de una versión editable. */
export async function eliminarProductoVersionAdmin(
  idVersion: number,
  idDetalle: number,
): Promise<RespuestaEliminarLineaVersion> {
  const respuesta =
    await solicitarAdmin<RespuestaEliminarLineaVersion>(
      `/admin/quote-versions/${idVersion}/products/${idDetalle}`,
      {
        method: 'DELETE',
      },
    );

  if (respuesta.estado !== 'OK') {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos eliminar el producto de la versión.',
    );
  }

  return respuesta;
}

// ======================================================
// AGREGAR Y ELIMINAR SERVICIOS DE UNA VERSIÓN
// ======================================================

/** Agrega un servicio a una versión editable. */
export async function agregarServicioVersionAdmin(
  idVersion: number,
  datos: DatosAgregarServicioVersion,
): Promise<RespuestaLineaVersion> {
  const respuesta = await solicitarAdmin<RespuestaLineaVersion>(
    `/admin/quote-versions/${idVersion}/services`,
    {
      method: 'POST',
      body: JSON.stringify(datos),
    },
  );

  if (respuesta.estado !== 'OK') {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos agregar el servicio a la versión.',
    );
  }

  return respuesta;
}

/** Elimina un servicio de una versión editable. */
export async function eliminarServicioVersionAdmin(
  idVersion: number,
  idDetalle: number,
): Promise<RespuestaEliminarLineaVersion> {
  const respuesta =
    await solicitarAdmin<RespuestaEliminarLineaVersion>(
      `/admin/quote-versions/${idVersion}/services/${idDetalle}`,
      {
        method: 'DELETE',
      },
    );

  if (respuesta.estado !== 'OK') {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos eliminar el servicio de la versión.',
    );
  }

  return respuesta;
}

// ======================================================
// APROBACIONES Y ENVÍO AL CLIENTE
// ======================================================

/** Envía una versión editable a GERENCIA para su aprobación. */
export async function enviarVersionAprobacionAdmin(
  idVersion: number,
): Promise<RespuestaVersionCotizacion> {
  const respuesta = await solicitarAdmin<RespuestaVersionCotizacion>(
    `/admin/quote-versions/${idVersion}/enviar-aprobacion`,
    {
      method: 'POST',
    },
  );

  if (
    respuesta.estado !== 'OK' ||
    !respuesta.version
  ) {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos enviar la versión a aprobación.',
    );
  }

  return respuesta;
}

/** GERENCIA o SUPERADMIN aprueba o devuelve una versión. */
export async function resolverAprobacionVersionAdmin(
  idVersion: number,
  accion: AccionAprobacion,
  observaciones?: string,
): Promise<RespuestaAprobacionVersion> {
  const respuesta = await solicitarAdmin<RespuestaAprobacionVersion>(
    `/admin/quote-versions/${idVersion}/aprobacion`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        accion,
        observaciones,
      }),
    },
  );

  if (
    respuesta.estado !== 'OK' ||
    !respuesta.version ||
    !respuesta.aprobacion
  ) {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos registrar la decisión de aprobación.',
    );
  }

  return respuesta;
}

/**
 * Envía al cliente una cotización aprobada.
 *
 * Puede devolver:
 * OK: correo enviado.
 * PENDIENTE: envío pendiente o con reintento programado.
 *
 * Los errores especiales del backend conservan su mensaje.
 * No se debe repetir el envío automáticamente desde el frontend.
 */
export async function enviarCotizacionVersionClienteAdmin(
  idVersion: number,
): Promise<RespuestaEnvioCliente> {
  const respuesta = await solicitarAdmin<RespuestaEnvioCliente>(
    `/admin/quote-versions/${idVersion}/enviar-cliente`,
    {
      method: 'POST',
    },
  );

  if (
    !['OK', 'PENDIENTE'].includes(respuesta.estado)
  ) {
    throw new Error(
      respuesta.mensaje ||
        'No se pudo procesar el envío de la cotización.',
    );
  }

  return respuesta;
}

// ======================================================
// CONFIGURACIÓN TRIBUTARIA - IGV
// ======================================================

export interface ConfiguracionIGV {
  id_configuracion: number;
  modo_igv: ModoIGV;
  tasa_igv: number | string;
  actualizado_por: number | null;
  actualizado_en: string | null;
  administrador_actualizacion?: string | null;
  correo_administrador?: string | null;
}

export interface RespuestaConfiguracionIGV {
  estado: 'OK' | 'SIN_CONFIGURACION' | 'ERROR' | string;
  mensaje?: string;
  configuracion: ConfiguracionIGV | null;
  tasa_igv?: number;
}

export interface RespuestaActualizarConfiguracionIGV {
  estado: string;
  mensaje?: string;
  configuracion: ConfiguracionIGV;
}

/** Consulta la modalidad tributaria configurada en el sistema. */
export async function obtenerConfiguracionIGV(): Promise<RespuestaConfiguracionIGV> {
  const respuesta = await solicitarAdmin<RespuestaConfiguracionIGV>(
    '/admin/quote-settings',
  );

  if (
    !['OK', 'SIN_CONFIGURACION'].includes(respuesta.estado)
  ) {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos obtener la configuración tributaria.',
    );
  }

  return respuesta;
}

/** Actualiza la modalidad del IGV. Solo GERENCIA y SUPERADMIN. */
export async function actualizarConfiguracionIGV(
  modo_igv: ModoIGV,
): Promise<ConfiguracionIGV> {
  const respuesta =
    await solicitarAdmin<RespuestaActualizarConfiguracionIGV>(
      '/admin/quote-settings',
      {
        method: 'PUT',
        body: JSON.stringify({ modo_igv }),
      },
    );

  if (
    respuesta.estado !== 'OK' ||
    !respuesta.configuracion
  ) {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos actualizar la configuración tributaria.',
    );
  }

  return respuesta.configuracion;
}

// ======================================================
// PRODUCTOS ADMINISTRATIVOS
// ======================================================

/**
 * Obtiene los productos del panel administrativo.
 * El backend admite hasta 100 productos por solicitud.
 * activo=todos es el comportamiento predeterminado del backend.
 */
export async function obtenerProductosAdmin(): Promise<Producto[]> {
  const respuesta = await solicitarAdmin<RespuestaProductos>(
    '/admin/products?limite=100&pagina=1',
  );

  if (
    respuesta?.estado !== 'OK' ||
    !Array.isArray(respuesta.productos)
  ) {
    throw new Error(
      'No pudimos cargar los productos administrativos.',
    );
  }

  return respuesta.productos;
}

// ======================================================
// TOTAL GENERAL DE PRODUCTOS
// ======================================================

interface RespuestaTotalProductos {
  estado: string;
  total: number;
}

export async function obtenerTotalProductosGeneral(): Promise<number> {
  const respuesta = await solicitarAdmin<RespuestaTotalProductos>(
    '/admin/products/total',
  );

  if (
    respuesta?.estado !== 'OK' ||
    typeof respuesta.total !== 'number' ||
    !Number.isFinite(respuesta.total)
  ) {
    throw new Error(
      'No pudimos obtener el total general de productos.',
    );
  }

  return respuesta.total;
}

// ======================================================
// PRODUCTO INDIVIDUAL ADMINISTRATIVO
// ======================================================

export async function obtenerProductoAdmin(
  id: number,
): Promise<Producto> {
  const respuesta = await solicitarAdmin<{
    estado: string;
    producto: Producto;
  }>(`/admin/products/${id}`);

  if (
    respuesta?.estado !== 'OK' ||
    !respuesta.producto
  ) {
    throw new Error(
      'No pudimos obtener el producto solicitado.',
    );
  }

  return respuesta.producto;
}

// ======================================================
// CREAR PRODUCTO
// ======================================================

export async function crearProductoAdmin(
  producto: Partial<Producto>,
): Promise<unknown> {
  return solicitarAdmin('/admin/products', {
    method: 'POST',
    body: JSON.stringify(producto),
  });
}

// ======================================================
// ACTUALIZAR PRODUCTO
// ======================================================

export async function actualizarProductoAdmin(
  id: number,
  producto: Partial<Producto>,
): Promise<unknown> {
  return solicitarAdmin(`/admin/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(producto),
  });
}

// ======================================================
// ACTIVAR / DESACTIVAR PRODUCTO
// ======================================================

export async function cambiarEstadoProductoAdmin(
  id: number,
  activo: boolean,
): Promise<unknown> {
  return solicitarAdmin(`/admin/products/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
  });
}

// ======================================================
// MI PERFIL ADMINISTRATIVO
// ======================================================

export interface PerfilAdministrador {
  id_administrador: number;
  nombre: string;
  correo: string;
  rol: 'SUPERADMIN' | 'VENTAS' | 'GERENCIA' | string;
  activo?: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

export interface RespuestaPerfilAdmin {
  estado: string;
  mensaje?: string;
  perfil?: PerfilAdministrador;
  administrador?: PerfilAdministrador;
  [clave: string]: unknown;
}

export interface DatosActualizarPerfilAdmin {
  nombre: string;
  correo: string;
}

export interface DatosCambiarPasswordAdmin {
  password_actual: string;
  password_nueva: string;
  confirmar_password: string;
}

export async function obtenerPerfilAdmin(): Promise<PerfilAdministrador> {
  const respuesta = await solicitarAdmin<RespuestaPerfilAdmin>(
    '/auth/perfil',
  );

  const perfil =
    respuesta.perfil ?? respuesta.administrador;

  if (respuesta.estado !== 'OK' || !perfil) {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos cargar tu perfil administrativo.',
    );
  }

  return perfil;
}

export async function actualizarPerfilAdmin(
  datos: DatosActualizarPerfilAdmin,
): Promise<RespuestaPerfilAdmin> {
  const respuesta = await solicitarAdmin<RespuestaPerfilAdmin>(
    '/auth/perfil',
    {
      method: 'PUT',
      body: JSON.stringify(datos),
    },
  );

  if (respuesta.estado !== 'OK') {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos actualizar tu perfil.',
    );
  }

  return respuesta;
}

export async function cambiarPasswordAdmin(
  datos: DatosCambiarPasswordAdmin,
): Promise<RespuestaPerfilAdmin> {
  if (datos.password_nueva !== datos.confirmar_password) {
    throw new Error('Las contraseñas nuevas no coinciden.');
  }

  if (datos.password_nueva.length < 8) {
    throw new Error(
      'La nueva contraseña debe tener al menos 8 caracteres.',
    );
  }

  const respuesta = await solicitarAdmin<RespuestaPerfilAdmin>(
    '/auth/perfil/password',
    {
      method: 'PATCH',
      body: JSON.stringify(datos),
    },
  );

  if (respuesta.estado !== 'OK') {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos cambiar tu contraseña.',
    );
  }

  return respuesta;
}

// ======================================================
// GESTIÓN DE ADMINISTRADORES
// ======================================================

export type RolAdministrador =
  | 'SUPERADMIN'
  | 'ADMIN'
  | 'VENTAS'
  | 'GERENCIA';

export interface AdministradorGestion {
  id_administrador: number;
  nombre: string;
  correo: string;
  rol: RolAdministrador;
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

export interface RespuestaAdministradoresAdmin {
  estado: string;
  mensaje?: string;
  administradores?: AdministradorGestion[];
  administrador?: AdministradorGestion;
  [clave: string]: unknown;
}

export interface DatosCrearAdministrador {
  nombre: string;
  correo: string;
  password: string;
  rol: RolAdministrador;
}

export interface DatosActualizarAdministrador {
  nombre: string;
  correo: string;
  rol: RolAdministrador;
}

export interface RespuestaAccionAdmin {
  estado: string;
  mensaje?: string;
  administrador?: AdministradorGestion;
  [clave: string]: unknown;
}

export async function obtenerAdministradoresAdmin(): Promise<
  AdministradorGestion[]
> {
  const respuesta =
    await solicitarAdmin<RespuestaAdministradoresAdmin>(
      '/auth/administradores',
    );

  if (
    respuesta.estado !== 'OK' ||
    !Array.isArray(respuesta.administradores)
  ) {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos cargar la lista de administradores.',
    );
  }

  return respuesta.administradores;
}

export async function obtenerAdministradorAdmin(
  id: number,
): Promise<AdministradorGestion> {
  const respuesta =
    await solicitarAdmin<RespuestaAdministradoresAdmin>(
      `/auth/administradores/${id}`,
    );

  if (
    respuesta.estado !== 'OK' ||
    !respuesta.administrador
  ) {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos obtener los datos del administrador.',
    );
  }

  return respuesta.administrador;
}

export async function crearAdministradorAdmin(
  datos: DatosCrearAdministrador,
): Promise<RespuestaAccionAdmin> {
  const respuesta =
    await solicitarAdmin<RespuestaAccionAdmin>(
      '/auth/administradores',
      {
        method: 'POST',
        body: JSON.stringify(datos),
      },
    );

  if (respuesta.estado !== 'OK') {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos registrar al administrador.',
    );
  }

  return respuesta;
}

export async function actualizarAdministradorAdmin(
  id: number,
  datos: DatosActualizarAdministrador,
): Promise<RespuestaAccionAdmin> {
  const respuesta =
    await solicitarAdmin<RespuestaAccionAdmin>(
      `/auth/administradores/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(datos),
      },
    );

  if (respuesta.estado !== 'OK') {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos actualizar al administrador.',
    );
  }

  return respuesta;
}

export async function cambiarEstadoAdministradorAdmin(
  id: number,
  activo: boolean,
): Promise<RespuestaAccionAdmin> {
  const respuesta =
    await solicitarAdmin<RespuestaAccionAdmin>(
      `/auth/administradores/${id}/estado`,
      {
        method: 'PATCH',
        body: JSON.stringify({ activo }),
      },
    );

  if (respuesta.estado !== 'OK') {
    throw new Error(
      respuesta.mensaje ||
        'No pudimos cambiar el estado del administrador.',
    );
  }

  return respuesta;
}

// ======================================================
// CERRAR SESIÓN ADMINISTRATIVA
// ======================================================

export function cerrarSesionAdmin(): void {
  localStorage.removeItem('tusa_token');
  localStorage.removeItem('tusa_administrador');
}