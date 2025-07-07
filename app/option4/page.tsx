"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  MessageCircle, 
  Smartphone, 
  Zap, 
  TrendingUp, 
  Users, 
  CheckCircle, 
  Play, 
  Star, 
  ArrowRight, 
  Target, 
  BarChart3, 
  Globe, 
  Shield, 
  Clock, 
  Award, 
  ChevronRight,
  Rocket,
  Heart,
  Sparkles,
  Coffee,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Timer,
  DollarSign,
  UserCheck,
  Brain,
  Lock,
  Wifi,
  Battery,
  Signal
} from 'lucide-react';

const Option4LandingPage = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const steps = [
    {
      icon: <Coffee className="h-6 w-6" />,
      title: "Despierta",
      description: "Tu negocio está listo para el siguiente nivel",
      time: "09:00 AM"
    },
    {
      icon: <MessageCircle className="h-6 w-6" />,
      title: "Conecta",
      description: "WhatsApp se convierte en tu mejor vendedor",
      time: "10:30 AM"
    },
    {
      icon: <Brain className="h-6 w-6" />,
      title: "Aprende",
      description: "IA que mejora con cada conversación",
      time: "12:00 PM"
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Crece",
      description: "Resultados que hablan por sí solos",
      time: "02:00 PM"
    }
  ];

  const features = [
    {
      icon: <Phone className="h-8 w-8" />,
      title: "WhatsApp Business API",
      description: "Integración nativa con la plataforma más confiable del mundo",
      color: "text-green-500"
    },
    {
      icon: <Brain className="h-8 w-8" />,
      title: "IA Conversacional",
      description: "Chatbot que entiende contexto y aprende de cada interacción",
      color: "text-blue-500"
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "Analytics Inteligente",
      description: "Métricas que te dicen exactamente qué está funcionando",
      color: "text-purple-500"
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Seguridad Enterprise",
      description: "Encriptación end-to-end y cumplimiento GDPR",
      color: "text-red-500"
    }
  ];

  const stats = [
    { number: "2.5B+", label: "Usuarios WhatsApp", icon: <Users className="h-5 w-5" /> },
    { number: "99.9%", label: "Tiempo Activo", icon: <Wifi className="h-5 w-5" /> },
    { number: "24/7", label: "Disponibilidad", icon: <Clock className="h-5 w-5" /> },
    { number: "0", label: "Configuración", icon: <Rocket className="h-5 w-5" /> }
  ];

  const testimonials = [
    {
      name: "Sofia Chen",
      role: "Fundadora",
      company: "Bubble Tea Co.",
      avatar: "SC",
      story: "Antes perdía clientes por no responder a tiempo. Ahora SkedyBot maneja todo y mis ventas aumentaron 300%.",
      rating: 5,
      highlight: "300% más ventas"
    },
    {
      name: "Miguel Torres",
      role: "CEO",
      company: "TechFlow",
      avatar: "MT",
      story: "La integración fue súper fácil. En 2 horas ya estaba funcionando. Mis clientes están encantados.",
      rating: 5,
      highlight: "2 horas setup"
    },
    {
      name: "Elena Rodriguez",
      role: "Marketing Manager",
      company: "Fashion Forward",
      avatar: "ER",
      story: "El chatbot entiende perfectamente lo que necesitan mis clientes. Es como tener un vendedor experto 24/7.",
      rating: 5,
      highlight: "Vendedor 24/7"
    }
  ];

  const timeline = [
    {
      day: "Día 1",
      title: "Configuración",
      description: "Conecta tu WhatsApp Business en minutos",
      status: "completed"
    },
    {
      day: "Día 3",
      title: "Entrenamiento",
      description: "La IA aprende sobre tu negocio",
      status: "completed"
    },
    {
      day: "Día 7",
      title: "Optimización",
      description: "Ajustes basados en conversaciones reales",
      status: "current"
    },
    {
      day: "Día 14",
      title: "Resultados",
      description: "Métricas y mejoras continuas",
      status: "pending"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <MessageCircle className="h-8 w-8 text-indigo-600" />
                <Sparkles className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1" />
              </div>
              <span className="text-2xl font-bold text-slate-800">SkedyBot</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#story" className="text-slate-600 hover:text-slate-800 transition-colors">Historia</a>
              <a href="#features" className="text-slate-600 hover:text-slate-800 transition-colors">Características</a>
              <a href="#timeline" className="text-slate-600 hover:text-slate-800 transition-colors">Timeline</a>
              <Button variant="outline" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                Demo
              </Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Empezar
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-8 bg-indigo-100 text-indigo-700 border-indigo-200 px-4 py-2">
            <Rocket className="h-4 w-4 mr-2" />
            Lanzamiento Beta
          </Badge>
          
          <h1 className="text-6xl md:text-8xl font-bold mb-8 leading-tight">
            El futuro de la
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent block">
              atención al cliente
            </span>
          </h1>
          
          <p className="text-xl text-slate-600 mb-12 max-w-3xl mx-auto">
            Imagina que tu negocio nunca duerme. Que cada cliente recibe atención instantánea, 
            personalizada y efectiva. Eso es SkedyBot.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 text-lg font-semibold shadow-lg">
              <Play className="h-5 w-5 mr-2" />
              Ver Demo en Vivo
            </Button>
            <Button variant="outline" size="lg" className="border-slate-300 text-slate-700 hover:bg-slate-50 px-8 py-4 text-lg font-semibold">
              <Heart className="h-5 w-5 mr-2" />
              ¿Por qué nos aman?
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="flex items-center justify-center mb-2">
                  {stat.icon}
                </div>
                <div className="text-2xl font-bold text-slate-800">{stat.number}</div>
                <div className="text-sm text-slate-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section id="story" className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-800">Una historia de transformación</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Descubre cómo un día normal se convierte en extraordinario
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <Card key={index} className={`bg-gradient-to-br from-slate-50 to-white border-slate-200 hover:shadow-lg transition-all duration-300 ${
                index === currentStep ? 'ring-2 ring-indigo-500' : ''
              }`}>
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <div className="text-indigo-600">
                      {step.icon}
                    </div>
                  </div>
                  <div className="text-sm text-indigo-600 font-medium mb-2">{step.time}</div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">{step.title}</h3>
                  <p className="text-slate-600 text-sm">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Progress value={progress} className="w-full max-w-md mx-auto" />
            <p className="text-sm text-slate-500 mt-2">Progreso de implementación</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-800">Más que un chatbot</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Es tu compañero de trabajo más inteligente, disponible 24/7
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-white/80 backdrop-blur-sm border-slate-200 hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                  <div className={`w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mb-6 ${feature.color}`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-4">{feature.title}</h3>
                  <p className="text-slate-600 text-lg leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section id="timeline" className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-800">Tu viaje hacia el éxito</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              En solo 14 días, tu negocio estará transformado
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            {timeline.map((item, index) => (
              <div key={index} className="flex items-center mb-8">
                <div className="flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    item.status === 'completed' ? 'bg-green-500' :
                    item.status === 'current' ? 'bg-indigo-500' : 'bg-slate-300'
                  }`}>
                    {item.status === 'completed' ? (
                      <CheckCircle className="h-6 w-6 text-white" />
                    ) : item.status === 'current' ? (
                      <Clock className="h-6 w-6 text-white" />
                    ) : (
                      <div className="w-3 h-3 bg-white rounded-full"></div>
                    )}
                  </div>
                </div>
                <div className="ml-6 flex-1">
                  <div className="flex items-center mb-2">
                    <span className="text-sm font-medium text-slate-500">{item.day}</span>
                    <div className={`ml-4 px-3 py-1 rounded-full text-xs font-medium ${
                      item.status === 'completed' ? 'bg-green-100 text-green-700' :
                      item.status === 'current' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {item.status === 'completed' ? 'Completado' :
                       item.status === 'current' ? 'En Progreso' : 'Pendiente'}
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">{item.title}</h3>
                  <p className="text-slate-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-800">Historias que inspiran</h2>
            <p className="text-xl text-slate-600">
              Emprendedores que transformaron sus negocios
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-white/80 backdrop-blur-sm border-slate-200 hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-4">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{testimonial.name}</h3>
                      <p className="text-sm text-slate-600">{testimonial.role} en {testimonial.company}</p>
                    </div>
                  </div>
                  
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  
                  <p className="text-slate-700 mb-4 italic">"{testimonial.story}"</p>
                  
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    {testimonial.highlight}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6 text-slate-800">
                Ve la magia en acción
              </h2>
              <p className="text-xl text-slate-600 mb-8">
                Una conversación real que muestra cómo SkedyBot maneja consultas complejas 
                de manera natural y efectiva.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Respuestas instantáneas</h3>
                    <p className="text-slate-600">En menos de 2 segundos</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Contexto inteligente</h3>
                    <p className="text-slate-600">Recuerda conversaciones anteriores</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Personalización</h3>
                    <p className="text-slate-600">Adaptado a tu marca y estilo</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl">
                {/* Phone Header */}
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
                
                {/* Chat Messages */}
                <div className="space-y-4 h-80 overflow-y-auto mb-4">
                  <div className="flex justify-start">
                    <div className="bg-slate-800 text-white p-3 rounded-2xl max-w-xs">
                      ¡Hola! Soy tu asistente personal. ¿En qué puedo ayudarte hoy?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-green-500 text-white p-3 rounded-2xl max-w-xs">
                      Hola! Quiero reservar una cita para mañana
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-slate-800 text-white p-3 rounded-2xl max-w-xs">
                      ¡Perfecto! ¿Para qué hora prefieres? Tenemos disponibilidad a las 10am, 2pm y 6pm.
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-green-500 text-white p-3 rounded-2xl max-w-xs">
                      Las 2pm estaría bien
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-slate-800 text-white p-3 rounded-2xl max-w-xs">
                      Excelente elección. ¿Cuál es tu nombre para confirmar la reserva?
                    </div>
                  </div>
                </div>
                
                {/* Input */}
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    placeholder="Escribe tu mensaje..." 
                    className="flex-1 bg-slate-800 text-white p-3 rounded-2xl border-none focus:ring-2 focus:ring-green-500"
                  />
                  <Button className="bg-green-500 hover:bg-green-600 p-3 rounded-2xl">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-indigo-600 to-purple-600">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6 text-white">
            ¿Listo para transformar tu negocio?
          </h2>
          <p className="text-xl text-indigo-100 mb-10 max-w-3xl mx-auto">
            Únete a miles de emprendedores que ya están usando SkedyBot para 
            revolucionar su atención al cliente.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 px-8 py-4 text-lg font-semibold shadow-lg">
              Comenzar Gratis
            </Button>
            <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg font-semibold">
              Hablar con Expertos
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
                <MessageCircle className="h-8 w-8 text-indigo-400" />
                <span className="text-2xl font-bold">SkedyBot</span>
              </div>
              <p className="text-slate-400 text-lg leading-relaxed">
                Transformando la atención al cliente con IA inteligente y WhatsApp Business.
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
              <h3 className="text-white font-semibold text-lg mb-6">Recursos</h3>
              <ul className="space-y-3 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentación</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Casos de uso</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Soporte</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold text-lg mb-6">Empresa</h3>
              <ul className="space-y-3 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Acerca de</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Carreras</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contacto</a></li>
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

export default Option4LandingPage;
