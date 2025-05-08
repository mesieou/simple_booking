'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/lib/language-context';

const features_app = [
  {
    id: 1,
    key: 'whatsapp_ia',
    image: "/images/whatsapp-ia.png",
    link: "/features/whatsapp-ia"
  },
  {
    id: 2,
    key: 'dynamic_pricing',
    image: "/images/precios-dinamicos.png",
    link: "/features/precios-dinamicos"
  },
  {
    id: 3,
    key: 'calendar',
    image: "/images/calendarios.png",
    link: "/features/calendarios"
  },
  {
    id: 4,
    key: 'team',
    image: "/images/equipos.png",
    link: "/features/equipos"
  }
] as const;

export default function Features_App() {
  const { t } = useLanguage();

  return (
    <section className="py-16 bg-gradient-to-b from-background to-background/80">
      <div className="container mx-auto px-4">
        {/* <h2 className="text-3xl font-bold text-center mb-12">Características Principales del dato</h2> */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features_app.map((feature) => (
            <div 
              key={feature.id} 
              className="group relative bg-card rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="relative h-48 overflow-hidden">
                <Image
                  src={feature.image}
                  alt={t(`features.${feature.key}.title`)}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-3 text-[rgb(250,204,21)]">
                  {t(`features.${feature.key}.title`)}
                </h3>
                <p className="text-muted-foreground mb-4 line-clamp-3">
                  {t(`features.${feature.key}.description`)}
                </p>
                <Link 
                  href={feature.link}
                  className="inline-flex items-center text-[rgb(250,204,21)] hover:text-[rgb(250,204,21)]/80 transition-colors duration-200"
                >
                  {t('features.learn_more')}
                  <svg 
                    className="w-4 h-4 ml-2 transform transition-transform duration-200 group-hover:translate-x-1" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 5l7 7-7 7" 
                    />
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