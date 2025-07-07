"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  MessageCircle, 
  Smartphone, 
  Zap, 
  Shield, 
  Users, 
  CheckCircle, 
  Play, 
  Star, 
  ArrowRight, 
  Calendar,
  Clock,
  DollarSign,
  Globe,
  Brain,
  CreditCard,
  FileText,
  Phone,
  Mail,
  MapPin,
  Timer,
  TrendingUp,
  UserCheck,
  Lock,
  Wifi,
  Battery,
  Signal,
  Languages,
  Calculator,
  CreditCard as PaymentIcon,
  CalendarDays,
  HelpCircle,
  Quote,
  BookOpen,
  Target,
  BarChart3,
  Rocket,
  Sparkles,
  Heart,
  Award,
  ChevronRight,
  ChevronDown,
  Plus,
  Minus
} from 'lucide-react';

const Option5LandingPage = () => {
  const [activeTab, setActiveTab] = useState("reservas");

  const benefits = [
    {
      icon: <MessageCircle className="h-8 w-8" />,
      title: "WhatsApp Business",
      description: "Integración nativa con la plataforma más popular del mundo",
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      icon: <Brain className="h-8 w-8" />,
      title: "AI Chatbot Inteligente",
      description: "IA avanzada que entiende y responde como un humano",
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      icon: <Calendar className="h-8 w-8" />,
      title: "Reservas Automáticas",
      description: "Gestiona tu calendario sin intervención manual",
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    {
      icon: <Clock className="h-8 w-8" />,
      title: "Servicio 24/7",
      description: "Atención ininterrumpida todos los días del año",
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    },
    {
      icon: <UserCheck className="h-8 w-8" />,
      title: "Atención Personalizada",
      description: "Cada cliente recibe atención individualizada",
      color: "text-pink-600",
      bgColor: "bg-pink-100"
    },
    {
      icon: <TrendingUp className="h-8 w-8" />,
      title: "Aumenta Ventas",
      description: "Convierte consultas en reservas automáticamente",
      color: "text-emerald-600",
      bgColor: "bg-emerald-100"
    },
    {
      icon: <Globe className="h-8 w-8" />,
      title: "Multilingüe",
      description: "Atiende clientes en múltiples idiomas",
      color: "text-indigo-600",
      bgColor: "bg-indigo-100"
    },
    {
      icon: <DollarSign className="h-8 w-8" />,
      title: "Más Barato que una Persona",
      description: "Reduce costos operativos significativamente",
      color: "text-red-600",
      bgColor: "bg-red-100"
    }
  ];

  const features = [
    {
      icon: <HelpCircle className="h-6 w-6" />,
      title: "FAQ Automáticas",
      description: "Responde preguntas frecuentes sin intervención",
      examples: ["Horarios de atención", "Políticas de cancelación", "Servicios disponibles"]
    },
    {
      icon: <Calculator className="h-6 w-6" />,
      title: "Cotizaciones",
      description: "Genera presupuestos automáticamente",
      examples: ["Cálculo de precios", "Descuentos aplicables", "Opciones de pago"]
    },
    {
      icon: <CalendarDays className="h-6 w-6" />,
      title: "Reservas",
      description: "Gestiona citas y reservas en tiempo real",
      examples: ["Verificación de disponibilidad", "Confirmación automática", "Recordatorios"]
    },
    {
      icon: <PaymentIcon className="h-6 w-6" />,
      title: "Pagos",
      description: "Procesa pagos de forma segura",
      examples: ["Múltiples métodos de pago", "Facturación automática", "Comprobantes"]
    },
    {
      icon: <Timer className="h-6 w-6" />,
      title: "Disponibilidad",
      description: "Muestra horarios en tiempo real",
      examples: ["Calendario dinámico", "Bloqueos automáticos", "Sincronización"]
    }
  ];

  const testimonials = [
    {
      name: "Carlos Mendoza",
      business: "Restaurante El Sabor",
      savings: "70% menos en costos",
      improvement: "300% más reservas",
      comment: "SkedyBot maneja todas nuestras reservas y consultas. Es como tener 3 empleados trabajando 24/7 por una fracción del costo."
    },
    {
      name: "Ana Silva",
      business: "Salón de Belleza Glamour",
      savings: "60% reducción de costos",
      improvement: "250% más clientes",
      comment: "La atención personalizada que ofrece el chatbot es increíble. Mis clientes no notan que están hablando con una IA."
    },
    {
      name: "Miguel Torres",
      business: "Taller Mecánico Rápido",
      savings: "80% menos gastos",
      improvement: "400% más citas",
      comment: "El soporte multilingüe nos permite atender a clientes de diferentes nacionalidades sin problemas."
    }
  ];

  const pricing = [
    {
      name: "Starter",
      price: "$29",
      period: "/mes",
      description: "Perfecto para pequeños negocios",
      features: [
        "500 mensajes/mes",
        "Reservas básicas",
        "1 idioma",
        "Soporte por email",
        "FAQ básicas"
      ],
      popular: false
    },
    {
      name: "Professional",
      price: "$79",
      period: "/mes",
      description: "Ideal para negocios en crecimiento",
      features: [
        "2000 mensajes/mes",
        "Reservas avanzadas",
        "3 idiomas",
        "Cotizaciones automáticas",
        "Pagos integrados",
        "Soporte prioritario",
        "Analytics básicos"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: "$199",
      period: "/mes",
      description: "Para grandes operaciones",
      features: [
        "Mensajes ilimitados",
        "Todas las funciones",
        "Idiomas ilimitados",
        "API personalizada",
        "Soporte 24/7",
        "Analytics avanzados",
        "Integraciones personalizadas"
      ],
      popular: false
    }
  ];

  const faqs = [
    {
      question: "¿Cómo se conecta con WhatsApp Business?",
      answer: "La integración es muy simple. Solo necesitas escanear un código QR y autorizar la conexión. En menos de 5 minutos estará funcionando."
    },
    {
      question: "¿Puede manejar múltiples idiomas?",
      answer: "Sí, nuestro chatbot puede comunicarse en más de 20 idiomas diferentes, detectando automáticamente el idioma preferido del cliente."
    },
    {
      question: "¿Qué tan inteligente es la IA?",
      answer: "Nuestra IA utiliza tecnología de última generación que le permite entender contexto, recordar conversaciones anteriores y aprender de cada interacción."
    },
    {
      question: "¿Es realmente más barato que contratar personal?",
      answer: "Absolutamente. Un chatbot puede manejar cientos de conversaciones simultáneamente, 24/7, por una fracción del costo de un empleado."
    },
    {
      question: "¿Puede procesar pagos de forma segura?",
      answer: "Sí, integramos con las principales pasarelas de pago y cumplimos con todos los estándares de seguridad PCI DSS."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <MessageCircle className="h-8 w-8 text-green-600" />
                <Sparkles className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1" />
              </div>
              <span className="text-2xl font-bold text-slate-800">SkedyBot</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#benefits" className="text-slate-600 hover:text-slate-800 transition-colors">Beneficios</a>
              <a href="#features" className="text-slate-600 hover:text-slate-800 transition-colors">Funciones</a>
              <a href="#pricing" className="text-slate-600 hover:text-slate-800 transition-colors">Precios</a>
              <Button variant="outline" className="border-green-200 text-green-600 hover:bg-green-50">
                Demo
              </Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                Empezar
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-8 bg-green-100 text-green-700 border-green-200 px-4 py-2">
            <Rocket className="h-4 w-4 mr-2" />
            Revoluciona tu Negocio
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight">
            Automatiza todo con
            <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent block">
              WhatsApp + IA
            </span>
          </h1>
          
          <p className="text-xl text-slate-600 mb-12 max-w-4xl mx-auto">
            Reservas automáticas, servicio al cliente 24/7, cotizaciones instantáneas, 
            pagos seguros y atención personalizada. Todo en WhatsApp.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg font-semibold shadow-lg">
              <Play className="h-5 w-5 mr-2" />
              Ver Demo Gratis
            </Button>
            <Button variant="outline" size="lg" className="border-slate-300 text-slate-700 hover:bg-slate-50 px-8 py-4 text-lg font-semibold">
              <Calculator className="h-5 w-5 mr-2" />
              Calcular Ahorros
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">24/7</div>
              <div className="text-sm text-slate-600">Disponibilidad</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">20+</div>
              <div className="text-sm text-slate-600">Idiomas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">70%</div>
              <div className="text-sm text-slate-600">Menos Costos</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">5min</div>
              <div className="text-sm text-slate-600">Configuración</div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-800">Beneficios que Transforman</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Descubre por qué miles de negocios eligen SkedyBot para automatizar sus operaciones
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <Card key={index} className="bg-gradient-to-br from-slate-50 to-white border-slate-200 hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <div className={`w-16 h-16 ${benefit.bgColor} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                    <div className={benefit.color}>
                      {benefit.icon}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">{benefit.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-gradient-to-br from-green-50 to-blue-50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-800">Funciones Automatizadas</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Todo lo que necesitas para manejar tu negocio automáticamente
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-6xl mx-auto">
            <TabsList className="grid w-full grid-cols-5 bg-white">
              <TabsTrigger value="faq" className="text-slate-700">FAQ</TabsTrigger>
              <TabsTrigger value="cotizaciones" className="text-slate-700">Cotizaciones</TabsTrigger>
              <TabsTrigger value="reservas" className="text-slate-700">Reservas</TabsTrigger>
              <TabsTrigger value="pagos" className="text-slate-700">Pagos</TabsTrigger>
              <TabsTrigger value="disponibilidad" className="text-slate-700">Disponibilidad</TabsTrigger>
            </TabsList>
            
            <div className="mt-8">
              {features.map((feature, index) => (
                <TabsContent key={index} value={Object.keys(features)[index]} className="mt-0">
                  <div className="grid lg:grid-cols-2 gap-12 items-center">
                    <div>
                      <div className="flex items-center mb-6">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mr-4">
                          <div className="text-green-600">
                            {feature.icon}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-slate-800">{feature.title}</h3>
                          <p className="text-slate-600">{feature.description}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        {feature.examples.map((example, exampleIndex) => (
                          <div key={exampleIndex} className="flex items-center">
                            <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                            <span className="text-slate-700">{example}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="bg-slate-900 rounded-2xl p-6 shadow-xl">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                            <MessageCircle className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-white font-semibold">SkedyBot</h3>
                            <p className="text-green-400 text-sm">En línea</p>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Signal className="h-4 w-4 text-white" />
                          <Wifi className="h-4 w-4 text-white" />
                          <Battery className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      
                      <div className="space-y-4 h-64 overflow-y-auto">
                        <div className="flex justify-start">
                          <div className="bg-slate-800 text-white p-3 rounded-2xl max-w-xs">
                            ¡Hola! ¿En qué puedo ayudarte hoy?
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <div className="bg-green-500 text-white p-3 rounded-2xl max-w-xs">
                            {feature.title === "FAQ Automáticas" && "¿Cuáles son sus horarios?"}
                            {feature.title === "Cotizaciones" && "¿Cuánto cuesta el servicio premium?"}
                            {feature.title === "Reservas" && "Quiero reservar para mañana"}
                            {feature.title === "Pagos" && "¿Aceptan tarjeta de crédito?"}
                            {feature.title === "Disponibilidad" && "¿Tienen espacio para hoy?"}
                          </div>
                        </div>
                        <div className="flex justify-start">
                          <div className="bg-slate-800 text-white p-3 rounded-2xl max-w-xs">
                            {feature.title === "FAQ Automáticas" && "Nuestros horarios son de lunes a viernes de 9am a 6pm, y sábados de 9am a 2pm. ¿Te gustaría hacer una reserva?"}
                            {feature.title === "Cotizaciones" && "El servicio premium cuesta $150. Incluye: ✅ Tratamiento completo ✅ Productos premium ✅ Seguimiento personalizado"}
                            {feature.title === "Reservas" && "¡Perfecto! ¿Para qué hora prefieres? Tenemos disponibilidad a las 10am, 2pm y 6pm."}
                            {feature.title === "Pagos" && "Sí, aceptamos todas las tarjetas principales: Visa, MasterCard, American Express. También PayPal y transferencias."}
                            {feature.title === "Disponibilidad" && "Sí, tenemos espacio disponible hoy. ¿Para qué hora te gustaría? Tenemos citas a las 3pm y 5pm."}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-800">Resultados Reales</h2>
            <p className="text-xl text-slate-600">
              Emprendedores que transformaron sus negocios con SkedyBot
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-gradient-to-br from-slate-50 to-white border-slate-200 hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold mr-4">
                      {testimonial.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{testimonial.name}</h3>
                      <p className="text-sm text-slate-600">{testimonial.business}</p>
                    </div>
                  </div>
                  
                  <p className="text-slate-700 mb-6 italic">"{testimonial.comment}"</p>
                  
                  <div className="space-y-2">
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      {testimonial.savings}
                    </Badge>
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 ml-2">
                      {testimonial.improvement}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-gradient-to-br from-green-50 to-blue-50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-800">Precios que Ahorran</h2>
            <p className="text-xl text-slate-600">
              Más barato que contratar personal, más efectivo que cualquier solución
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricing.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative bg-white border-slate-200 hover:shadow-xl transition-all duration-300 ${
                  plan.popular ? 'ring-2 ring-green-500 shadow-lg' : ''
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-green-500 text-white">
                    Más Popular
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-slate-800 text-2xl">{plan.name}</CardTitle>
                  <div className="text-4xl font-bold text-slate-800">
                    {plan.price}<span className="text-lg font-normal text-slate-600">{plan.period}</span>
                  </div>
                  <CardDescription className="text-slate-600">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center text-slate-700">
                        <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className={`w-full ${
                      plan.popular 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    {plan.popular ? "Comenzar Ahora" : "Elegir Plan"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-800">Preguntas Frecuentes</h2>
            <p className="text-xl text-slate-600">
              Todo lo que necesitas saber sobre SkedyBot
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left text-slate-800 hover:text-green-600">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-green-600 to-blue-600">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6 text-white">
            ¿Listo para Automatizar tu Negocio?
          </h2>
          <p className="text-xl text-green-100 mb-10 max-w-3xl mx-auto">
            Únete a miles de emprendedores que ya están ahorrando tiempo y dinero 
            con SkedyBot. Configuración en 5 minutos.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button size="lg" className="bg-white text-green-600 hover:bg-green-50 px-8 py-4 text-lg font-semibold shadow-lg">
              Comenzar Gratis
            </Button>
            <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg font-semibold">
              Hablar con Ventas
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-16 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <MessageCircle className="h-8 w-8 text-green-400" />
                <span className="text-2xl font-bold">SkedyBot</span>
              </div>
              <p className="text-slate-400 text-lg leading-relaxed">
                Automatiza tu negocio con WhatsApp e IA inteligente. 
                Reservas, pagos, cotizaciones y más.
              </p>
            </div>
            
            <div>
              <h3 className="text-white font-semibold text-lg mb-6">Producto</h3>
              <ul className="space-y-3 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Características</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Precios</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integraciones</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold text-lg mb-6">Soporte</h3>
              <ul className="space-y-3 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Centro de Ayuda</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentación</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contacto</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Estado</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold text-lg mb-6">Empresa</h3>
              <ul className="space-y-3 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Acerca de</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Carreras</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacidad</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-slate-400">
            <p>&copy; 2024 SkedyBot. Todos los derechos reservados.</p>
            <div className="flex space-x-8 mt-4 md:mt-0">
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

export default Option5LandingPage;
