"use client";

import { motion } from "framer-motion";
import React from "react";
import { useLanguage } from "@/lib/translations/language-context";

const About = () => {
  const { t } = useLanguage();
  
  return (
    <motion.section
      className="max-w-2xl mx-auto my-12 p-8 bg-card rounded-lg shadow-md"
      initial={{ scale: 0.5, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      transition={{ duration: 1.2, type: "spring" }}
      viewport={{ once: false, amount: 0.2 }}
    >
      <h2 className="text-3xl font-bold mb-4 text-primary">Skedy</h2>
      <p className="mb-4 text-lg text-foreground/90">
        {t('description')}
      </p>
      <ul className="list-disc pl-6 text-foreground/80 mb-4">
        <li>{t('feature_booking')}</li>
        <li>{t('feature_schedule')}</li>
        <li>{t('feature_chatbot')}</li>
        <li>{t('feature_roles')}</li>
        <li>{t('feature_interface')}</li>
      </ul>
      <p className="text-foreground/80">
        {t('mission')}
      </p>
    </motion.section>
  );
};

export default About;