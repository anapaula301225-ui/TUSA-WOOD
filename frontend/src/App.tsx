import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Check,
  X,
  Send,
  LoaderCircle,
  CircleCheck,
  AlertCircle,
  Search,
  Trash2,
} from 'lucide-react';

import {
  obtenerProductos,
  obtenerServicios,
  enviarCotizacion,
  type Producto,
  type Servicio,
  type ProductoCotizacion,
  type ServicioCotizacion,
} from './services/api';

import { alertas } from './utils/alertas';
import WhatsAppFloat from './components/WhatsAppFloat';

import Navbar from './home/Navbar';
import Hero from './home/Hero';
import Nosotros from './home/Nosotros';
import Catalogo from './home/Catalogo';
import Servicios from './home/Servicios';
import Ventajas from './home/Ventajas';
import Contacto from './home/Contacto';
import Footer from './home/Footer';

import './home/home.css';

// ======================================================
// INTERFACES DEL FORMULARIO
// ======================================================

interface FormularioCotizacion {
  nombre_contacto: string;
  empresa: string;
  correo: string;
  telefono: string;
  direccion_entrega: string;
  mensaje: string;
}

interface ProductoSeleccionado extends ProductoCotizacion {
  id_producto: number;
}

interface ServicioSeleccionado extends ServicioCotizacion {
  id_servicio: number;
}

// ======================================================
// VALORES INICIALES
// ======================================================

