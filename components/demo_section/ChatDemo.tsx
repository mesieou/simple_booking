"use client";

import { MessageCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const ChatDemo = () => {
  return (
    <div className="relative">
      <div className="bg-stone-200 rounded-3xl p-8 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-black font-semibold">SkedyBot</h3>
              <p className="text-green-400 text-sm">Online</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          </div>
        </div>
        
        <div className="space-y-4 h-64 overflow-y-auto">
          <div className="flex justify-start">
            <div className="bg-white text-black p-3 rounded-lg max-w-xs">
              Hi! I'm your virtual assistant. How can I help you today?
            </div>
          </div>
          <div className="flex justify-end">
            <div className="bg-green-500 text-white p-3 rounded-lg max-w-xs">
              Hi, I want to make a booking
            </div>
          </div>
          <div className="flex justify-start">
            <div className="bg-white text-black p-3 rounded-lg max-w-xs">
              Perfect! For how many people and what date do you prefer?
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex space-x-2">
          <input 
            type="text" 
            placeholder="Type your message..." 
            className="flex-1 bg-white text-black p-3 rounded-lg border-none focus:ring-2 focus:ring-purple-500"
          />
          <Button className="bg-green-500 hover:bg-green-600">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatDemo; 