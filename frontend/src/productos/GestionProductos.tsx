
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  obtenerProductosAdmin,
  obtenerCategoriasAdmin,
  crearProductoAdmin,
  actualizarProductoAdmin,
  cambiarEstadoProductoAdmin,
  type Producto,
  type Categoria,
} from '../services/api';
import { alertas } from '../utils/alertas';
import './products-management.css';

interface ProductoForm {
  id_categoria: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  material: string;
  largo_cm: string;
  ancho_cm: string;
  alto_cm: string;
  capacidad_kg: string;
  imagen_url: string;
  destacado: boolean;
}

const formularioInicial: ProductoForm = {
  id_categoria: '',
  codigo: '',
  nombre: '',
  descripcion: '',
  material: '',
  largo_cm: '',
  ancho_cm: '',
  alto_cm: '',
  capacidad_kg: '',
  imagen_url: '',
  destacado: false,
};

function obtenerMensajeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error al procesar la solicitud.';
}

function esActivo(valor: unknown): boolean {
  return valor === true || Number(valor) === 1;
}

export default function GestionProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [productoEditando, setProductoEditando] = useState<number | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [formulario, setFormulario] = useState<ProductoForm>(formularioInicial);

  const cargarDatos = useCallback(async () => {
    setCargando(true);

    try {
      const [listaProductos, listaCategorias] = await Promise.all([
        obtenerProductosAdmin(),
        obtenerCategoriasAdmin(),
      ]);

      setProductos(listaProductos);
      setCategorias(listaCategorias);
    } catch (error) {
      await alertas.error(
        'Error al cargar productos',
        obtenerMensajeError(error)
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return productos.filter((producto) => {
      const coincideBusqueda =
        !texto ||
        producto.nombre.toLowerCase().includes(texto) ||
        producto.codigo.toLowerCase().includes(texto) ||
        (producto.material || '').toLowerCase().includes(texto) ||
        (producto.categoria || '').toLowerCase().includes(texto);

      const coincideEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'activos' && esActivo(producto.activo)) ||
        (filtroEstado === 'inactivos' && !esActivo(producto.activo));

      const coincideCategoria =
        filtroCategoria === 'todas' ||
        String(producto.id_categoria ?? '') === filtroCategoria;

      return coincideBusqueda && coincideEstado && coincideCategoria;
    });
  }, [productos, busqueda, filtroEstado, filtroCategoria]);

  const totalActivos = productos.filter((p) => esActivo(p.activo)).length;
  const totalInactivos = productos.length - totalActivos;
  const totalDestacados = productos.filter((p) => p.destacado).length;

  const actualizarCampo = (
    campo: keyof ProductoForm,
    valor: string | boolean
  ) => {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const abrirNuevoProducto = () => {
    setProductoEditando(null);
    setFormulario(formularioInicial);
    setModalAbierto(true);
  };

  const abrirEdicion = (producto: Producto) => {
    setProductoEditando(producto.id_producto);

    setFormulario({
      id_categoria: producto.id_categoria
        ? String(producto.id_categoria)
        : '',
      codigo: producto.codigo || '',
      nombre: producto.nombre || '',
      descripcion: producto.descripcion || '',
      material: producto.material || '',
      largo_cm: producto.largo_cm != null ? String(producto.largo_cm) : '',
      ancho_cm: producto.ancho_cm != null ? String(producto.ancho_cm) : '',
      alto_cm: producto.alto_cm != null ? String(producto.alto_cm) : '',
      capacidad_kg:
        producto.capacidad_kg != null
          ? String(producto.capacidad_kg)
          : '',
      imagen_url: producto.imagen_url || '',
      destacado: Boolean(producto.destacado),
    });

    setModalAbierto(true);
  };

  const cerrarModal = () => {
    if (guardando) return;

    setModalAbierto(false);
    setProductoEditando(null);
    setFormulario(formularioInicial);
  };

  const validarFormulario = (): string | null => {
    if (!formulario.id_categoria) {
      return 'Selecciona una categoría para el producto.';
    }

    if (!formulario.codigo.trim()) {
      return 'Ingresa el código del producto.';
    }

    if (!formulario.nombre.trim()) {
      return 'Ingresa el nombre del producto.';
    }

    const medidas = [
      ['Largo', formulario.largo_cm],
      ['Ancho', formulario.ancho_cm],
      ['Alto', formulario.alto_cm],
      ['Capacidad', formulario.capacidad_kg],
    ] as const;

    for (const [nombre, valor] of medidas) {
      if (valor.trim() !== '') {
        const numero = Number(valor);

        if (!Number.isFinite(numero) || numero <= 0) {
          return `${nombre} debe ser un número mayor que cero.`;
        }
      }
    }

    return null;
  };

  const guardarProducto = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    const errorValidacion = validarFormulario();

    if (errorValidacion) {
      await alertas.advertencia(
        'Revisa el formulario',
        errorValidacion
      );
      return;
    }

    const datos: Partial<Producto> = {
      id_categoria: Number(formulario.id_categoria),
      codigo: formulario.codigo.trim(),
      nombre: formulario.nombre.trim(),
      descripcion: formulario.descripcion.trim() || null,
      material: formulario.material.trim(),
      largo_cm: formulario.largo_cm.trim()
        ? Number(formulario.largo_cm)
        : null,
      ancho_cm: formulario.ancho_cm.trim()
        ? Number(formulario.ancho_cm)
        : null,
      alto_cm: formulario.alto_cm.trim()
        ? Number(formulario.alto_cm)
        : null,
      capacidad_kg: formulario.capacidad_kg.trim()
        ? Number(formulario.capacidad_kg)
        : null,
      imagen_url: formulario.imagen_url.trim() || null,
      destacado: formulario.destacado,
    };

    setGuardando(true);

    alertas.cargando(
      productoEditando !== null ? 'Actualizando producto...' : 'Registrando producto...',
      'Estamos guardando la información.'
    );

    try {
      if (productoEditando !== null) {
        await actualizarProductoAdmin(productoEditando, datos);
      } else {
        await crearProductoAdmin(datos);
      }

      alertas.cerrar();

      setModalAbierto(false);
      setProductoEditando(null);
      setFormulario(formularioInicial);

      await cargarDatos();

      await alertas.notificacion(
        productoEditando !== null
          ? 'Producto actualizado correctamente.'
          : 'Producto registrado correctamente.',
        'success'
      );
    } catch (error) {
      alertas.cerrar();

      await alertas.error(
        'No se pudo guardar el producto',
        obtenerMensajeError(error)
      );
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (producto: Producto) => {
    const nuevoEstado = !esActivo(producto.activo);

    const confirmado = await alertas.confirmar(
      nuevoEstado ? '¿Activar producto?' : '¿Desactivar producto?',
      nuevoEstado
        ? `¿Deseas activar "${producto.nombre}"? El producto volverá a estar disponible.`
        : `¿Deseas desactivar "${producto.nombre}"?`,
      nuevoEstado ? 'Sí, activar' : 'Sí, desactivar'
    );

    if (!confirmado) return;

    alertas.cargando(
      nuevoEstado ? 'Activando producto...' : 'Desactivando producto...',
      'Estamos actualizando su estado.'
    );

    try {
      await cambiarEstadoProductoAdmin(
        producto.id_producto,
        nuevoEstado
      );

      alertas.cerrar();

      await cargarDatos();

      await alertas.notificacion(
        nuevoEstado
          ? 'Producto activado correctamente.'
          : 'Producto desactivado correctamente.',
        'success'
      );
    } catch (error) {
      alertas.cerrar();

      await alertas.error(
        'No se pudo cambiar el estado',
        obtenerMensajeError(error)
      );
    }
  };

  return (
    <div className="productos-page">
      <header className="productos-header">
        <div>
          <span className="productos-eyebrow">GESTIÓN COMERCIAL</span>
          <h1>Productos</h1>
          <p>Administra el catálogo de productos de TUSA WOOD.</p>
        </div>

        <button
          type="button"
          className="productos-btn-primary"
          onClick={abrirNuevoProducto}
        >
          <span>＋</span> Nuevo producto
        </button>
      </header>

      <section className="productos-resumen">
        <article className="productos-resumen-card">
          <span className="productos-resumen-icono naranja">📦</span>
          <div>
            <small>Total de productos</small>
            <strong>{productos.length}</strong>
          </div>
        </article>

        <article className="productos-resumen-card">
          <span className="productos-resumen-icono verde">✓</span>
          <div>
            <small>Productos activos</small>
            <strong>{totalActivos}</strong>
          </div>
        </article>

        <article className="productos-resumen-card">
          <span className="productos-resumen-icono gris">○</span>
          <div>
            <small>Productos inactivos</small>
            <strong>{totalInactivos}</strong>
          </div>
        </article>

        <article className="productos-resumen-card">
          <span className="productos-resumen-icono dorado">★</span>
          <div>
            <small>Productos destacados</small>
            <strong>{totalDestacados}</strong>
          </div>
        </article>
      </section>

      <section className="productos-listado">
        <div className="productos-listado-heading">
          <div>
            <h2>Catálogo de productos</h2>
            <p>Consulta y administra los productos registrados.</p>
          </div>

          <button
            type="button"
            className="productos-btn-refresh"
            onClick={() => void cargarDatos()}
            disabled={cargando}
          >
            ↻ Actualizar
          </button>
        </div>

        <div className="productos-filtros">
          <div className="productos-busqueda">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Buscar por nombre, código, material..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            aria-label="Filtrar por categoría"
          >
            <option value="todas">Todas las categorías</option>
            {categorias.map((categoria) => (
              <option
                key={categoria.id_categoria}
                value={String(categoria.id_categoria)}
              >
                {categoria.nombre}
              </option>
            ))}
          </select>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="todos">Todos los estados</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </div>

        <div className="productos-tabla-contenedor">
          <table className="productos-tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Código</th>
                <th>Categoría</th>
                <th>Material</th>
                <th>Medidas</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={7} className="productos-estado-tabla">
                    <span className="productos-spinner" />
                    Cargando productos...
                  </td>
                </tr>
              ) : productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="productos-estado-tabla">
                    <span>📦</span>
                    <strong>No se encontraron productos</strong>
                    <small>
                      Prueba modificando los filtros o registra un producto.
                    </small>
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((producto) => (
                  <tr key={producto.id_producto}>
                    <td>
                      <div className="productos-celda-producto">
                        {producto.imagen_url ? (
                          <img
                            src={producto.imagen_url}
                            alt={producto.nombre}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="productos-imagen-vacia">📦</div>
                        )}

                        <div>
                          <strong>{producto.nombre}</strong>
                          {producto.destacado && (
                            <span className="productos-destacado">
                              ★ Destacado
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="productos-codigo">
                        {producto.codigo}
                      </span>
                    </td>

                    <td>{producto.categoria || '—'}</td>
                    <td>{producto.material || '—'}</td>

                    <td>
                      {producto.largo_cm || '—'} ×{' '}
                      {producto.ancho_cm || '—'} ×{' '}
                      {producto.alto_cm || '—'} cm
                    </td>

                    <td>
                      <span
                        className={`productos-estado ${
                          esActivo(producto.activo) ? 'activo' : 'inactivo'
                        }`}
                      >
                        {esActivo(producto.activo) ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    <td>
                      <div className="productos-acciones">
                        <button
                          type="button"
                          className="productos-accion editar"
                          onClick={() => abrirEdicion(producto)}
                          title="Editar producto"
                        >
                          ✎
                        </button>

                        <button
                          type="button"
                          className={`productos-accion ${
                            esActivo(producto.activo) ? 'desactivar' : 'activar'
                          }`}
                          onClick={() => void cambiarEstado(producto)}
                          title={
                            esActivo(producto.activo)
                              ? 'Desactivar producto'
                              : 'Activar producto'
                          }
                        >
                          {esActivo(producto.activo) ? '⊘' : '✓'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="productos-pie-tabla">
          Mostrando <strong>{productosFiltrados.length}</strong> de{' '}
          <strong>{productos.length}</strong> productos
        </footer>
      </section>

      {modalAbierto && (
        <div
          className="productos-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cerrarModal();
          }}
        >
          <section
            className="productos-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="productos-modal-titulo"
          >
            <header className="productos-modal-header">
              <div>
                <span className="productos-eyebrow">CATÁLOGO TUSA WOOD</span>
                <h2 id="productos-modal-titulo">
                  {productoEditando !== null
                    ? 'Editar producto'
                    : 'Registrar producto'}
                </h2>
                <p>Completa la información del producto.</p>
              </div>

              <button
                type="button"
                className="productos-modal-cerrar"
                onClick={cerrarModal}
                disabled={guardando}
                aria-label="Cerrar formulario"
              >
                ×
              </button>
            </header>

            <form onSubmit={guardarProducto}>
              <div className="productos-form-grid">
                <label className="productos-campo">
                  <span>Categoría *</span>
                  <select
                    value={formulario.id_categoria}
                    onChange={(e) =>
                      actualizarCampo('id_categoria', e.target.value)
                    }
                    required
                  >
                    <option value="">Seleccionar categoría</option>
                    {categorias
                      .filter((categoria) => esActivo(categoria.activo))
                      .map((categoria) => (
                        <option
                          key={categoria.id_categoria}
                          value={String(categoria.id_categoria)}
                        >
                          {categoria.nombre}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="productos-campo">
                  <span>Código *</span>
                  <input
                    type="text"
                    value={formulario.codigo}
                    onChange={(e) =>
                      actualizarCampo('codigo', e.target.value)
                    }
                    placeholder="Ej. PAR-MAD-001"
                    required
                  />
                </label>

                <label className="productos-campo productos-campo-completo">
                  <span>Nombre del producto *</span>
                  <input
                    type="text"
                    value={formulario.nombre}
                    onChange={(e) =>
                      actualizarCampo('nombre', e.target.value)
                    }
                    placeholder="Nombre del producto"
                    required
                  />
                </label>

                <label className="productos-campo productos-campo-completo">
                  <span>Descripción</span>
                  <textarea
                    value={formulario.descripcion}
                    onChange={(e) =>
                      actualizarCampo('descripcion', e.target.value)
                    }
                    placeholder="Describe las características del producto..."
                    rows={3}
                  />
                </label>

                <label className="productos-campo productos-campo-completo">
                  <span>Material</span>
                  <input
                    type="text"
                    value={formulario.material}
                    onChange={(e) =>
                      actualizarCampo('material', e.target.value)
                    }
                    placeholder="Ej. Madera, plástico..."
                  />
                </label>

                <div className="productos-form-subtitulo">
                  Dimensiones y capacidad
                </div>

                <label className="productos-campo">
                  <span>Largo (cm)</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={formulario.largo_cm}
                    onChange={(e) =>
                      actualizarCampo('largo_cm', e.target.value)
                    }
                    placeholder="Ej. 120"
                  />
                </label>

                <label className="productos-campo">
                  <span>Ancho (cm)</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={formulario.ancho_cm}
                    onChange={(e) =>
                      actualizarCampo('ancho_cm', e.target.value)
                    }
                    placeholder="Ej. 100"
                  />
                </label>

                <label className="productos-campo">
                  <span>Alto (cm)</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={formulario.alto_cm}
                    onChange={(e) =>
                      actualizarCampo('alto_cm', e.target.value)
                    }
                    placeholder="Ej. 15"
                  />
                </label>

                <label className="productos-campo">
                  <span>Capacidad (kg)</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={formulario.capacidad_kg}
                    onChange={(e) =>
                      actualizarCampo('capacidad_kg', e.target.value)
                    }
                    placeholder="Ej. 1500"
                  />
                </label>

                <label className="productos-campo productos-campo-completo">
                  <span>URL de imagen</span>
                  <input
                    type="url"
                    value={formulario.imagen_url}
                    onChange={(e) =>
                      actualizarCampo('imagen_url', e.target.value)
                    }
                    placeholder="https://..."
                  />
                </label>

                <label className="productos-checkbox">
                  <input
                    type="checkbox"
                    checked={formulario.destacado}
                    onChange={(e) =>
                      actualizarCampo('destacado', e.target.checked)
                    }
                  />
                  <span>
                    <strong>Producto destacado</strong>
                    <small>Resaltar este producto en el catálogo.</small>
                  </span>
                </label>
              </div>

              <footer className="productos-modal-footer">
                <button
                  type="button"
                  className="productos-btn-secundario"
                  onClick={cerrarModal}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="productos-btn-primary"
                  disabled={guardando}
                >
                  {guardando
                    ? 'Guardando...'
                    : productoEditando !== null
                      ? 'Guardar cambios'
                      : 'Registrar producto'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
