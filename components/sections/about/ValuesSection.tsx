import { Card, CardContent } from "@/components/ui/card"
import { 
  Zap, 
  Shield, 
  Award, 
  TrendingUp
} from "lucide-react"

const ValuesSection = () => {
  const values = [
    {
      title: "Innovation",
      description: "Constantly pushing boundaries with cutting-edge technology",
      icon: Zap,
    },
    {
      title: "Reliability",
      description: "Building trust through consistent, dependable service",
      icon: Shield,
    },
    {
      title: "Excellence",
      description: "Striving for perfection in every interaction and feature",
      icon: Award,
    },
    {
      title: "Growth",
      description: "Supporting your business expansion with scalable solutions",
      icon: TrendingUp,
    },
  ]

  return (
    <section className="mb-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-foreground mb-4">Our Values</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          The principles that guide everything we do
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {values.map((value, index) => (
          <article key={index}>
            <Card className="text-center hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <value.icon className="w-8 h-8 mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold text-foreground mb-2">{value.title}</h3>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </CardContent>
            </Card>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ValuesSection 