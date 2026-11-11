import { useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import type { Producto, Servicio } from '../services/api';
import { alertas } from '../utils/alertas';

type DatosProducto = {
  id_producto: number | null;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number;
  precio_unitario: number;
};

type DatosServicio = {
  id_servicio: number;
  descripcion: string | null;
  cantidad: number;
  precio_unitario: number;
};

interface EditorLineasCotizacionProps {
  productos: Producto[];
  servicios: Servicio[];
  procesando: boolean;
  estiloCampo: CSSProperties;
  onAgregarProducto: (datos: DatosProducto) => Promise<boolean>;
  onAgregarServicio: (datos: DatosServicio) => Promise<boolean>;
  mostrarProductos?: boolean;
  mostrarServicios?: boolean;
}

export default function EditorLineasCotizacion({
  productos,
  servicios,
  procesando,
  estiloCampo,
  onAgregarProducto,
  onAgregarServicio,
  mostrarProductos = true,
  mostrarServicios = true,
}: EditorLineasCotizacionProps) {
  const [productoId, setProductoId] = useState('');
  const [productoNombre, setProductoNombre] = useState('');
  const [productoDescripcion, setProductoDescripcion] = useState('');
  const [productoCantidad, setProductoCantidad] = useState('1');
  const [productoPrecio, setProductoPrecio] = useState('0');

  const [servicioId, setServicioId] = useState('');
  const [servicioDescripcion, setServicioDescripcion] = useState('');
  const [servicioCantidad, setServicioCantidad] = useState('1');
  const [servicioPrecio, setServicioPrecio] = useState('0');

  async function agregarProducto(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const cantidad = Number(productoCantidad);
    const precio = Number(productoPrecio);
    const itemCatalogo = productos.find((item) => item.id_producto === Number(productoId));
    const nombre = itemCatalogo?.nombre || productoNombre.trim();

    if (!nombre || !Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(precio) || precio < 0) {
      await alertas.advertencia('Datos del producto inválidos', 'Selecciona un producto o escribe el nombre de uno personalizado. La cantidad debe ser mayor que cero y el precio no puede ser negativo.');
      return;
    }

    const agregado = await onAgregarProducto({
      id_producto: itemCatalogo ? itemCatalogo.id_producto : null,
      nombre_producto: nombre,
      descripcion: productoDescripcion.trim() || itemCatalogo?.descripcion || null,
      cantidad,
      precio_unitario: precio,
    });

    if (agregado) {
      setProductoId('');
      setProductoNombre('');
      setProductoDescripcion('');
      setProductoCantidad('1');
      setProductoPrecio('0');
    }
  }

  async function agregarServicio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const id = Number(servicioId);
    const cantidad = Number(servicioCantidad);
    const precio = Number(servicioPrecio);
    if (!id || !Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(precio) || precio < 0) {
      await alertas.advertencia('Datos del servicio inválidos', 'Selecciona un servicio, indica una cantidad mayor que cero y un precio no negativo.');
      return;
    }

    const agregado = await onAgregarServicio({
      id_servicio: id,
      descripcion: servicioDescripcion.trim() || null,
      cantidad,
      precio_unitario: precio,
    });

    if (agregado) {
      setServicioId('');
      setServicioDescripcion('');
      setServicioCantidad('1');
      setServicioPrecio('0');
    }
  }

  return (
    <>
      {mostrarProductos && (
        <section className="quote-detail-section">
          <h3>Agregar producto a la versión</h3>
          <p className="quote-message">Puedes seleccionar un producto del catálogo o registrar uno personalizado.</p>
          <form onSubmit={(evento) => void agregarProducto(evento)}>
            <div className="tusa-line-editor-grid">
              <label>
                <span>Producto del catálogo</span>
                <select
                  value={productoId}
                  onChange={(evento) => {
                    const valor = evento.target.value;
                    setProductoId(valor);
                    const item = productos.find((producto) => producto.id_producto === Number(valor));
                    if (item) {
                      setProductoNombre(item.nombre);
                      setProductoDescripcion(item.descripcion || '');
                    }
                  }}
                  style={estiloCampo}
                >
                  <option value="">Producto personalizado</option>
                  {productos.map((producto) => (
                    <option key={producto.id_producto} value={producto.id_producto}>
                      {producto.codigo} — {producto.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Nombre del producto</span>
                <input value={productoNombre} onChange={(evento) => setProductoNombre(evento.target.value)} disabled={Boolean(productoId)} placeholder="Nombre del producto" style={estiloCampo} />
              </label>
              <label>
                <span>Cantidad</span>
                <input type="number" min="0.01" step="0.01" value={productoCantidad} onChange={(evento) => setProductoCantidad(evento.target.value)} style={estiloCampo} />
              </label>
              <label>
                <span>Precio unitario (S/)</span>
                <input type="number" min="0" step="0.01" value={productoPrecio} onChange={(evento) => setProductoPrecio(evento.target.value)} style={estiloCampo} />
              </label>
              <label className="tusa-line-editor-wide">
                <span>Descripción / especificaciones</span>
                <textarea rows={2} value={productoDescripcion} onChange={(evento) => setProductoDescripcion(evento.target.value)} style={{ ...estiloCampo, height: 'auto' }} />
              </label>
            </div>
            <button type="submit" className="quote-save-button" disabled={procesando} style={{ marginTop: 12 }}>
              {procesando ? 'Procesando...' : 'Agregar producto'}
            </button>
          </form>
        </section>
      )}

      {mostrarServicios && (
        <section className="quote-detail-section">
          <h3>Agregar servicio a la versión</h3>
          <form onSubmit={(evento) => void agregarServicio(evento)}>
            <div className="tusa-line-editor-grid">
              <label>
                <span>Servicio</span>
                <select value={servicioId} onChange={(evento) => setServicioId(evento.target.value)} style={estiloCampo}>
                  <option value="">Selecciona un servicio</option>
                  {servicios.map((servicio) => (
                    <option key={servicio.id_servicio} value={servicio.id_servicio}>{servicio.nombre}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Cantidad</span>
                <input type="number" min="0.01" step="0.01" value={servicioCantidad} onChange={(evento) => setServicioCantidad(evento.target.value)} style={estiloCampo} />
              </label>
              <label>
                <span>Precio unitario (S/)</span>
                <input type="number" min="0" step="0.01" value={servicioPrecio} onChange={(evento) => setServicioPrecio(evento.target.value)} style={estiloCampo} />
              </label>
              <label className="tusa-line-editor-wide">
                <span>Descripción</span>
                <textarea rows={2} value={servicioDescripcion} onChange={(evento) => setServicioDescripcion(evento.target.value)} style={{ ...estiloCampo, height: 'auto' }} />
              </label>
            </div>
            <button type="submit" className="quote-save-button" disabled={procesando} style={{ marginTop: 12 }}>
              {procesando ? 'Procesando...' : 'Agregar servicio'}
            </button>
          </form>
        </section>
      )}
    </>
  );
}
