"use client";

import { Phone, PhoneCall } from "lucide-react";

const CallDemo = () => {
  return (
    <div className="w-full max-w-[400px] mx-auto">
      {/* Phone Call Interface */}
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 shadow-xl">

        {/* AI Avatar */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone className="w-12 h-12 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">AI Receptionist</h3>
          <p className="text-white/70">Taking a call...</p>
        </div>

        {/* Call Features */}
        <div className="space-y-4 mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white text-sm">Answering calls 24/7</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-white text-sm">Scheduling appointments</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
              <span className="text-white text-sm">Handling customer inquiries</span>
            </div>
          </div>
        </div>

        {/* Call Button */}
        <div className="text-center">
          <button className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full flex items-center gap-2 mx-auto transition-all duration-300 hover:scale-105 shadow-lg">
            <PhoneCall className="w-5 h-5" />
            Try a Demo Call
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallDemo;
