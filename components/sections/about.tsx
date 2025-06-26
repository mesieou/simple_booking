//muestra la informacion de la empresa y los servicios que ofrece

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { t } from "@/lib/rename-categorise-better/utils/translations";

export default function About() {
  const features = [
    { key: 'feature_booking', description: t('about.feature_booking') },
    { key: 'feature_schedule', description: t('about.feature_schedule') },
    { key: 'feature_chatbot', description: t('about.feature_chatbot') },
    { key: 'feature_roles', description: t('about.feature_roles') },
    { key: 'feature_interface', description: t('about.feature_interface') },
  ];

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">{t('about')}</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            {t('about.description')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => (
            <Card key={index} className="text-center">
              <CardHeader>
                <CardTitle className="text-lg">{feature.key.replace('feature_', '').replace(/_/g, ' ').toUpperCase()}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Our Mission</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-lg">
                {t('about.mission')}
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
} 