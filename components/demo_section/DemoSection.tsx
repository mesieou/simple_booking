"use client";

import DemoHeader from "./DemoHeader";
import ConversationTabs from "./ConversationTabs";
import ChatDemo from "./ChatDemo";
import WhatsAppDemoButton from "./WhatsAppDemoButton";

const DemoSection = () => {
  return (
    <section id="demo" className="py-20 px-4 bg-white/5">
      <div className="container mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <DemoHeader />
            <ConversationTabs />
          </div>
          <ChatDemo />
        </div>
        <div className="flex justify-center mt-12">
          <WhatsAppDemoButton />
        </div>
      </div>
    </section>
  );
};

export default DemoSection; 