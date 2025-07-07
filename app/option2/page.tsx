"use client";

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TextPlugin } from 'gsap/TextPlugin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MessageCircle, Smartphone, Zap, Shield, Users, CheckCircle, Play, Star, ArrowRight, Bot, Sparkles, Target, TrendingUp } from 'lucide-react';

// Registrar plugins de GSAP
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, TextPlugin);
}

const Option2LandingPage = () => {
  const heroRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const ctaRef = useRef(null);
  const featuresRef = useRef(null);
  const demoRef = useRef(null);
  const testimonialsRef = useRef(null);
  const pricingRef = useRef(null);
  const floatingElementsRef = useRef(null);

  useEffect(() => {
    // Animación del hero
    const heroTl = gsap.timeline();
    
    heroTl
      .fromTo(heroRef.current, 
        { opacity: 0, y: 100 }, 
        { opacity: 1, y: 0, duration: 1, ease: "power3.out" }
      )
      .fromTo(titleRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 0.8, ease: "back.out(1.7)" },
        "-=0.5"
      )
      .fromTo(subtitleRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6 },
        "-=0.3"
      )
      .fromTo(ctaRef.current,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" },
        "-=0.2"
      );

    // Animación de elementos flotantes
    gsap.to(floatingElementsRef.current, {
      y: -20,
      duration: 2,
      ease: "power2.inOut",
      yoyo: true,
      repeat: -1
    });

    // Animación de características con ScrollTrigger
    gsap.fromTo(featuresRef.current?.children,
      { opacity: 0, y: 100 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: featuresRef.current,
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none reverse"
        }
      }
    );

    // Animación del demo
    gsap.fromTo(demoRef.current,
      { opacity: 0, x: -100 },
      {
        opacity: 1,
        x: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: demoRef.current,
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none reverse"
        }
      }
    );

    // Animación de testimonios
    gsap.fromTo(testimonialsRef.current?.children,
      { opacity: 0, scale: 0.8 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.6,
        stagger: 0.3,
        ease: "back.out(1.7)",
        scrollTrigger: {
          trigger: testimonialsRef.current,
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none reverse"
        }
      }
    );

    // Animación de precios
    gsap.fromTo(pricingRef.current?.children,
      { opacity: 0, y: 50 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: pricingRef.current,
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none reverse"
        }
      }
    );

    // Parallax effect para elementos de fondo
    gsap.to(".parallax-bg", {
      yPercent: -50,
      ease: "none",
      scrollTrigger: {
        trigger: "body",
        start: "top top",
        end: "bottom top",
        scrub: true
      }
    });

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  const features = [
    {
      icon: <Bot className="h-8 w-8" />,
      title: "IA Avanzada",
      description: "Chatbot inteligente que aprende y mejora con cada conversación"
    },
    {
      icon: <Smartphone className="h-8 w-8" />,
      title: "WhatsApp Business",
      description: "Integración nativa con WhatsApp Business API"
    },
    {
      icon: <Zap className="h-8 w-8" />,
      title: "Respuestas Instantáneas",
      description: "Resuelve consultas en milisegundos, no en horas"
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Seguridad Total",
      description: "Encriptación end-to-end y cumplimiento GDPR"
    },
    {
      icon: <Target className="h-8 w-8" />,
      title: "Personalización",
      description: "Adapta el chatbot a tu marca y necesidades específicas"
    },
    {
      icon: <TrendingUp className="h-8 w-8" />,
      title: "Analytics Avanzados",
      description: "Métricas detalladas para optimizar tu atención al cliente"
    }
  ];

  const testimonials = [
    {
      name: "María González",
      business: "Salón de Belleza Elegance",
      rating: 5,
      comment: "El chatbot ha revolucionado mi negocio. Las reservas han aumentado un 60% y mis clientes están encantados con la atención instantánea.",
      avatar: "MG"
    },
    {
      name: "Carlos Rodríguez",
      business: "Taller Mecánico Pro",
      rating: 5,
      comment: "Ya no pierdo clientes por no responder a tiempo. El bot maneja todas las consultas básicas y me permite enfocarme en el trabajo técnico.",
      avatar: "CR"
    },
    {
      name: "Ana Martínez",
      business: "Restaurante La Esquina",
      rating: 5,
      comment: "Increíble herramienta. Mis clientes pueden hacer reservas, consultar el menú y recibir confirmaciones sin esperar. ¡Altamente recomendado!",
      avatar: "AM"
    }
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "Gratis",
      period: "para siempre",
      features: [
        "100 mensajes/mes",
        "Respuestas básicas",
        "Integración WhatsApp",
        "Soporte por email",
        "1 chatbot"
      ],
      popular: false
    },
    {
      name: "Professional",
      price: "$29",
      period: "por mes",
      features: [
        "1,000 mensajes/mes",
        "IA avanzada",
        "Reservas automáticas",
        "Soporte prioritario",
        "Analytics básicos",
        "3 chatbots"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: "$79",
      period: "por mes",
      features: [
        "Mensajes ilimitados",
        "IA personalizada",
        "Múltiples canales",
        "Soporte 24/7",
        "Analytics avanzados",
        "Integraciones API",
        "Chatbots ilimitados"
      ],
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Elementos flotantes de fondo */}
      <div ref={floatingElementsRef} className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary/10 rounded-full blur-xl"></div>
        <div className="absolute top-40 right-20 w-32 h-32 bg-secondary/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-40 left-1/4 w-16 h-16 bg-primary/20 rounded-full blur-lg"></div>
        <div className="absolute bottom-20 right-1/3 w-24 h-24 bg-secondary/20 rounded-full blur-xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/20 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <MessageCircle className="h-8 w-8 text-primary" />
                <Sparkles className="h-4 w-4 text-secondary absolute -top-1 -right-1" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                SkedyBot
              </span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-foreground/80 hover:text-foreground transition-colors">Características</a>
              <a href="#demo" className="text-foreground/80 hover:text-foreground transition-colors">Demo</a>
              <a href="#pricing" className="text-foreground/80 hover:text-foreground transition-colors">Precios</a>
              <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                Iniciar Sesión
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section ref={heroRef} className="relative py-20 px-4 min-h-screen flex items-center">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-8 bg-primary/20 text-primary border-primary/30 px-4 py-2">
            <Zap className="h-4 w-4 mr-2" />
            IA Revolucionaria para WhatsApp Business
          </Badge>
          
          <h1 ref={titleRef} className="text-6xl md:text-8xl font-bold mb-8 leading-tight">
            Automatiza tu
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent block">
              Negocio
            </span>
          </h1>
          
          <p ref={subtitleRef} className="text-xl text-foreground/80 mb-12 max-w-4xl mx-auto text-lg">
            Conecta tu WhatsApp Business con IA avanzada. Responde automáticamente, 
            gestiona reservas y aumenta tus ventas sin esfuerzo. El futuro de la atención al cliente está aquí.
          </p>

          <div ref={ctaRef} className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="lg" className="bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-primary-foreground px-10 py-4 text-lg font-semibold shadow-2xl hover:shadow-primary/25 transition-all duration-300">
                  <Play className="h-6 w-6 mr-3" />
                  Probar Demo Interactivo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-2xl text-card-foreground">Demo del Chatbot de WhatsApp</DialogTitle>
                  <DialogDescription className="text-card-foreground/70">
                    Experimenta cómo nuestro chatbot maneja consultas complejas en tiempo real
                  </DialogDescription>
                </DialogHeader>
                <div className="bg-muted rounded-xl p-8 h-96 overflow-y-auto">
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <div className="bg-primary text-primary-foreground p-4 rounded-2xl max-w-xs shadow-lg">
                        Hola, ¿tienen disponibilidad para mañana a las 2pm para un corte de cabello?
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-card text-card-foreground p-4 rounded-2xl max-w-xs shadow-lg border border-border">
                        ¡Hola! Gracias por contactarnos. Déjame verificar la disponibilidad para mañana a las 2pm.
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-card text-card-foreground p-4 rounded-2xl max-w-xs shadow-lg border border-border">
                        ✅ Sí tenemos disponibilidad. ¿Te gustaría hacer una reserva? Solo necesito tu nombre y número de teléfono.
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-primary text-primary-foreground p-4 rounded-2xl max-w-xs shadow-lg">
                        Perfecto, me llamo María y mi número es 555-0123
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-card text-card-foreground p-4 rounded-2xl max-w-xs shadow-lg border border-border">
                        ¡Excelente María! Tu reserva está confirmada para mañana a las 2pm. Te enviaré un recordatorio 1 hora antes.
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-card text-card-foreground p-4 rounded-2xl max-w-xs shadow-lg border border-border">
                        📅 Reserva confirmada: María - Mañana 2:00 PM - Corte de Cabello
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" size="lg" className="border-primary/30 text-primary hover:bg-primary/10 px-10 py-4 text-lg font-semibold">
              Ver Video Demo
            </Button>
          </div>

          <div className="flex items-center justify-center space-x-12 text-foreground/60">
            <div className="flex items-center">
              <Users className="h-6 w-6 mr-3 text-primary" />
              <span className="text-lg">+500 negocios confían en nosotros</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 mr-3 text-primary" />
              <span className="text-lg">99.9% tiempo activo</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" ref={featuresRef} className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Todo lo que necesitas para automatizar tu negocio
            </h2>
            <p className="text-xl text-foreground/60 max-w-3xl mx-auto">
              Nuestro chatbot inteligente maneja todas las tareas repetitivas 
              para que puedas enfocarte en lo que realmente importa: hacer crecer tu negocio.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-card/50 border-border/50 backdrop-blur-xl hover:bg-card/80 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-primary/10">
                <CardHeader>
                  <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center text-primary-foreground mb-6 shadow-lg">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-2xl text-card-foreground">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-card-foreground/70 text-lg leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" ref={demoRef} className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-5xl font-bold mb-8 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Ve cómo funciona en acción
              </h2>
              <p className="text-xl text-foreground/60 mb-10 leading-relaxed">
                Nuestro chatbot maneja consultas complejas, reservas y ventas 
                de manera natural y eficiente. Experimenta la magia de la IA en tiempo real.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">Reservas Automáticas</h3>
                    <p className="text-foreground/60">Gestiona citas sin intervención humana</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-secondary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">Ventas Inteligentes</h3>
                    <p className="text-foreground/60">Convierte consultas en ventas automáticamente</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">Soporte 24/7</h3>
                    <p className="text-foreground/60">Atención ininterrumpida para tus clientes</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-card rounded-3xl p-8 border border-border shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                      <MessageCircle className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-card-foreground">SkedyBot</h3>
                      <p className="text-primary text-sm font-medium">En línea • IA Activa</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  </div>
                </div>
                
                <div className="space-y-4 h-80 overflow-y-auto mb-6">
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground p-4 rounded-2xl max-w-xs shadow-lg">
                      ¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground p-4 rounded-2xl max-w-xs shadow-lg">
                      Hola, quiero hacer una reserva para 4 personas
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground p-4 rounded-2xl max-w-xs shadow-lg">
                      ¡Perfecto! ¿Para qué fecha y hora prefieres? Tenemos disponibilidad este fin de semana.
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground p-4 rounded-2xl max-w-xs shadow-lg">
                      El sábado a las 8pm estaría bien
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground p-4 rounded-2xl max-w-xs shadow-lg">
                      Excelente elección. ¿Cuál es tu nombre y número de teléfono para confirmar la reserva?
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <input 
                    type="text" 
                    placeholder="Escribe tu mensaje..." 
                    className="flex-1 bg-muted text-foreground p-4 rounded-2xl border border-border focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground p-4 rounded-2xl shadow-lg">
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section ref={testimonialsRef} className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Lo que dicen nuestros clientes
            </h2>
            <p className="text-xl text-foreground/60">
              Descubre cómo SkedyBot está transformando negocios en todo el mundo
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-card/50 border-border/50 backdrop-blur-xl hover:bg-card/80 transition-all duration-300 hover:scale-105">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center text-primary-foreground text-xl font-bold mx-auto mb-6">
                    {testimonial.avatar}
                  </div>
                  <div className="flex justify-center mb-6">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-card-foreground/80 text-lg mb-8 italic leading-relaxed">
                    "{testimonial.comment}"
                  </p>
                  <div>
                    <p className="text-card-foreground font-semibold text-lg">{testimonial.name}</p>
                    <p className="text-card-foreground/60">{testimonial.business}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" ref={pricingRef} className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Planes que se adaptan a tu negocio
            </h2>
            <p className="text-xl text-foreground/60">
              Comienza gratis y escala según crezca tu negocio
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative bg-card/50 border-border/50 backdrop-blur-xl hover:bg-card/80 transition-all duration-300 hover:scale-105 ${
                  plan.popular ? 'ring-2 ring-primary shadow-2xl shadow-primary/20' : ''
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-primary to-secondary text-primary-foreground px-6 py-2 text-sm font-semibold">
                    Más Popular
                  </Badge>
                )}
                <CardHeader className="text-center pt-8">
                  <CardTitle className="text-3xl text-card-foreground mb-2">{plan.name}</CardTitle>
                  <div className="flex items-baseline justify-center space-x-1">
                    <span className="text-5xl font-bold text-card-foreground">{plan.price}</span>
                    <span className="text-card-foreground/60">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4 mb-10">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center text-card-foreground/80">
                        <CheckCircle className="h-5 w-5 text-primary mr-4 flex-shrink-0" />
                        <span className="text-lg">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className={`w-full py-4 text-lg font-semibold ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-primary-foreground shadow-lg' 
                        : 'bg-card/50 hover:bg-card/80 text-card-foreground border border-border'
                    }`}
                  >
                    {plan.price === "Gratis" ? "Comenzar Gratis" : "Comenzar Ahora"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <Card className="bg-gradient-to-r from-primary/20 to-secondary/20 border-primary/30 backdrop-blur-xl">
            <CardContent className="p-16">
              <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                ¿Listo para automatizar tu negocio?
              </h2>
              <p className="text-xl text-foreground/80 mb-10 max-w-3xl mx-auto leading-relaxed">
                Únete a cientos de negocios que ya están usando SkedyBot para 
                mejorar su atención al cliente y aumentar sus ventas. El futuro de la atención al cliente está aquí.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <Button size="lg" className="bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-primary-foreground px-12 py-4 text-xl font-semibold shadow-2xl hover:shadow-primary/25">
                  Comenzar Gratis
                </Button>
                <Button variant="outline" size="lg" className="border-primary/30 text-primary hover:bg-primary/10 px-12 py-4 text-xl font-semibold">
                  Hablar con Ventas
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/20 bg-card/50 backdrop-blur-xl py-16 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <MessageCircle className="h-8 w-8 text-primary" />
                <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  SkedyBot
                </span>
              </div>
              <p className="text-foreground/60 text-lg leading-relaxed">
                Automatiza tu negocio con IA avanzada y WhatsApp Business. 
                El futuro de la atención al cliente está aquí.
              </p>
            </div>
            
            <div>
              <h3 className="text-foreground font-semibold text-lg mb-6">Producto</h3>
              <ul className="space-y-3 text-foreground/60">
                <li><a href="#" className="hover:text-foreground transition-colors">Características</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Precios</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Integraciones</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-foreground font-semibold text-lg mb-6">Soporte</h3>
              <ul className="space-y-3 text-foreground/60">
                <li><a href="#" className="hover:text-foreground transition-colors">Centro de Ayuda</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Documentación</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contacto</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Estado</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-foreground font-semibold text-lg mb-6">Empresa</h3>
              <ul className="space-y-3 text-foreground/60">
                <li><a href="#" className="hover:text-foreground transition-colors">Acerca de</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Carreras</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacidad</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border/20 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-foreground/60">
            <p>&copy; 2024 SkedyBot. Todos los derechos reservados.</p>
            <div className="flex space-x-8 mt-4 md:mt-0">
              <a href="#" className="hover:text-foreground transition-colors">Términos</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacidad</a>
              <a href="#" className="hover:text-foreground transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Option2LandingPage;
