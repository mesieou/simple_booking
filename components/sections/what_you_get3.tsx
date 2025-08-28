import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Zap, Database, Globe, TrendingUp, Shield, CalendarCheck2, Languages, Clock } from 'lucide-react';

const features = [
  {
    icon: Clock,
    title: "24/7 Availability",
    description: "Agents that work tirelessly, automating complex tasks and optimizing business processes.",
    gradient: "from-secondary to-primary"
  },
  {
    icon: Brain,
    title: "Advanced Artificial Intelligence",
    description: "State-of-the-art natural language processing to understand and respond contextually.",
    gradient: "from-primary to-secondary"
  },
  {
    icon: TrendingUp,
    title: "Continuous Learning",
    description: "Agents constantly improve their performance through machine learning and feedback.",
    gradient: "from-secondary to-primary"
  },

  {
    icon: Languages,
    title: "Multi-language Communication",
    description: "Communicate without barriers with your users in any language, expanding your global reach.",
    gradient: "from-accent to-secondary"
  },

  {
    icon: CalendarCheck2,
    title: "Business Adaptation",
    description: "Customize your AI receptionist to match your business style and specific requirements.",
    gradient: "from-accent to-secondary"
  },
];

const FeatureCard = ({
  icon: Icon,
  title,
  description,
  gradient,
  index
}: {
  icon: any;
  title: string;
  description: string;
  gradient: string;
  index: number;
}) => {
  return (
    <Card className="group transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/20 bg-white border-gray-200">
      <CardHeader className="text-center">
        <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}>
          <Icon className="w-8 h-8 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 text-center leading-relaxed">
          {description}
        </p>
      </CardContent>
    </Card>
  );
};

export const FeaturesSection = () => {
  const handleGetStarted = () => {
    // Function to handle button click
    console.log('Get started clicked');
  };

  return (
    <section className="py-24 px-4 bg-white">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center p-2 bg-primary/10 rounded-full mb-4">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Your AI Receptionist Features
          </h2>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Professional AI receptionist that handles calls, bookings, and customer service with human-like conversation.
          </p>
        </div>

        {/* Features Grid */}
        <div className="space-y-12">
          {/* First row - 3 features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.slice(0, 3).map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                gradient={feature.gradient}
                index={index}
              />
            ))}
          </div>

          {/* Second row - 2 centered features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {features.slice(3, 5).map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                gradient={feature.gradient}
                index={index + 3}
              />
            ))}
          </div>
        </div>



      </div>
    </section>
  );
};
