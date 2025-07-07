"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

const ConversationTabs = () => {
  return (
    <Tabs defaultValue="booking" className="w-full">
      <TabsList className="grid w-full grid-cols-5 bg-slate-800">
        <TabsTrigger value="booking" className="text-white">Booking</TabsTrigger>
        <TabsTrigger value="quote" className="text-white">Quote</TabsTrigger>
        <TabsTrigger value="sales" className="text-white">Sales</TabsTrigger>
        <TabsTrigger value="support" className="text-white">Support</TabsTrigger>
        <TabsTrigger value="calendar" className="text-white">Calendar</TabsTrigger>
      </TabsList>
      
      <TabsContent value="booking" className="mt-6">
        <Card className="bg-stone-200 border-stone-200">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-green-500 text-white p-2 rounded-lg text-sm">
                  Can I book for 4 people on Saturday?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white text-black p-2 rounded-lg text-sm">
                  Of course! What time do you prefer? We have availability at 7pm and 9pm.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="quote" className="mt-6">
        <Card className="bg-stone-200 border-stone-200">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-green-500 text-white p-2 rounded-lg text-sm">
                  How much would it cost for a full treatment?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white text-black p-2 rounded-lg text-sm">
                  Here's your quote: Basic treatment $80, Premium $120, VIP package $180. Which one interests you?
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="sales" className="mt-6">
        <Card className="bg-stone-200 border-stone-200">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-green-500 text-white p-2 rounded-lg text-sm">
                  I want to pay for the premium service
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white text-black p-2 rounded-lg text-sm">
                  Perfect! Here's your payment link: https://pay.stripe.com/premium-service-xyz
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="support" className="mt-6">
        <Card className="bg-stone-200 border-stone-200">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-green-500 text-white p-2 rounded-lg text-sm">
                  Can I cancel my appointment?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white text-black p-2 rounded-lg text-sm">
                  Yes, you can cancel up to 24 hours in advance at no charge. What is your booking number?
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="calendar" className="mt-6">
        <Card className="bg-stone-200 border-stone-200">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-green-500 text-white p-2 rounded-lg text-sm">
                  What days do you have available this week?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white text-black p-2 rounded-lg text-sm">
                  Available days: Monday (2 slots), Wednesday (4 slots), Friday (1 slot), Saturday (3 slots)
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default ConversationTabs; 