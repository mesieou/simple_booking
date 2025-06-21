import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | Skedy",
  description: "Terms and conditions for Skedy - The best way to manage bookings and calendars",
};

export default function TermsOfService() {
  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-center">Terms & Conditions</h1>
      
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-primary/10 px-2 py-1 rounded-md">1. Acceptance of Terms</h2>
          <p className="text-foreground/90">
            By accessing and using Skedy's booking and calendar management service, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-secondary/10 px-2 py-1 rounded-md">2. Description of Service</h2>
          <p className="text-foreground/90">
            Skedy provides a platform for booking and calendar management services, including:
          </p>
          <ul className="list-disc pl-6 text-foreground/90">
            <li>Online booking and appointment scheduling</li>
            <li>Calendar management and availability tracking</li>
            <li>WhatsApp messaging integration for customer communication</li>
            <li>AI-powered chatbot support</li>
            <li>Multi-user and team management features</li>
            <li>Dynamic pricing and quote generation</li>
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-primary/10 px-2 py-1 rounded-md">3. User Accounts and Registration</h2>
          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-medium">3.1 Account Creation</h3>
            <p className="text-foreground/90">
              To use certain features of our service, you must create an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.
            </p>
            
            <h3 className="text-xl font-medium">3.2 Account Security</h3>
            <p className="text-foreground/90">
              You are responsible for safeguarding your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>
            
            <h3 className="text-xl font-medium">3.3 Business Accounts</h3>
            <p className="text-foreground/90">
              Business users may create accounts for their organizations and manage multiple users. The business account owner is responsible for all activities conducted under their business account.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-secondary/10 px-2 py-1 rounded-md">4. Acceptable Use Policy</h2>
          <p className="text-foreground/90">
            You agree not to use the service to:
          </p>
          <ul className="list-disc pl-6 text-foreground/90">
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe upon the rights of others</li>
            <li>Transmit harmful, offensive, or inappropriate content</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Interfere with the proper functioning of the service</li>
            <li>Use the service for spam or unsolicited communications</li>
            <li>Impersonate another person or entity</li>
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-primary/10 px-2 py-1 rounded-md">5. WhatsApp Integration</h2>
          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-medium">5.1 WhatsApp Business API</h3>
            <p className="text-foreground/90">
              Our service integrates with WhatsApp Business API to provide messaging capabilities. By using this feature, you agree to comply with WhatsApp's Business Policy and our messaging guidelines.
            </p>
            
            <h3 className="text-xl font-medium">5.2 Message Consent</h3>
            <p className="text-foreground/90">
              Users must explicitly opt-in to receive WhatsApp messages. You may opt-out at any time by contacting us or using the opt-out mechanism provided in our messages.
            </p>
            
            <h3 className="text-xl font-medium">5.3 Message Content</h3>
            <p className="text-foreground/90">
              You are responsible for the content of messages sent through our WhatsApp integration. Messages must comply with WhatsApp's content policies and applicable laws.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-secondary/10 px-2 py-1 rounded-md">6. Booking and Payment Terms</h2>
          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-medium">6.1 Booking Process</h3>
            <p className="text-foreground/90">
              Bookings made through our platform are subject to the terms and conditions set by the service provider. We facilitate the booking process but are not responsible for the actual service delivery.
            </p>
            
            <h3 className="text-xl font-medium">6.2 Payment Processing</h3>
            <p className="text-foreground/90">
              Payments are processed through secure third-party payment processors. We do not store your payment information and are not responsible for payment processing errors.
            </p>
            
            <h3 className="text-xl font-medium">6.3 Cancellation and Refunds</h3>
            <p className="text-foreground/90">
              Cancellation and refund policies are determined by individual service providers. Please review the provider's terms before making a booking.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-primary/10 px-2 py-1 rounded-md">7. Intellectual Property</h2>
          <p className="text-foreground/90">
            The service and its original content, features, and functionality are owned by Skedy and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-secondary/10 px-2 py-1 rounded-md">8. Privacy and Data Protection</h2>
          <p className="text-foreground/90">
            Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the service, to understand our practices regarding the collection and use of your information.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-primary/10 px-2 py-1 rounded-md">9. Service Availability</h2>
          <p className="text-foreground/90">
            We strive to maintain high service availability but do not guarantee uninterrupted access. The service may be temporarily unavailable due to maintenance, updates, or technical issues.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-secondary/10 px-2 py-1 rounded-md">10. Limitation of Liability</h2>
          <p className="text-foreground/90">
            To the maximum extent permitted by law, Skedy shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-primary/10 px-2 py-1 rounded-md">11. Indemnification</h2>
          <p className="text-foreground/90">
            You agree to defend, indemnify, and hold harmless Skedy and its officers, directors, employees, and agents from and against any claims, damages, obligations, losses, liabilities, costs, or debt arising from your use of the service.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-secondary/10 px-2 py-1 rounded-md">12. Termination</h2>
          <p className="text-foreground/90">
            We may terminate or suspend your account and access to the service immediately, without prior notice, for any reason, including breach of these terms. Upon termination, your right to use the service will cease immediately.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-primary/10 px-2 py-1 rounded-md">13. Governing Law</h2>
          <p className="text-foreground/90">
            These terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Skedy operates, without regard to its conflict of law provisions.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-secondary/10 px-2 py-1 rounded-md">14. Changes to Terms</h2>
          <p className="text-foreground/90">
            We reserve the right to modify these terms at any time. We will notify users of any material changes by posting the new terms on this page and updating the "Last Updated" date.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-primary/10 px-2 py-1 rounded-md">15. Contact Information</h2>
          <p className="text-foreground/90">
            If you have any questions about these Terms & Conditions, please contact us at:
          </p>
          <p className="text-primary font-medium">info@skedy.com</p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold bg-secondary/10 px-2 py-1 rounded-md">16. Severability</h2>
          <p className="text-foreground/90">
            If any provision of these terms is held to be invalid or unenforceable, such provision shall be struck and the remaining provisions shall be enforced.
          </p>
          <p className="text-foreground/90 italic">
            Last Updated: December 20, 2024
          </p>
        </section>
      </div>
    </div>
  );
} 