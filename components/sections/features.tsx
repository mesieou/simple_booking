'use client';

import React from 'react';
import { MessageCircle, TrendingUp, Calendar, Users } from 'lucide-react';
import { useLanguage } from '@/lib/rename-categorise-better/utils/translations/language-context';

const features_app = [
  {
    id: 'whatsapp_ia',
    key: 'whatsapp_ia',
    title: 'WhatsApp AI Agent',
    description: 'Our AI agent integrates with WhatsApp to automate responses and enhance customer service.',
    icon: MessageCircle,
    gradient: 'from-green-500/50 to-green-600/50',
    link: '/features/whatsapp-ia'
  },
  {
    id: 'dynamic_pricing',
    key: 'dynamic_pricing',
    title: 'Dynamic Pricing',
    description: 'Intelligent pricing system that automatically adjusts based on demand and market conditions.',
    icon: TrendingUp,
    gradient: 'from-red-500/50 to-orange-500/50',
    link: '/features/precios-dinamicos'
  },
  {
    id: 'calendar',
    key: 'calendar',
    title: 'Calendar Management',
    description: 'Efficient calendar administration with real-time management and automatic synchronization.',
    icon: Calendar,
    gradient: 'from-teal-500/50 to-cyan-600/50',
    link: '/features/calendarios'
  },
  {
    id: 'team',
    key: 'team',
    title: 'Team Management',
    description: 'Collaborative platform that enables efficient management of multiple users and work teams.',
    icon: Users,
    gradient: 'from-purple-500/50 to-indigo-600/50',
    link: '/features/equipos'
  }
] as const;

export default function Features_App() {
  const { t } = useLanguage();

  return (
    <section className="relative py-24 overflow-hidden backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 relative z-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 drop-shadow-lg">
          Innovative solutions for your business
          </h2>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-8">
          {features_app.map((feature) => {
            const IconComponent = feature.icon;
            
            return (
              <div
                key={feature.id}
                className="group relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2.5rem] p-8 text-center transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl hover:shadow-black/20 hover:border-white/30"
              >
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-[2.5rem] z-10"></div>
                
                {/* Content */}
                <div className="relative z-20">
                  {/* Icon */}
                  <div className={`w-20 h-20 mx-auto mb-6 rounded-[1.5rem] bg-gradient-to-br ${feature.gradient} flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-black/30`}>
                    <IconComponent className="w-10 h-10 text-primary-foreground" strokeWidth={2} />
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-foreground mb-5 leading-tight">
                    {t(`features.${feature.key}.title`)}
                  </h3>

                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed mb-6 text-sm">
                    {t(`features.${feature.key}.description`)}
                  </p>

                  {/* Link */}
                  <a
                    href={feature.link}
                    className="inline-flex items-center gap-2 text-primary font-semibold transition-all duration-300 hover:text-primary/80 group-hover:translate-x-1"
                  >
                    {t('features.learn_more')}
                    <svg
                      className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
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
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Background decorative elements */}
      <div className="absolute top-1/4 left-0 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
    </section>
  );
} 