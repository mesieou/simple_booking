import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check } from "lucide-react";

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={`w-6 h-6 ${className}`}
  >
    <path
      fillRule="evenodd"
      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
      clipRule="evenodd"
    />
  </svg>
);

export function Pricing() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-4">
            Pricing
          </Badge>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight mb-3 sm:mb-4">
            Simple & transparent pricing
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 sm:mb-10 md:mb-12">
            We believe Skedy should be accessible to all companies, no matter the size.
          </p>

          {/* Coming Soon Message */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 md:p-16 shadow-xl border max-w-2xl mx-auto">
            <div className="text-4xl sm:text-5xl md:text-6xl mb-4 sm:mb-6">🚧</div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
              Coming Soon
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-700 mb-6 sm:mb-8 leading-relaxed">
              We're putting the finishing touches on our pricing plans. Stay tuned for transparent, affordable options that scale with your business.
            </p>
            <Badge variant="secondary" className="text-sm sm:text-base px-4 sm:px-6 py-1.5 sm:py-2 bg-gradient-to-r from-primary to-secondary text-white">
              Launching Soon
            </Badge>
          </div>
        </div>
      </div>
    </section>
  );
}
