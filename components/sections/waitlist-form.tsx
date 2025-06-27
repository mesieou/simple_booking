"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const WaitlistForm = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setStatus('error');
      setErrorMessage('Please enter a valid email address');
      return;
    }

    try {
      // Here you would typically send the email to your backend
      // For now, we'll just simulate a successful submission
      await new Promise(resolve => setTimeout(resolve, 1000));
      setStatus('success');
      setEmail('');
    } catch (error) {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Join the Waitlist</h2>
        </div>
        
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'loading'}
            className="flex-1"
            required
          />
          <Button 
            type="submit" 
            disabled={status === 'loading'}
            className="whitespace-nowrap"
          >
            {status === 'loading' ? 'Loading...' : 'Join Waitlist'}
          </Button>
        </div>

        {status === 'success' && (
          <p className="text-green-600 text-sm text-center">
            Thanks! You've been added to the waitlist.
          </p>
        )}

        {status === 'error' && (
          <p className="text-red-600 text-sm text-center">
            {errorMessage}
          </p>
        )}
      </form>
    </div>
  );
};

export default WaitlistForm; 