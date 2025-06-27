import {
  HeroSection,
  MissionSection,
  FeaturesSection,
  ValuesSection,
  CTASection
} from "@/components/sections/about"

// Metadata para SEO
export const metadata = {
  title: 'About Skedy - Revolutionizing Business Management',
  description: 'Learn about Skedy, the innovative AI-powered platform that transforms how businesses handle appointments, customer interactions, and team coordination.',
  keywords: 'business management, appointment scheduling, AI chatbot, team management, automation',
  openGraph: {
    title: 'About Skedy - Revolutionizing Business Management',
    description: 'Transform your business operations with our AI-powered platform',
    type: 'website',
  },
}

const AboutPage = () => {
  return (
    <main className="min-h-screen relative">
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <HeroSection />
          <MissionSection />
          <FeaturesSection />
          <ValuesSection />
          <CTASection />
        </div>
      </div>
    </main>
  )
}

export default AboutPage
