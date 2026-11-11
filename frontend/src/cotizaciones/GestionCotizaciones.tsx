import { useEffect, useMemo, useRef, useState } from 'react';

import {
  obtenerCotizacionesAdmin,
  obtenerCotizacionAdmin,
  actualizarEstadoCotizacion,
  obtenerVersionesCotizacionAdmin,
  crearVersionCotizacionAdmin,
  obtenerVersionCotizacionAdmin,
  actualizarVersionCotizacionAdmin,
  enviarVersionAprobacionAdmin,
  resolverAprobacionVersionAdmin,
  enviarCotizacionVersionClienteAdmin,
  obtenerConfiguracionIGV,
  obtenerProductos,
  obtenerServicios,
  agregarProductoVersionAdmin,
  eliminarProductoVersionAdmin,
  agregarServicioVersionAdmin,
  eliminarServicioVersionAdmin,
} from '../services/api';

import { alertas } from '../utils/alertas';
import DetalleCotizacionModal from './DetalleCotizacionModal';
import FormularioCotizacionModal from './FormularioCotizacionModal';
import HistorialCotizacion from './HistorialCotizacion';
import EditorLineasCotizacion from './EditorLineasCotizacion';
import './quotes-management.css';
import './lineas-version.css';
import './formulario-cotizacion-modal.css';


import type { Cotizacion, Registro, ResumenGeneral, VersionDetalle } from './tiposCotizaciones';
import type { ProductoDetalleCotizacion, ServicioDetalleCotizacion, HistorialCotizacion as HistorialCotizacionRegistro, Producto, Servicio } from '../services/api';
import {
  estadosSolicitud,
  obtenerNombreCliente,
  obtenerCodigo,
  obtenerFecha,
  obtenerFechaHora,
  normalizarEstado,
  formatearEstado,
  formatearEstadoVersion,
  obtenerClaseEstado,
  obtenerListaCotizaciones,
  obtenerMensajeError,
  obtenerDatosRespuesta,
  obtenerClaveHistorial,
  obtenerEtiquetaRol,
  obtenerRolActual,
  formatearMoneda,
  obtenerNombreVersion,
  obtenerIdVersion,
  obtenerRespuestaVersionDetalle,
} from './utilsCotizaciones';

// Estado de la última versión de cotización de una solicitud.
// Viene en el listado (estado_version). Vacío = todavía no se armó.
function estadoVersionLista(cotizacion: Cotizacion): string {
  const valor = (cotizacion as unknown as Registro).estado_version;
  return typeof valor === 'string' ? valor.trim().toUpperCase() : '';
}

