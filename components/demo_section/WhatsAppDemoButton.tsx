import { FaWhatsapp } from "react-icons/fa";

const WHATSAPP_DEMO_URL = "https://wa.me/1234567890"; // Change to the real number

const WhatsAppDemoButton = () => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      (e.target as HTMLAnchorElement).click();
    }
  };

  return (
    <a
      href={WHATSAPP_DEMO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-3 px-8 py-3 rounded-full font-semibold text-white bg-gradient-to-r from-green-400 to-green-600 shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition hover:from-green-500 hover:to-green-700"
      aria-label="Demo on WhatsApp"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <span className="relative flex items-center justify-center">
        <span className="absolute w-10 h-10 rounded-full bg-green-500/20 animate-ping" />
        <FaWhatsapp className="relative z-10 w-6 h-6" />
      </span>
      Demo on WhatsApp
    </a>
  );
};

export default WhatsAppDemoButton; 