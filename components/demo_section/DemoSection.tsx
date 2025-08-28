"use client";

import { useState } from "react";
import { Phone, Calendar, DollarSign, MessageSquare, PhoneCall, Play, ClipboardList, PhoneIncoming } from "lucide-react";

const DemoSection = () => {
  const [activeFeature, setActiveFeature] = useState(0);

  const features = [
    {
      id: 0,
      icon: PhoneIncoming,
      title: "Sales & Support",
      description: "Handles inquiries and converts leads",
      conversation: {
        customer: "I saw your ad, do you do emergency calls?",
        ai: "Absolutely! We offer 24/7 emergency plumbing services. We can have someone to you within 45 minutes. What's the nature of your emergency? Is it a burst pipe, blocked drain, or something else?"
      }
    },
    {
      id: 1,
      icon: DollarSign,
      title: "Smart Quotes",
      description: "Calculates quotes with distance & materials",
      conversation: {
        customer: "I need a quote for bathroom renovation in Bondi",
        ai: "I can help with that! For a full bathroom reno in Bondi, based on 15km from our location, the quote is $8,500-12,000 including materials and travel. Would you like me to schedule a site inspection?"
      }
    },
    {
      id: 2,
      icon: Calendar,
      title: "Scheduling",
      description: "Books appointments automatically",
      conversation: {
        customer: "Can I book for next Tuesday at 2pm?",
        ai: "Perfect! I've scheduled you for Tuesday, March 12th at 2:00 PM. I've sent the booking confirmation to your phone. Our plumber Jake will call 15 minutes before arrival."
      }
    }
  ];

  return (
    <section id="demo" className="py-10 sm:py-16 md:py-20 px-2 sm:px-4">
      <div className="container mx-auto max-w-6xl">

        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 md:mb-16">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold tracking-tighter text-white mb-4 sm:mb-6 px-2">
            See Your AI Receptionist in Action
          </h1>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/70 max-w-2xl mx-auto px-4">
            Watch how our AI handles real customer calls with professional, natural conversation
          </p>
        </div>

                        {/* Feature Tabs - Compact Layout */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 sm:mb-12 max-w-4xl mx-auto px-2">
          {features.map((feature) => {
            const IconComponent = feature.icon;
            return (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(feature.id)}
                className={`group flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl transition-all duration-500 transform ${
                  activeFeature === feature.id
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-xl scale-105'
                    : 'bg-white/10 text-white/90 hover:bg-white/20 hover:scale-102 backdrop-blur-sm border border-white/20'
                }`}
              >
                <IconComponent className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="font-medium text-xs sm:text-sm">{feature.title}</span>
              </button>
            );
          })}
        </div>

        {/* Demo Display - More Compact */}
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-center max-w-5xl mx-auto px-2">

            {/* AI Avatar & Status */}
            <div className="text-center order-2 lg:order-1">
              <div className="relative mb-4 sm:mb-6 lg:mb-8">
                <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-xl">
                  <Phone className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 text-white" />
                </div>
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                  <div className="bg-green-500 text-white px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse"></div>
                    On Call
                  </div>
                </div>
              </div>

              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-1 sm:mb-2">AI Receptionist</h3>
              <p className="text-sm sm:text-base md:text-lg text-white/70 font-medium mb-4 sm:mb-6">{features[activeFeature].description}</p>

              {/* Live Stats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center mb-4 sm:mb-8">
                <div className="bg-white rounded-lg p-2 sm:p-4 shadow-xl border">
                  <div className="text-base sm:text-xl md:text-2xl font-bold text-green-600">24/7</div>
                  <div className="text-xs sm:text-sm text-gray-700 font-medium">Available</div>
                </div>
                <div className="bg-white rounded-lg p-2 sm:p-4 shadow-xl border">
                  <div className="text-base sm:text-xl md:text-2xl font-bold text-blue-600">&lt;2s</div>
                  <div className="text-xs sm:text-sm text-gray-700 font-medium">Response</div>
                </div>
                <div className="bg-white rounded-lg p-2 sm:p-4 shadow-xl border">
                  <div className="text-base sm:text-xl md:text-2xl font-bold text-purple-600">100%</div>
                  <div className="text-xs sm:text-sm text-gray-700 font-medium">Accuracy</div>
                </div>
              </div>

              {/* Strategic CTA Button */}
              <div className="text-center">
                <button className="group inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-lg sm:rounded-xl shadow-lg hover:scale-105 transition-all duration-300 hover:shadow-xl text-sm sm:text-base">
                  <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Demo Call Soon</span>
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/80 rounded-full animate-pulse"></div>
                </button>
                <p className="text-white/60 text-xs mt-2">Coming soon</p>
              </div>
            </div>

                        {/* Phone Call Demo */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 md:p-6 shadow-xl border order-1 lg:order-2">

              {/* Call Header */}
              <div className="flex items-center justify-between mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-gray-800 font-medium text-sm sm:text-base">Live Call</span>
                </div>
                <div className="text-gray-600 text-xs sm:text-sm">Duration: 0:42</div>
              </div>

              {/* Voice Conversation */}
              <div className="space-y-3 sm:space-y-4">

                {/* Customer Speaking */}
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-9 sm:h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-xs shadow-lg flex-shrink-0">
                    C
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-blue-50 rounded-xl rounded-tl-sm p-2 sm:p-3 border border-blue-200 shadow-sm">
                      <p className="text-blue-800 font-semibold mb-1 text-xs sm:text-sm">Customer</p>
                      <p className="text-gray-900 leading-relaxed text-xs sm:text-sm">{features[activeFeature].conversation.customer}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 sm:mt-2 ml-2">
                      <div className="flex space-x-1">
                        <div className="w-1 h-3 sm:h-4 bg-blue-400 rounded-full animate-pulse"></div>
                        <div className="w-1 h-4 sm:h-6 bg-blue-500 rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-1 h-2 sm:h-3 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-blue-600 text-xs font-medium">Speaking...</span>
                    </div>
                  </div>
                </div>

                {/* AI Responding */}
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-9 sm:h-9 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                    <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-green-50 rounded-xl rounded-tl-sm p-2 sm:p-3 border border-green-200 shadow-sm">
                      <p className="text-green-800 font-semibold mb-1 text-xs sm:text-sm">AI Receptionist</p>
                      <p className="text-gray-900 leading-relaxed text-xs sm:text-sm">{features[activeFeature].conversation.ai}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 sm:mt-2 ml-2">
                      <div className="flex space-x-1">
                        <div className="w-1 h-4 sm:h-5 bg-green-400 rounded-full animate-pulse"></div>
                        <div className="w-1 h-5 sm:h-7 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-1 h-3 sm:h-4 bg-green-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-1 h-4 sm:h-6 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
                      </div>
                      <span className="text-green-600 text-xs font-medium">AI responding...</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
        </div>



      </div>
    </section>
  );
};

export default DemoSection;
