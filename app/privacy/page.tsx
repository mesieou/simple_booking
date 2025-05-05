import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Skedy",
  description: "Privacy policy for Skedy - The best way to manage bookings and calendars",
};

export default function PrivacyPolicy() {
  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto ">
      <h1 className="text-3xl font-bold text-center">Privacy Policy</h1>
      
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-primary/10 px-2 py-1 rounded-md">1. Introduction</h2>
          <p className="text-foreground/90">
            At Skedy, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our booking and calendar management service.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-secondary/10 px-2 py-1 rounded-md">2. Information We Collect</h2>
          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-medium">2.1 Personal Information</h3>
            <p className="text-foreground/90">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc pl-6 text-foreground/90">
              <li>Name and contact information</li>
              <li>Business details</li>
              <li>Calendar and booking information</li>
              <li>Payment information</li>
            </ul>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-primary/10 px-2 py-1 rounded-md">3. How We Use Your Information</h2>
          <p className="text-foreground/90">
            We use the information we collect to:
          </p>
          <ul className="list-disc pl-6 text-foreground/90">
            <li>Provide and maintain our service</li>
            <li>Process your bookings and payments</li>
            <li>Send you important updates and notifications</li>
            <li>Improve our service and develop new features</li>
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-secondary/10 px-2 py-1 rounded-md">4. Data Security</h2>
          <p className="text-foreground/90">
            We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-primary/10 px-2 py-1 rounded-md">5. Your Rights</h2>
          <p className="text-foreground/90">
            You have the right to:
          </p>
          <ul className="list-disc pl-6 text-foreground/90">
            <li>Access your personal information</li>
            <li>Correct inaccurate information</li>
            <li>Request deletion of your information</li>
            <li>Object to processing of your information</li>
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-secondary/10 px-2 py-1 rounded-md">6. Contact Us</h2>
          <p className="text-foreground/90">
            If you have any questions about this Privacy Policy, please contact us at:
          </p>
          <p className="text-primary font-medium">privacy@skedy.com</p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-primary/10 px-2 py-1 rounded-md">7. Changes to This Policy</h2>
          <p className="text-foreground/90">
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
          </p>
          <p className="text-foreground/90 italic">
            Last Updated: March 20, 2024
          </p>
        </section>
      </div>
    </div>
  );
} 