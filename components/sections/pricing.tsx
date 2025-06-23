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
            We believe Untitled should be accessible to all companies, no matter
            the size.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <Card className="flex flex-col rounded-2xl bg-white/5 dark:bg-black/5 border border-white/10 dark:border-black/10">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Basic plan</CardTitle>
              <CardDescription>
                Our most popular plan for small teams.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-5xl font-bold">$10</span>
                <span className="text-muted-foreground">per month</span>
              </div>
              <p className="font-semibold mb-4">FEATURES</p>
              <p className="text-muted-foreground mb-6">
                Everything in our free plan plus....
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>Access to basic features</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>Basic reporting + analytics</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>Up to 10 individual users</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>20GB individual data</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>Basic chat support</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button size="lg" className="w-full">
                Get started
              </Button>
            </CardFooter>
          </Card>

          <Card className="flex flex-col rounded-2xl bg-primary/5 dark:bg-primary/10 border-primary/20">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-2xl font-bold">
                  Business plan
                </CardTitle>
                <Badge>Popular</Badge>
              </div>
              <CardDescription>
                Advanced features and reporting.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-5xl font-bold">$20</span>
                <span className="text-muted-foreground">per month</span>
              </div>
              <p className="font-semibold mb-4">FEATURES</p>
              <p className="text-muted-foreground mb-6">
                Everything in our basic plan plus....
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>200+ integrations</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>Advanced reporting</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>Up to 20 individual users</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>40GB individual data</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon className="text-primary" />
                  <span>Priority chat support</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button size="lg" className="w-full">
                Get started
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  );
}