export default function GestionCotizaciones() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [busqueda, setBusqueda] = useState('');
  // VENTAS entra viendo las solicitudes pendientes; GERENCIA y SUPERADMIN
  // entran viendo las cotizaciones que esperan su aprobación.
  const [filtroEstado, setFiltroEstado] = useState<string>(() => {
    const rol = obtenerRolActual();
    if (rol === 'VENTAS') return 'PENDIENTE';
    if (rol === 'GERENCIA' || rol === 'SUPERADMIN') return 'POR_APROBAR';
    return 'TODOS';
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [seleccionada, setSeleccionada] =
    useState<Cotizacion | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [rolActual] = useState<string>(() => obtenerRolActual());

  const esSuperAdmin = rolActual === 'SUPERADMIN';
  const esGerencia = rolActual === 'GERENCIA' || esSuperAdmin;
  const esVentas = rolActual === 'VENTAS';

  // Armar la cotización (precios, condiciones, enviar a aprobación):
  // VENTAS (y SUPERADMIN). GERENCIA solo revisa, aprueba o devuelve.
  const puedeArmar = esVentas || esSuperAdmin;

  // Estado de la solicitud: GERENCIA y SUPERADMIN pueden usar todos los
  // estados; VENTAS solo puede marcarla como EN_ATENCION (regla del backend).
  const puedeGestionarSolicitud = esGerencia || esVentas;

  const [nuevoEstadoSolicitud, setNuevoEstadoSolicitud] =
    useState('PENDIENTE');
  const [observacionEstadoSolicitud, setObservacionEstadoSolicitud] =
    useState('');
  const [procesandoEstadoSolicitud, setProcesandoEstadoSolicitud] =
    useState(false);

  const [versiones, setVersiones] = useState<Registro[]>([]);
  const [versionSeleccionada, setVersionSeleccionada] =
    useState<VersionDetalle | null>(null);
  const [idVersionActiva, setIdVersionActiva] = useState<number | null>(
    null,
  );

  const [cargandoVersiones, setCargandoVersiones] = useState(false);
  const [cargandoVersionDetalle, setCargandoVersionDetalle] =
    useState(false);
  const [procesandoVersion, setProcesandoVersion] = useState(false);
  const [modalArmadoAbierto, setModalArmadoAbierto] = useState(false);

  // Conteos de la última consulta, para avisar cuando llega una novedad.
  const conteosPrevios = useRef<{
    porAprobar: number;
    devueltas: number;
  } | null>(null);

  const [productosEditables, setProductosEditables] = useState<Registro[]>(
    [],
  );
  const [serviciosEditables, setServiciosEditables] = useState<Registro[]>(
    [],
  );

  const [condicionesComerciales, setCondicionesComerciales] =
    useState('');
  const [observacionesInternas, setObservacionesInternas] = useState('');
  const [observacionesAprobacion, setObservacionesAprobacion] =
    useState('');

  const [configuracionIGV, setConfiguracionIGV] =
    useState<Registro | null>(null);
  const [catalogoProductos, setCatalogoProductos] = useState<Producto[]>([]);
  const [catalogoServicios, setCatalogoServicios] = useState<Servicio[]>([]);

  // Avisa a GERENCIA cuando VENTAS envía una cotización a aprobación y a
  // VENTAS cuando GERENCIA devuelve una con observaciones.
  function avisarNovedades(lista: Cotizacion[]) {
    const actual = {
      porAprobar: lista.filter(
        (item) => estadoVersionLista(item) === 'PENDIENTE_APROBACION',
      ).length,
      devueltas: lista.filter(
        (item) => estadoVersionLista(item) === 'DEVUELTA',
      ).length,
    };

    const previo = conteosPrevios.current;
    conteosPrevios.current = actual;

    if (!previo) return;

    if (esGerencia && actual.porAprobar > previo.porAprobar) {
      void alertas.notificacion(
        'Hay una nueva cotización pendiente de aprobación',
        'success',
      );
    }

    if (esVentas && actual.devueltas > previo.devueltas) {
      void alertas.notificacion(
        'GERENCIA devolvió una cotización con observaciones',
        'success',
      );
    }
  }

  async function cargarCotizaciones(
    mostrarCarga = true,
  ): Promise<boolean> {
    try {
      if (mostrarCarga) setCargando(true);

      setError('');

      if (mostrarCarga) {
        alertas.cargando(
          'Cargando cotizaciones...',
          'Estamos obteniendo las solicitudes recibidas.',
        );
      }

      const respuesta: unknown = await obtenerCotizacionesAdmin();

      const listaInicial = obtenerListaCotizaciones(respuesta);

      setCotizaciones(listaInicial);
      avisarNovedades(listaInicial);

      if (mostrarCarga) alertas.cerrar();

      return true;
    } catch (error_) {
      console.error('Error al cargar cotizaciones:', error_);

      const mensajeError = obtenerMensajeError(
        error_,
        'No se pudieron cargar las cotizaciones.',
      );

      setError(mensajeError);

      if (mostrarCarga) alertas.cerrar();

      await alertas.error(
        'No se pudieron cargar las cotizaciones',
        mensajeError,
      );

      return false;
    } finally {
      if (mostrarCarga) setCargando(false);
    }
  }

  // Recarga la lista sin mostrar cargando ni alertas (uso interno).
  async function refrescarListaSilencioso() {
    try {
      const respuesta: unknown = await obtenerCotizacionesAdmin();
      const lista = obtenerListaCotizaciones(respuesta);

      setCotizaciones(lista);
      avisarNovedades(lista);
    } catch (error_) {
      console.error('No se pudo refrescar la lista:', error_);
    }
  }

  async function cargarConfiguracionIGV() {
    try {
      const respuesta: unknown = await obtenerConfiguracionIGV();
      const datos = obtenerDatosRespuesta(respuesta);

      setConfiguracionIGV(datos.configuracion || null);
    } catch (error_) {
      console.error(
        'No se pudo consultar la configuración IGV:',
        error_,
      );

      setConfiguracionIGV(null);
    }
  }

  async function cargarCatalogosLineas() {
    try {
      const [productos, servicios] = await Promise.all([
        obtenerProductos(),
        obtenerServicios(),
      ]);
      setCatalogoProductos(productos);
      setCatalogoServicios(servicios);
    } catch (error_) {
      console.error('No se pudieron cargar los catálogos para cotizaciones:', error_);
    }
  }

  useEffect(() => {
    void cargarCotizaciones();
    void cargarConfiguracionIGV();
    void cargarCatalogosLineas();
  }, []);

  useEffect(() => {
    function manejarEscape(evento: KeyboardEvent) {
      if (
        evento.key === 'Escape' &&
        !procesandoVersion &&
        !procesandoEstadoSolicitud
      ) {
        if (modalArmadoAbierto) {
          setModalArmadoAbierto(false);
          return;
        }

        cerrarDetalle();
      }
    }

    window.addEventListener('keydown', manejarEscape);

    return () => {
      window.removeEventListener('keydown', manejarEscape);
    };
  }, [procesandoVersion, procesandoEstadoSolicitud, modalArmadoAbierto]);

  // Actualización automática: así GERENCIA ve las cotizaciones que VENTAS
  // envía a aprobación (y viceversa) sin tener que recargar la página.
  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState === 'visible') {
        void refrescarListaSilencioso();
      }
    };

    const intervalo = window.setInterval(refrescar, 8000);

    window.addEventListener('focus', refrescar);
    document.addEventListener('visibilitychange', refrescar);

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener('focus', refrescar);
      document.removeEventListener('visibilitychange', refrescar);
    };
  }, []);

  // Si el detalle está abierto y la versión cambió de estado en el servidor
  // (por ejemplo VENTAS la envió o GERENCIA la devolvió), se recarga sola.
  // No se toca si el usuario está editando precios.
  useEffect(() => {
    if (
      !seleccionada ||
      !versionSeleccionada ||
      procesandoVersion ||
      cargandoVersiones ||
      cargandoVersionDetalle
    ) {
      return;
    }

    const fila = cotizaciones.find(
      (item) => item.id_cotizacion === seleccionada.id_cotizacion,
    ) as unknown as Registro | undefined;

    if (!fila) return;

    const mismaVersion =
      Number(fila.numero_version_actual) ===
      Number(versionSeleccionada.version.numero_version);

    const estadoServidor = String(fila.estado_version || '')
      .trim()
      .toUpperCase();

    const estadoLocal = normalizarEstado(versionSeleccionada.version.estado);

    const editando =
      ['BORRADOR', 'DEVUELTA'].includes(estadoLocal) && puedeArmar;

    if (mismaVersion && estadoServidor && estadoServidor !== estadoLocal && !editando) {
      void cargarVersiones(seleccionada.id_cotizacion, idVersionActiva);
    }
  }, [cotizaciones]);

  const cotizacionesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return cotizaciones.filter((cotizacion) => {
      const codigo = obtenerCodigo(cotizacion).toLowerCase();
      const nombre = obtenerNombreCliente(cotizacion).toLowerCase();
      const empresa = (cotizacion.empresa || '').toLowerCase();
      const correo = (cotizacion.correo || '').toLowerCase();

      const coincideBusqueda =
        codigo.includes(texto) ||
        nombre.includes(texto) ||
        empresa.includes(texto) ||
        correo.includes(texto);

      let coincideEstado: boolean;

      if (filtroEstado === 'TODOS') {
        coincideEstado = true;
      } else if (filtroEstado === 'POR_APROBAR') {
        coincideEstado =
          estadoVersionLista(cotizacion) === 'PENDIENTE_APROBACION';
      } else if (filtroEstado === 'DEVUELTAS') {
        coincideEstado = estadoVersionLista(cotizacion) === 'DEVUELTA';
      } else {
        coincideEstado =
          normalizarEstado(cotizacion.estado) === filtroEstado;
      }

      return coincideBusqueda && coincideEstado;
    });
  }, [cotizaciones, busqueda, filtroEstado]);

  const resumenGeneral: ResumenGeneral = useMemo(
    () => ({
      total: cotizaciones.length,
      pendientes: cotizaciones.filter(
        (cotizacion) =>
          normalizarEstado(cotizacion.estado) === 'PENDIENTE',
      ).length,
      atencion: cotizaciones.filter(
        (cotizacion) =>
          normalizarEstado(cotizacion.estado) === 'EN_ATENCION',
      ).length,
      cotizadas: cotizaciones.filter(
        (cotizacion) =>
          normalizarEstado(cotizacion.estado) === 'COTIZADA',
      ).length,
      aceptadas: cotizaciones.filter(
        (cotizacion) =>
          normalizarEstado(cotizacion.estado) === 'ACEPTADA',
      ).length,
    }),
    [cotizaciones],
  );

  async function cargarVersiones(
    idCotizacion: number,
    idPreferido?: number | null,
  ) {
    try {
      setCargandoVersiones(true);

      const respuesta: unknown =
        await obtenerVersionesCotizacionAdmin(idCotizacion);

      const datos = obtenerDatosRespuesta(respuesta);

      // obtenerVersionesCotizacionAdmin ya devuelve el arreglo de versiones.
      const lista: Registro[] = Array.isArray(respuesta)
        ? respuesta
        : Array.isArray(datos.versiones)
          ? datos.versiones
          : [];

      setVersiones(lista);

      if (lista.length > 0) {
        const versionPreferida = idPreferido
          ? lista.find(
              (item: Registro) =>
                obtenerIdVersion(item) === idPreferido,
            )
          : undefined;

        const seleccion = versionPreferida || lista[0];
        const id = obtenerIdVersion(seleccion);

        if (id) await cargarDetalleVersion(id);
      } else {
        setVersionSeleccionada(null);
        setIdVersionActiva(null);
        setProductosEditables([]);
        setServiciosEditables([]);
        setCondicionesComerciales('');
        setObservacionesInternas('');
      }

      // Mantiene la tabla al día con los estados de las versiones.
      void refrescarListaSilencioso();
    } catch (error_) {
      console.error('Error al cargar versiones:', error_);

      await alertas.error(
        'No se pudieron cargar las versiones',
        obtenerMensajeError(
          error_,
          'No se pudo consultar el historial de versiones de esta cotización.',
        ),
      );
    } finally {
      setCargandoVersiones(false);
    }
  }

  async function cargarDetalleVersion(idVersion: number) {
    try {
      setCargandoVersionDetalle(true);

      // Si se recarga la misma versión (por ejemplo al agregar una línea)
      // no se vacía la pantalla, para que el modal no parpadee.
      if (idVersion !== idVersionActiva) {
        setVersionSeleccionada(null);
        setIdVersionActiva(null);
        setProductosEditables([]);
        setServiciosEditables([]);
        setCondicionesComerciales('');
        setObservacionesInternas('');
      }

      const respuesta: unknown =
        await obtenerVersionCotizacionAdmin(idVersion);

      const detalle = obtenerRespuestaVersionDetalle(respuesta);

      if (!detalle.version || !obtenerIdVersion(detalle.version)) {
        throw new Error(
          'La API no devolvió una versión de cotización válida.',
        );
      }

      setVersionSeleccionada(detalle);
      setIdVersionActiva(idVersion);

      setProductosEditables(
        detalle.productos.map((producto) => ({
          ...producto,
          cantidad: Number(producto.cantidad ?? 0),
          precio_unitario: Number(producto.precio_unitario ?? 0),
        })),
      );

      setServiciosEditables(
        detalle.servicios.map((servicio) => ({
          ...servicio,
          cantidad: Number(servicio.cantidad ?? 0),
          precio_unitario: Number(servicio.precio_unitario ?? 0),
        })),
      );

      setCondicionesComerciales(
        String(detalle.version.condiciones_comerciales || ''),
      );

      setObservacionesInternas(
        String(detalle.version.observaciones_internas || ''),
      );

      setObservacionesAprobacion('');
    } catch (error_) {
      console.error('Error al cargar detalle de versión:', error_);

      await alertas.error(
        'No se pudo abrir la versión',
        obtenerMensajeError(
          error_,
          'No se pudo consultar el detalle de esta versión.',
        ),
      );
    } finally {
      setCargandoVersionDetalle(false);
    }
  }

  async function abrirDetalle(cotizacion: Cotizacion) {
  try {
    setSeleccionada(null);
    setVersiones([]);
    setVersionSeleccionada(null);
    setIdVersionActiva(null);
    setProductosEditables([]);
    setServiciosEditables([]);
    setCargandoDetalle(true);

    const respuesta: unknown = await obtenerCotizacionAdmin(
      cotizacion.id_cotizacion,
    );

    // obtenerCotizacionAdmin ya devuelve la cotización normalizada.
    const detalle = respuesta as Cotizacion;

    if (
      !detalle ||
      !Number.isFinite(Number(detalle.id_cotizacion)) ||
      Number(detalle.id_cotizacion) <= 0
    ) {
      throw new Error(
        'La API no devolvió una cotización válida.',
      );
    }

    setSeleccionada(detalle);
    setNuevoEstadoSolicitud(normalizarEstado(detalle.estado));
    setObservacionEstadoSolicitud('');

    await cargarVersiones(detalle.id_cotizacion);
  } catch (error_) {
    console.error('Error al consultar cotización:', error_);

    await alertas.error(
      'No se pudo abrir el detalle',
      obtenerMensajeError(
        error_,
        'No se pudo cargar el detalle de la cotización.',
      ),
    );
  } finally {
    setCargandoDetalle(false);
  }
}
  // Actualización independiente del estado general de la solicitud.
  // Está disponible para VENTAS, GERENCIA y SUPERADMIN.
  async function guardarEstadoSolicitud() {
    if (
      !seleccionada ||
      procesandoEstadoSolicitud ||
      !puedeGestionarSolicitud
    ) {
      return;
    }

    const estadoActual = normalizarEstado(seleccionada.estado);
    const estadoNuevo = normalizarEstado(nuevoEstadoSolicitud);

    if (!estadosSolicitud.includes(estadoNuevo)) {
      await alertas.advertencia(
        'Estado no válido',
        'Selecciona un estado permitido para la solicitud.',
      );
      return;
    }

    if (estadoActual === estadoNuevo) {
      await alertas.advertencia(
        'No hay cambios',
        'Selecciona un estado diferente al estado actual.',
      );
      return;
    }

    const confirmar = await alertas.confirmar(
      '¿Actualizar estado de la solicitud?',
      `La solicitud cambiará de "${formatearEstado(
        estadoActual,
      )}" a "${formatearEstado(
        estadoNuevo,
      )}". El movimiento quedará registrado en el historial.`,
      'Actualizar estado',
    );

    if (!confirmar) return;

    try {
      setProcesandoEstadoSolicitud(true);

      await actualizarEstadoCotizacion(
        seleccionada.id_cotizacion,
        estadoNuevo,
        observacionEstadoSolicitud.trim() || undefined,
      );

      const respuestaLista: unknown = await obtenerCotizacionesAdmin();

      setCotizaciones(obtenerListaCotizaciones(respuestaLista));

      const respuestaDetalle: unknown = await obtenerCotizacionAdmin(
        seleccionada.id_cotizacion,
      );

const detalle = respuestaDetalle as Cotizacion;
      setSeleccionada(detalle);
      setNuevoEstadoSolicitud(normalizarEstado(detalle.estado));
      setObservacionEstadoSolicitud('');

      await alertas.notificacion(
        'Estado de la solicitud actualizado correctamente',
        'success',
      );
    } catch (error_) {
      console.error(
        'Error al actualizar estado de solicitud:',
        error_,
      );

      await alertas.error(
        'No se pudo actualizar el estado',
        obtenerMensajeError(
          error_,
          'Ocurrió un problema al actualizar el estado de la solicitud.',
        ),
      );
    } finally {
      setProcesandoEstadoSolicitud(false);
    }
  }

  async function crearVersion() {
    if (!seleccionada || procesandoVersion || !puedeArmar) {
      return;
    }

    const ultimaVersion = versiones[0];
    const estadoUltima = normalizarEstado(ultimaVersion?.estado);

    if (
      ultimaVersion &&
      !['APROBADA', 'ENVIADA'].includes(estadoUltima)
    ) {
      await alertas.advertencia(
        'No se puede crear otra versión',
        'La versión actual debe estar aprobada o enviada al cliente antes de crear una nueva.',
      );
      return;
    }

    const confirmar = await alertas.confirmar(
      '¿Crear una nueva versión?',
      ultimaVersion
        ? 'Se generará una nueva versión tomando como base la última versión aprobada o enviada.'
        : 'Se armará la cotización a partir de los productos y servicios que pidió el cliente. Luego podrás ingresar los precios.',
      'Armar cotización',
    );

    if (!confirmar) return;

    try {
      setProcesandoVersion(true);

      const respuesta: unknown =
        await crearVersionCotizacionAdmin(
          seleccionada.id_cotizacion,
        );

      const datos = obtenerDatosRespuesta(respuesta);
      const version = datos.version || {};
      const idVersion = obtenerIdVersion(version);

      await cargarVersiones(
        seleccionada.id_cotizacion,
        idVersion || null,
      );

      setModalArmadoAbierto(true);

      await alertas.notificacion(
        'Versión de cotización creada correctamente',
        'success',
      );
    } catch (error_) {
      console.error('Error al crear versión:', error_);

      // Si la cotización ya estaba armada (la lista en pantalla estaba
      // desactualizada), se recarga y se abre la versión existente.
      const mensajeCrear = obtenerMensajeError(error_, '');

      if (
        mensajeCrear.includes('No se puede crear una nueva versión') &&
        seleccionada
      ) {
        await cargarVersiones(seleccionada.id_cotizacion);
        setModalArmadoAbierto(true);
        return;
      }

      await alertas.error(
        'No se pudo crear la versión',
        obtenerMensajeError(
          error_,
          'Ocurrió un problema al crear la versión de cotización.',
        ),
      );
    } finally {
      setProcesandoVersion(false);
    }
  }

  function actualizarCampoProducto(
    indice: number,
    campo: string,
    valor: string,
  ) {
    setProductosEditables((actuales) =>
      actuales.map((producto, index) =>
        index === indice
          ? {
              ...producto,
              [campo]:
                campo === 'cantidad' || campo === 'precio_unitario'
                  ? Number(valor)
                  : valor,
            }
          : producto,
      ),
    );
  }

  function actualizarCampoServicio(
    indice: number,
    campo: string,
    valor: string,
  ) {
    setServiciosEditables((actuales) =>
      actuales.map((servicio, index) =>
        index === indice
          ? {
              ...servicio,
              [campo]:
                campo === 'cantidad' || campo === 'precio_unitario'
                  ? Number(valor)
                  : valor,
            }
          : servicio,
      ),
    );
  }

  const hayLineasCotizacion =
    productosEditables.length + serviciosEditables.length > 0;

  const productosEditablesValidos = productosEditables.every(
    (producto) =>
      Number.isFinite(Number(producto.cantidad)) &&
      Number(producto.cantidad) > 0 &&
      Number.isFinite(Number(producto.precio_unitario)) &&
      Number(producto.precio_unitario) >= 0,
  );

  const serviciosEditablesValidos = serviciosEditables.every(
    (servicio) =>
      Number.isFinite(Number(servicio.cantidad)) &&
      Number(servicio.cantidad) > 0 &&
      Number.isFinite(Number(servicio.precio_unitario)) &&
      Number(servicio.precio_unitario) >= 0,
  );

  const estadoVersionActiva = normalizarEstado(
    versionSeleccionada?.version.estado,
  );

  const puedeEditarVersion =
    ['BORRADOR', 'DEVUELTA'].includes(estadoVersionActiva) && puedeArmar;

  // Para enviar a aprobación todas las líneas deben tener precio.
  const preciosCompletos = [
    ...productosEditables,
    ...serviciosEditables,
  ].every((linea) => Number(linea.precio_unitario) > 0);

  const puedeEnviarAprobacion =
    puedeEditarVersion &&
    hayLineasCotizacion &&
    productosEditablesValidos &&
    serviciosEditablesValidos &&
    preciosCompletos;

  const puedeAprobar =
    esGerencia && estadoVersionActiva === 'PENDIENTE_APROBACION';

  const puedeEnviarCliente =
    esGerencia && estadoVersionActiva === 'APROBADA';

  const puedeCrearVersion = puedeArmar;

  const importeLineasEstimado = useMemo(() => {
    const productos = productosEditables.reduce(
      (total, producto) =>
        total +
        Number(producto.cantidad || 0) *
          Number(producto.precio_unitario || 0),
      0,
    );

    const servicios = serviciosEditables.reduce(
      (total, servicio) =>
        total +
        Number(servicio.cantidad || 0) *
          Number(servicio.precio_unitario || 0),
      0,
    );

    return productos + servicios;
  }, [productosEditables, serviciosEditables]);

  // Envía al servidor los precios, cantidades y textos que están en pantalla.
  async function persistirCambiosVersion() {
    if (!idVersionActiva) return;

    const datos = {
      productos: productosEditables.map((producto) => ({
        id_detalle_version: Number(producto.id_detalle_version),
        nombre_producto: producto.nombre_producto,
        descripcion: producto.descripcion,
        cantidad: Number(producto.cantidad),
        precio_unitario: Number(producto.precio_unitario),
      })),
      servicios: serviciosEditables.map((servicio) => ({
        id_detalle_servicio_version: Number(
          servicio.id_detalle_servicio_version,
        ),
        descripcion: servicio.descripcion,
        cantidad: Number(servicio.cantidad),
        precio_unitario: Number(servicio.precio_unitario),
      })),
      condiciones_comerciales: condicionesComerciales,
      observaciones_internas: observacionesInternas,
    };

    await actualizarVersionCotizacionAdmin(idVersionActiva, datos as any);
  }

  // Al agregar o quitar una línea la versión se vuelve a cargar desde el
  // servidor; antes se guardan los precios escritos para no perderlos.
  async function guardarCambiosPendientes() {
    if (!idVersionActiva) return;
    if (productosEditables.length + serviciosEditables.length === 0) return;
    if (!productosEditablesValidos || !serviciosEditablesValidos) return;

    await persistirCambiosVersion();
  }

  async function agregarProductoLinea(datos: {
    id_producto: number | null;
    nombre_producto: string;
    descripcion: string | null;
    cantidad: number;
    precio_unitario: number;
  }): Promise<boolean> {
    if (!idVersionActiva || !puedeEditarVersion || procesandoVersion) return false;
    try {
      setProcesandoVersion(true);
      await guardarCambiosPendientes();
      await agregarProductoVersionAdmin(idVersionActiva, datos);
      await cargarDetalleVersion(idVersionActiva);
      await alertas.notificacion('Producto agregado a la versión', 'success');
      return true;
    } catch (error_) {
      await alertas.error('No se pudo agregar el producto', obtenerMensajeError(error_, 'Ocurrió un problema al agregar el producto.'));
      return false;
    } finally {
      setProcesandoVersion(false);
    }
  }

  async function quitarProductoLinea(idDetalle: number) {
    if (!idVersionActiva || !puedeEditarVersion || procesandoVersion) return;
    const confirmar = await alertas.confirmar('¿Eliminar producto?', 'Se eliminará esta línea de la versión actual.', 'Sí, eliminar');
    if (!confirmar) return;
    try {
      setProcesandoVersion(true);
      await guardarCambiosPendientes();
      await eliminarProductoVersionAdmin(idVersionActiva, idDetalle);
      await cargarDetalleVersion(idVersionActiva);
      await alertas.notificacion('Producto eliminado', 'success');
    } catch (error_) {
      await alertas.error('No se pudo eliminar el producto', obtenerMensajeError(error_, 'Ocurrió un problema al eliminar el producto.'));
    } finally { setProcesandoVersion(false); }
  }

  async function agregarServicioLinea(datos: {
    id_servicio: number;
    descripcion: string | null;
    cantidad: number;
    precio_unitario: number;
  }): Promise<boolean> {
    if (!idVersionActiva || !puedeEditarVersion || procesandoVersion) return false;
    try {
      setProcesandoVersion(true);
      await guardarCambiosPendientes();
      await agregarServicioVersionAdmin(idVersionActiva, datos);
      await cargarDetalleVersion(idVersionActiva);
      await alertas.notificacion('Servicio agregado a la versión', 'success');
      return true;
    } catch (error_) {
      await alertas.error('No se pudo agregar el servicio', obtenerMensajeError(error_, 'Ocurrió un problema al agregar el servicio.'));
      return false;
    } finally {
      setProcesandoVersion(false);
    }
  }

  async function quitarServicioLinea(idDetalle: number) {
    if (!idVersionActiva || !puedeEditarVersion || procesandoVersion) return;
    const confirmar = await alertas.confirmar('¿Eliminar servicio?', 'Se eliminará esta línea de la versión actual.', 'Sí, eliminar');
    if (!confirmar) return;
    try {
      setProcesandoVersion(true);
      await guardarCambiosPendientes();
      await eliminarServicioVersionAdmin(idVersionActiva, idDetalle);
      await cargarDetalleVersion(idVersionActiva);
      await alertas.notificacion('Servicio eliminado', 'success');
    } catch (error_) {
      await alertas.error('No se pudo eliminar el servicio', obtenerMensajeError(error_, 'Ocurrió un problema al eliminar el servicio.'));
    } finally { setProcesandoVersion(false); }
  }

  async function guardarVersion() {
    if (
      !versionSeleccionada ||
      !idVersionActiva ||
      !puedeEditarVersion ||
      procesandoVersion
    ) {
      return;
    }

    if (!hayLineasCotizacion) {
      await alertas.advertencia(
        'La versión no tiene líneas',
        'Agrega al menos un producto o servicio antes de continuar.',
      );
      return;
    }

    if (!productosEditablesValidos || !serviciosEditablesValidos) {
      await alertas.advertencia(
        'Revisa las cantidades y precios',
        'Las cantidades deben ser mayores que cero y los precios no pueden ser negativos.',
      );
      return;
    }

    const confirmar = await alertas.confirmar(
      '¿Guardar los cambios?',
      'Se actualizarán los precios y las condiciones comerciales de esta versión.',
      'Guardar versión',
    );

    if (!confirmar) return;

    try {
      setProcesandoVersion(true);

      await persistirCambiosVersion();

      await cargarDetalleVersion(idVersionActiva);

      await alertas.notificacion(
        'Versión actualizada correctamente',
        'success',
      );
    } catch (error_) {
      console.error('Error al guardar versión:', error_);

      await alertas.error(
        'No se pudieron guardar los cambios',
        obtenerMensajeError(
          error_,
          'Ocurrió un problema al actualizar la versión.',
        ),
      );
    } finally {
      setProcesandoVersion(false);
    }
  }

  async function enviarAprobacion() {
    if (
      !idVersionActiva ||
      !puedeEnviarAprobacion ||
      procesandoVersion
    ) {
      return;
    }

    if (!preciosCompletos) {
      await alertas.advertencia(
        'Faltan precios',
        'Todos los productos y servicios deben tener un precio mayor que cero antes de enviar la cotización a aprobación.',
      );
      return;
    }

    const confirmar = await alertas.confirmar(
      '¿Enviar cotización para aprobación?',
      'La cotización pasará a revisión de GERENCIA. Ya no podrás modificarla mientras esté pendiente de aprobación.',
      'Enviar a aprobación',
    );

    if (!confirmar) return;

    try {
      setProcesandoVersion(true);

      // Se guardan primero los precios que están en pantalla.
      await persistirCambiosVersion();

      await enviarVersionAprobacionAdmin(idVersionActiva);

      if (seleccionada) {
        await cargarVersiones(
          seleccionada.id_cotizacion,
          idVersionActiva,
        );
      } else {
        await cargarDetalleVersion(idVersionActiva);
      }

      setModalArmadoAbierto(false);

      await alertas.notificacion(
        'La cotización fue enviada a aprobación',
        'success',
      );
    } catch (error_) {
      console.error('Error al enviar a aprobación:', error_);

      await alertas.error(
        'No se pudo enviar a aprobación',
        obtenerMensajeError(
          error_,
          'Ocurrió un problema al enviar la versión a aprobación.',
        ),
      );
    } finally {
      setProcesandoVersion(false);
    }
  }

  async function resolverAprobacion(accion: 'APROBADA' | 'DEVUELTA') {
    if (!idVersionActiva || !puedeAprobar || procesandoVersion) return;

    if (
      accion === 'DEVUELTA' &&
      observacionesAprobacion.trim().length === 0
    ) {
      await alertas.advertencia(
        'Se requiere una observación',
        'Explica qué debe corregirse antes de devolver la cotización a VENTAS.',
      );
      return;
    }

    const esAprobacion = accion === 'APROBADA';

    const confirmar = await alertas.confirmar(
      esAprobacion
        ? '¿Aprobar esta versión?'
        : '¿Devolver esta versión?',
      esAprobacion
        ? 'La versión quedará aprobada internamente. Esto todavía no significa que haya sido enviada o aceptada por el cliente.'
        : 'La versión volverá a VENTAS para que realice las correcciones indicadas.',
      esAprobacion ? 'Sí, aprobar' : 'Sí, devolver',
    );

    if (!confirmar) return;

    try {
      setProcesandoVersion(true);

      await resolverAprobacionVersionAdmin(
        idVersionActiva,
        accion,
        observacionesAprobacion.trim(),
      );

      if (seleccionada) {
        await cargarVersiones(
          seleccionada.id_cotizacion,
          idVersionActiva,
        );
      } else {
        await cargarDetalleVersion(idVersionActiva);
      }

      setModalArmadoAbierto(false);

      await alertas.notificacion(
        esAprobacion
          ? 'Versión aprobada correctamente'
          : 'Versión devuelta a VENTAS',
        'success',
      );
    } catch (error_) {
      console.error('Error al resolver aprobación:', error_);

      await alertas.error(
        'No se pudo registrar la aprobación',
        obtenerMensajeError(
          error_,
          'Ocurrió un problema al procesar la aprobación.',
        ),
      );
    } finally {
      setProcesandoVersion(false);
    }
  }

  async function enviarAlCliente() {
    if (!idVersionActiva || !puedeEnviarCliente || procesandoVersion) {
      return;
    }

    const correoDestino =
      versionSeleccionada?.version.correo ||
      seleccionada?.correo ||
      'correo registrado en la solicitud';

    const confirmar = await alertas.confirmar(
      '¿Enviar cotización al cliente?',
      `Se generará o recuperará el PDF de esta versión y se enviará a ${correoDestino}. Esta acción enviará un correo real.`,
      'Sí, enviar cotización',
    );

    if (!confirmar) return;

    try {
      setProcesandoVersion(true);

      const respuesta: unknown =
        await enviarCotizacionVersionClienteAdmin(idVersionActiva);

      const datos = obtenerDatosRespuesta(respuesta);
      const estado = normalizarEstado(datos.estado);
      const estadoNotificacion = normalizarEstado(
        datos.notificacion?.estado,
      );

      if (seleccionada) {
        await cargarVersiones(
          seleccionada.id_cotizacion,
          idVersionActiva,
        );
      } else {
        await cargarDetalleVersion(idVersionActiva);
      }

      if (
        estado === 'PENDIENTE' ||
        estadoNotificacion === 'PENDIENTE_REINTENTO' ||
        estadoNotificacion === 'CORREO_DESACTIVADO'
      ) {
        await alertas.advertencia(
          'El correo quedó pendiente',
          datos.mensaje ||
            'La cotización continúa aprobada, pero el correo no se confirmó como enviado. Revisa la notificación antes de intentar otra acción.',
        );
        return;
      }

      if (estado === 'ERROR') {
        await alertas.error(
          'No se pudo enviar el correo',
          datos.mensaje ||
            'El servidor informó que no pudo completar el envío. Revisa el registro de notificaciones.',
        );
        return;
      }

      if (estado === 'REVISION_REQUERIDA') {
        await alertas.advertencia(
          'Se requiere revisión del envío',
          datos.mensaje ||
            'El servidor requiere revisar el registro de la notificación. No vuelvas a enviar esta cotización hasta verificar el resultado.',
        );
        return;
      }

      await alertas.notificacion(
        datos.mensaje || 'La cotización fue enviada al cliente.',
        'success',
      );
    } catch (error_) {
      console.error('Error al enviar cotización al cliente:', error_);

      const datosError = obtenerDatosRespuesta(
        (error_ as Registro)?.response?.data ||
          (error_ as Registro)?.data,
      );

      const estadoError = normalizarEstado(datosError.estado);

      if (
        estadoError === 'REVISION_REQUERIDA' ||
        estadoError === 'ERROR' ||
        estadoError === 'PENDIENTE'
      ) {
        await alertas.advertencia(
          'El envío requiere revisión',
          datosError.mensaje ||
            obtenerMensajeError(
              error_,
              'No se pudo confirmar el resultado del envío. Verifica el registro de notificaciones antes de volver a intentarlo.',
            ),
        );
      } else {
        await alertas.error(
          'No se pudo enviar la cotización',
          obtenerMensajeError(
            error_,
            'No se pudo confirmar el envío. Antes de repetir la operación, verifica si el correo llegó al cliente.',
          ),
        );
      }
    } finally {
      setProcesandoVersion(false);
    }
  }

  function cerrarDetalle() {
    if (procesandoVersion || procesandoEstadoSolicitud) return;

    setSeleccionada(null);
    setCargandoDetalle(false);
    setVersiones([]);
    setVersionSeleccionada(null);
    setIdVersionActiva(null);
    setProductosEditables([]);
    setServiciosEditables([]);
    setCondicionesComerciales('');
    setObservacionesInternas('');
    setObservacionesAprobacion('');
    setNuevoEstadoSolicitud('PENDIENTE');
    setObservacionEstadoSolicitud('');
    setModalArmadoAbierto(false);
    void refrescarListaSilencioso();
  }

  const detalles: ProductoDetalleCotizacion[] =
    seleccionada?.productos ||
    seleccionada?.detalles ||
    [];

  const serviciosOriginales: ServicioDetalleCotizacion[] =
    seleccionada?.servicios || [];

  const historial: HistorialCotizacionRegistro[] =
    seleccionada?.historial || [];

  const resumenDetalle = useMemo(() => {
    const resumen = seleccionada?.resumen;

    let totalUnidadesCalculado = 0;

    for (const producto of detalles) {
      totalUnidadesCalculado += Number(producto.cantidad || 0);
    }

    return {
      total_productos:
        resumen?.total_productos ??
        seleccionada?.total_productos ??
        detalles.length,
      total_unidades:
        resumen?.total_unidades ??
        seleccionada?.total_unidades ??
        totalUnidadesCalculado,
      total_servicios:
        resumen?.total_servicios ??
        seleccionada?.total_servicios ??
        serviciosOriginales.length,
      total_items:
        resumen?.total_items ??
        seleccionada?.total_items ??
        detalles.length + serviciosOriginales.length,
    };
  }, [seleccionada, detalles, serviciosOriginales]);

  const modoIGV = String(
    versionSeleccionada?.version.modo_igv ??
      configuracionIGV?.modo_igv ??
      '',
  ).toUpperCase();

  const tasaIGV = Number(
    versionSeleccionada?.version.tasa_igv ??
      configuracionIGV?.tasa_igv ??
      18,
  );

  const cantidadPorAprobar = cotizaciones.filter(
    (cotizacion) =>
      estadoVersionLista(cotizacion) === 'PENDIENTE_APROBACION',
  ).length;

  const cantidadDevueltas = cotizaciones.filter(
    (cotizacion) => estadoVersionLista(cotizacion) === 'DEVUELTA',
  ).length;

  const opcionesEstadoSolicitud: string[] = esVentas
    ? Array.from(
        new Set([
          normalizarEstado(seleccionada?.estado),
          'EN_ATENCION',
        ]),
      )
    : estadosSolicitud;

  const versionActual = versionSeleccionada?.version;
  const aprobaciones = versionSeleccionada?.aprobaciones || [];

  // Última devolución de GERENCIA (para mostrarla a VENTAS al corregir).
  const ultimaDevolucion = [...aprobaciones]
    .filter((item) => normalizarEstado(item.accion) === 'DEVUELTA')
    .sort(
      (a, b) =>
        new Date(b.creado_en || 0).getTime() -
        new Date(a.creado_en || 0).getTime(),
    )[0];

  // Última decisión de GERENCIA / SUPERADMIN (aprobó o devolvió).
  const ultimaAprobacion = [...aprobaciones].sort(
    (a, b) =>
      new Date(b.creado_en || 0).getTime() -
      new Date(a.creado_en || 0).getTime(),
  )[0];

  let contenidoTabla;

  if (cargando) {
    contenidoTabla = (
      <div className="quotes-loading">
        <span className="quotes-spinner" aria-hidden="true" />
        <p>Cargando cotizaciones...</p>
      </div>
    );
  } else if (cotizacionesFiltradas.length === 0) {
    contenidoTabla = (
      <div className="quotes-empty">
        <span aria-hidden="true">▤</span>
        <h3>No hay cotizaciones</h3>
        <p>
          No se encontraron solicitudes con los filtros seleccionados.
        </p>
      </div>
    );
  } else {
    contenidoTabla = (
      <div className="quotes-table-scroll">
        <table className="quotes-table">
          <thead>
            <tr>
              <th>CÓDIGO</th>
              <th>CLIENTE</th>
              <th>EMPRESA</th>
              <th>FECHA</th>
              <th>SOLICITUD</th>
              <th>COTIZACIÓN</th>
              <th>ACCIÓN</th>
            </tr>
          </thead>

          <tbody>
            {cotizacionesFiltradas.map((cotizacion) => (
              <tr key={cotizacion.id_cotizacion}>
                <td>
                  <strong className="quote-code">
                    {obtenerCodigo(cotizacion)}
                  </strong>
                </td>

                <td>
                  <div className="quote-client">
                    <span className="quote-avatar" aria-hidden="true">
                      {obtenerNombreCliente(cotizacion)
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                    <span>{obtenerNombreCliente(cotizacion)}</span>
                  </div>
                </td>

                <td>{cotizacion.empresa || '—'}</td>
                <td>{obtenerFecha(cotizacion)}</td>

                <td>
                  <span
                    className={`quote-status ${obtenerClaseEstado(
                      cotizacion.estado,
                    )}`}
                  >
                    {formatearEstado(cotizacion.estado)}
                  </span>
                </td>

                <td>
                  {estadoVersionLista(cotizacion) ? (
                    <span
                      className={`quote-status ${obtenerClaseEstado(
                        estadoVersionLista(cotizacion),
                      )}`}
                    >
                      {formatearEstadoVersion(
                        estadoVersionLista(cotizacion),
                      )}
                    </span>
                  ) : (
                    <span className="quote-no-details">Sin armar</span>
                  )}
                </td>

                <td>
                  <button
                    type="button"
                    className="quote-detail-button"
                    onClick={() => void abrirDetalle(cotizacion)}
                    aria-label={`Abrir detalle de ${obtenerCodigo(cotizacion)}`}
                  >
                    Abrir detalle →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const modalCotizacion =
    seleccionada !== null || cargandoDetalle
      ? (
          <DetalleCotizacionModal
            onClose={cerrarDetalle}
            disabled={procesandoVersion || procesandoEstadoSolicitud}
          >
            <dialog
              open
              className="quote-modal"
              aria-labelledby="quote-modal-titulo"
              onCancel={(evento) => {
                evento.preventDefault();
                cerrarDetalle();
              }}
            >
              {cargandoDetalle ? (
                <div className="quotes-loading">
                  <span className="quotes-spinner" aria-hidden="true" />
                  <p>Cargando detalle...</p>
                </div>
              ) : seleccionada ? (
                <>
                  <header className="quote-modal-header">
                    <div>
                      <span className="quotes-eyebrow">
                        GESTIÓN COMERCIAL
                      </span>

                      <h2 id="quote-modal-titulo">
                        {obtenerCodigo(seleccionada)}
                      </h2>

                      <p>
                        Registrada el {obtenerFecha(seleccionada)}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="quote-modal-close"
                      onClick={cerrarDetalle}
                      disabled={procesandoVersion || procesandoEstadoSolicitud}
                      aria-label="Cerrar detalle"
                    >
                      ×
                    </button>
                  </header>

                  <div className="quote-modal-body">
                    <div className="quote-detail-section">
                      <h3>Información del cliente</h3>

                      <div className="quote-info-grid">
                        <div>
                          <span>Nombre</span>
                          <strong>
                            {obtenerNombreCliente(seleccionada)}
                          </strong>
                        </div>

                        <div>
                          <span>Empresa</span>
                          <strong>{seleccionada.empresa || '—'}</strong>
                        </div>

                        <div>
                          <span>Correo electrónico</span>
                          <strong>{seleccionada.correo || '—'}</strong>
                        </div>

                        <div>
                          <span>Teléfono</span>
                          <strong>{seleccionada.telefono || '—'}</strong>
                        </div>

                        <div>
                          <span>Dirección de entrega</span>
                          <strong>
                            {seleccionada.direccion_entrega || '—'}
                          </strong>
                        </div>

                        <div>
                          <span>Origen de solicitud</span>
                          <strong>{seleccionada.origen || '—'}</strong>
                        </div>
                      </div>
                    </div>

                    {puedeGestionarSolicitud && (
                      <div className="quote-detail-section">
                        <h3>Estado de la solicitud</h3>

                        <p className="quote-message">
                          Actualiza el seguimiento comercial de esta
                          solicitud. Este estado es independiente del
                          estado de aprobación de las versiones.
                        </p>

                        <div className="quote-info-grid">
                          <div>
                            <span>Estado actual</span>
                            <strong>
                              <span
                                className={`quote-status ${obtenerClaseEstado(
                                  seleccionada.estado,
                                )}`}
                              >
                                {formatearEstado(seleccionada.estado)}
                              </span>
                            </strong>
                          </div>
                        </div>

                        <label className="quote-status-form">
                          <span>Nuevo estado</span>

                          <select
                            value={nuevoEstadoSolicitud}
                            onChange={(evento) =>
                              setNuevoEstadoSolicitud(evento.target.value)
                            }
                            disabled={procesandoEstadoSolicitud}
                          >
                            {opcionesEstadoSolicitud.map((estado) => (
                              <option key={estado} value={estado}>
                                {formatearEstado(estado)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label
                          className="quote-status-form"
                          style={{ marginTop: 15 }}
                        >
                          <span>Observación del cambio (opcional)</span>

                          <textarea
                            rows={3}
                            value={observacionEstadoSolicitud}
                            onChange={(evento) =>
                              setObservacionEstadoSolicitud(
                                evento.target.value,
                              )
                            }
                            disabled={procesandoEstadoSolicitud}
                            placeholder="Explica el motivo del cambio de estado..."
                          />
                        </label>

                        <button
                          type="button"
                          className="quote-save-button"
                          style={{ marginTop: 16 }}
                          onClick={() => void guardarEstadoSolicitud()}
                          disabled={
                            procesandoEstadoSolicitud ||
                            normalizarEstado(nuevoEstadoSolicitud) ===
                              normalizarEstado(seleccionada.estado)
                          }
                        >
                          {procesandoEstadoSolicitud
                            ? 'Actualizando...'
                            : 'Guardar estado de solicitud'}
                        </button>
                      </div>
                    )}

                    <div className="quote-detail-section">
                      <h3>Resumen de la solicitud original</h3>

                      <div className="quote-info-grid">
                        <div>
                          <span>Productos</span>
                          <strong>{resumenDetalle.total_productos}</strong>
                        </div>

                        <div>
                          <span>Unidades solicitadas</span>
                          <strong>{resumenDetalle.total_unidades}</strong>
                        </div>

                        <div>
                          <span>Servicios adicionales</span>
                          <strong>{resumenDetalle.total_servicios}</strong>
                        </div>

                        <div>
                          <span>Total de elementos</span>
                          <strong>{resumenDetalle.total_items}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="quote-detail-section">
                      <h3>Productos solicitados originalmente</h3>

                      {detalles.length === 0 ? (
                        <p className="quote-no-details">
                          No hay detalles de productos disponibles.
                        </p>
                      ) : (
                        <div className="quote-products-list">
                          {detalles.map((detalle, index) => (
                            <div
                              className="quote-product-row"
                              key={
                                detalle.id_detalle ??
                                `${seleccionada.id_cotizacion}-${index}`
                              }
                            >
                              <div>
                                <strong>
                                  {detalle.nombre_producto ||
                                    'Producto sin nombre'}
                                </strong>

                                {detalle.especificaciones && (
                                  <p>{detalle.especificaciones}</p>
                                )}
                              </div>

                              <span>
                                Cantidad: {detalle.cantidad}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="quote-detail-section">
                      <h3>Servicios solicitados originalmente</h3>

                      {serviciosOriginales.length === 0 ? (
                        <p className="quote-no-details">
                          No se solicitaron servicios adicionales.
                        </p>
                      ) : (
                        <div className="quote-products-list">
                          {serviciosOriginales.map((servicio) => (
                            <div
                              className="quote-product-row"
                              key={servicio.id_detalle_servicio}
                            >
                              <div>
                                <strong>
                                  {servicio.nombre_servicio ||
                                    'Servicio sin nombre'}
                                </strong>

                                {servicio.observaciones && (
                                  <p>{servicio.observaciones}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="quote-detail-section">
                      <h3>Mensaje del cliente</h3>

                      <p className="quote-message">
                        {seleccionada.mensaje ||
                          'El cliente no agregó comentarios.'}
                      </p>
                    </div>

                    {seleccionada.notas_internas && (
                      <div className="quote-detail-section">
                        <h3>Notas internas de la solicitud</h3>

                        <p className="quote-message">
                          {seleccionada.notas_internas}
                        </p>
                      </div>
                    )}

                    <div className="quote-detail-section">
                      <h3>Cotización</h3>

                      {cargandoVersiones ? (
                        <div className="quotes-loading">
                          <span className="quotes-spinner" />
                          <p>Cargando versiones...</p>
                        </div>
                      ) : (
                        <>
                          {versiones.length === 0 ? (
                            <p className="quote-no-details">
                              {puedeArmar
                                ? 'Todavía no se armó la cotización. Presiona "Armar cotización" para ingresar los precios.'
                                : 'VENTAS todavía no armó la cotización de esta solicitud.'}
                            </p>
                          ) : (
                            <div className="quote-products-list">
                              {versiones.map((version) => {
                                const id = obtenerIdVersion(version);
                                const activa = id === idVersionActiva;

                                return (
                                  <div
                                    className="quote-product-row"
                                    key={id}
                                    style={{
                                      alignItems: 'center',
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    <div>
                                      <strong>
                                        {obtenerNombreVersion(version)}
                                      </strong>

                                      <span>
                                        {obtenerFechaHora(
                                          version.creado_en,
                                        )}
                                      </span>

                                      <span>
                                        Responsable:{' '}
                                        {version.administrador_creacion ||
                                          'No disponible'}
                                      </span>
                                    </div>

                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        flexWrap: 'wrap',
                                      }}
                                    >
                                      <span
                                        className={`quote-status ${obtenerClaseEstado(
                                          version.estado,
                                        )}`}
                                      >
                                        {formatearEstadoVersion(
                                          version.estado,
                                        )}
                                      </span>

                                      <button
                                        type="button"
                                        className="quote-detail-button"
                                        disabled={
                                          cargandoVersionDetalle ||
                                          procesandoVersion
                                        }
                                        onClick={() =>
                                          void (async () => {
                                            if (!activa) {
                                              await cargarDetalleVersion(id);
                                            }
                                            setModalArmadoAbierto(true);
                                          })()
                                        }
                                      >
                                        Abrir cotización
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {puedeCrearVersion && (
                            <button
                              type="button"
                              className="quote-save-button"
                              style={{ marginTop: 18 }}
                              onClick={() => void crearVersion()}
                              disabled={
                                procesandoVersion ||
                                cargandoVersiones ||
                                (versiones.length > 0 &&
                                  !['APROBADA', 'ENVIADA'].includes(
                                    normalizarEstado(versiones[0]?.estado),
                                  ))
                              }
                            >
                              {procesandoVersion
                                ? 'Procesando...'
                                : versiones.length === 0
                                  ? 'Armar cotización'
                                  : 'Crear nueva versión para corregir'}
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {cargandoVersionDetalle && !versionSeleccionada ? (
                      <div className="quote-detail-section">
                        <div className="quotes-loading">
                          <span className="quotes-spinner" />
                          <p>Cargando detalle de versión...</p>
                        </div>
                      </div>
                    ) : versionSeleccionada && versionActual ? (
                      <>
                      <div className="quote-detail-section">
                        <h3>{obtenerNombreVersion(versionActual)}</h3>

                        <div className="quote-info-grid">
                          <div>
                            <span>Estado</span>
                            <strong>
                              <span
                                className={`quote-status ${obtenerClaseEstado(
                                  versionActual.estado,
                                )}`}
                              >
                                {formatearEstadoVersion(versionActual.estado)}
                              </span>
                            </strong>
                          </div>

                          <div>
                            <span>Total</span>
                            <strong>
                              {versionActual.total !== null &&
                              versionActual.total !== undefined
                                ? formatearMoneda(versionActual.total)
                                : '—'}
                            </strong>
                          </div>
                        </div>

                        {/* Mensajes de estado visibles para todos los roles */}
                        {estadoVersionActiva === 'PENDIENTE_APROBACION' &&
                          !puedeAprobar && (
                            <p className="quote-message" style={{ marginTop: 14 }}>
                              Esta cotización está en revisión de GERENCIA o
                              SUPERADMIN. Se actualizará aquí cuando la
                              aprueben o la devuelvan.
                            </p>
                          )}

                        {estadoVersionActiva === 'APROBADA' &&
                          !puedeEnviarCliente && (
                            <p className="quote-message" style={{ marginTop: 14 }}>
                              Esta cotización fue aprobada por GERENCIA o
                              SUPERADMIN.
                            </p>
                          )}

                        {ultimaAprobacion && (
                          <div
                            className="quote-message"
                            style={{
                              marginTop: 14,
                              borderLeft: '4px solid var(--q-orange)',
                              paddingLeft: 12,
                            }}
                          >
                            <strong>
                              Última decisión:{' '}
                              {formatearEstadoVersion(ultimaAprobacion.accion)}
                            </strong>
                            <p style={{ margin: '4px 0' }}>
                              {ultimaAprobacion.observaciones ||
                                'Sin observaciones.'}
                            </p>
                            <small>
                              {obtenerFechaHora(ultimaAprobacion.creado_en)}
                              {' · '}
                              {ultimaAprobacion.administrador || 'GERENCIA'}
                            </small>
                          </div>
                        )}

                        {/* GERENCIA / SUPERADMIN: aprobar o devolver */}
                        {puedeAprobar && (
                          <div style={{ marginTop: 16 }}>
                            <label className="quote-status-form">
                              <span>Observaciones de la revisión</span>
                              <textarea
                                rows={3}
                                value={observacionesAprobacion}
                                onChange={(evento) =>
                                  setObservacionesAprobacion(
                                    evento.target.value,
                                  )
                                }
                                disabled={procesandoVersion}
                                placeholder="Obligatorio si devuelves la cotización a VENTAS..."
                              />
                            </label>

                            <div
                              style={{
                                display: 'flex',
                                gap: 12,
                                flexWrap: 'wrap',
                                marginTop: 14,
                              }}
                            >
                              <button
                                type="button"
                                className="quote-save-button"
                                onClick={() =>
                                  void resolverAprobacion('APROBADA')
                                }
                                disabled={procesandoVersion}
                              >
                                Aprobar cotización
                              </button>

                              <button
                                type="button"
                                className="quote-detail-button"
                                onClick={() =>
                                  void resolverAprobacion('DEVUELTA')
                                }
                                disabled={
                                  procesandoVersion ||
                                  !observacionesAprobacion.trim()
                                }
                              >
                                Devolver con observaciones
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Botones de acción */}
                        <div
                          style={{
                            display: 'flex',
                            gap: 12,
                            flexWrap: 'wrap',
                            marginTop: 16,
                          }}
                        >
                          <button
                            type="button"
                            className={
                              puedeEditarVersion
                                ? 'quote-save-button'
                                : 'quote-detail-button'
                            }
                            onClick={() => setModalArmadoAbierto(true)}
                          >
                            {puedeEditarVersion
                              ? 'Armar cotización (precios)'
                              : 'Ver precios de la cotización'}
                          </button>

                          {/* VENTAS / SUPERADMIN: enviar a aprobación */}
                          {puedeEditarVersion && (
                            <button
                              type="button"
                              className="quote-save-button"
                              onClick={() => void enviarAprobacion()}
                              disabled={
                                !puedeEnviarAprobacion || procesandoVersion
                              }
                            >
                              {procesandoVersion
                                ? 'Procesando...'
                                : 'Enviar para aprobación'}
                            </button>
                          )}

                          {/* GERENCIA / SUPERADMIN: enviar al cliente */}
                          {puedeEnviarCliente && (
                            <button
                              type="button"
                              className="quote-save-button"
                              onClick={() => void enviarAlCliente()}
                              disabled={procesandoVersion}
                            >
                              {procesandoVersion
                                ? 'Procesando envío...'
                                : 'Enviar cotización al cliente'}
                            </button>
                          )}
                        </div>

                        {puedeEditarVersion && !puedeEnviarAprobacion && (
                          <p className="quote-no-details" style={{ marginTop: 10 }}>
                            Para enviar a aprobación, abre la cotización,
                            registra el precio de todos los productos y
                            servicios y guarda los cambios.
                          </p>
                        )}
                      </div>

                      <FormularioCotizacionModal
                        abierto={modalArmadoAbierto}
                        onClose={() => setModalArmadoAbierto(false)}
                        titulo={obtenerNombreVersion(versionActual)}
                        subtitulo={`${obtenerCodigo(seleccionada)} · ${formatearEstadoVersion(versionActual.estado)}`}
                        estado={versionActual.estado}
                        disabled={!puedeEditarVersion || procesandoVersion}
                      >
                        <>
                        {puedeAprobar && (
                          <div
                            className="quote-detail-section"
                            style={{ borderLeft: '4px solid var(--q-orange)' }}
                          >
                            <h3>Revisión de GERENCIA</h3>

                            <p className="quote-message">
                              Revisa los precios, el IGV y las condiciones
                              comerciales. Puedes aprobar la versión o
                              devolverla a VENTAS con observaciones.
                            </p>

                            <label
                              className="quote-status-form"
                              style={{ marginTop: 16 }}
                            >
                              <span>
                                Observaciones de la revisión
                              </span>
                              <textarea
                                rows={4}
                                value={observacionesAprobacion}
                                onChange={(evento) =>
                                  setObservacionesAprobacion(
                                    evento.target.value,
                                  )
                                }
                                disabled={procesandoVersion}
                                placeholder="Indica las observaciones si necesitas devolver la versión..."
                              />
                            </label>

                            <div
                              style={{
                                display: 'flex',
                                gap: 12,
                                flexWrap: 'wrap',
                                marginTop: 16,
                              }}
                            >
                              <button
                                type="button"
                                className="quote-save-button"
                                onClick={() =>
                                  void resolverAprobacion('APROBADA')
                                }
                                disabled={procesandoVersion}
                              >
                                Aprobar versión
                              </button>

                              <button
                                type="button"
                                className="quote-detail-button"
                                onClick={() =>
                                  void resolverAprobacion('DEVUELTA')
                                }
                                disabled={
                                  procesandoVersion ||
                                  !observacionesAprobacion.trim()
                                }
                              >
                                Devolver a VENTAS
                              </button>
                            </div>
                          </div>
                        )}


                        {esGerencia &&
                          !puedeAprobar &&
                          ['BORRADOR', 'DEVUELTA'].includes(
                            estadoVersionActiva,
                          ) && (
                            <div className="quote-detail-section">
                              <h3>Revisión de GERENCIA</h3>

                              <p className="quote-message">
                                VENTAS todavía no envió esta cotización a
                                aprobación. Los botones para aprobar o
                                devolver con observaciones aparecerán aquí
                                cuando esté pendiente de aprobación.
                              </p>
                            </div>
                          )}

                        {estadoVersionActiva === 'DEVUELTA' &&
                          ultimaDevolucion && (
                            <div
                              className="quote-detail-section"
                              role="alert"
                              style={{
                                borderLeft: '4px solid var(--q-orange)',
                              }}
                            >
                              <h3>Devuelta por GERENCIA</h3>

                              <p className="quote-message">
                                {ultimaDevolucion.observaciones ||
                                  'Sin observaciones.'}
                              </p>

                              <small>
                                {obtenerFechaHora(
                                  ultimaDevolucion.creado_en,
                                )}
                                {' · '}
                                {ultimaDevolucion.administrador ||
                                  'GERENCIA'}
                              </small>
                            </div>
                          )}

                        <div className="quote-detail-section">
                          <h3>
                            {obtenerNombreVersion(versionActual)}
                          </h3>

                          <div className="quote-info-grid">
                            <div>
                              <span>Estado de la versión</span>
                              <strong>
                                <span
                                  className={`quote-status ${obtenerClaseEstado(
                                    versionActual.estado,
                                  )}`}
                                >
                                  {formatearEstadoVersion(
                                    versionActual.estado,
                                  )}
                                </span>
                              </strong>
                            </div>

                            <div>
                              <span>Modalidad de IGV</span>
                              <strong>
                                {modoIGV === 'INCLUIDO'
                                  ? 'IGV incluido'
                                  : modoIGV === 'ADICIONAL'
                                    ? 'IGV adicional'
                                    : 'No configurado'}
                              </strong>
                            </div>

                            <div>
                              <span>Tasa de IGV</span>
                              <strong>{tasaIGV}%</strong>
                            </div>

                            <div>
                              <span>Creada el</span>
                              <strong>
                                {obtenerFechaHora(
                                  versionActual.creado_en,
                                )}
                              </strong>
                            </div>

                            <div>
                              <span>Preparada por</span>
                              <strong>
                                {versionActual.administrador_creacion ||
                                  'No disponible'}
                              </strong>
                            </div>

                            <div>
                              <span>Correo de destino</span>
                              <strong>
                                {versionActual.correo ||
                                  seleccionada.correo ||
                                  '—'}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="quote-detail-section">
                          <h3>Productos de la cotización</h3>

                          {productosEditables.length === 0 ? (
                            <p className="quote-no-details">
                              Esta versión no contiene productos.
                            </p>
                          ) : (
                            <div className="quote-products-list">
                              {productosEditables.map(
                                (producto, index) => {
                                  const subtotal =
                                    Number(producto.cantidad || 0) *
                                    Number(
                                      producto.precio_unitario || 0,
                                    );

                                  return (
                                    <div
                                      className="quote-product-row"
                                      key={
                                        producto.id_detalle_version ||
                                        index
                                      }
                                      style={{
                                        alignItems: 'stretch',
                                        flexDirection: 'column',
                                      }}
                                    >
                                      <div>
                                        <strong>
                                          {producto.nombre_producto ||
                                            'Producto sin nombre'}
                                        </strong>

                                        {producto.descripcion && (
                                          <p>{producto.descripcion}</p>
                                        )}
                                      </div>

                                      <div
                                        style={{
                                          display: 'grid',
                                          gridTemplateColumns:
                                            'repeat(auto-fit, minmax(125px, 1fr))',
                                          gap: 12,
                                          width: '100%',
                                          alignItems: 'end',
                                        }}
                                      >
                                        <label>
                                          <span>Cantidad</span>
                                          <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={producto.cantidad}
                                            disabled={
                                              !puedeEditarVersion ||
                                              procesandoVersion
                                            }
                                            onChange={(evento) =>
                                              actualizarCampoProducto(
                                                index,
                                                'cantidad',
                                                evento.target.value,
                                              )
                                            }
                                            style={estiloCampo}
                                          />
                                        </label>

                                        <label>
                                          <span>Precio unitario (S/)</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={
                                              producto.precio_unitario
                                            }
                                            disabled={
                                              !puedeEditarVersion ||
                                              procesandoVersion
                                            }
                                            onChange={(evento) =>
                                              actualizarCampoProducto(
                                                index,
                                                'precio_unitario',
                                                evento.target.value,
                                              )
                                            }
                                            style={estiloCampo}
                                          />
                                        </label>

                                        <div>
                                          <span>Subtotal de línea</span>
                                          <strong
                                            style={{
                                              display: 'block',
                                              marginTop: 9,
                                              color: 'var(--q-orange-text)',
                                            }}
                                          >
                                            {formatearMoneda(subtotal)}
                                          </strong>
                                        </div>
                                        {puedeEditarVersion && (
                                          <button type="button" className="quote-detail-button" onClick={() => void quitarProductoLinea(Number(producto.id_detalle_version))} disabled={procesandoVersion}>Eliminar producto</button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          )}
                        </div>

                        {puedeEditarVersion && (
                          <EditorLineasCotizacion
                            productos={catalogoProductos}
                            servicios={catalogoServicios}
                            procesando={procesandoVersion}
                            estiloCampo={estiloCampo}
                            onAgregarProducto={agregarProductoLinea}
                            onAgregarServicio={agregarServicioLinea}
                            mostrarProductos
                            mostrarServicios={false}
                          />
                        )}

                        <div className="quote-detail-section">
                          <h3>Servicios de la cotización</h3>

                          {serviciosEditables.length === 0 ? (
                            <p className="quote-no-details">
                              Esta versión no contiene servicios.
                            </p>
                          ) : (
                            <div className="quote-products-list">
                              {serviciosEditables.map(
                                (servicio, index) => {
                                  const subtotal =
                                    Number(servicio.cantidad || 0) *
                                    Number(
                                      servicio.precio_unitario || 0,
                                    );

                                  return (
                                    <div
                                      className="quote-product-row"
                                      key={
                                        servicio.id_detalle_servicio_version ||
                                        index
                                      }
                                      style={{
                                        alignItems: 'stretch',
                                        flexDirection: 'column',
                                      }}
                                    >
                                      <div>
                                        <strong>
                                          {servicio.nombre_servicio ||
                                            'Servicio adicional'}
                                        </strong>

                                        {servicio.descripcion && (
                                          <p>{servicio.descripcion}</p>
                                        )}
                                      </div>

                                      <div
                                        style={{
                                          display: 'grid',
                                          gridTemplateColumns:
                                            'repeat(auto-fit, minmax(125px, 1fr))',
                                          gap: 12,
                                          width: '100%',
                                          alignItems: 'end',
                                        }}
                                      >
                                        <label>
                                          <span>Cantidad</span>
                                          <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={servicio.cantidad}
                                            disabled={
                                              !puedeEditarVersion ||
                                              procesandoVersion
                                            }
                                            onChange={(evento) =>
                                              actualizarCampoServicio(
                                                index,
                                                'cantidad',
                                                evento.target.value,
                                              )
                                            }
                                            style={estiloCampo}
                                          />
                                        </label>

                                        <label>
                                          <span>Precio unitario (S/)</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={
                                              servicio.precio_unitario
                                            }
                                            disabled={
                                              !puedeEditarVersion ||
                                              procesandoVersion
                                            }
                                            onChange={(evento) =>
                                              actualizarCampoServicio(
                                                index,
                                                'precio_unitario',
                                                evento.target.value,
                                              )
                                            }
                                            style={estiloCampo}
                                          />
                                        </label>

                                        <div>
                                          <span>Subtotal de línea</span>
                                          <strong
                                            style={{
                                              display: 'block',
                                              marginTop: 9,
                                              color: 'var(--q-orange-text)',
                                            }}
                                          >
                                            {formatearMoneda(subtotal)}
                                          </strong>
                                        </div>
                                        {puedeEditarVersion && (
                                          <button type="button" className="quote-detail-button" onClick={() => void quitarServicioLinea(Number(servicio.id_detalle_servicio_version))} disabled={procesandoVersion}>Eliminar servicio</button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          )}
                        </div>

                        {puedeEditarVersion && (
                          <EditorLineasCotizacion
                            productos={catalogoProductos}
                            servicios={catalogoServicios}
                            procesando={procesandoVersion}
                            estiloCampo={estiloCampo}
                            onAgregarProducto={agregarProductoLinea}
                            onAgregarServicio={agregarServicioLinea}
                            mostrarProductos={false}
                            mostrarServicios
                          />
                        )}

                        <div className="quote-detail-section">
                          <h3>Resumen económico</h3>

                          <div className="quote-info-grid">
                            <div>
                              <span>Subtotal tributario</span>
                              <strong>
                                {versionActual.subtotal !== null &&
                                versionActual.subtotal !== undefined
                                  ? formatearMoneda(
                                      versionActual.subtotal,
                                    )
                                  : 'Pendiente de cálculo del servidor'}
                              </strong>
                            </div>

                            <div>
                              <span>IGV ({tasaIGV}%)</span>
                              <strong>
                                {versionActual.importe_igv !== null &&
                                versionActual.importe_igv !== undefined
                                  ? formatearMoneda(
                                      versionActual.importe_igv,
                                    )
                                  : 'Pendiente de cálculo del servidor'}
                              </strong>
                            </div>

                            <div>
                              <span>Importe de líneas (referencial)</span>
                              <strong>
                                {formatearMoneda(
                                  importeLineasEstimado,
                                )}
                              </strong>
                            </div>

                            <div>
                              <span>Total de cotización</span>
                              <strong
                                style={{
                                  color: 'var(--q-orange-text)',
                                  fontSize: '1.15rem',
                                }}
                              >
                                {versionActual.total !== null &&
                                versionActual.total !== undefined
                                  ? formatearMoneda(versionActual.total)
                                  : 'Pendiente de cálculo del servidor'}
                              </strong>
                            </div>

                            <div>
                              <span>Tratamiento tributario</span>
                              <strong>
                                {modoIGV === 'INCLUIDO'
                                  ? 'Los precios ya incluyen IGV'
                                  : modoIGV === 'ADICIONAL'
                                    ? 'Se agrega IGV al subtotal'
                                    : 'Pendiente de configuración'}
                              </strong>
                            </div>
                          </div>

                          <p className="quote-no-details">
                            El importe de líneas es una suma referencial.
                            Los importes tributarios oficiales son los
                            calculados y guardados por el servidor.
                          </p>
                        </div>

                        <div className="quote-detail-section">
                          <h3>Condiciones comerciales</h3>

                          <label className="quote-status-form">
                            <span>Condiciones de la cotización</span>
                            <textarea
                              rows={4}
                              value={condicionesComerciales}
                              disabled={
                                !puedeEditarVersion || procesandoVersion
                              }
                              onChange={(evento) =>
                                setCondicionesComerciales(
                                  evento.target.value,
                                )
                              }
                              placeholder="Escribe las condiciones comerciales..."
                            />
                          </label>

                          <label
                            className="quote-status-form"
                            style={{ marginTop: 15 }}
                          >
                            <span>Observaciones internas</span>
                            <textarea
                              rows={3}
                              value={observacionesInternas}
                              disabled={
                                !puedeEditarVersion || procesandoVersion
                              }
                              onChange={(evento) =>
                                setObservacionesInternas(
                                  evento.target.value,
                                )
                              }
                              placeholder="Observaciones internas para el equipo..."
                            />
                          </label>

                          {puedeEditarVersion && (
                            <button
                              type="button"
                              className="quote-save-button"
                              style={{ marginTop: 18 }}
                              onClick={() => void guardarVersion()}
                              disabled={procesandoVersion}
                            >
                              {procesandoVersion
                                ? 'Guardando...'
                                : 'Guardar cambios de la versión'}
                            </button>
                          )}
                        </div>

                        {puedeEditarVersion && (
                          <div className="quote-detail-section">
                            <h3>Enviar a aprobación</h3>

                            <p className="quote-message">
                              Cuando termines de registrar los precios y
                              las condiciones comerciales, envía la
                              cotización a GERENCIA para su revisión.
                            </p>

                            {!hayLineasCotizacion && (
                              <p
                                className="quote-no-details"
                                role="alert"
                                style={{ marginTop: 12 }}
                              >
                                No se puede enviar esta versión porque no
                                contiene productos ni servicios. Agrega al
                                menos una línea antes de iniciar la aprobación.
                              </p>
                            )}

                            {hayLineasCotizacion && !preciosCompletos && (
                              <p
                                className="quote-no-details"
                                role="alert"
                                style={{ marginTop: 12 }}
                              >
                                Todos los productos y servicios deben tener
                                un precio mayor que cero para poder enviar la
                                cotización a aprobación.
                              </p>
                            )}

                            <button
                              type="button"
                              className="quote-save-button"
                              style={{ marginTop: 16 }}
                              onClick={() => void enviarAprobacion()}
                              disabled={
                                !puedeEnviarAprobacion ||
                                procesandoVersion
                              }
                            >
                              {procesandoVersion
                                ? 'Procesando...'
                                : 'Enviar cotización para aprobación'}
                            </button>
                          </div>
                        )}

                        {puedeEnviarCliente && (
                          <div className="quote-detail-section">
                            <h3>Envío al cliente</h3>

                            <p className="quote-message">
                              Esta versión ya fue aprobada internamente.
                              El envío al cliente es una acción distinta
                              y no significa que el cliente haya aceptado
                              la cotización.
                            </p>

                            <div className="quote-info-grid">
                              <div>
                                <span>Destinatario</span>
                                <strong>
                                  {versionActual.correo ||
                                    seleccionada.correo ||
                                    'No disponible'}
                                </strong>
                              </div>

                              <div>
                                <span>Estado actual</span>
                                <strong>
                                  Aprobada internamente
                                </strong>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="quote-save-button"
                              style={{ marginTop: 18 }}
                              onClick={() => void enviarAlCliente()}
                              disabled={procesandoVersion}
                            >
                              {procesandoVersion
                                ? 'Procesando envío...'
                                : 'Enviar cotización al cliente'}
                            </button>
                          </div>
                        )}

                        {estadoVersionActiva === 'ENVIADA' && (
                          <div className="quote-detail-section">
                            <h3>Estado del envío</h3>

                            <p className="quote-message">
                              Esta versión fue enviada al cliente. El
                              envío no representa una aceptación de la
                              cotización.
                            </p>
                          </div>
                        )}

                        {aprobaciones.length > 0 && (
                          <HistorialCotizacion titulo="Historial de aprobación">
                                                        <div className="quote-history">
                              {aprobaciones.map((item, index) => (
                                <div
                                  className="quote-history-item"
                                  key={
                                    item.id_aprobacion ||
                                    `${item.creado_en}-${index}`
                                  }
                                >
                                  <span
                                    className="quote-history-dot"
                                    aria-hidden="true"
                                  />

                                  <div>
                                    <strong>
                                      {formatearEstadoVersion(
                                        item.accion,
                                      )}
                                    </strong>

                                    <p>
                                      {item.observaciones ||
                                        'Sin observaciones'}
                                    </p>

                                    <small>
                                      {obtenerFechaHora(item.creado_en)}
                                    </small>

                                    <small>
                                      Responsable:{' '}
                                      {item.administrador ||
                                        `Administrador #${item.id_administrador}`}
                                    </small>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </HistorialCotizacion>
                        )}
                      </>
                      </FormularioCotizacionModal>
                      </>
                    ) : (
                      <div className="quote-detail-section">
                        <h3>Preparación de cotización</h3>

                        <p className="quote-no-details">
                          {puedeArmar
                            ? 'Presiona "Armar cotización" para ingresar los precios de productos y servicios.'
                            : 'Cuando VENTAS arme y envíe la cotización, podrás revisarla aquí.'}
                        </p>
                      </div>
                    )}

                    <HistorialCotizacion titulo="Historial de cambios de la solicitud">
                                            {historial.length === 0 ? (
                        <p className="quote-no-details">
                          No hay movimientos registrados.
                        </p>
                      ) : (
                        <div className="quote-history">
                          {historial.map((item) => (
                            <div
                              className="quote-history-item"
                              key={obtenerClaveHistorial(item)}
                            >
                              <span
                                className="quote-history-dot"
                                aria-hidden="true"
                              />

                              <div>
                                <strong>
                                  {formatearEstado(
                                    item.estado_anterior || 'Inicio',
                                  )}
                                  {' → '}
                                  {formatearEstado(
                                    item.estado_nuevo || 'Actualización',
                                  )}
                                </strong>

                                <p>
                                  {item.comentario || 'Sin observación'}
                                </p>

                                <small>
                                  {obtenerFechaHora(item.creado_en)}
                                </small>

                                <div className="quote-history-admin">
                                  <small>
                                    Responsable:{' '}
                                    {item.administrador || 'Sistema'}
                                  </small>

                                  {item.correo_administrador && (
                                    <small>
                                      Correo:{' '}
                                      {item.correo_administrador}
                                    </small>
                                  )}

                                  <small>
                                    Rol:{' '}
                                    {obtenerEtiquetaRol(
                                      item.rol_administrador,
                                    )}
                                  </small>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </HistorialCotizacion>
                  </div>
                </>
              ) : null}
            </dialog>
          </DetalleCotizacionModal>
        )
      : null;

  return (
    <>
      <section className="quotes-page">
        <header className="quotes-header">
          <div>
            <span className="quotes-eyebrow">
              GESTIÓN COMERCIAL
            </span>

            <h1>Gestión de cotizaciones</h1>

            <p>
              Consulta solicitudes, prepara versiones y administra el
              proceso de aprobación comercial.
            </p>
          </div>

          <button
            type="button"
            className="quotes-refresh"
            onClick={() => {
              void cargarCotizaciones();
              void cargarConfiguracionIGV();
            }}
            disabled={cargando}
          >
            <span className="quotes-refresh-icon" aria-hidden="true">
              ↻
            </span>
            Actualizar
          </button>
        </header>

        <div className="quotes-stats">
          <article className="quote-stat">
            <div
              className="quote-stat-icon total-icon"
              aria-hidden="true"
            >
              ▤
            </div>

            <div>
              <span>Total de solicitudes</span>
              <strong>{resumenGeneral.total}</strong>
            </div>
          </article>

          <article className="quote-stat">
            <div
              className="quote-stat-icon pending-icon"
              aria-hidden="true"
            >
              ◷
            </div>

            <div>
              <span>Pendientes</span>
              <strong>{resumenGeneral.pendientes}</strong>
            </div>
          </article>

          <article className="quote-stat">
            <div
              className="quote-stat-icon review-icon"
              aria-hidden="true"
            >
              ⌕
            </div>

            <div>
              <span>En atención</span>
              <strong>{resumenGeneral.atencion}</strong>
            </div>
          </article>

          <article className="quote-stat">
            <div
              className="quote-stat-icon approved-icon"
              aria-hidden="true"
            >
              ✓
            </div>

            <div>
              <span>Cotizadas / aceptadas</span>
              <strong>
                {resumenGeneral.cotizadas + resumenGeneral.aceptadas}
              </strong>
            </div>
          </article>
        </div>

        <div className="quotes-toolbar">
          <div className="quotes-search">
            <span className="quotes-search-icon" aria-hidden="true">
              ⌕
            </span>

            <input
              type="search"
              placeholder="Buscar por código, cliente o empresa..."
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              aria-label="Buscar cotizaciones"
            />
          </div>

          <select
            value={filtroEstado}
            onChange={(evento) => setFiltroEstado(evento.target.value)}
            aria-label="Filtrar cotizaciones por estado"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="POR_APROBAR">
              Cotizaciones por aprobar ({cantidadPorAprobar})
            </option>
            <option value="DEVUELTAS">
              Devueltas a ventas ({cantidadDevueltas})
            </option>

            {estadosSolicitud.map((estado) => (
              <option key={estado} value={estado}>
                {formatearEstado(estado)}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <output className="quotes-error" aria-live="assertive">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => void cargarCotizaciones()}
            >
              Reintentar
            </button>
          </output>
        )}

        <div className="quotes-table-card">
          <div className="quotes-table-heading">
            <div>
              <span className="quotes-section-label">
                REGISTRO COMERCIAL
              </span>

              <h2>Solicitudes recibidas</h2>

              <p>
                {cotizacionesFiltradas.length} solicitudes encontradas
              </p>
            </div>
          </div>

          {contenidoTabla}
        </div>
      </section>

      {modalCotizacion}
    </>
  );
}

const estiloCampo: React.CSSProperties = {
  display: 'block',
  width: '100%',
  minWidth: 0,
  height: 42,
  marginTop: 7,
  padding: '8px 10px',
  color: 'var(--q-text)',
  font: 'inherit',
  fontSize: '0.85rem',
  border: '1px solid var(--q-border)',
  borderRadius: 8,
  background: '#fff',
  outlineColor: 'var(--q-orange)',
};