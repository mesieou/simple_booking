"use client";

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Smartphone, Zap, TrendingUp, Users, CheckCircle, Play, Star, ArrowRight, Target, BarChart3, Globe, Shield, Clock, Award, ChevronRight } from 'lucide-react';

const Option3LandingPage = () => {
  const heroRef = useRef(null);
  const metricsRef = useRef(null);
  const featuresRef = useRef(null);

  useEffect(() => {
    // Animación de entrada suave
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    });

    const elements = document.querySelectorAll('.fade-in');
    elements.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const metrics = [
    {
      number: "3x",
      label: "Mayor ROAS",
      description: "Mayor LTV"
    },
    {
      number: "85%",
      label: "Mayor tasa de conversión",
      description: "Mayor AOV"
    },
    {
      number: "55%",
      label: "Mayor valor del pedido",
      description: "Menores Costos"
    }
  ];

  const performanceMetrics = [
    {
      number: "3.6x",
      label: "Rentabilidad de la inversión publicitaria"
    },
    {
      number: "30%",
      label: "Menor costo por adquisición"
    },
    {
      number: "80%",
      label: "Menor costo por lead calificado"
    }
  ];

  const features = [
    {
      icon: <Target className="h-8 w-8" />,
      title: "Performance Audiences",
      description: "Aprovecha las audiencias con mejor rendimiento de Instagram y Facebook para atraer a WhatsApp a clientes listos para comprar."
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "Métricas en Tiempo Real",
      description: "Haz seguimiento de tus ROAS, CPA y CPL en tiempo real con datos cuantificables en cada etapa."
    },
    {
      icon: <Globe className="h-8 w-8" />,
      title: "Integración Meta API",
      description: "Utiliza CAPI (Conversions API) y MAPI (Marketing API) para mejorar el rendimiento de tus anuncios en Meta."
    }
  ];

  const benefits = [
    {
      title: "Conecta con clientes reales",
      description: "Llega directamente a los clientes con WhatsApp mediante números de teléfono, no clics anónimos."
    },
    {
      title: "Configuración perfecta, sin complicaciones",
      description: "Configuraremos tu marketing por WhatsApp de principio a fin, sin complicaciones."
    },
    {
      title: "Gestión de servicio completo",
      description: "Nos ocupamos de todo. Desde la gestión de los números de WhatsApp hasta el ajuste de las campañas publicitarias."
    }
  ];

  const testimonials = [
    {
      name: "María González",
      role: "Marketing Manager",
      company: "E-commerce Fashion",
      comment: "360Dialog ha revolucionado nuestro marketing. El ROAS aumentó 3x y las conversiones un 85%. Es increíble.",
      rating: 5
    },
    {
      name: "Carlos Rodríguez",
      role: "CEO",
      company: "Tech Startup",
      comment: "La integración con Meta API nos permite optimizar campañas en tiempo real. Resultados excepcionales.",
      rating: 5
    },
    {
      name: "Ana Martínez",
      role: "Digital Marketing Director",
      company: "Retail Chain",
      comment: "Performance Messaging ha transformado nuestra estrategia. Los clientes prefieren WhatsApp para decisiones de compra.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MessageCircle className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">SkedyBot</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#performance" className="text-foreground/80 hover:text-foreground transition-colors">Performance</a>
              <a href="#features" className="text-foreground/80 hover:text-foreground transition-colors">Características</a>
              <a href="#pricing" className="text-foreground/80 hover:text-foreground transition-colors">Precios</a>
              <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                Iniciar Sesión
              </Button>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Habla con un experto
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section ref={heroRef} className="py-20 px-4">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-8 bg-primary/20 text-primary border-primary/30 px-4 py-2">
            <Zap className="h-4 w-4 mr-2" />
            Performance Messaging
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight fade-in">
            Multiplica el retorno con
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent block">
              Performance Messaging
            </span>
          </h1>
          
          <p className="text-xl text-foreground/80 mb-12 max-w-4xl mx-auto fade-in">
            Olvídate de enviar clics a páginas de inicio. Consigue llegar a personas reales con los mensajes de WhatsApp, 
            la aplicación en la que confían miles de millones.
          </p>

          <p className="text-lg text-foreground/60 mb-12 max-w-3xl mx-auto fade-in">
            Con información de más de 40,000 empresas, ayudamos a los profesionales del marketing a crear un nuevo canal de crecimiento real.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16 fade-in">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-semibold">
              Hablemos de la estrategia
            </Button>
            <Button variant="outline" size="lg" className="border-primary/30 text-primary hover:bg-primary/10 px-8 py-4 text-lg font-semibold">
              Ver los casos de uso
            </Button>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section ref={metricsRef} className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {metrics.map((metric, index) => (
              <Card key={index} className="bg-card/50 border-border/50 backdrop-blur-sm fade-in">
                <CardContent className="p-8 text-center">
                  <div className="text-5xl font-bold text-primary mb-2">{metric.number}</div>
                  <div className="text-xl font-semibold text-card-foreground mb-2">{metric.label}</div>
                  <div className="text-card-foreground/60">{metric.description}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mb-16 fade-in">
            <h2 className="text-4xl font-bold mb-4">Optimizado para WhatsApp y Meta</h2>
            <p className="text-xl text-foreground/60 max-w-3xl mx-auto">
              Para los profesionales del marketing que exigen resultados, no hay nada como Performance Messaging
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {performanceMetrics.map((metric, index) => (
              <Card key={index} className="bg-card/50 border-border/50 backdrop-blur-sm fade-in">
                <CardContent className="p-8 text-center">
                  <div className="text-4xl font-bold text-primary mb-2">{metric.number}</div>
                  <div className="text-lg text-card-foreground">{metric.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12 text-sm text-foreground/60">
            Datos internos 2024: Comparación del valor del ciclo de vida del cliente (LTV) entre usuarios de WhatsApp vs. Web/App.
          </div>
        </div>
      </section>

      {/* Why WhatsApp Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-4xl font-bold mb-4">¿Por qué WhatsApp?</h2>
            <p className="text-xl text-foreground/60 max-w-3xl mx-auto">
              El nuevo canal preferido para los mercadólogos enfocados en resultados
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
            <div className="fade-in">
              <h3 className="text-3xl font-bold mb-6">Consigue convertir a personas reales, no solo clics</h3>
              <p className="text-lg text-foreground/60 mb-8">
                Perseguir clics es cosa del pasado: convierte clientes reales con mensajes de WhatsApp automatizados y personalizados.
              </p>
              
              <div className="space-y-6">
                {benefits.slice(0, 2).map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <CheckCircle className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-foreground mb-2">{benefit.title}</h4>
                      <p className="text-foreground/60">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="fade-in">
              <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                        <MessageCircle className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-card-foreground">SkedyBot</h3>
                        <p className="text-primary text-sm">Performance Messaging</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4 h-64 overflow-y-auto">
                    <div className="flex justify-start">
                      <div className="bg-muted text-foreground p-3 rounded-lg max-w-xs">
                        ¡Hola! Veo que estás interesado en nuestros servicios. ¿Te gustaría conocer más detalles?
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-primary text-primary-foreground p-3 rounded-lg max-w-xs">
                        Sí, me interesa. ¿Cuáles son los precios?
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-muted text-foreground p-3 rounded-lg max-w-xs">
                        Perfecto. Nuestros planes comienzan desde $29/mes. ¿Te gustaría que te envíe un catálogo completo?
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-primary text-primary-foreground p-3 rounded-lg max-w-xs">
                        Sí, por favor. Mi email es cliente@ejemplo.com
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-muted text-foreground p-3 rounded-lg max-w-xs">
                        ¡Excelente! Te envío el catálogo ahora mismo. También puedes agendar una demo gratuita.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="fade-in">
              <h3 className="text-3xl font-bold mb-6">Impacto cuantificable en cada etapa</h3>
              <p className="text-lg text-foreground/60 mb-8">
                Obtén las métricas que importan. Haz un seguimiento de cada interacción de WhatsApp con datos en tiempo real 
                y métricas de rendimiento conocidas, para que puedas tomar decisiones rápidas basadas en datos.
              </p>
              
              <div className="space-y-6">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      {feature.icon}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h4>
                      <p className="text-foreground/60">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="fade-in">
              <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-card-foreground mb-6">Métricas en Tiempo Real</h3>
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <span className="text-card-foreground/60">ROAS</span>
                      <span className="text-2xl font-bold text-primary">3.6x</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-card-foreground/60">CPA</span>
                      <span className="text-2xl font-bold text-primary">-30%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-card-foreground/60">Conversiones</span>
                      <span className="text-2xl font-bold text-primary">+85%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-card-foreground/60">LTV</span>
                      <span className="text-2xl font-bold text-primary">+55%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Performance Messaging Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-4xl font-bold mb-4">Performance Messaging</h2>
            <p className="text-xl text-foreground/60 max-w-3xl mx-auto">
              Logra más, simplemente hablando
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <Card className="bg-card/50 border-border/50 backdrop-blur-sm fade-in">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
                  <Target className="h-8 w-8 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-card-foreground mb-4">Proceso completo</h3>
                <p className="text-card-foreground/60">
                  Acompaña a los clientes con comodidad, desde el descubrimiento hasta la compra
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50 backdrop-blur-sm fade-in">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
                  <MessageCircle className="h-8 w-8 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-card-foreground mb-4">Conversaciones bidireccionales</h3>
                <p className="text-card-foreground/60">
                  Conecta con personas reales, no solo con clics
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50 backdrop-blur-sm fade-in">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
                  <BarChart3 className="h-8 w-8 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-card-foreground mb-4">Atribución completa</h3>
                <p className="text-card-foreground/60">
                  Optimizado para Meta con métricas completas
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center fade-in">
            <p className="text-lg text-foreground/60 mb-8 max-w-3xl mx-auto">
              Con 360Dialog, WhatsApp es más que una simple aplicación de mensajería: es tu nuevo canal de rendimiento 
              donde cada conversación genera un crecimiento cuantificable.
            </p>
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-semibold">
              Hablemos de estrategia
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16 fade-in">
            <h2 className="text-4xl font-bold mb-4">Lo que dicen nuestros clientes</h2>
            <p className="text-xl text-foreground/60">
              Descubre cómo Performance Messaging está transformando negocios
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-card/50 border-border/50 backdrop-blur-sm fade-in">
                <CardContent className="p-8">
                  <div className="flex justify-center mb-6">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-card-foreground/80 text-lg mb-6 italic">
                    "{testimonial.comment}"
                  </p>
                  <div>
                    <p className="text-card-foreground font-semibold">{testimonial.name}</p>
                    <p className="text-card-foreground/60">{testimonial.role}</p>
                    <p className="text-card-foreground/60">{testimonial.company}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto text-center">
          <Card className="bg-gradient-to-r from-primary/20 to-secondary/20 border-primary/30 backdrop-blur-sm">
            <CardContent className="p-16">
              <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Ve un paso por delante con Performance Messaging
              </h2>
              <p className="text-xl text-foreground/80 mb-10 max-w-3xl mx-auto">
                ¿Listo para ir en cabeza? Conecta con tus clientes en WhatsApp, la aplicación en la que confían para tomar decisiones. 
                Utiliza Performance Messaging para impulsar las conversiones, aumentar el ROI y superar a la competencia.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-semibold">
                  Hablemos de estrategia
                </Button>
                <Button variant="outline" size="lg" className="border-primary/30 text-primary hover:bg-primary/10 px-8 py-4 text-lg font-semibold">
                  Ver los casos de uso
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/20 bg-card/50 backdrop-blur-sm py-16 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <MessageCircle className="h-8 w-8 text-primary" />
                <span className="text-2xl font-bold text-foreground">SkedyBot</span>
              </div>
              <p className="text-foreground/60 text-lg leading-relaxed">
                Performance Messaging para WhatsApp Business. 
                Conecta con clientes reales y maximiza tu ROI.
              </p>
            </div>
            
            <div>
              <h3 className="text-foreground font-semibold text-lg mb-6">Performance Messaging</h3>
              <ul className="space-y-3 text-foreground/60">
                <li><a href="#" className="hover:text-foreground transition-colors">¿Por qué WhatsApp?</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Soluciones de rendimiento</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Casos de uso</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Preguntas frecuentes</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-foreground font-semibold text-lg mb-6">Soluciones API</h3>
              <ul className="space-y-3 text-foreground/60">
                <li><a href="#" className="hover:text-foreground transition-colors">WhatsApp Business API</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Documentación</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Entorno de pruebas</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Estado del sistema</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-foreground font-semibold text-lg mb-6">Empresa</h3>
              <ul className="space-y-3 text-foreground/60">
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacidad</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contacto</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Empleo</a></li>
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

export default Option3LandingPage;