const formularioInicial: FormularioCotizacion = {
  nombre_contacto: '',
  empresa: '',
  correo: '',
  telefono: '',
  direccion_entrega: '',
  mensaje: '',
};

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function obtenerMedidas(producto: Producto): string {
  const { largo_cm, ancho_cm, alto_cm } = producto;

  if (
    largo_cm == null &&
    ancho_cm == null &&
    alto_cm == null
  ) {
    return 'Consultar medidas';
  }

  const largo = largo_cm ?? '?';
  const ancho = ancho_cm ?? '?';

  if (alto_cm == null) {
    return `${largo} × ${ancho} cm`;
  }

  return `${largo} × ${ancho} × ${alto_cm} cm`;
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

function App() {
  // ----------------------------------------------------
  // CATÁLOGO
  // ----------------------------------------------------

  const [busqueda, setBusqueda] = useState('');

  const [productos, setProductos] = useState<Producto[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);

  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [cargandoServicios, setCargandoServicios] = useState(true);

  const [errorProductos, setErrorProductos] = useState('');
  const [errorServicios, setErrorServicios] = useState('');

  // ----------------------------------------------------
  // MODAL
  // ----------------------------------------------------

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalMontado, setModalMontado] = useState(false);
  const [modalCerrando, setModalCerrando] = useState(false);

  // ----------------------------------------------------
  // FORMULARIO
  // ----------------------------------------------------

  const [formulario, setFormulario] =
    useState<FormularioCotizacion>(formularioInicial);

  const [productosSeleccionados, setProductosSeleccionados] =
    useState<ProductoSeleccionado[]>([]);

  const [serviciosSeleccionados, setServiciosSeleccionados] =
    useState<ServicioSeleccionado[]>([]);

  const [enviando, setEnviando] = useState(false);
  const [errorCotizacion, setErrorCotizacion] = useState('');
  const [codigoCotizacion, setCodigoCotizacion] = useState('');

  const [bienvenidaMostrada, setBienvenidaMostrada] = useState(false);

  // ======================================================
  // CARGAR PRODUCTOS Y SERVICIOS
  // ======================================================

  useEffect(() => {
    let activo = true;

    async function cargarProductos() {
      try {
        setCargandoProductos(true);
        setErrorProductos('');

        const datos = await obtenerProductos();

        if (activo) {
          setProductos(datos);
        }
      } catch {
        if (activo) {
          setErrorProductos(
            'No pudimos cargar el catálogo en este momento. Inténtalo nuevamente.',
          );
        }
      } finally {
        if (activo) {
          setCargandoProductos(false);
        }
      }
    }

    async function cargarServicios() {
      try {
        setCargandoServicios(true);
        setErrorServicios('');

        const datos = await obtenerServicios();

        if (activo) {
          setServicios(datos);
        }
      } catch {
        if (activo) {
          setErrorServicios(
            'No pudimos cargar nuestros servicios en este momento.',
          );
        }
      } finally {
        if (activo) {
          setCargandoServicios(false);
        }
      }
    }

    void cargarProductos();
    void cargarServicios();

    return () => {
      activo = false;
    };
  }, []);

  // ======================================================
  // BLOQUEAR EL SCROLL DE LA PÁGINA
  // ======================================================

  useEffect(() => {
    if (!modalMontado) {
      return;
    }

    const overflowAnterior = document.body.style.overflow;
    const overflowHtmlAnterior =
      document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.documentElement.style.overflow =
        overflowHtmlAnterior;
    };
  }, [modalMontado]);

  // ======================================================
  // ANIMACIÓN DE APERTURA
  // ======================================================

  useEffect(() => {
    if (!modalMontado || modalCerrando) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setModalAbierto(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [modalMontado, modalCerrando]);

  // ======================================================
  // CERRAR MODAL DESPUÉS DE LA ANIMACIÓN
  // ======================================================

  function finalizarCierreModal() {
    setModalAbierto(false);
    setModalCerrando(true);

    window.setTimeout(() => {
      setModalMontado(false);
      setModalCerrando(false);
    }, 450);
  }

  // ======================================================
  // BÚSQUEDA Y FILTRADO DEL CATÁLOGO
  // ======================================================

  const terminoBusqueda = busqueda.trim().toLowerCase();

  const productosFiltrados = productos.filter((producto) =>
    `${producto.nombre} ${producto.codigo} ${
      producto.categoria ?? ''
    } ${producto.material}`
      .toLowerCase()
      .includes(terminoBusqueda),
  );

  // ======================================================
  // ABRIR COTIZACIÓN
  // ======================================================

  async function abrirCotizacion(producto?: Producto) {
    if (enviando || modalMontado) {
      return;
    }

    setFormulario(formularioInicial);

    setProductosSeleccionados(
      producto
        ? [
            {
              id_producto: producto.id_producto,
              cantidad: 100,
              especificaciones: obtenerMedidas(producto),
            },
          ]
        : [],
    );

    setServiciosSeleccionados([]);

    setErrorCotizacion('');
    setCodigoCotizacion('');
    setModalCerrando(false);

    if (!bienvenidaMostrada) {
      const confirmado = await alertas.bienvenida();

      setBienvenidaMostrada(true);

      if (!confirmado) {
        return;
      }
    }

    setModalMontado(true);
    setModalAbierto(false);
  }

  // ======================================================
  // CERRAR COTIZACIÓN
  // ======================================================

  async function cerrarCotizacion() {
    if (enviando || modalCerrando) {
      return;
    }

    const hayDatosIngresados = Object.values(formulario).some(
      (valor) => valor.trim() !== '',
    );

    const hayProductos = productosSeleccionados.length > 0;
    const hayServicios = serviciosSeleccionados.length > 0;

    if (hayDatosIngresados || hayProductos || hayServicios) {
      const confirmado = await alertas.confirmar(
        '¿Cerrar la cotización?',
        'Los datos ingresados podrían perderse si cierras esta ventana.',
        'Sí, cerrar',
      );

      if (!confirmado) {
        return;
      }
    }

    setErrorCotizacion('');
    setCodigoCotizacion('');

    finalizarCierreModal();
  }

  // ======================================================
  // CERRAR CON LA TECLA ESCAPE
  // ======================================================

  useEffect(() => {
    if (!modalMontado) {
      return;
    }

    function manejarEscape(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        void cerrarCotizacion();
      }
    }

    window.addEventListener('keydown', manejarEscape);

    return () => {
      window.removeEventListener('keydown', manejarEscape);
    };
  }, [
    modalMontado,
    modalCerrando,
    enviando,
    formulario,
    productosSeleccionados,
    serviciosSeleccionados,
  ]);

  // ======================================================
  // ACTUALIZAR CAMPOS DE CONTACTO
  // ======================================================

  function actualizarCampo(
    campo: keyof FormularioCotizacion,
    valor: string,
  ) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));

    if (errorCotizacion) {
      setErrorCotizacion('');
    }
  }

  // ======================================================
  // AGREGAR PRODUCTO
  // ======================================================

  function agregarProducto(idProducto: number) {
    if (
      productosSeleccionados.some(
        (producto) => producto.id_producto === idProducto,
      )
    ) {
      return;
    }

    const producto = productos.find(
      (item) => item.id_producto === idProducto,
    );

    setProductosSeleccionados((actuales) => [
      ...actuales,
      {
        id_producto: idProducto,
        cantidad: 100,
        especificaciones: producto
          ? obtenerMedidas(producto)
          : '',
      },
    ]);

    setErrorCotizacion('');
  }

  // ======================================================
  // QUITAR PRODUCTO
  // ======================================================

  function quitarProducto(idProducto: number) {
    setProductosSeleccionados((actuales) =>
      actuales.filter(
        (producto) => producto.id_producto !== idProducto,
      ),
    );

    setErrorCotizacion('');
  }

  // ======================================================
  // ACTUALIZAR CANTIDAD DE PRODUCTO
  // ======================================================

  function actualizarCantidadProducto(
    idProducto: number,
    cantidad: string,
  ) {
    setProductosSeleccionados((actuales) =>
      actuales.map((producto) =>
        producto.id_producto === idProducto
          ? {
              ...producto,
              cantidad: cantidad === '' ? 0 : Number(cantidad),
            }
          : producto,
      ),
    );

    setErrorCotizacion('');
  }

  // ======================================================
  // ACTUALIZAR ESPECIFICACIONES DE PRODUCTO
  // ======================================================

  function actualizarEspecificacionesProducto(
    idProducto: number,
    especificaciones: string,
  ) {
    setProductosSeleccionados((actuales) =>
      actuales.map((producto) =>
        producto.id_producto === idProducto
          ? {
              ...producto,
              especificaciones,
            }
          : producto,
      ),
    );

    setErrorCotizacion('');
  }

  // ======================================================
  // AGREGAR SERVICIO
  // ======================================================

  function agregarServicio(idServicio: number) {
    if (
      serviciosSeleccionados.some(
        (servicio) => servicio.id_servicio === idServicio,
      )
    ) {
      return;
    }

    setServiciosSeleccionados((actuales) => [
      ...actuales,
      {
        id_servicio: idServicio,
        observaciones: '',
      },
    ]);

    setErrorCotizacion('');
  }

  // ======================================================
  // QUITAR SERVICIO
  // ======================================================

  function quitarServicio(idServicio: number) {
    setServiciosSeleccionados((actuales) =>
      actuales.filter(
        (servicio) => servicio.id_servicio !== idServicio,
      ),
    );

    setErrorCotizacion('');
  }

  // ======================================================
  // ACTUALIZAR OBSERVACIONES DEL SERVICIO
  // ======================================================

  function actualizarObservacionesServicio(
    idServicio: number,
    observaciones: string,
  ) {
    setServiciosSeleccionados((actuales) =>
      actuales.map((servicio) =>
        servicio.id_servicio === idServicio
          ? {
              ...servicio,
              observaciones,
            }
          : servicio,
      ),
    );

    setErrorCotizacion('');
  }

  // ======================================================
  // VALIDAR Y ENVIAR COTIZACIÓN
  // ======================================================

  async function enviarFormulario(
    evento: FormEvent<HTMLFormElement>,
  ) {
    evento.preventDefault();

    if (enviando) {
      return;
    }

    setErrorCotizacion('');
    setCodigoCotizacion('');

    // ----------------------------------------------
    // VALIDAR PRODUCTOS
    // ----------------------------------------------

    if (productosSeleccionados.length === 0) {
      await alertas.advertencia(
        'Selecciona al menos un producto',
        'Agrega uno o varios productos del catálogo para preparar tu cotización.',
      );
      return;
    }

    const cantidadInvalida = productosSeleccionados.some(
      (producto) =>
        !Number.isInteger(producto.cantidad) ||
        producto.cantidad <= 0 ||
        producto.cantidad > 1000000,
    );

    if (cantidadInvalida) {
      await alertas.advertencia(
        'Revisa las cantidades',
        'Cada producto debe tener una cantidad entera entre 1 y 1,000,000.',
      );
      return;
    }

    // ----------------------------------------------
    // VALIDAR DATOS DE CONTACTO
    // ----------------------------------------------

    if (formulario.nombre_contacto.trim().length < 2) {
      await alertas.advertencia(
        'Necesitamos tu nombre',
        'Escribe tu nombre completo para poder identificar tu solicitud.',
      );
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        formulario.correo.trim(),
      )
    ) {
      await alertas.advertencia(
        'Revisa tu correo electrónico',
        'Ingresa una dirección de correo válida para que podamos contactarte.',
      );
      return;
    }

    if (formulario.telefono.trim().length < 6) {
      await alertas.advertencia(
        'Revisa tu teléfono',
        'Ingresa un número de contacto válido.',
      );
      return;
    }

    // ----------------------------------------------
    // VALIDAR SERVICIO "OTRO SERVICIO"
    // ----------------------------------------------

    const otroServicio = servicios.find(
      (servicio) =>
        servicio.nombre.trim().toLowerCase() ===
        'otro servicio',
    );

    if (otroServicio) {
      const otroSeleccionado = serviciosSeleccionados.find(
        (servicio) =>
          servicio.id_servicio === otroServicio.id_servicio,
      );

      if (
        otroSeleccionado &&
        !otroSeleccionado.observaciones?.trim()
      ) {
        await alertas.advertencia(
          'Describe el otro servicio',
          'Cuéntanos qué servicio necesitas para que podamos evaluar tu requerimiento.',
        );
        return;
      }
    }

    // ----------------------------------------------
    // PREPARAR DATOS
    // ----------------------------------------------

    const datosProductos: ProductoCotizacion[] =
      productosSeleccionados.map((producto) => ({
        id_producto: producto.id_producto,
        cantidad: producto.cantidad,
        especificaciones:
          producto.especificaciones?.trim() ?? '',
      }));

    const datosServicios: ServicioCotizacion[] =
      serviciosSeleccionados.map((servicio) => ({
        id_servicio: servicio.id_servicio,
        observaciones: servicio.observaciones?.trim() ?? '',
      }));

    // ----------------------------------------------
    // ENVIAR SOLICITUD
    // ----------------------------------------------

    setEnviando(true);

    alertas.cargando(
      '¡Ya nos estamos encargando!',
      'Estamos registrando tu cotización. Gracias por esperar un momento.',
    );

    try {
      const respuesta = await enviarCotizacion({
        nombre_contacto: formulario.nombre_contacto.trim(),
        empresa: formulario.empresa.trim(),
        correo: formulario.correo.trim(),
        telefono: formulario.telefono.trim(),
        direccion_entrega: formulario.direccion_entrega.trim(),
        mensaje: formulario.mensaje.trim(),
        productos: datosProductos,
        servicios: datosServicios,
      });

      const codigo =
        respuesta.cotizacion?.codigo ??
        (typeof respuesta.codigo === 'string'
          ? respuesta.codigo
          : '') ??
        (typeof respuesta.codigo_cotizacion === 'string'
          ? respuesta.codigo_cotizacion
          : '');

      const referencia = codigo || 'Solicitud registrada';

      alertas.cerrar();

      setCodigoCotizacion(referencia);
      setFormulario(formularioInicial);
      setProductosSeleccionados([]);
      setServiciosSeleccionados([]);
      setErrorCotizacion('');

      await alertas.exito(
        '¡Cotización registrada!',
        codigo
          ? `Tu solicitud fue recibida correctamente. Tu código de referencia es ${referencia}. ¡Gracias por confiar en TUSA WOOD!`
          : 'Tu solicitud fue recibida correctamente. ¡Gracias por confiar en TUSA WOOD!',
      );
    } catch (error) {
      alertas.cerrar();

      const mensaje =
        error instanceof Error
          ? error.message
          : 'No pudimos registrar tu cotización en este momento. Revisa tu conexión e inténtalo nuevamente.';

      setErrorCotizacion(mensaje);

      await alertas.error(
        'No se pudo enviar la cotización',
        mensaje,
      );
    } finally {
      alertas.cerrar();
      setEnviando(false);
    }
  }

  // ======================================================
  // MODAL RENDERIZADO MEDIANTE PORTAL
  // ======================================================

  const modalCotizacion = modalMontado
    ? createPortal(
        <div
          className={[
            'quote-modal-backdrop',
            modalAbierto && !modalCerrando
              ? 'quote-modal-visible'
              : '',
            modalCerrando ? 'quote-modal-closing' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role="presentation"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) {
              void cerrarCotizacion();
            }
          }}
        >
          <section
            className="quote-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quote-modal-title"
            tabIndex={-1}
          >
            {/* ENCABEZADO */}

            <div className="quote-modal-header">
              <div>
                <span className="quote-modal-kicker">
                  TUSA WOOD / ÁREA COMERCIAL
                </span>

                <h2 id="quote-modal-title">
                  Solicitar <em>cotización.</em>
                </h2>

                <p>
                  ¡Estamos para ayudarte! Cuéntanos sobre tu
                  requerimiento y nos pondremos en contacto contigo.
                </p>
              </div>

              <button
                className="quote-modal-close"
                type="button"
                onClick={() => void cerrarCotizacion()}
                disabled={enviando || modalCerrando}
                aria-label="Cerrar ventana de cotización"
              >
                <X size={22} />
              </button>
            </div>

            {/* CONFIRMACIÓN DE REGISTRO */}

            {codigoCotizacion ? (
              <div className="quote-success" role="status">
                <span className="quote-success-icon">
                  <CircleCheck size={38} />
                </span>

                <h3>¡Solicitud registrada!</h3>

                <p>
                  Tu solicitud fue recibida. Guarda el código
                  de referencia para futuras consultas.
                </p>

                <div className="quote-success-code">
                  <small>CÓDIGO DE COTIZACIÓN</small>
                  <strong>{codigoCotizacion}</strong>
                </div>

                <button
                  className="button button-orange quote-submit"
                  type="button"
                  onClick={() => {
                    setCodigoCotizacion('');
                    setErrorCotizacion('');
                    finalizarCierreModal();
                  }}
                >
                  Cerrar
                  <Check size={18} />
                </button>
              </div>
            ) : (
              <form
                className="quote-form"
                onSubmit={enviarFormulario}
              >
                {/* ================================== */}
                {/* 01. DATOS DE CONTACTO */}
                {/* ================================== */}

                <div className="quote-form-section-title">
                  <span>01</span>
                  DATOS DE CONTACTO
                </div>

                <div className="quote-form-grid">
                  <label className="quote-field quote-field-full">
                    Nombre completo *
                    <input
                      type="text"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={120}
                      value={formulario.nombre_contacto}
                      onChange={(evento) =>
                        actualizarCampo(
                          'nombre_contacto',
                          evento.target.value,
                        )
                      }
                      placeholder="Tu nombre y apellido"
                      disabled={enviando}
                    />
                  </label>

                  <label className="quote-field">
                    Empresa
                    <input
                      type="text"
                      autoComplete="organization"
                      maxLength={150}
                      value={formulario.empresa}
                      onChange={(evento) =>
                        actualizarCampo(
                          'empresa',
                          evento.target.value,
                        )
                      }
                      placeholder="Nombre de tu empresa"
                      disabled={enviando}
                    />
                  </label>

                  <label className="quote-field">
                    Teléfono *
                    <input
                      type="tel"
                      autoComplete="tel"
                      required
                      minLength={6}
                      maxLength={25}
                      value={formulario.telefono}
                      onChange={(evento) =>
                        actualizarCampo(
                          'telefono',
                          evento.target.value,
                        )
                      }
                      placeholder="Tu número de contacto"
                      disabled={enviando}
                    />
                  </label>

                  <label className="quote-field quote-field-full">
                    Correo electrónico *
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={150}
                      value={formulario.correo}
                      onChange={(evento) =>
                        actualizarCampo(
                          'correo',
                          evento.target.value,
                        )
                      }
                      placeholder="nombre@empresa.com"
                      disabled={enviando}
                    />
                  </label>

                  <label className="quote-field quote-field-full">
                    Dirección de entrega
                    <input
                      type="text"
                      autoComplete="street-address"
                      maxLength={250}
                      value={formulario.direccion_entrega}
                      onChange={(evento) =>
                        actualizarCampo(
                          'direccion_entrega',
                          evento.target.value,
                        )
                      }
                      placeholder="Distrito, ciudad o dirección"
                      disabled={enviando}
                    />
                  </label>
                </div>

                {/* ================================== */}
                {/* 02. PRODUCTOS */}
                {/* ================================== */}

                <div className="quote-form-section-title">
                  <span>02</span>
                  PRODUCTOS QUE NECESITAS
                </div>

                <div className="quote-form-grid">
                  <label className="quote-field quote-field-full">
                    Agregar producto
                    <select
                      value=""
                      onChange={(evento) => {
                        if (evento.target.value) {
                          agregarProducto(Number(evento.target.value));
                        }
                      }}
                      disabled={
                        enviando ||
                        cargandoProductos ||
                        productos.length === 0
                      }
                    >
                      <option value="">
                        {cargandoProductos
                          ? 'Cargando productos...'
                          : 'Selecciona un producto para agregar'}
                      </option>

                      {productos.map((producto) => {
                        const seleccionado =
                          productosSeleccionados.some(
                            (item) =>
                              item.id_producto === producto.id_producto,
                          );

                        return (
                          <option
                            key={producto.id_producto}
                            value={producto.id_producto}
                            disabled={seleccionado}
                          >
                            {producto.codigo} — {producto.nombre}
                            {seleccionado ? ' (Agregado)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>

                {productosSeleccionados.length > 0 ? (
                  <div className="quote-selected-list">
                    {productosSeleccionados.map((seleccionado) => {
                      const producto = productos.find(
                        (item) =>
                          item.id_producto === seleccionado.id_producto,
                      );

                      if (!producto) {
                        return null;
                      }

                      return (
                        <article
                          className="quote-selected-item"
                          key={seleccionado.id_producto}
                        >
                          <div className="quote-selected-item-header">
                            <div>
                              <span className="quote-selected-code">
                                {producto.codigo}
                              </span>

                              <h4>{producto.nombre}</h4>

                              <small>
                                {producto.categoria ||
                                  producto.material ||
                                  'Producto TUSA WOOD'}
                              </small>
                            </div>

                            <button
                              type="button"
                              className="quote-remove-item"
                              onClick={() =>
                                quitarProducto(
                                  seleccionado.id_producto,
                                )
                              }
                              disabled={enviando}
                              aria-label={`Quitar ${producto.nombre}`}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>

                          <div className="quote-form-grid">
                            <label className="quote-field">
                              Cantidad *
                              <input
                                type="number"
                                min="1"
                                max="1000000"
                                step="1"
                                required
                                value={seleccionado.cantidad || ''}
                                onChange={(evento) =>
                                  actualizarCantidadProducto(
                                    seleccionado.id_producto,
                                    evento.target.value,
                                  )
                                }
                                disabled={enviando}
                              />
                            </label>

                            <label className="quote-field">
                              Medidas o especificaciones
                              <input
                                type="text"
                                maxLength={1000}
                                value={
                                  seleccionado.especificaciones ?? ''
                                }
                                onChange={(evento) =>
                                  actualizarEspecificacionesProducto(
                                    seleccionado.id_producto,
                                    evento.target.value,
                                  )
                                }
                                placeholder="Ej. 120 × 100 cm"
                                disabled={enviando}
                              />
                            </label>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="quote-empty-selection">
                    <AlertCircle size={19} />
                    <span>
                      Todavía no has agregado productos a tu cotización.
                    </span>
                  </div>
                )}

                {/* ================================== */}
                {/* 03. SERVICIOS */}
                {/* ================================== */}

                <div className="quote-form-section-title">
                  <span>03</span>
                  SERVICIOS COMPLEMENTARIOS
                </div>

                <div className="quote-form-grid">
                  <label className="quote-field quote-field-full">
                    Agregar servicio
                    <select
                      value=""
                      onChange={(evento) => {
                        if (evento.target.value) {
                          agregarServicio(Number(evento.target.value));
                        }
                      }}
                      disabled={
                        enviando ||
                        cargandoServicios ||
                        servicios.length === 0
                      }
                    >
                      <option value="">
                        {cargandoServicios
                          ? 'Cargando servicios...'
                          : servicios.length === 0
                            ? 'No hay servicios disponibles'
                            : 'Selecciona un servicio para agregar'}
                      </option>

                      {servicios.map((servicio) => {
                        const seleccionado =
                          serviciosSeleccionados.some(
                            (item) =>
                              item.id_servicio === servicio.id_servicio,
                          );

                        return (
                          <option
                            key={servicio.id_servicio}
                            value={servicio.id_servicio}
                            disabled={seleccionado}
                          >
                            {servicio.nombre}
                            {seleccionado ? ' (Agregado)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>

                {serviciosSeleccionados.length > 0 ? (
                  <div className="quote-selected-list">
                    {serviciosSeleccionados.map((seleccionado) => {
                      const servicio = servicios.find(
                        (item) =>
                          item.id_servicio === seleccionado.id_servicio,
                      );

                      if (!servicio) {
                        return null;
                      }

                      const esOtroServicio =
                        servicio.nombre.trim().toLowerCase() ===
                        'otro servicio';

                      return (
                        <article
                          className="quote-selected-item"
                          key={seleccionado.id_servicio}
                        >
                          <div className="quote-selected-item-header">
                            <div>
                              <span className="quote-selected-code">
                                SERVICIO
                              </span>

                              <h4>{servicio.nombre}</h4>

                              {servicio.descripcion && (
                                <small>{servicio.descripcion}</small>
                              )}
                            </div>

                            <button
                              type="button"
                              className="quote-remove-item"
                              onClick={() =>
                                quitarServicio(
                                  seleccionado.id_servicio,
                                )
                              }
                              disabled={enviando}
                              aria-label={`Quitar ${servicio.nombre}`}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>

                          <label className="quote-field quote-field-full">
                            Observaciones
                            {esOtroServicio ? ' *' : ''}
                            <textarea
                              rows={2}
                              maxLength={1000}
                              required={esOtroServicio}
                              value={
                                seleccionado.observaciones ?? ''
                              }
                              onChange={(evento) =>
                                actualizarObservacionesServicio(
                                  seleccionado.id_servicio,
                                  evento.target.value,
                                )
                              }
                              placeholder={
                                esOtroServicio
                                  ? 'Describe el servicio que necesitas...'
                                  : 'Indica detalles o requerimientos adicionales...'
                              }
                              disabled={enviando}
                            />
                          </label>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="quote-empty-selection">
                    <AlertCircle size={19} />
                    <span>
                      Los servicios son opcionales. Puedes continuar
                      sin seleccionar ninguno.
                    </span>
                  </div>
                )}

                {/* ================================== */}
                {/* 04. MENSAJE ADICIONAL */}
                {/* ================================== */}

                <div className="quote-form-section-title">
                  <span>04</span>
                  INFORMACIÓN ADICIONAL
                </div>

                <div className="quote-form-grid">
                  <label className="quote-field quote-field-full">
                    Mensaje adicional
                    <textarea
                      rows={3}
                      maxLength={1500}
                      value={formulario.mensaje}
                      onChange={(evento) =>
                        actualizarCampo(
                          'mensaje',
                          evento.target.value,
                        )
                      }
                      placeholder="Cuéntanos un poco más sobre tu proyecto..."
                      disabled={enviando}
                    />
                  </label>
                </div>

                {/* ================================== */}
                {/* MENSAJES DE ERROR */}
                {/* ================================== */}

                {errorCotizacion && (
                  <div className="quote-error" role="alert">
                    <AlertCircle size={19} />
                    <span>{errorCotizacion}</span>
                  </div>
                )}

                {!cargandoProductos &&
                  productos.length === 0 &&
                  !errorProductos && (
                    <div className="quote-error" role="alert">
                      <AlertCircle size={19} />
                      <span>
                        No hay productos disponibles para cotizar.
                      </span>
                    </div>
                  )}

                {errorProductos && (
                  <div className="quote-error" role="alert">
                    <AlertCircle size={19} />
                    <span>{errorProductos}</span>
                  </div>
                )}

                {errorServicios && (
                  <div className="quote-error" role="alert">
                    <AlertCircle size={19} />
                    <span>
                      No pudimos cargar los servicios. Puedes continuar
                      cotizando productos.
                    </span>
                  </div>
                )}

                {/* ================================== */}
                {/* RESUMEN Y ENVÍO */}
                {/* ================================== */}

                <div className="quote-form-footer">
                  <p>
                    Los campos marcados con * son obligatorios.
                    <br />
                    Puedes seleccionar varios productos y servicios.
                  </p>

                  <button
                    className="button button-orange quote-submit"
                    type="submit"
                    disabled={
                      enviando ||
                      cargandoProductos ||
                      productos.length === 0
                    }
                  >
                    {enviando ? (
                      <>
                        <LoaderCircle
                          className="loading-icon"
                          size={18}
                        />
                        Enviando...
                      </>
                    ) : (
                      <>
                        Enviar solicitud
                        <Send size={17} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>,
        document.body,
      )
    : null;

  // ======================================================
  // VISTA PRINCIPAL
  // ======================================================

  return (
    <>
      <div className="site-shell">
        {/* BARRA SUPERIOR */}

        <div className="top-strip">
          <div className="container top-strip-inner">
            <span className="top-strip-message">
              <span className="status-dot" />
              SOLUCIONES PARA EL SECTOR INDUSTRIAL
            </span>

            <button
              className="top-strip-quote"
              type="button"
              onClick={() => void abrirCotizacion()}
            >
              CONVERSEMOS SOBRE TU OPERACIÓN
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* NAVEGACIÓN */}

        <Navbar onCotizar={() => void abrirCotizacion()} />

        <main>
          {/* PORTADA */}

          <Hero onCotizar={() => void abrirCotizacion()} />

          {/* NOSOTROS */}

          <Nosotros onCotizar={() => void abrirCotizacion()} />

          {/* CATÁLOGO */}

          <section id="productos" className="products-section">
            <div className="container">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">
                    02 / NUESTRO CATÁLOGO
                  </div>

                  <h2>
                    Encuentra la solución
                    <br />
                    para <em>tu operación.</em>
                  </h2>
                </div>

                <div className="catalog-side">
                  <p>
                    Explora nuestras alternativas y solicita una
                    cotización según las características de tu operación.
                  </p>

                  <label className="search-box">
                    <Search size={17} />

                    <input
                      value={busqueda}
                      onChange={(evento) =>
                        setBusqueda(evento.target.value)
                      }
                      placeholder="Buscar por nombre, código o material"
                      aria-label="Buscar productos"
                    />

                    {busqueda && (
                      <button
                        type="button"
                        onClick={() => setBusqueda('')}
                        aria-label="Limpiar búsqueda"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </label>
                </div>
              </div>

              <Catalogo
                productos={productosFiltrados}
                cargando={cargandoProductos}
                error={errorProductos}
                onReintentar={() => window.location.reload()}
                onCotizar={(producto) =>
                  void abrirCotizacion(producto)
                }
              />

              <div className="catalog-results">
                Mostrando{' '}
                <strong>{productosFiltrados.length}</strong>{' '}
                productos del catálogo
              </div>

              <div className="catalog-footnote">
                <span className="orange-square" />
                Las medidas y características deben confirmarse para
                cada requerimiento.
              </div>
            </div>
          </section>

          {/* SERVICIOS */}

          <Servicios
            servicios={servicios}
            cargando={cargandoServicios}
            error={errorServicios}
            onReintentar={() => window.location.reload()}
            onCotizar={() => void abrirCotizacion()}
          />

          {/* VENTAJAS */}

          <Ventajas />

          {/* CONTACTO */}

          <Contacto onCotizar={() => void abrirCotizacion()} />
        </main>

        {/* PIE DE PÁGINA */}

        <Footer />

        {/* BOTÓN FLOTANTE DE WHATSAPP */}

        <WhatsAppFloat />
      </div>

      {/* MODAL FUERA DE LA PÁGINA PRINCIPAL */}

      {modalCotizacion}
    </>
  );
}

export default App;