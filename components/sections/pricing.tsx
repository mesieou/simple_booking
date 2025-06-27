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
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-4">
            Pricing
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4">
            Simple & transparent pricing
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-12">
            We believe Skedy should be accessible to all companies, no matter the size.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Basic Plan */}
          <Card className="flex flex-col rounded-2xl bg-white/5 dark:bg-black/5 border border-white/10 dark:border-black/10 max-w-sm mx-auto">
            <CardHeader>
              <CardTitle className="text-xl font-bold">Basic Plan <span className="text-primary text-base">(Free)</span></CardTitle>
              <CardDescription>
                Perfect for getting started with automating your business.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow px-4">
              <p className="font-semibold mb-4">FEATURES</p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>AI-powered calendar management</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>Virtual assistant to schedule appointments via WhatsApp</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>Option to enable payments at the time of booking</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>Automatic email reminders</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button size="lg" className="w-full" disabled>
                Free
              </Button>
            </CardFooter>
          </Card>

          {/* Business Plan */}
          <Card className="flex flex-col rounded-2xl bg-primary/5 dark:bg-primary/10 border-primary/20 max-w-sm mx-auto">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-bold">
                  Business Plan <span className="text-primary text-base">(Contact us)</span>
                </CardTitle>
                <Badge>Custom</Badge>
              </div>
              <CardDescription>
                For teams that need more customization, advanced features, or support for a high volume of clients.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow px-4">
              <p className="font-semibold mb-4">FEATURES</p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>Simple web dashboard</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>Instant access</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button size="lg" className="w-full">
                Contact us
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  );
}
