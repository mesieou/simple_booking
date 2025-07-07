import React, { useEffect, useState } from "react";

const icons = [
  {
    src: "/images/beneficts/24hours-removebg-preview.png",
    alt: "24/7 Support",
    label: "Answering questions 24/7",
    aria: "24/7 Support",
  },
  {
    src: "/images/beneficts/language-removebg-preview.png",
    alt: "Any Language",
    label: "Any language",
    aria: "Any Language",
  },
  {
    src: "/images/beneficts/whatsapp-removebg-preview.png",
    alt: "Personalized",
    label: "A constantly improving chatbot powered by your feedback",
    aria: "Personalized",
  },
  {
    src: "/images/beneficts/happy-removebg-preview.png",
    alt: "Happier Customers",
    label: "Happier customers",
    aria: "Happier Customers",
  },
  {
    src: "/images/beneficts/scalable-removebg-preview.png",
    alt: "Scalable",
    label: "Scalable",
    aria: "Scalable",
  },
  {
    src: "/images/beneficts/customizable-removebg-preview.png",
    alt: "Reduce Costs",
    label: "Personalized for your business in minutes",
    aria: "Reduce Costs",
  },
];

const AUTO_CYCLE_INTERVAL = 2000; // ms

const WhatYouGet = () => {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % icons.length);
    }, AUTO_CYCLE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="flex flex-col items-center justify-center py-12 w-full">
      <div className="flex items-center justify-around w-full max-w-4xl mb-8 gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold">What you get</h2>
          <h3 className="text-xl font-bold">- Reducing costs</h3>
          <h3 className="text-xl font-bold">- Increasing sales</h3>
        </div>
        <img
          src="/favicon.png"
          alt="Calendar Icon"
          className="w-40 h-40 md:w-56 md:h-56 rounded-2xl shadow-lg object-contain"
        />
      </div>
      
      <div className="flex flex-wrap justify-center gap-8 w-full max-w-4xl mb-8">
        {icons.map((icon, idx) => (
          <div key={icon.alt} className="flex flex-col items-center relative">
            <div
              aria-label={icon.aria}
              className={`bg-white rounded-full shadow-md p-3 transition-transform duration-500 ${
                activeIdx === idx ? "scale-125 ring-4 ring-purple-400" : "scale-100"
              }`}
            >
              <img src={icon.src} alt={icon.alt} className="w-14 h-14 object-contain" />
            </div>
          </div>
        ))}
      </div>
      <div className="text-center text-2xl font-medium text-primary min-h-[2.5rem] transition-all duration-500 bg-white rounded-full p-4">
        {icons[activeIdx].label}
      </div>
    </section>
  );
};

export default WhatYouGet;
