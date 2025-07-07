import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const faqs = [
  {
    question: "How does WhatsApp integration work?",
    answer: "We connect directly with your WhatsApp Business API. You just need to authorize the connection and configure automatic responses."
  },
  {
    question: "Can the chatbot handle complex bookings?",
    answer: "Yes, our AI can manage bookings with multiple options, dates, schedules and automatic confirmations."
  },
  {
    question: "What languages does it support?",
    answer: "We currently support Spanish, English, Portuguese and French. You can configure the language according to your audience."
  },
  {
    question: "Can I customize the responses?",
    answer: "Absolutely. You can create personalized responses, add your brand tone and configure specific flows."
  },
  {
    question: "Is there a message limit?",
    answer: "The free plan includes 100 messages/month. Paid plans include more volume and Enterprise is unlimited."
  },
  {
    question: "How fast is the setup?",
    answer: "Basic configuration takes less than 15 minutes. Our team helps you with advanced configuration."
  }
];

const Questions2 = () => {
  return (
    <section className="py-20 px-4 bg-white/5">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-white/60">
            Everything you need to know about our chatbot
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {faqs.map((faq, index) => (
            <Card key={index} className="bg-white/5 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white text-lg">{faq.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-white/70">
                  {faq.answer}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Questions2;

