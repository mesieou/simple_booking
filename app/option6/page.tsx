"use client";
import Image from "next/image";

const benefits = [
  { icon: "🤖", label: "AI Chatbot" },
  { icon: "📅", label: "Automate bookings and calendars" },
  { icon: "💬", label: "Automate customer services" },
  { icon: "🕑", label: "24/7 Customer Service" },
  { icon: "🌎", label: "Multilenguage" },
  { icon: "💸", label: "Más barato que una persona" },
  { icon: "📈", label: "Increase Sales" },
  { icon: "🙋‍♂️", label: "Atención personalizada" },
  { icon: "❓", label: "FAQ queries" },
  { icon: "📝", label: "Cotización" },
  { icon: "📆", label: "Reservas" },
  { icon: "💳", label: "Pagos" },
  { icon: "✅", label: "Disponibilidad" },
];

const companyLogos = [
  { src: "/favicon.png", alt: "Logo Empresa 1" },
  { src: "/public/icons_size/house.png", alt: "Logo Empresa 2" },
  { src: "/public/icons_size/one_item.png", alt: "Logo Empresa 3" },
  { src: "/public/icons_size/few_items.png", alt: "Logo Empresa 4" },
];

const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, onClick: () => void) => {
  if (event.key === "Enter" || event.key === " ") {
    onClick();
  }
};

const Option6Landing = () => {
  return (
    <main className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* Header/Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Image src="/favicon.png" alt="Logo" width={40} height={40} />
          <span className="font-bold text-xl tracking-tight">simple booking</span>
        </div>
        <ul className="hidden md:flex gap-6 text-base font-medium">
          <li><a href="#precios" className="hover:text-primary">Precios</a></li>
          <li><a href="#caracteristicas" className="hover:text-primary">Características</a></li>
          <li><a href="#soluciones" className="hover:text-primary">Soluciones</a></li>
          <li><a href="#integraciones" className="hover:text-primary">Integraciones</a></li>
          <li><a href="#afiliados" className="hover:text-primary">Afiliados/Partners</a></li>
        </ul>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary focus:outline-none"
            aria-label="Reserva una demo"
            tabIndex={0}
            onClick={() => alert("Demo reservada")}
            onKeyDown={e => handleKeyDown(e, () => alert("Demo reservada"))}
          >
            Reserva una demo
          </button>
          <button
            className="btn btn-primary focus:outline-none"
            aria-label="Prueba gratuita"
            tabIndex={0}
            onClick={() => alert("Prueba gratuita iniciada")}
            onKeyDown={e => handleKeyDown(e, () => alert("Prueba gratuita iniciada"))}
          >
            Prueba gratuita
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex flex-col md:flex-row items-center justify-between px-6 md:px-16 py-12 bg-white bg-grid-pattern">
        <div className="max-w-xl flex-1">
          <div className="inline-block bg-pink-100 text-pink-700 font-semibold rounded px-3 py-1 mb-4">Wati para soporte</div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
            Deja que la <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">IA</span> maneje tus conversaciones con los clientes
          </h1>
          <p className="text-lg text-gray-700 mb-6">
            Responde preguntas de los clientes, resuelve problemas y transfiere consultas complejas a tu equipo, sin esfuerzo manual.
          </p>
          <div className="flex gap-4 mb-8">
            <button
              className="btn btn-primary focus:outline-none"
              aria-label="Prueba gratuita de 7 días"
              tabIndex={0}
              onClick={() => alert("Prueba gratuita de 7 días")}
              onKeyDown={e => handleKeyDown(e, () => alert("Prueba gratuita de 7 días"))}
            >
              Prueba gratuita de 7 días
            </button>
            <button
              className="btn btn-secondary focus:outline-none"
              aria-label="Reserva una demo"
              tabIndex={0}
              onClick={() => alert("Demo reservada")}
              onKeyDown={e => handleKeyDown(e, () => alert("Demo reservada"))}
            >
              Reserva una demo
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">WhatsApp</span>
            <span className="inline-flex items-center bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">AI Chatbot</span>
            <span className="inline-flex items-center bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">Automate bookings</span>
            <span className="inline-flex items-center bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">24/7 Service</span>
            <span className="inline-flex items-center bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-sm font-medium">Multilenguage</span>
          </div>
        </div>
        <div className="flex-1 flex justify-center mt-10 md:mt-0">
          <Image
            src="/public/images/calendarios.png"
            alt="Calendario automatizado"
            width={320}
            height={320}
            className="rounded-2xl shadow-lg"
          />
        </div>
      </section>

      {/* Beneficios Section */}
      <section className="py-12 px-6 md:px-16 bg-gradient-to-r from-pink-50 to-purple-50" id="caracteristicas">
        <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">Beneficios</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-center gap-4 bg-white rounded-xl shadow p-4">
              <span className="text-3xl" aria-label={b.label}>{b.icon}</span>
              <span className="font-medium text-lg">{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Logos de confianza */}
      <section className="py-10 px-6 md:px-16 bg-white border-t border-gray-100">
        <h3 className="text-lg md:text-xl font-semibold text-center mb-6">
          Más de 12,000 empresas confían en simple booking para escalar el soporte sin aumentar los costos
        </h3>
        <div className="flex flex-wrap justify-center gap-8 items-center">
          {companyLogos.map((logo, i) => (
            <Image
              key={i}
              src={logo.src}
              alt={logo.alt}
              width={80}
              height={80}
              className="object-contain"
            />
          ))}
        </div>
      </section>
    </main>
  );
};

export default Option6Landing;
