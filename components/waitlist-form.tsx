'use client';

import React, { useState } from "react";
import { FormMessage, Message } from "./form-message"; // Import FormMessage component

// Main JoinWaitlist component
function JoinWaitlist() {
  const [email, setEmail] = useState<string>("");
  const [formMessage, setFormMessage] = useState<Message | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFormMessage({ error: "Please enter a valid email address." });
      return;
    }

    // Handle form submission (replace with API call)
    setIsSubmitted(true);
    setFormMessage({ success: "Thank you for joining the waitlist!" });

    console.log("Submitted email:", email);
    // Replace with API call (e.g., axios.post("/api/subscribe", { email }))
  };

  return (
    <div className="flex justify-center items-center p-6">
      <div className="max-w-md w-ful p-6  flex items-center gap-2">
        <h2 className="text-2xl text-white font-semibold mb-4 text-center">Join the Waitlist</h2>

        {/* Display success or error message */}
        {formMessage && <FormMessage message={formMessage} />}

        {!isSubmitted ? (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-white-700"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={handleEmailChange}
                required
                placeholder="Enter your email"
                className="w-full bg-white p-2 mt-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground py-2 rounded-md hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
            >
              Join Waitlist
            </button>
          </form>
        ) : (
          <div className="text-center text-green-600 mt-4">
            <p>Thank you for joining the waitlist!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default JoinWaitlist;
