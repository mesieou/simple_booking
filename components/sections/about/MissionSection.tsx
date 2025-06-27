import Image from "next/image"
import { CheckCircle } from "lucide-react"

const MissionSection = () => {
  return (
    <div className="mb-20">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div className="rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300">
          <Image 
            src="/people.png" 
            alt="Our Team at Skedy" 
            width={600} 
            height={450}
            className="w-full h-auto object-cover"
            priority
          />
        </div>
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-foreground">Our Mission</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            To empower businesses with intelligent automation tools that streamline operations, 
            enhance customer experiences, and drive sustainable growth through innovative technology solutions.
          </p>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-7 h-7 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground">Streamline Operations</h4>
                <p className="text-muted-foreground">Automate repetitive tasks and optimize workflows.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-7 h-7 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground">Enhance Customer Experiences</h4>
                <p className="text-muted-foreground">Deliver personalized and efficient service 24/7.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-7 h-7 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground">Drive Sustainable Growth</h4>
                <p className="text-muted-foreground">Provide data-driven insights for smarter decisions.</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default MissionSection 