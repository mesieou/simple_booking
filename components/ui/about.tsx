"use client";

import { motion } from "framer-motion";
import React from "react";

const About = () => (
  <motion.section
    className="max-w-2xl mx-auto my-12 p-8 bg-card rounded-lg shadow-md"
    initial={{ scale: 0.5, opacity: 0 }}
    whileInView={{ scale: 1, opacity: 1 }}
    transition={{ duration: 1.2, type: "spring" }}
    viewport={{ once: false, amount: 0.2 }}
  >
    <h2 className="text-3xl font-bold mb-4 text-primary">Skedy</h2>
    <p className="mb-4 text-lg text-foreground/90">
      Is a modern platform for booking and calendar management, designed for service businesses that want to optimize their operations and improve the customer experience.
    </p>
    <ul className="list-disc pl-6 text-foreground/80 mb-4">
      <li>Real-time booking and quote management</li>
      <li>Control of schedules and availability</li>
      <li>Intelligent chatbot for automated support</li>
      <li>Support for multiple roles and businesses</li>
      <li>Intuitive interface adaptable to any device</li>
    </ul>
    <p className="text-foreground/80">
      Our mission is to make business digitalization easy, allowing both customers and providers to manage their services efficiently, securely, and simply.
    </p>
  </motion.section>
);

export default About;