import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DetalleCotizacionModalProps {
  onClose: () => void;
  disabled?: boolean;
  children: ReactNode;
}

export default function DetalleCotizacionModal({
  onClose,
  disabled = false,
  children,
}: DetalleCotizacionModalProps) {
  return createPortal(
    <div className="quote-modal-overlay">
      <button
        type="button"
        className="quote-modal-backdrop"
        onClick={onClose}
        disabled={disabled}
        aria-label="Cerrar detalle de cotización"
        tabIndex={-1}
      />
      {children}
    </div>,
    document.body,
  );
}
