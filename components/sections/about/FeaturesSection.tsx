import * as React from "react"
import { Separator } from "@/components/ui/separator"
import { 
  Users, 
  Calendar, 
  MessageCircle, 
  Shield, 
  Zap, 
  Target
} from "lucide-react"

const FeaturesSection = () => {
  const features = [
    {
      icon: Calendar,
      title: "Smart Booking System",
      description: "Automated appointment scheduling with intelligent time slot management",
      gradient: "from-blue-500 to-indigo-600",
    },
    {
      icon: MessageCircle,
      title: "AI Chatbot Integration",
      description: "24/7 customer support with intelligent conversation handling",
      gradient: "from-green-500 to-emerald-600",
    },
    {
      icon: Users,
      title: "Team Management",
      description: "Comprehensive role-based access control and team coordination",
      gradient: "from-purple-500 to-pink-600",
    },
    {
      icon: Shield,
      title: "Secure & Reliable",
      description: "Enterprise-grade security with data protection and privacy",
      gradient: "from-orange-500 to-red-600",
    },
    {
      icon: Zap,
      title: "Dynamic Pricing",
      description: "Intelligent pricing strategies based on demand and availability",
      gradient: "from-yellow-500 to-orange-600",
    },
    {
      icon: Target,
      title: "Performance Analytics",
      description: "Real-time insights and data-driven decision making",
      gradient: "from-teal-500 to-cyan-600",
    },
  ]

  return (
    <section className="mb-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-foreground mb-4">Why Choose Skedy?</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Discover the powerful features that make Skedy the ultimate business management solution
        </p>
      </div>
      
      <div className="space-y-10">
        {/* Row 1 */}
        <div className="flex flex-col md:flex-row justify-around items-stretch gap-8">
          {features.slice(0, 3).map((feature, index) => (
            <React.Fragment key={index}>
              <article className="flex items-center gap-5 text-left flex-1 max-w-sm mx-auto">
                <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center flex-shrink-0`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </div>
              </article>
              {index < 2 && (
                <Separator orientation="vertical" className="h-auto hidden md:block" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Row 2 */}
        <div className="flex flex-col md:flex-row justify-around items-stretch gap-8">
          {features.slice(3, 6).map((feature, index) => (
            <React.Fragment key={index}>
              <article className="flex items-center gap-5 text-left flex-1 max-w-sm mx-auto">
                <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center flex-shrink-0`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </div>
              </article>
              {index < 2 && (
                <Separator orientation="vertical" className="h-auto hidden md:block" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection 