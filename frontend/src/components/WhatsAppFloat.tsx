
import './WhatsAppFloat.css';

const telefono = '51904797199';

const mensaje =
  'Hola, TUSA WOOD. Me gustaría obtener información sobre sus productos y servicios. ¿Podrían brindarme más detalles, por favor?';

const enlaceWhatsApp = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;

export default function WhatsAppFloat() {
  return (
    <a
      className="whatsapp-float"
      href={enlaceWhatsApp}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar con TUSA WOOD por WhatsApp"
      title="Contáctanos por WhatsApp"
    >
      <svg
        viewBox="0 0 32 32"
        width="31"
        height="31"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M16.02 3C8.85 3 3.02 8.81 3.02 15.96c0 2.28.6 4.5 1.74 6.47L3 29l6.77-1.73a13.02 13.02 0 0 0 6.25 1.6h.01C23.2 28.87 29 23.06 29 15.92 29 8.8 23.18 3 16.02 3Zm0 23.7c-1.94 0-3.85-.52-5.52-1.52l-.4-.24-4.02 1.03 1.07-3.9-.26-.41a10.7 10.7 0 0 1-1.65-5.7c0-5.93 4.83-10.75 10.78-10.75 2.88 0 5.58 1.12 7.62 3.16a10.66 10.66 0 0 1 3.16 7.6c0 5.93-4.83 10.75-10.78 10.75Zm5.9-8.05c-.32-.16-1.9-.94-2.2-1.05-.3-.1-.52-.16-.74.16-.22.32-.84 1.05-1.03 1.26-.19.22-.38.24-.7.08-.33-.16-1.38-.5-2.62-1.59-.97-.86-1.62-1.92-1.81-2.24-.19-.32-.02-.5.14-.66.14-.14.32-.38.48-.57.16-.19.22-.32.33-.54.1-.21.05-.4-.03-.56-.08-.16-.74-1.77-1.01-2.42-.27-.63-.54-.55-.74-.56h-.63c-.22 0-.57.08-.87.4-.3.32-1.14 1.1-1.14 2.69 0 1.58 1.17 3.11 1.33 3.33.16.21 2.3 3.5 5.57 4.9.78.33 1.38.53 1.85.68.78.25 1.49.22 2.05.13.63-.1 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.14-.3-.22-.63-.38Z" />
      </svg>
    </a>
  );
}
