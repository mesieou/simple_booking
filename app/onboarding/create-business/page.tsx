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
import { FaqStep } from '@/components/onboarding/faq-step';
import { PaymentStep } from '@/components/onboarding/payment-step';
import { useToast } from '@/lib/rename-categorise-better/utils/use-toast';
import { type BusinessCategoryType, getBusinessTemplate } from '@/lib/config/business-templates';
import { businessInfoSchema, servicesSchema } from '@/lib/validations/onboarding';
import { ZodError } from 'zod';

interface BusinessFormData {
  // Business Category
  businessCategory: BusinessCategoryType | '';
  
  // Business Information
  businessName: string;
  ownerFirstName: string;
  ownerLastName: string;
  email: string;
  phone: string;
  phoneCountryCode?: string;
  whatsappNumber: string;
  whatsappCountryCode?: string;
  businessAddress: string;
  websiteUrl?: string;
  timeZone: string;
  userRole: 'admin' | 'admin/provider';
  numberOfProviders: number;
  providerNames: string[];
  
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
  
  // Calendar - per provider settings
  providerCalendarSettings: Array<{
    providerIndex: number;
    providerName: string;
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
  }>;
  
  // FAQ Documents
  faqDocument?: File | null;
  faqDocumentName?: string;
  faqDocumentSize?: number;
  faqDocumentBase64?: string;
  
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
    title: 'FAQ Documents',
    description: 'Upload your frequently asked questions'
  },
  {
    id: 5,
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
  phoneCountryCode: '+61',
  whatsappNumber: '',
  whatsappCountryCode: '+61',
  businessAddress: '',
  websiteUrl: '',
  timeZone: 'Australia/Sydney',
  userRole: 'admin',
  numberOfProviders: 1,
  providerNames: [''],
  password: '',
  services: [],
  providerCalendarSettings: [
    {
      providerIndex: 0,
      providerName: 'Provider 1',
      workingHours: {
        mon: { start: '09:00', end: '17:00' },
        tue: { start: '09:00', end: '17:00' },
        wed: { start: '09:00', end: '17:00' },
        thu: { start: '09:00', end: '17:00' },
        fri: { start: '09:00', end: '17:00' },
        sat: null,
        sun: null
      },
      bufferTime: 15
    }
  ],
  faqDocument: null,
  faqDocumentName: '',
  faqDocumentSize: 0,
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
      
      // Ensure all services have valid duration estimates (supported availability intervals)
      const validDurations = [60, 90, 120, 150, 180, 240, 300, 360];
      const correctedServices = template.services.map(service => ({
        ...service,
        durationEstimate: validDurations.includes(service.durationEstimate) ? service.durationEstimate : 60
      }));
      
      setFormData(prev => {
        // Apply template settings to all provider calendar settings
        const updatedProviderSettings = prev.providerCalendarSettings.map(setting => ({
          ...setting,
          workingHours: template.defaultWorkingHours,
          bufferTime: template.bufferTime
        }));
        
        return {
          ...prev,
          services: correctedServices,
          providerCalendarSettings: updatedProviderSettings,
          depositPercentage: template.depositPercentage
        };
      });
    }
  }, [formData.businessCategory]);

  // Handle provider names based on user role changes
  useEffect(() => {
    if (formData.userRole === 'admin/provider') {
      // For admin/provider, we don't need to store owner name in providerNames array
      // The owner name is handled separately in calendar settings
      // Ensure providerNames has correct length for additional providers only
      const additionalProvidersCount = Math.max(0, formData.numberOfProviders - 1);
      if (formData.providerNames.length !== additionalProvidersCount) {
        const newProviderNames = [...formData.providerNames];
        while (newProviderNames.length < additionalProvidersCount) {
          newProviderNames.push('');
        }
        if (newProviderNames.length > additionalProvidersCount) {
          newProviderNames.splice(additionalProvidersCount);
        }
        setFormData(prev => ({ ...prev, providerNames: newProviderNames }));
      }
    } else if (formData.userRole === 'admin') {
      // For admin role, providerNames should match numberOfProviders
      if (formData.providerNames.length !== formData.numberOfProviders) {
        const newProviderNames = [...formData.providerNames];
        while (newProviderNames.length < formData.numberOfProviders) {
          newProviderNames.push('');
        }
        if (newProviderNames.length > formData.numberOfProviders) {
          newProviderNames.splice(formData.numberOfProviders);
        }
        setFormData(prev => ({ ...prev, providerNames: newProviderNames }));
      }
    }
  }, [formData.userRole, formData.numberOfProviders]);

  // Update provider calendar settings when number of providers changes
  useEffect(() => {
    const currentSettings = formData.providerCalendarSettings;
    const targetCount = formData.numberOfProviders;
    
    if (currentSettings.length !== targetCount) {
      const newSettings = [...currentSettings];
      
      // Add new provider settings if needed
      while (newSettings.length < targetCount) {
        const index = newSettings.length;
        
        // Generate provider name based on role and index
        const generateProviderName = (providerIndex: number) => {
          if (providerIndex === 0 && formData.userRole === 'admin/provider') {
            return `${formData.ownerFirstName} ${formData.ownerLastName}`.trim() || `Provider ${providerIndex + 1}`;
          } else {
            const providerNameIndex = formData.userRole === 'admin/provider' ? providerIndex - 1 : providerIndex;
            return formData.providerNames[providerNameIndex] || `Provider ${providerIndex + 1}`;
          }
        };
        
        newSettings.push({
          providerIndex: index,
          providerName: generateProviderName(index),
          workingHours: {
            mon: { start: '09:00', end: '17:00' },
            tue: { start: '09:00', end: '17:00' },
            wed: { start: '09:00', end: '17:00' },
            thu: { start: '09:00', end: '17:00' },
            fri: { start: '09:00', end: '17:00' },
            sat: null,
            sun: null
          },
          bufferTime: 15
        });
      }
      
      // Remove excess provider settings
      if (newSettings.length > targetCount) {
        newSettings.splice(targetCount);
      }
      
      setFormData(prev => ({ ...prev, providerCalendarSettings: newSettings }));
    }
  }, [formData.numberOfProviders]);

  // Update provider names in calendar settings when provider names change
  useEffect(() => {
    const updatedSettings = formData.providerCalendarSettings.map((setting, index) => {
      let providerName = '';
      
      if (index === 0 && formData.userRole === 'admin/provider') {
        // First provider is the owner when role is admin/provider
        providerName = `${formData.ownerFirstName} ${formData.ownerLastName}`.trim() || `Provider ${index + 1}`;
      } else {
        // For additional providers, get the name from providerNames array
        // When userRole is 'admin/provider', providerNames[0] is for the second provider (index 1)
        // When userRole is 'admin', providerNames[0] is for the first provider (index 0)
        const providerNameIndex = formData.userRole === 'admin/provider' ? index - 1 : index;
        providerName = formData.providerNames[providerNameIndex] || `Provider ${index + 1}`;
      }
      
      // Only update if the name has actually changed to avoid unnecessary re-renders
      if (setting.providerName !== providerName) {
        return { ...setting, providerName };
      }
      return setting;
    });
    
    // Only update state if there are actual changes
    const hasChanges = updatedSettings.some((setting, index) => 
      setting.providerName !== formData.providerCalendarSettings[index]?.providerName
    );
    
    if (hasChanges) {
      setFormData(prev => ({ ...prev, providerCalendarSettings: updatedSettings }));
    }
  }, [formData.providerNames, formData.ownerFirstName, formData.ownerLastName, formData.userRole, formData.providerCalendarSettings]);

  // Validation function for Business Information step
  const validateBusinessInfo = () => {
    try {
      // Prepare data for validation
      const phoneCountryCode = formData.phoneCountryCode || '+61';
      const whatsappCountryCode = formData.whatsappCountryCode || '+61';
      
      // Only combine country code with phone number if the local number is provided
      const fullPhone = formData.phone ? `${phoneCountryCode}${formData.phone}` : '';
      const fullWhatsappNumber = formData.whatsappNumber ? `${whatsappCountryCode}${formData.whatsappNumber}` : '';
      
      // Provider names are already structured correctly for validation
      // admin/provider role: providerNames contains only additional providers
      // admin role: providerNames contains all providers
      const validationProviderNames = formData.providerNames;
      
      const validationData = {
        businessCategory: formData.businessCategory,
        businessName: formData.businessName,
        ownerFirstName: formData.ownerFirstName,
        ownerLastName: formData.ownerLastName,
        email: formData.email,
        phone: fullPhone,
        whatsappNumber: fullWhatsappNumber,
        businessAddress: formData.businessAddress,
        websiteUrl: formData.websiteUrl || '',
        timeZone: formData.timeZone,
        userRole: formData.userRole,
        numberOfProviders: formData.numberOfProviders,
        providerNames: validationProviderNames,
      };

      // Simple phone number validation
      if (!formData.phone || formData.phone.trim().length < 7) {
        throw new Error('Please enter a valid phone number (minimum 7 digits)');
      }
      
      if (!formData.whatsappNumber || formData.whatsappNumber.trim().length < 7) {
        throw new Error('Please enter a valid WhatsApp number (minimum 7 digits)');
      }
      
      // Count only digits for length validation
      const phoneDigits = formData.phone.replace(/[^\d]/g, '');
      const whatsappDigits = formData.whatsappNumber.replace(/[^\d]/g, '');
      
      if (phoneDigits.length > 10) {
        throw new Error('Phone number should not be more than 10 digits');
      }
      
      if (whatsappDigits.length > 10) {
        throw new Error('WhatsApp number should not be more than 10 digits');
      }

      // Business address validation
      if (!formData.businessAddress || formData.businessAddress.trim().length < 5) {
        throw new Error('Please enter a complete business address (minimum 5 characters)');
      }
      
      if (formData.businessAddress.trim().length > 500) {
        throw new Error('Business address must be less than 500 characters');
      }
      
      // Check if address contains some basic components (not just whitespace or single words)
      const addressParts = formData.businessAddress.trim().split(/\s+/);
      if (addressParts.length < 2) {
        throw new Error('Please enter a complete address with street and suburb/city');
      }

      // Validate using zod schema (with full international numbers)
      businessInfoSchema.parse(validationData);

      // Additional password validation for business info step
      if (!formData.password || formData.password.length < 8) {
        throw new Error('Password is required and must be at least 8 characters');
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
      if (!passwordRegex.test(formData.password)) {
        throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      }

      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        // Get the first validation error message
        const firstError = error.errors[0];
        toast({
          title: "Validation Error",
          description: firstError.message,
          variant: "destructive",
        });
      } else if (error instanceof Error) {
        toast({
          title: "Validation Error", 
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Validation Error",
          description: "Please check all required fields",
          variant: "destructive",
        });
      }
      return false;
    }
  };

  // State to track if there's an unsaved service being edited
  const [hasUnsavedService, setHasUnsavedService] = useState(false);

  // Validation function for Services & Pricing step
  const validateServices = () => {
    try {
      // Check if there's a service currently being edited that hasn't been saved
      if (hasUnsavedService) {
        throw new Error('Please save or cancel the service you are currently editing before proceeding');
      }

      if (!formData.services || formData.services.length === 0) {
        throw new Error('Please add at least one service');
      }

      // Check each service for required fields
      for (let i = 0; i < formData.services.length; i++) {
        const service = formData.services[i];
        
        if (!service.name || service.name.trim().length < 2) {
          throw new Error(`Service ${i + 1}: Service name is required and must be at least 2 characters`);
        }
        
        if (!service.description || service.description.trim().length < 10) {
          throw new Error(`Service ${i + 1}: Description is required and must be at least 10 characters`);
        }
        
        if (!service.durationEstimate || ![60, 90, 120, 150, 180, 240, 300, 360].includes(service.durationEstimate)) {
          throw new Error(`Service ${i + 1}: Please select a valid duration from the available options`);
        }
        
        if (service.pricingType === 'fixed') {
          if (!service.fixedPrice || service.fixedPrice <= 0) {
            throw new Error(`Service ${i + 1}: Fixed price is required and must be greater than 0`);
          }
        } else if (service.pricingType === 'per_minute') {
          if (!service.ratePerMinute || service.ratePerMinute <= 0) {
            throw new Error(`Service ${i + 1}: Rate per hour is required and must be greater than 0`);
          }
        }
      }

      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        // Get the first validation error message
        const firstError = error.errors[0];
        toast({
          title: "Services Validation Error",
          description: firstError.message,
          variant: "destructive",
        });
      } else if (error instanceof Error) {
        toast({
          title: "Services Validation Error", 
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Services Validation Error",
          description: "Please check all service information",
          variant: "destructive",
        });
      }
      return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      // Validate current step before proceeding
      if (currentStep === 1) {
        // Business Information step validation
        if (!validateBusinessInfo()) {
          return; // Don't proceed if validation fails
        }
      } else if (currentStep === 2) {
        // Services & Pricing step validation
        if (!validateServices()) {
          return; // Don't proceed if validation fails
        }
      }
      // Add validation for other steps here as needed
      
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
      // Prepare form data for submission
      const submissionData = { ...formData };
      
      // Convert FAQ document to base64 if present
      if (formData.faqDocument) {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(formData.faqDocument!);
          });
          
          submissionData.faqDocumentBase64 = base64;
          // Remove the File object as it can't be serialized
          delete submissionData.faqDocument;
        } catch (error) {
          console.error('Error converting FAQ document to base64:', error);
          toast({
            title: "Error",
            description: "Failed to process FAQ document. Please try again.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch('/api/onboarding/create-business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create business');
      }

      const result = await response.json();
      
      toast({
        title: "Business created successfully!",
        description: `Welcome to Skedy, ${result.owner.firstName}!`,
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
            onEditingChange={setHasUnsavedService}
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
          <FaqStep
            data={{
              ...formData,
              businessName: formData.businessName,
              businessCategory: formData.businessCategory
            }}
            onUpdate={updateFormData}
          />
        );
      case 5:
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