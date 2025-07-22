'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { BusinessInfoStep } from '@/components/onboarding/business-info-step';
import { ServicesStep } from '@/components/onboarding/services-step';
import { CalendarStep } from '@/components/onboarding/calendar-step';
import { PaymentStep } from '@/components/onboarding/payment-step';
import { useToast } from '@/lib/rename-categorise-better/utils/use-toast';
import { type BusinessCategoryType, getBusinessTemplate } from '@/lib/config/business-templates';

interface BusinessFormData {
  // Business Category
  businessCategory: BusinessCategoryType | '';
  
  // Business Information
  businessName: string;
  ownerFirstName: string;
  ownerLastName: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  businessAddress: string;
  websiteUrl?: string;
  timeZone: string;
  userRole: 'admin' | 'admin/provider';
  
  // Auth
  password: string;
  
  // Services
  services: Array<{
    name: string;
    pricingType: 'fixed' | 'per_minute';
    fixedPrice?: number;
    baseCharge?: number;
    ratePerMinute?: number;
    description: string;
    durationEstimate: number;
    mobile: boolean;
  }>;
  
  // Calendar
  workingHours: {
    mon: { start: string; end: string } | null;
    tue: { start: string; end: string } | null;
    wed: { start: string; end: string } | null;
    thu: { start: string; end: string } | null;
    fri: { start: string; end: string } | null;
    sat: { start: string; end: string } | null;
    sun: { start: string; end: string } | null;
  };
  bufferTime: number;
  
  // Payment
  depositPercentage: number;
  preferredPaymentMethod: string;
  setupPayments: boolean;
}

const STEPS = [
  {
    id: 1,
    title: 'Business Information',
    description: 'Tell us about your business'
  },
  {
    id: 2,
    title: 'Services & Pricing',
    description: 'Configure your services'
  },
  {
    id: 3,
    title: 'Schedule & Availability',
    description: 'Set your working hours'
  },
  {
    id: 4,
    title: 'Payment Setup',
    description: 'Configure payment processing'
  }
];

const DEFAULT_FORM_DATA: BusinessFormData = {
  businessCategory: '',
  businessName: '',
  ownerFirstName: '',
  ownerLastName: '',
  email: '',
  phone: '',
  whatsappNumber: '',
  businessAddress: '',
  websiteUrl: '',
  timeZone: 'Australia/Sydney',
  userRole: 'admin/provider',
  password: '',
  services: [],
  workingHours: {
    mon: { start: '09:00', end: '17:00' },
    tue: { start: '09:00', end: '17:00' },
    wed: { start: '09:00', end: '17:00' },
    thu: { start: '09:00', end: '17:00' },
    fri: { start: '09:00', end: '17:00' },
    sat: null,
    sun: null
  },
  bufferTime: 15,
  depositPercentage: 25,
  preferredPaymentMethod: 'cash',
  setupPayments: false
};

export default function CreateBusinessPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<BusinessFormData>(DEFAULT_FORM_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const progress = (currentStep / STEPS.length) * 100;
  const isLastStep = currentStep === STEPS.length;

  // Update form data when business category changes
  useEffect(() => {
    if (formData.businessCategory) {
      const template = getBusinessTemplate(formData.businessCategory);
      setFormData(prev => ({
        ...prev,
        services: template.services,
        workingHours: template.defaultWorkingHours,
        bufferTime: template.bufferTime,
        depositPercentage: template.depositPercentage
      }));
    }
  }, [formData.businessCategory]);

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!isLastStep) {
      handleNext();
      return;
    }

    if (!formData.businessCategory) {
      toast({
        title: "Error",
        description: "Please select a business category",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/onboarding/create-business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create business');
      }

      const result = await response.json();
      
      toast({
        title: "Business created successfully!",
        description: `Welcome to Skedy, ${result.user.firstName}!`,
      });

      // If Stripe Connect setup is enabled, redirect to it
      if (formData.setupPayments && result.onboarding.stripeAccountId) {
        const stripeResponse = await fetch('/api/onboarding/stripe-connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessId: result.business.id,
            action: 'create_onboarding_link'
          }),
        });
        
        if (stripeResponse.ok) {
          const stripeResult = await stripeResponse.json();
          window.location.href = stripeResult.onboardingUrl;
          return;
        }
      }

      // Otherwise redirect to dashboard
      router.push('/protected');

    } catch (error) {
      console.error('Error creating business:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create business',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (stepData: Partial<BusinessFormData>) => {
    setFormData(prev => ({ ...prev, ...stepData }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <BusinessInfoStep
            data={formData}
            onUpdate={updateFormData}
          />
        );
      case 2:
        return (
          <ServicesStep
            data={formData}
            onUpdate={updateFormData}
          />
        );
      case 3:
        return (
          <CalendarStep
            data={formData}
            onUpdate={updateFormData}
          />
        );
      case 4:
        return (
          <PaymentStep
            data={formData}
            onUpdate={updateFormData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-3">
            Launch Your Business in Minutes
          </h1>
          <p className="text-xl text-white/90">
            Create your automated booking system and start taking customers instantly
          </p>
        </div>

        {/* Main Form Container */}
        <div className="bg-white rounded-lg p-8 shadow-lg border">
            {/* Progress Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {STEPS.map((step, index) => (
                  <div
                    key={step.id}
                    className={`flex items-center ${
                      index < STEPS.length - 1 ? 'flex-1' : ''
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                        currentStep >= step.id
                          ? 'bg-primary border-primary text-white shadow-sm'
                          : 'border-gray-300 text-gray-400 bg-gray-100'
                      }`}
                    >
                      {currentStep > step.id ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        step.id
                      )}
                    </div>
                    <div className="ml-3 text-sm">
                      <p
                        className={`font-semibold ${
                          currentStep >= step.id ? 'text-gray-800' : 'text-gray-500'
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-gray-600 hidden sm:block">
                        {step.description}
                      </p>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-4 transition-colors ${
                          currentStep > step.id ? 'bg-primary' : 'bg-gray-300'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Main Form Content */}
            <div className="space-y-8">
              {/* Step Title */}
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{STEPS[currentStep - 1].title}</h2>
                <p className="text-lg text-gray-600">{STEPS[currentStep - 1].description}</p>
              </div>
              
              {/* Form Content */}
              <div className="max-w-4xl mx-auto">
                {renderStep()}
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center max-w-4xl mx-auto pt-6">
                <Button
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-l from-secondary to-primary text-white font-semibold shadow-md hover:from-secondary/90 hover:to-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                  Previous
                </Button>

                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Creating...
                    </>
                  ) : isLastStep ? (
                    'Create Business'
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}