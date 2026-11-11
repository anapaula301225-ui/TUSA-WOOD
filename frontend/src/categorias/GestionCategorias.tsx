
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  obtenerCategoriasAdmin,
  crearCategoriaAdmin,
  actualizarCategoriaAdmin,
  cambiarEstadoCategoriaAdmin,
  eliminarCategoriaAdmin,
} from '../services/api';
import { alertas } from '../utils/alertas';
import './categories-management.css';

interface Categoria {
  id_categoria: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean | number;
}

interface CategoriaForm {
  nombre: string;
  descripcion: string;
}

const formularioInicial: CategoriaForm = {
  nombre: '',
  descripcion: '',
};

function esActivo(valor: unknown): boolean {
  return valor === true || Number(valor) === 1;
}

function mensajeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Ocurrió un error al procesar la solicitud.';
}

export default function GestionCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<number | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [formulario, setFormulario] = useState<CategoriaForm>(formularioInicial);

  const cargarCategorias = useCallback(async (mostrarError = true) => {
    setCargando(true);

    try {
      const respuesta = await obtenerCategoriasAdmin();
      setCategorias(respuesta);
    } catch (error) {
      if (mostrarError) {
        await alertas.error(
          'No se pudieron cargar las categorías',
          mensajeError(error)
        );
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarCategorias();
  }, [cargarCategorias]);

  const categoriasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return categorias.filter((categoria) => {
      const coincideBusqueda =
        !texto ||
        categoria.nombre.toLowerCase().includes(texto) ||
        (categoria.descripcion || '').toLowerCase().includes(texto);

      const coincideEstado =
        filtroEstado === 'todas' ||
        (filtroEstado === 'activas' && esActivo(categoria.activo)) ||
        (filtroEstado === 'inactivas' && !esActivo(categoria.activo));

      return coincideBusqueda && coincideEstado;
    });
  }, [categorias, busqueda, filtroEstado]);

  const totalActivas = useMemo(
    () => categorias.filter((categoria) => esActivo(categoria.activo)).length,
    [categorias]
  );

  const totalInactivas = categorias.length - totalActivas;

  const abrirNuevaCategoria = () => {
    setCategoriaEditando(null);
    setFormulario(formularioInicial);
    setModalAbierto(true);
  };

  const abrirEdicion = (categoria: Categoria) => {
    setCategoriaEditando(categoria.id_categoria);

    setFormulario({
      nombre: categoria.nombre || '',
      descripcion: categoria.descripcion || '',
    });

    setModalAbierto(true);
  };

  const cerrarModal = () => {
    if (guardando) return;

    setModalAbierto(false);
    setCategoriaEditando(null);
    setFormulario(formularioInicial);
  };

  const actualizarCampo = (
    campo: keyof CategoriaForm,
    valor: string
  ) => {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const guardarCategoria = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    const nombre = formulario.nombre.trim();

    if (!nombre) {
      await alertas.advertencia(
        'Nombre obligatorio',
        'Ingresa el nombre de la categoría para continuar.'
      );
      return;
    }

    const datos = {
      nombre,
      descripcion: formulario.descripcion.trim(),
    };

    setGuardando(true);

    try {
      if (categoriaEditando !== null) {
        await actualizarCategoriaAdmin(categoriaEditando, datos);

        setModalAbierto(false);
        setCategoriaEditando(null);
        setFormulario(formularioInicial);

        await cargarCategorias(false);

        await alertas.exito(
          'Categoría actualizada',
          'Los cambios se guardaron correctamente.'
        );
      } else {
        await crearCategoriaAdmin(datos);

        setModalAbierto(false);
        setCategoriaEditando(null);
        setFormulario(formularioInicial);

        await cargarCategorias(false);

        await alertas.exito(
          'Categoría registrada',
          'La nueva categoría se agregó correctamente.'
        );
      }
    } catch (error) {
      await alertas.error(
        'No se pudo guardar la categoría',
        mensajeError(error)
      );
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (categoria: Categoria) => {
    if (procesandoId !== null) return;

    const nuevoEstado = !esActivo(categoria.activo);

    const confirmar = await alertas.confirmar(
      nuevoEstado ? '¿Activar categoría?' : '¿Desactivar categoría?',
      nuevoEstado
        ? `La categoría "${categoria.nombre}" volverá a estar disponible.`
        : `La categoría "${categoria.nombre}" dejará de estar disponible.`,
      nuevoEstado ? 'Sí, activar' : 'Sí, desactivar'
    );

    if (!confirmar) return;

    setProcesandoId(categoria.id_categoria);

    try {
      await cambiarEstadoCategoriaAdmin(
        categoria.id_categoria,
        nuevoEstado
      );

      await cargarCategorias(false);

      await alertas.exito(
        nuevoEstado ? 'Categoría activada' : 'Categoría desactivada',
        nuevoEstado
          ? 'La categoría está activa nuevamente.'
          : 'La categoría se desactivó correctamente.'
      );
    } catch (error) {
      await alertas.error(
        'No se pudo cambiar el estado',
        mensajeError(error)
      );
    } finally {
      setProcesandoId(null);
    }
  };

  const eliminarCategoria = async (categoria: Categoria) => {
    if (procesandoId !== null) return;

    const confirmar = await alertas.confirmar(
      '¿Eliminar esta categoría?',
      `Se eliminará "${categoria.nombre}". Esta acción no se puede deshacer.`,
      'Sí, eliminar'
    );

    if (!confirmar) return;

    setProcesandoId(categoria.id_categoria);

    try {
      await eliminarCategoriaAdmin(categoria.id_categoria);

      await cargarCategorias(false);

      await alertas.exito(
        'Categoría eliminada',
        'La categoría se eliminó correctamente.'
      );
    } catch (error) {
      await alertas.error(
        'No se pudo eliminar la categoría',
        mensajeError(error)
      );
    } finally {
      setProcesandoId(null);
    }
  };

  const contenidoListado = (() => {
    if (cargando) {
      return (
        <tr>
          <td colSpan={5} className="categorias-estado-tabla">
            <span className="categorias-spinner" />
            <strong>Cargando categorías...</strong>
            <small>Estamos preparando la información del catálogo.</small>
          </td>
        </tr>
      );
    }

    if (categoriasFiltradas.length === 0) {
      return (
        <tr>
          <td colSpan={5} className="categorias-estado-tabla">
            <span className="categorias-vacio-icono">▤</span>
            <strong>No se encontraron categorías</strong>
            <small>
              Prueba con otra búsqueda o registra una nueva categoría.
            </small>
          </td>
        </tr>
      );
    }

    return categoriasFiltradas.map((categoria, indice) => {
      const activo = esActivo(categoria.activo);
      const procesando = procesandoId === categoria.id_categoria;

      return (
        <tr
          key={categoria.id_categoria}
          className="categorias-fila"
          style={{ animationDelay: `${Math.min(indice * 45, 350)}ms` }}
        >
          <td>
            <span className="categorias-id">
              #{String(categoria.id_categoria).padStart(3, '0')}
            </span>
          </td>

          <td>
            <div className="categorias-nombre-celda">
              <span className="categorias-nombre-icono">▤</span>
              <strong className="categorias-nombre">
                {categoria.nombre}
              </strong>
            </div>
          </td>

          <td className="categorias-descripcion">
            {categoria.descripcion?.trim() || 'Sin descripción'}
          </td>

          <td>
            <span className={`categorias-estado ${activo ? 'activo' : 'inactivo'}`}>
              <span />
              {activo ? 'Activa' : 'Inactiva'}
            </span>
          </td>

          <td>
            <div className="categorias-acciones">
              <button
                type="button"
                className="categorias-accion editar"
                onClick={() => abrirEdicion(categoria)}
                disabled={procesando}
                title="Editar categoría"
                aria-label={`Editar categoría ${categoria.nombre}`}
              >
                ✎
              </button>

              <button
                type="button"
                className={`categorias-accion ${activo ? 'desactivar' : 'activar'}`}
                onClick={() => void cambiarEstado(categoria)}
                disabled={procesando}
                title={activo ? 'Desactivar categoría' : 'Activar categoría'}
                aria-label={activo ? 'Desactivar categoría' : 'Activar categoría'}
              >
                {procesando ? '…' : activo ? '⊘' : '✓'}
              </button>

              <button
                type="button"
                className="categorias-accion eliminar"
                onClick={() => void eliminarCategoria(categoria)}
                disabled={procesando}
                title="Eliminar categoría"
                aria-label={`Eliminar categoría ${categoria.nombre}`}
              >
                ×
              </button>
            </div>
          </td>
        </tr>
      );
    });
  })();

  let textoBotonGuardar = 'Registrar categoría';

  if (guardando) {
    textoBotonGuardar = 'Guardando...';
  } else if (categoriaEditando !== null) {
    textoBotonGuardar = 'Guardar cambios';
  }

  return (
    <div className="categorias-page">
      <header className="categorias-header">
        <div className="categorias-header-copy">
          <span className="tw-eyebrow">GESTIÓN DEL CATÁLOGO</span>
          <h1>Categorías</h1>
          <p>
            Organiza y administra las categorías de productos de TUSA WOOD.
          </p>
        </div>

        <button
          type="button"
          className="categorias-btn-primary"
          onClick={abrirNuevaCategoria}
        >
          <span>＋</span>
          Nueva categoría
        </button>
      </header>

      <section className="categorias-resumen">
        <article className="categorias-resumen-card">
          <span className="categorias-resumen-icono naranja">▤</span>
          <div>
            <small>Total de categorías</small>
            <strong>{categorias.length}</strong>
            <span className="categorias-kpi-detalle">Registradas en el catálogo</span>
          </div>
        </article>

        <article className="categorias-resumen-card">
          <span className="categorias-resumen-icono verde">✓</span>
          <div>
            <small>Categorías activas</small>
            <strong>{totalActivas}</strong>
            <span className="categorias-kpi-detalle">Disponibles actualmente</span>
          </div>
        </article>

        <article className="categorias-resumen-card">
          <span className="categorias-resumen-icono gris">○</span>
          <div>
            <small>Categorías inactivas</small>
            <strong>{totalInactivas}</strong>
            <span className="categorias-kpi-detalle">No disponibles actualmente</span>
          </div>
        </article>
      </section>

      <section className="categorias-listado">
        <div className="categorias-listado-heading">
          <div>
            <span className="tw-eyebrow">ADMINISTRACIÓN</span>
            <h2>Listado de categorías</h2>
            <p>Consulta, filtra y administra las categorías registradas.</p>
          </div>

          <button
            type="button"
            className="categorias-btn-refresh"
            onClick={() => void cargarCategorias()}
            disabled={cargando}
          >
            <span className={cargando ? 'girando' : ''}>↻</span>
            Actualizar
          </button>
        </div>

        <div className="categorias-filtros">
          <label className="categorias-busqueda">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Buscar por nombre o descripción..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                aria-label="Limpiar búsqueda"
              >
                ×
              </button>
            )}
          </label>

          <label className="categorias-filtro-estado">
            <span>Estado:</span>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="todas">Todos los estados</option>
              <option value="activas">Activas</option>
              <option value="inactivas">Inactivas</option>
            </select>
          </label>
        </div>

        <div className="categorias-tabla-contenedor">
          <table className="categorias-tabla">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre de categoría</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>{contenidoListado}</tbody>
          </table>
        </div>

        <footer className="categorias-pie-tabla">
          <span>
            Mostrando <strong>{categoriasFiltradas.length}</strong> de{' '}
            <strong>{categorias.length}</strong> categorías
          </span>
          <span className="categorias-pie-indicador">
            <i />
            Catálogo actualizado
          </span>
        </footer>
      </section>

      {modalAbierto && (
        <div
          className="categorias-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              cerrarModal();
            }
          }}
        >
          <section
            className="categorias-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="categorias-modal-titulo"
          >
            <header className="categorias-modal-header">
              <div className="categorias-modal-icono">▤</div>

              <div className="categorias-modal-titulo">
                <span className="tw-eyebrow">CATÁLOGO TUSA WOOD</span>
                <h2 id="categorias-modal-titulo">
                  {categoriaEditando !== null
                    ? 'Editar categoría'
                    : 'Nueva categoría'}
                </h2>
                <p>Completa los datos para organizar tus productos.</p>
              </div>

              <button
                type="button"
                className="categorias-modal-cerrar"
                onClick={cerrarModal}
                disabled={guardando}
                aria-label="Cerrar formulario"
              >
                ×
              </button>
            </header>

            <form onSubmit={guardarCategoria}>
              <div className="categorias-formulario">
                <label className="categorias-campo">
                  <span>
                    Nombre de la categoría <b>*</b>
                  </span>
                  <input
                    type="text"
                    value={formulario.nombre}
                    onChange={(e) => actualizarCampo('nombre', e.target.value)}
                    placeholder="Ej. Parihuelas de madera"
                    maxLength={100}
                    required
                    autoFocus
                  />
                  <small>Utiliza un nombre claro y fácil de identificar.</small>
                </label>

                <label className="categorias-campo">
                  <span>Descripción</span>
                  <textarea
                    value={formulario.descripcion}
                    onChange={(e) => actualizarCampo('descripcion', e.target.value)}
                    placeholder="Describe brevemente esta categoría..."
                    rows={4}
                    maxLength={500}
                  />
                  <small>{formulario.descripcion.length}/500 caracteres</small>
                </label>
              </div>

              <footer className="categorias-modal-footer">
                <button
                  type="button"
                  className="categorias-btn-secundario"
                  onClick={cerrarModal}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="categorias-btn-primary"
                  disabled={guardando}
                >
                  {guardando && <span className="categorias-boton-spinner" />}
                  {textoBotonGuardar}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
