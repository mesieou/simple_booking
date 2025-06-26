//muestra la informacion de la empresa y los servicios que ofrece

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

export default function About() {
  const features = [
    { 
      key: 'feature_booking', 
      title: 'RESERVA EN LÍNEA',
      description: 'Sistema de reservas en línea fácil de usar para tus clientes' 
    },
    { 
      key: 'feature_schedule', 
      title: 'GESTIÓN DE HORARIOS',
      description: 'Administra tu disponibilidad y horarios de trabajo' 
    },
    { 
      key: 'feature_chatbot', 
      title: 'CHATBOT INTELIGENTE',
      description: 'Asistente virtual que ayuda a tus clientes con reservas' 
    },
    { 
      key: 'feature_roles', 
      title: 'GESTIÓN DE ROLES',
      description: 'Control de acceso y permisos para diferentes usuarios' 
    },
    { 
      key: 'feature_interface', 
      title: 'INTERFAZ INTUITIVA',
      description: 'Diseño moderno y fácil de navegar para todos los usuarios' 
    },
  ];

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Sobre Nosotros</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Somos una plataforma innovadora que simplifica la gestión de reservas y citas para empresas de todos los tamaños. Nuestro objetivo es conectar a profesionales con sus clientes de manera eficiente y sin complicaciones.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => (
            <Card key={index} className="text-center">
              <CardHeader>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
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
              <CardTitle className="text-2xl">Nuestra Misión</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-lg">
                Transformar la forma en que las empresas gestionan sus citas y reservas, proporcionando herramientas intuitivas que ahorran tiempo y mejoran la experiencia del cliente.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
} 