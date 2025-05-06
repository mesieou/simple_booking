import Image from 'next/image';
import Link from 'next/link';

const features_app = [
  {
    id: 1,
    title: "Agente WhatsApp IA",
    description: "Nuestro agente de IA integrado con WhatsApp automatiza respuestas, gestiona consultas y mejora la experiencia del cliente las 24/7.",
    image: "/images/whatsapp-ia.png",
    link: "/features/whatsapp-ia"
  },
  {
    id: 2,
    title: "Precios Dinámicos",
    description: "Sistema inteligente de precios que se ajusta automáticamente según la demanda, temporada y otros factores del mercado.",
    image: "/images/precios-dinamicos.png",
    link: "/features/precios-dinamicos"
  },
  {
    id: 3,
    title: "Manejo de Calendarios",
    description: "Gestión eficiente de calendarios con sincronización en tiempo real, recordatorios automáticos y disponibilidad en línea.",
    image: "/images/calendarios.png",
    link: "/features/calendarios"
  },
  {
    id: 4,
    title: "Multiusuario y Gestión de Equipos",
    description: "Plataforma colaborativa que permite gestionar múltiples usuarios, asignar roles y monitorear el rendimiento del equipo.",
    image: "/images/equipos.png",
    link: "/features/equipos"
  }
];

export default function Features_App() {
  return (
    <section className="py-16" style={{ backgroundColor: 'silver' }}>
      <div className="container mx-auto px-4">
        {/* <h2 className="text-3xl font-bold text-center mb-12">Características Principales del dato</h2> */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features_app.map((feature) => (
            <div key={feature.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="relative h-48">
                <Image
                  src={feature.image}
                  alt={feature.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2 bg-black text-white px-2 py-1 rounded">{feature.title}</h3>
                <p className="text-gray-600 mb-4">{feature.description}</p>
                <Link 
                  href={feature.link}
                  className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center"
                >
                  Saber más
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
} 