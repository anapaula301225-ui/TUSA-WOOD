import type { ReactNode } from 'react';

interface HistorialCotizacionProps {
  titulo: string;
  children: ReactNode;
}

export default function HistorialCotizacion({
  titulo,
  children,
}: HistorialCotizacionProps) {
  return (
    <section className="quote-detail-section">
      <h3>{titulo}</h3>
      {children}
    </section>
  );
}
