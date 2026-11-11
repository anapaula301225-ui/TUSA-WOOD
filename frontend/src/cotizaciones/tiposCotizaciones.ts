
import type {
  CotizacionAdmin,
  ProductoDetalleCotizacion,
} from '../services/api';

export type Registro = Record<string, any>;

export interface Cotizacion extends CotizacionAdmin {
  detalles?: ProductoDetalleCotizacion[];
  nombre_cliente?: string;
  cliente?: string;
  email?: string;
  observaciones?: string;
  fecha?: string;
}

export interface RespuestaLista {
  cotizaciones?: Cotizacion[];
  data?: Cotizacion[];
}

export interface ResumenGeneral {
  total: number;
  pendientes: number;
  atencion: number;
  cotizadas: number;
  aceptadas: number;
}

export interface VersionDetalle {
  version: Registro;
  productos: Registro[];
  servicios: Registro[];
  aprobaciones: Registro[];
}
