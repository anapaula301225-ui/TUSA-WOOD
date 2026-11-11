
import Swal, { type SweetAlertIcon } from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import './alertas.css';
const opcionesBase = {
  heightAuto: false,
  confirmButtonColor: '#f07832',
  cancelButtonColor: '#64748b',
  color: '#263238',
  background: '#ffffff',
  showClass: {
    popup: 'tusa-alerta-entrada',
  },
  hideClass: {
    popup: 'tusa-alerta-salida',
  },
  customClass: {
    popup: 'tusa-alerta-popup',
    title: 'tusa-alerta-titulo',
    htmlContainer: 'tusa-alerta-contenido',
    confirmButton: 'tusa-alerta-confirmar',
    cancelButton: 'tusa-alerta-cancelar',
  },
};

function limpiarTexto(texto: string): string {
  return texto.trim();
}

export const alertas = {
  async bienvenida(): Promise<boolean> {
    const resultado = await Swal.fire({
      ...opcionesBase,
      icon: 'success',
      title: '¡Bienvenido a TUSA WOOD!',
      text: 'Tu plataforma de gestión está lista.',
      confirmButtonText: 'Continuar',
      allowOutsideClick: false,
    });

    return resultado.isConfirmed;
  },

  async exito(
    titulo = '¡Operación exitosa!',
    mensaje = 'Los cambios se guardaron correctamente.'
  ): Promise<void> {
    await Swal.fire({
      ...opcionesBase,
      icon: 'success',
      title: limpiarTexto(titulo),
      text: limpiarTexto(mensaje),
      confirmButtonText: 'Aceptar',
    });
  },

  async error(
    titulo = 'Ha ocurrido un error',
    mensaje = 'No fue posible completar la operación.'
  ): Promise<void> {
    await Swal.fire({
      ...opcionesBase,
      icon: 'error',
      title: limpiarTexto(titulo),
      text: limpiarTexto(mensaje),
      confirmButtonText: 'Entendido',
    });
  },

  async advertencia(
    titulo = 'Atención',
    mensaje = 'Verifica la información ingresada.'
  ): Promise<void> {
    await Swal.fire({
      ...opcionesBase,
      icon: 'warning',
      title: limpiarTexto(titulo),
      text: limpiarTexto(mensaje),
      confirmButtonText: 'Entendido',
    });
  },

  async informacion(
    titulo = 'Información',
    mensaje = ''
  ): Promise<void> {
    await Swal.fire({
      ...opcionesBase,
      icon: 'info',
      title: limpiarTexto(titulo),
      text: limpiarTexto(mensaje),
      confirmButtonText: 'Aceptar',
    });
  },

  async confirmar(
    titulo: string,
    mensaje: string,
    textoConfirmar = 'Sí, continuar'
  ): Promise<boolean> {
    const resultado = await Swal.fire({
      ...opcionesBase,
      icon: 'warning',
      title: limpiarTexto(titulo),
      text: limpiarTexto(mensaje),
      showCancelButton: true,
      confirmButtonText: textoConfirmar,
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: true,
    });

    return resultado.isConfirmed;
  },

  cargando(
    titulo = 'Procesando...',
    mensaje = 'Por favor, espera un momento.'
  ): void {
    Swal.fire({
      ...opcionesBase,
      title: limpiarTexto(titulo),
      text: limpiarTexto(mensaje),
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
  },

  async notificacion(
    titulo: string,
    icono: SweetAlertIcon = 'success'
  ): Promise<void> {
    await Swal.fire({
      ...opcionesBase,
      toast: true,
      position: 'top-end',
      icon: icono,
      title: limpiarTexto(titulo),
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      customClass: {
        popup: 'tusa-alerta-toast',
        title: 'tusa-alerta-toast-titulo',
      },
    });
  },

  cerrar(): void {
    Swal.close();
  },
};
