import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const HeroSection = () => {
  return (
    <div className="text-center mb-20">
      <Badge variant="secondary" className="mb-4 text-sm">
        About Skedy
      </Badge>
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
        Revolutionizing Business
        <span className="text-primary"> Management</span>
      </h1>
      <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed mb-8">
        We're transforming how businesses handle appointments, customer interactions, and team coordination with our innovative AI-powered platform.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Button size="lg" className="text-lg px-8">
          Get Started
        </Button>
        <Button variant="outline" size="lg" className="text-lg px-8">
          Learn More
        </Button>
      </div>
    </div>
  )
}

export default HeroSection 