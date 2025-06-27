import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const CTASection = () => {
  return (
    <section className="text-center">
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Transform Your Business?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of businesses that have already revolutionized their operations with Skedy
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="text-lg px-8">
              Start Free Trial
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8">
              Schedule Demo
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

export default CTASection 