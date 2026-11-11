import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface FormularioCotizacionModalProps {
  abierto: boolean;
  onClose: () => void;
  titulo: string;
  subtitulo?: string;
  estado: string;
  disabled: boolean;
  children: ReactNode;
}

/**
 * Modal para armar (VENTAS) o revisar (GERENCIA) una versión de
 * cotización. Se dibuja encima del detalle de la solicitud.
 */
export default function FormularioCotizacionModal({
  abierto,
  onClose,
  titulo,
  subtitulo,
  estado,
  disabled,
  children,
}: FormularioCotizacionModalProps) {
  if (!abierto) return null;

  return createPortal(
    <div className="quote-modal-overlay">
      <button
        type="button"
        className="quote-modal-backdrop"
        onClick={onClose}
        aria-label="Cerrar cotización"
        tabIndex={-1}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-armado-titulo"
        className="quote-modal"
        style={{ maxWidth: 980 }}
      >
        <header className="quote-modal-header">
          <div>
            <span className="quotes-eyebrow">COTIZACIÓN</span>
            <h2 id="quote-armado-titulo">{titulo}</h2>
            {subtitulo && <p>{subtitulo}</p>}
          </div>

          <button
            type="button"
            className="quote-modal-close"
            onClick={onClose}
            aria-label="Cerrar cotización"
          >
            ×
          </button>
        </header>

        <div className="quote-modal-body">
          <div
            className="quote-version-editor"
            data-version-state={estado}
            data-readonly={disabled ? 'true' : 'false'}
          >
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}