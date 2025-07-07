"use client";

import { useState } from 'react';
import { useTypewriter, Cursor } from 'react-simple-typewriter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { 
  MessageCircle, 
  Smartphone, 
  Zap, 
  Shield, 
  Users, 
  Clock, 
  CheckCircle, 
  Play, 
  Star, 
  ArrowRight,
  Bot,
  Calendar,
  DollarSign,
  Globe,
  Headphones,
  TrendingUp,
  Rocket,
  Sparkles
} from 'lucide-react';

const Option7LandingPage = () => {
  const heroTexts = [
    "Automatiza tu WhatsApp",
    "Responde 24/7 con IA",
    "Aumenta tus ventas",
    "Reduce costos operativos"
  ];

  const [text] = useTypewriter({
    words: heroTexts,
    loop: true,
    typeSpeed: 80,
    deleteSpeed: 50,
    delaySpeed: 2000,
  });

  const features = [
    {
      icon: <Bot className="h-6 w-6" />,
      title: "IA Conversacional",
      description: "Chatbot inteligente que entiende y responde como un humano"
    },
    {
      icon: <Calendar className="h-6 w-6" />,
      title: "Reservas Automáticas",
      description: "Gestiona calendarios y reservas sin intervención manual"
    },
    {
      icon: <DollarSign className="h-6 w-6" />,
      title: "Ventas Inteligentes",
      description: "Convierte consultas en ventas automáticamente"
    },
    {
      icon: <Globe className="h-6 w-6" />,
      title: "Multilenguaje",
      description: "Atención en español, inglés y más idiomas"
    },
    {
      icon: <Headphones className="h-6 w-6" />,
      title: "Soporte 24/7",
      description: "Nunca más pierdas un cliente por no responder"
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Analytics Avanzados",
      description: "Métricas detalladas de conversiones y engagement"
    }
  ];

  const benefits = [
    {
      icon: <Rocket className="h-8 w-8" />,
      title: "Implementación Rápida",
      description: "Configuración en menos de 15 minutos"
    },
    {
      icon: <DollarSign className="h-8 w-8" />,
      title: "Ahorro de Costos",
      description: "Reduce gastos en atención al cliente hasta 70%"
    },
    {
      icon: <TrendingUp className="h-8 w-8" />,
      title: "Aumento de Ventas",
      description: "Incrementa conversiones en un 40% promedio"
    },
    {
      icon: <Clock className="h-8 w-8" />,
      title: "Tiempo Libre",
      description: "Enfócate en tu negocio, no en responder mensajes"
    }
  ];

  const testimonials = [
    {
      name: "María González",
      business: "Salón de Belleza Elegance",
      rating: 5,
      comment: "El chatbot ha revolucionado mi negocio. Mis clientes reciben respuestas inmediatas y las reservas han aumentado un 40%.",
      metrics: "40% más reservas"
    },
    {
      name: "Carlos Rodríguez",
      business: "Taller Mecánico Pro",
      rating: 5,
      comment: "Ya no pierdo clientes por no responder a tiempo. El bot maneja todas las consultas básicas perfectamente.",
      metrics: "0 clientes perdidos"
    },
    {
      name: "Ana Martínez",
      business: "Restaurante La Terraza",
      rating: 5,
      comment: "Increíble herramienta. Mis clientes pueden hacer reservas y consultar el menú sin esperar.",
      metrics: "60% menos tiempo de respuesta"
    }
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "Gratis",
      period: "por siempre",
      features: [
        "100 mensajes/mes",
        "Respuestas básicas",
        "Integración WhatsApp",
        "Soporte por email"
      ],
      cta: "Comenzar Gratis"
    },
    {
      name: "Pro",
      price: "$29",
      period: "/mes",
      features: [
        "1000 mensajes/mes",
        "IA avanzada",
        "Reservas automáticas",
        "Soporte prioritario",
        "Analytics básicos",
        "Múltiples idiomas"
      ],
      popular: true,
      cta: "Comenzar Prueba Gratis"
    },
    {
      name: "Enterprise",
      price: "$79",
      period: "/mes",
      features: [
        "Mensajes ilimitados",
        "IA personalizada",
        "Múltiples canales",
        "Soporte 24/7",
        "Analytics avanzados",
        "Integraciones API",
        "White-label"
      ],
      cta: "Contactar Ventas"
    }
  ];

  const faqs = [
    {
      question: "¿Cómo funciona la integración con WhatsApp?",
      answer: "Conectamos directamente con tu WhatsApp Business API. Solo necesitas autorizar la conexión y configurar las respuestas automáticas."
    },
    {
      question: "¿El chatbot puede manejar reservas complejas?",
      answer: "Sí, nuestro IA puede gestionar reservas con múltiples opciones, fechas, horarios y confirmaciones automáticas."
    },
    {
      question: "¿Qué idiomas soporta?",
      answer: "Actualmente soportamos español, inglés, portugués y francés. Puedes configurar el idioma según tu audiencia."
    },
    {
      question: "¿Puedo personalizar las respuestas?",
      answer: "Absolutamente. Puedes crear respuestas personalizadas, agregar tu tono de marca y configurar flujos específicos."
    },
    {
      question: "¿Hay límite de mensajes?",
      answer: "El plan gratuito incluye 100 mensajes/mes. Los planes pagos incluyen más volumen y el Enterprise es ilimitado."
    },
    {
      question: "¿Qué tan rápido es el setup?",
      answer: "La configuración básica toma menos de 15 minutos. Nuestro equipo te ayuda con la configuración avanzada."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <MessageCircle className="h-8 w-8 text-purple-400" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <span className="text-xl font-bold text-white">ChatBot Pro</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-white/80 hover:text-white transition-colors">Características</a>
              <a href="#benefits" className="text-white/80 hover:text-white transition-colors">Beneficios</a>
              <a href="#pricing" className="text-white/80 hover:text-white transition-colors">Precios</a>
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Iniciar Sesión
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10"></div>
        <div className="container mx-auto text-center relative z-10">
          <Badge variant="secondary" className="mb-6 bg-purple-500/20 text-purple-300 border-purple-500/30">
            <Sparkles className="h-3 w-3 mr-1" />
            IA Revolucionaria para WhatsApp
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {text}
            </span>
            <Cursor cursorColor="#a855f7" />
          </h1>
          
          <p className="text-xl text-white/80 mb-8 max-w-3xl mx-auto">
            Conecta tu WhatsApp Business con IA avanzada. Responde automáticamente, 
            gestiona reservas y aumenta tus ventas sin esfuerzo.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3 group">
                  <Play className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                  Ver Demo en Vivo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Demo Interactivo del Chatbot</DialogTitle>
                  <DialogDescription className="text-slate-300">
                    Experimenta cómo nuestro chatbot maneja consultas en tiempo real
                  </DialogDescription>
                </DialogHeader>
                <div className="bg-slate-900 rounded-lg p-6 h-96 overflow-y-auto">
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <div className="bg-green-500 text-white p-3 rounded-lg max-w-xs">
                        Hola, ¿tienen disponibilidad para mañana a las 2pm?
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-slate-700 text-white p-3 rounded-lg max-w-xs">
                        ¡Hola! Gracias por contactarnos. Déjame verificar la disponibilidad para mañana a las 2pm.
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-slate-700 text-white p-3 rounded-lg max-w-xs">
                        ✅ Sí tenemos disponibilidad. ¿Te gustaría hacer una reserva? Solo necesito tu nombre y número de teléfono.
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-green-500 text-white p-3 rounded-lg max-w-xs">
                        Perfecto, me llamo María y mi número es 555-0123
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-slate-700 text-white p-3 rounded-lg max-w-xs">
                        ¡Excelente María! Tu reserva está confirmada para mañana a las 2pm. Te enviaré un recordatorio 1 hora antes.
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-slate-700 text-white p-3 rounded-lg max-w-xs">
                        📅 Reserva confirmada: María - Mañana 2:00 PM
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 px-8 py-3">
              Ver Video Tutorial
            </Button>
          </div>

          <div className="flex items-center justify-center space-x-8 text-white/60">
            <div className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              <span>+500 negocios confían en nosotros</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span>99.9% tiempo activo</span>
            </div>
            <div className="flex items-center">
              <Zap className="h-5 w-5 mr-2" />
              <span>Respuesta en &lt;2 segundos</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Todo lo que necesitas para automatizar tu negocio
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Nuestro chatbot inteligente maneja todas las tareas repetitivas 
              para que puedas enfocarte en lo que realmente importa.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-white/5 border-white/10 backdrop-blur-xl hover:bg-white/10 transition-all group">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-white/70">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4 bg-white/5">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              ¿Por qué elegir nuestro chatbot?
            </h2>
            <p className="text-xl text-white/60">
              Descubre los beneficios que transformarán tu negocio
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <Card key={index} className="bg-white/5 border-white/10 backdrop-blur-xl text-center hover:bg-white/10 transition-all">
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white mx-auto mb-6">
                    {benefit.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">{benefit.title}</h3>
                  <p className="text-white/70">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-white mb-6">
                Ve cómo funciona en acción
              </h2>
              <p className="text-xl text-white/60 mb-8">
                Nuestro chatbot maneja consultas complejas, reservas y ventas 
                de manera natural y eficiente.
              </p>
              
              <Tabs defaultValue="reservas" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-slate-800">
                  <TabsTrigger value="reservas" className="text-white">Reservas</TabsTrigger>
                  <TabsTrigger value="ventas" className="text-white">Ventas</TabsTrigger>
                  <TabsTrigger value="soporte" className="text-white">Soporte</TabsTrigger>
                </TabsList>
                
                <TabsContent value="reservas" className="mt-6">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="flex justify-end">
                          <div className="bg-green-500 text-white p-2 rounded-lg text-sm">
                            ¿Puedo reservar para 4 personas el sábado?
                          </div>
                        </div>
                        <div className="flex justify-start">
                          <div className="bg-slate-700 text-white p-2 rounded-lg text-sm">
                            ¡Por supuesto! ¿A qué hora prefieres? Tenemos disponibilidad a las 7pm y 9pm.
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="ventas" className="mt-6">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="flex justify-end">
                          <div className="bg-green-500 text-white p-2 rounded-lg text-sm">
                            ¿Cuánto cuesta el servicio premium?
                          </div>
                        </div>
                        <div className="flex justify-start">
                          <div className="bg-slate-700 text-white p-2 rounded-lg text-sm">
                            El servicio premium cuesta $150. Incluye: ✅ Tratamiento completo ✅ Productos premium ✅ Seguimiento personalizado
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="soporte" className="mt-6">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="flex justify-end">
                          <div className="bg-green-500 text-white p-2 rounded-lg text-sm">
                            ¿Puedo cancelar mi cita?
                          </div>
                        </div>
                        <div className="flex justify-start">
                          <div className="bg-slate-700 text-white p-2 rounded-lg text-sm">
                            Sí, puedes cancelar hasta 24 horas antes sin cargo. ¿Cuál es tu número de reserva?
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
            
            <div className="relative">
              <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <MessageCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">ChatBot Pro</h3>
                      <p className="text-green-400 text-sm">En línea</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  </div>
                </div>
                
                <div className="space-y-4 h-64 overflow-y-auto">
                  <div className="flex justify-start">
                    <div className="bg-slate-700 text-white p-3 rounded-lg max-w-xs">
                      ¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-green-500 text-white p-3 rounded-lg max-w-xs">
                      Hola, quiero hacer una reserva
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-slate-700 text-white p-3 rounded-lg max-w-xs">
                      ¡Perfecto! ¿Para cuántas personas y qué fecha prefieres?
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 flex space-x-2">
                  <input 
                    type="text" 
                    placeholder="Escribe tu mensaje..." 
                    className="flex-1 bg-slate-700 text-white p-3 rounded-lg border-none focus:ring-2 focus:ring-purple-500"
                  />
                  <Button className="bg-green-500 hover:bg-green-600">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-white/5">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Lo que dicen nuestros clientes
            </h2>
            <p className="text-xl text-white/60">
              Descubre cómo ChatBot Pro está transformando negocios
            </p>
          </div>

          <Carousel className="w-full max-w-4xl mx-auto">
            <CarouselContent>
              {testimonials.map((testimonial, index) => (
                <CarouselItem key={index}>
                  <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                    <CardContent className="p-8">
                      <div className="flex justify-center mb-4">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                        ))}
                      </div>
                      <p className="text-white/80 text-lg mb-6 italic text-center">
                        "{testimonial.comment}"
                      </p>
                      <div className="text-center mb-4">
                        <p className="text-white font-semibold">{testimonial.name}</p>
                        <p className="text-white/60">{testimonial.business}</p>
                      </div>
                      <div className="text-center">
                        <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
                          {testimonial.metrics}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700" />
            <CarouselNext className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700" />
          </Carousel>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Planes que se adaptan a tu negocio
            </h2>
            <p className="text-xl text-white/60">
              Comienza gratis y escala según crezcas
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative bg-white/5 border-white/10 backdrop-blur-xl hover:bg-white/10 transition-all ${
                  plan.popular ? 'ring-2 ring-purple-500 scale-105' : ''
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-500 text-white">
                    Más Popular
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-white text-2xl">{plan.name}</CardTitle>
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-white/60 ml-1">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center text-white/80">
                        <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className={`w-full ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600' 
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-white/5">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Preguntas Frecuentes
            </h2>
            <p className="text-xl text-white/60">
              Todo lo que necesitas saber sobre nuestro chatbot
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {faqs.map((faq, index) => (
              <Card key={index} className="bg-white/5 border-white/10 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-white text-lg">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-white/70">
                    {faq.answer}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <Card className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30 backdrop-blur-xl">
            <CardContent className="p-12">
              <h2 className="text-4xl font-bold text-white mb-4">
                ¿Listo para automatizar tu negocio?
              </h2>
              <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
                Únete a cientos de negocios que ya están usando ChatBot Pro para 
                mejorar su atención al cliente y aumentar sus ventas.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3">
                  Comenzar Gratis
                </Button>
                <Button variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 px-8 py-3">
                  Hablar con Ventas
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-white/5 py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <MessageCircle className="h-6 w-6 text-purple-400" />
                <span className="text-xl font-bold text-white">ChatBot Pro</span>
              </div>
              <p className="text-white/60">
                Automatiza tu negocio con IA avanzada y WhatsApp Business.
              </p>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Producto</h3>
              <ul className="space-y-2 text-white/60">
                <li><a href="#" className="hover:text-white transition-colors">Características</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Precios</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integraciones</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Soporte</h3>
              <ul className="space-y-2 text-white/60">
                <li><a href="#" className="hover:text-white transition-colors">Centro de Ayuda</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentación</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contacto</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Estado</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Empresa</h3>
              <ul className="space-y-2 text-white/60">
                <li><a href="#" className="hover:text-white transition-colors">Acerca de</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Carreras</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacidad</a></li>
              </ul>
            </div>
          </div>
          
          <Separator className="my-8 bg-white/10" />
          
          <div className="flex flex-col md:flex-row justify-between items-center text-white/60">
            <p>&copy; 2024 ChatBot Pro. Todos los derechos reservados.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="hover:text-white transition-colors">Términos</a>
              <a href="#" className="hover:text-white transition-colors">Privacidad</a>
              <a href="#" className="hover:text-white transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Option7LandingPage;
