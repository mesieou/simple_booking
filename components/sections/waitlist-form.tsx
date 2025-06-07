// Este archivo será movido a components/sections/waitlist-form.tsx
'use client';

import React, { useState } from "react";
import { FormMessage, Message } from "@components/form/form-message";
import { createClient } from "@/lib/database/supabase/client"
import { useLanguage } from "@/lib/rename-categorise-better/utils/translations/language-context";

// Main JoinWaitlist component
function JoinWaitlist() {
  const { t } = useLanguage();
  //create an instance of supa to save the emails in the database
  const supa = createClient();
  
  const [email, setEmail] = useState<string>("");
  const [formMessage, setFormMessage] = useState<Message | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
   
  // this saves the email typed by the user using usestate hook
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  // this function checks the email format and send it to supa
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFormMessage({ error: t('waitlist.error_invalid_email') });
      return;
    }

    // updates the use state and display a success message to the user
    setIsSubmitted(true);
    setFormMessage({ success: t('waitlist.success') });

    
    // Saving the email to the database
    const { data, error } = await supa.from("waitlist").insert([{email}]);  
    if (error) {
      console.error("Supabase insert error", error);
      setFormMessage({ error: t('waitlist.error_generic') })
      setIsSubmitted(false);
    }
  };

  return (
    <div className="flex justify-center items-center md:p-6">
      <div className="max-w-md w-ful p-6  md:flex items-center gap-2">
        <h2 className="text-2xl text-white font-semibold mb-4 text-center">{t('waitlist.title')}</h2>

        {/* Display success or error message */}
        {formMessage && <FormMessage message={formMessage} />}

        {!isSubmitted && (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <input
                type="email"
                id="email"
                value={email}
                onChange={handleEmailChange}
                required
                placeholder={t('waitlist.email_placeholder')}
                className="w-full text-black bg-white p-2 mt-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-center"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground py-2 rounded-md hover:bg-gradient-to-l from-primary to-secondary focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {t('waitlist.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default JoinWaitlist;
