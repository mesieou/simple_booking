'use client';

import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Scissors, User, Users, Plus, Minus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAllBusinessCategories, type BusinessCategoryType } from '@/lib/config/business-templates';

interface BusinessInfoStepProps {
  data: {
    businessCategory: BusinessCategoryType | '';
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
    password: string;
    numberOfProviders: number;
    providerNames: string[];
  };
  onUpdate: (data: any) => void;
  onEmailValidationChange?: (isValid: boolean | null) => void;
}

const CATEGORY_ICONS = {
  removalist: Truck,
  salon: Scissors
};

const TIMEZONES = [
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEDT)' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
  { value: 'Australia/Perth', label: 'Perth (AWST)' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACDT)' },
  { value: 'Australia/Darwin', label: 'Darwin (ACST)' },
  { value: 'Australia/Hobart', label: 'Hobart (AEDT)' },
];

const COUNTRY_CODES = [
  { value: '+61', label: '🇦🇺 +61', country: 'Australia', placeholder: '4XX XXX XXX' },
  { value: '+1', label: '🇺🇸 +1', country: 'United States', placeholder: '(555) 123-4567' },
  { value: '+44', label: '🇬🇧 +44', country: 'United Kingdom', placeholder: '7XXX XXXXXX' },
  { value: '+33', label: '🇫🇷 +33', country: 'France', placeholder: '6 XX XX XX XX' },
  { value: '+49', label: '🇩🇪 +49', country: 'Germany', placeholder: '1XX XXXXXXX' },
  { value: '+81', label: '🇯🇵 +81', country: 'Japan', placeholder: '90-XXXX-XXXX' },
  { value: '+86', label: '🇨🇳 +86', country: 'China', placeholder: '138 XXXX XXXX' },
  { value: '+91', label: '🇮🇳 +91', country: 'India', placeholder: '98XXX XXXXX' },
];

export function BusinessInfoStep({ data, onUpdate, onEmailValidationChange }: BusinessInfoStepProps) {
  const categories = getAllBusinessCategories();
  
  // Email validation state
  const [emailValidation, setEmailValidation] = useState<{
    isValidating: boolean;
    isValid: boolean | null;
    message: string;
  }>({
    isValidating: false,
    isValid: null,
    message: ''
  });

  const handleInputChange = (field: string, value: string) => {
    onUpdate({ [field]: value });
  };

  // Email validation function
  const validateEmail = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) {
      setEmailValidation({
        isValidating: false,
        isValid: false,
        message: 'Please enter a valid email address'
      });
      
      // Notify parent component about validation failure
      onEmailValidationChange?.(false);
      return;
    }

    setEmailValidation({
      isValidating: true,
      isValid: null,
      message: 'Checking email availability...'
    });

    try {
      const response = await fetch('/api/onboarding/validate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      setEmailValidation({
        isValidating: false,
        isValid: result.available,
        message: result.message
      });
      
      // Notify parent component about validation state
      onEmailValidationChange?.(result.available);
    } catch (error) {
      console.error('Email validation error:', error);
      setEmailValidation({
        isValidating: false,
        isValid: false,
        message: 'Error checking email availability'
      });
      
      // Notify parent component about validation failure
      onEmailValidationChange?.(false);
    }
  }, []);

  // Handle email input change with validation
  const handleEmailChange = (email: string) => {
    handleInputChange('email', email);
    
    // Clear previous validation when user starts typing
    setEmailValidation({
      isValidating: false,
      isValid: null,
      message: ''
    });
    
    // Notify parent that validation is pending
    onEmailValidationChange?.(null);
  };

  // Debounced email validation
  useEffect(() => {
    if (!data.email) return;

    const timeoutId = setTimeout(() => {
      validateEmail(data.email);
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [data.email, validateEmail]);

  const getPlaceholderForCountryCode = (countryCode: string) => {
    const country = COUNTRY_CODES.find(c => c.value === countryCode);
    return country ? country.placeholder : '4XX XXX XXX';
  };



  return (
    <div className="space-y-6 md:space-y-8">
      {/* Business Category Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold text-gray-800">Business Type</Label>
        <RadioGroup
          value={data.businessCategory}
          onValueChange={(value) => onUpdate({ businessCategory: value as BusinessCategoryType })}
        >
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            {categories.map((category) => {
              const Icon = CATEGORY_ICONS[category.value];
              const isSelected = data.businessCategory === category.value;
              
              return (
                <Label
                  key={category.value}
                  htmlFor={category.value}
                  className="cursor-pointer"
                >
                  <Card className={`transition-all duration-300 border-2 rounded-xl ${
                    isSelected 
                      ? 'ring-2 ring-primary border-primary bg-white shadow-xl scale-105' 
                      : 'border-gray-200 hover:border-primary/50 hover:shadow-lg bg-white hover:scale-102'
                  }`}>
                    <CardHeader className="space-y-1 p-3 sm:p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2 sm:space-x-3 flex-1">
                          <div className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                            isSelected ? 'bg-primary/10' : 'bg-gray-100'
                          }`}>
                            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${
                              isSelected ? 'text-primary' : 'text-gray-600'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm sm:text-base font-semibold text-gray-900">
                              {category.label}
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm text-gray-700 mt-0.5">
                              {category.description}
                            </CardDescription>
                          </div>
                        </div>
                        <RadioGroupItem
                          value={category.value}
                          id={category.value}
                          className="mt-1 shrink-0"
                        />
                      </div>
                    </CardHeader>
                  </Card>
                </Label>
              );
            })}
          </div>
        </RadioGroup>
      </div>

      {/* Business Details */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="businessName" className="text-sm font-semibold text-gray-800">Business Name</Label>
          <Input
            id="businessName"
            placeholder="Enter your business name"
            value={data.businessName}
            onChange={(e) => handleInputChange('businessName', e.target.value)}
            className="bg-white border-gray-300 text-black placeholder:text-gray-500 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timeZone" className="text-sm font-semibold text-gray-800">Time Zone</Label>
          <Select
            value={data.timeZone}
            onValueChange={(value) => handleInputChange('timeZone', value)}
          >
            <SelectTrigger id="timeZone" className="bg-white border-gray-300 text-black text-sm">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-300">
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value} className="text-black hover:bg-gray-100 text-sm">
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Owner Information */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-800">Owner Information</h3>
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ownerFirstName" className="text-sm font-semibold text-gray-800">First Name</Label>
            <Input
              id="ownerFirstName"
              placeholder="John"
              value={data.ownerFirstName}
              onChange={(e) => handleInputChange('ownerFirstName', e.target.value)}
              className="bg-white border-gray-300 text-black placeholder:text-gray-500 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerLastName" className="text-sm font-semibold text-gray-800">Last Name</Label>
            <Input
              id="ownerLastName"
              placeholder="Doe"
              value={data.ownerLastName}
              onChange={(e) => handleInputChange('ownerLastName', e.target.value)}
              className="bg-white border-gray-300 text-black placeholder:text-gray-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Provider Count Section */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Team Size</h3>
          <p className="text-sm text-gray-600 mt-2">
            {data.userRole === 'admin' 
              ? 'How many team members can provide services at the same time? This allows multiple bookings for the same time slot.'
              : 'How many team members (including yourself) can provide services at the same time? This allows multiple bookings for the same time slot.'
            }
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Label htmlFor="numberOfProviders" className="text-sm font-semibold text-gray-800 shrink-0">
              Number of Providers:
            </Label>
            <div className="flex items-center justify-center sm:justify-start space-x-2">
              <Button
                type="button"
                size="sm"
                className="h-8 w-8 p-0 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                onClick={() => {
                  const newCount = Math.max(1, data.numberOfProviders - 1);
                  const newProviderNames = [...data.providerNames];
                  if (newCount < data.providerNames.length) {
                    newProviderNames.splice(newCount);
                  }
                  onUpdate({ numberOfProviders: newCount, providerNames: newProviderNames });
                }}
                disabled={data.numberOfProviders <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="bg-white border border-gray-300 rounded-md px-3 py-1.5 min-w-[2.5rem]">
                <span className="text-sm sm:text-base font-semibold text-black text-center block">{data.numberOfProviders}</span>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-8 w-8 p-0 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                onClick={() => {
                  const newCount = Math.min(10, data.numberOfProviders + 1);
                  const newProviderNames = [...data.providerNames];
                  while (newProviderNames.length < newCount) {
                    newProviderNames.push('');
                  }
                  onUpdate({ numberOfProviders: newCount, providerNames: newProviderNames });
                }}
                disabled={data.numberOfProviders >= 10}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {(data.numberOfProviders > 1 || data.userRole === 'admin') && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-800">
                Provider Names:
              </Label>
              <div className="grid gap-3">
                {Array.from({ length: data.numberOfProviders }, (_, index) => {
                  // For admin/provider role: first provider is owner (disabled), additional providers use providerNames array
                  // For admin role: all providers use providerNames array
                  const isOwnerSlot = index === 0 && data.userRole === 'admin/provider';
                  const providerNamesIndex = data.userRole === 'admin/provider' ? index - 1 : index;
                  
                  return (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <Label className="text-sm text-gray-600 sm:min-w-[80px] shrink-0">
                        Provider {index + 1}:
                      </Label>
                      {isOwnerSlot ? (
                        <Input
                          value={`${data.ownerFirstName} ${data.ownerLastName}`.trim() || 'You (Owner)'}
                          disabled
                          className="bg-gray-50 border-gray-200 text-gray-600 text-sm flex-1"
                        />
                      ) : (
                        <Input
                          placeholder={`Enter provider ${index + 1} name`}
                          value={data.providerNames[providerNamesIndex] || ''}
                          onChange={(e) => {
                            const newProviderNames = [...data.providerNames];
                            newProviderNames[providerNamesIndex] = e.target.value;
                            onUpdate({ providerNames: newProviderNames });
                          }}
                          className="bg-white border-gray-300 text-black placeholder:text-gray-500 text-sm flex-1"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Role Selection */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Your Role</h3>
          <p className="text-sm text-gray-600 mt-2">
            Choose how you'll be involved in your business operations
          </p>
        </div>
        <RadioGroup
          value={data.userRole}
          onValueChange={(value) => onUpdate({ userRole: value as 'admin' | 'admin/provider' })}
        >
          <div className="grid gap-4">
            {/* Admin Only Option */}
            <Label
              htmlFor="admin"
              className="cursor-pointer"
            >
              <Card className={`transition-all duration-300 border-2 rounded-xl ${
                data.userRole === 'admin' 
                  ? 'ring-2 ring-primary border-primary bg-white shadow-xl scale-105' 
                  : 'border-gray-200 hover:border-primary/50 hover:shadow-lg bg-white hover:scale-102'
              }`}>
                <CardHeader className="space-y-1 p-3 sm:p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1">
                      <div className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                        data.userRole === 'admin' ? 'bg-primary/10' : 'bg-gray-100'
                      }`}>
                        <User className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${
                          data.userRole === 'admin' ? 'text-primary' : 'text-gray-600'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm sm:text-base font-semibold text-gray-900">
                          Admin Only
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm text-gray-700 mt-0.5">
                          I manage the business but don't provide services myself. I'll hire other providers to do the work.
                        </CardDescription>
                      </div>
                    </div>
                    <RadioGroupItem
                      value="admin"
                      id="admin"
                      className="mt-1 shrink-0"
                    />
                  </div>
                </CardHeader>
              </Card>
            </Label>

            {/* Admin/Provider Option */}
            <Label
              htmlFor="admin/provider"
              className="cursor-pointer"
            >
              <Card className={`transition-all duration-300 border-2 rounded-xl ${
                data.userRole === 'admin/provider' 
                  ? 'ring-2 ring-primary border-primary bg-white shadow-xl scale-105' 
                  : 'border-gray-200 hover:border-primary/50 hover:shadow-lg bg-white hover:scale-102'
              }`}>
                <CardHeader className="space-y-1 p-3 sm:p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1">
                      <div className={`p-1.5 sm:p-2 rounded-lg ${
                        data.userRole === 'admin/provider' ? 'bg-primary/10' : 'bg-gray-100'
                      }`}>
                        <Users className={`w-4 h-4 sm:w-5 sm:h-5 ${
                          data.userRole === 'admin/provider' ? 'text-primary' : 'text-gray-600'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm sm:text-base font-semibold text-gray-900">
                          Admin & Provider
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm text-gray-700 mt-0.5">
                          I manage the business AND provide services myself alongside other team members.
                        </CardDescription>
                      </div>
                    </div>
                    <RadioGroupItem
                      value="admin/provider"
                      id="admin/provider"
                      className="mt-1 shrink-0"
                    />
                  </div>
                </CardHeader>
              </Card>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Contact Information */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-800">Contact Information</h3>
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold text-gray-800">Email Address</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={data.email}
                onChange={(e) => handleEmailChange(e.target.value)}
                className={`bg-white border text-black placeholder:text-gray-500 text-sm pr-10 ${
                  emailValidation.isValid === false 
                    ? 'border-red-500 focus:border-red-500' 
                    : emailValidation.isValid === true 
                      ? 'border-green-500 focus:border-green-500'
                      : 'border-gray-300'
                }`}
              />
              {/* Validation icon */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {emailValidation.isValidating && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
                {!emailValidation.isValidating && emailValidation.isValid === true && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {!emailValidation.isValidating && emailValidation.isValid === false && (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
            {/* Validation message */}
            {emailValidation.message && (
              <p className={`text-xs ${
                emailValidation.isValid === false 
                  ? 'text-red-600' 
                  : emailValidation.isValid === true 
                    ? 'text-green-600'
                    : 'text-blue-600'
              }`}>
                {emailValidation.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-semibold text-gray-800">Business Phone</Label>
            <div className="flex">
              <Select
                value={data.phoneCountryCode || '+61'}
                onValueChange={(value) => handleInputChange('phoneCountryCode', value)}
              >
                <SelectTrigger className="w-24 sm:w-32 bg-white border-gray-300 text-black rounded-r-none border-r-0 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {COUNTRY_CODES.map((country) => (
                    <SelectItem key={country.value} value={country.value} className="text-black hover:bg-gray-100 text-xs sm:text-sm">
                      {country.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="phone"
                type="tel"
                placeholder={getPlaceholderForCountryCode(data.phoneCountryCode || '+61')}
                value={data.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="bg-white border-gray-300 text-black placeholder:text-gray-500 rounded-l-none flex-1 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsappNumber" className="text-sm font-semibold text-gray-800">WhatsApp Number</Label>
            <div className="flex">
              <Select
                value={data.whatsappCountryCode || '+61'}
                onValueChange={(value) => handleInputChange('whatsappCountryCode', value)}
              >
                <SelectTrigger className="w-24 sm:w-32 bg-white border-gray-300 text-black rounded-r-none border-r-0 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {COUNTRY_CODES.map((country) => (
                    <SelectItem key={country.value} value={country.value} className="text-black hover:bg-gray-100 text-xs sm:text-sm">
                      {country.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="whatsappNumber"
                type="tel"
                placeholder={getPlaceholderForCountryCode(data.whatsappCountryCode || '+61')}
                value={data.whatsappNumber}
                onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                className="bg-white border-gray-300 text-black placeholder:text-gray-500 rounded-l-none flex-1 text-sm"
              />
            </div>
            <p className="text-xs sm:text-sm text-gray-600">
              This is the number customers will message
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="websiteUrl" className="text-sm font-semibold text-gray-800">Website (Optional)</Label>
            <Input
              id="websiteUrl"
              type="url"
              placeholder="https://www.example.com"
              value={data.websiteUrl || ''}
              onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
              className="bg-white border-gray-300 text-black placeholder:text-gray-500 text-sm"
            />
          </div>
        </div>
        
        {/* Password Field */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-semibold text-gray-800">Account Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Create a secure password"
            value={data.password || ''}
            onChange={(e) => handleInputChange('password', e.target.value)}
            className="bg-white border-gray-300 text-black placeholder:text-gray-500 text-sm"
          />
          <p className="text-xs sm:text-sm text-gray-600">
            This will be your login password for the Skedy dashboard
          </p>
        </div>
      </div>

      {/* Business Address */}
      <div className="space-y-2">
        <Label htmlFor="businessAddress" className="text-sm font-semibold text-gray-800">Business Address</Label>
        <Textarea
          id="businessAddress"
          placeholder="123 Main Street, Sydney, NSW 2000"
          value={data.businessAddress}
          onChange={(e) => handleInputChange('businessAddress', e.target.value)}
          rows={3}
          className="bg-white border-gray-300 text-black placeholder:text-gray-500 text-sm resize-y"
        />
      </div>

      {data.businessCategory && (
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-green-50 border-2 border-green-200 rounded-lg shadow-sm">
          <p className="text-xs sm:text-sm text-green-800 font-medium">
            <strong className="text-green-900">Great choice!</strong> We'll pre-configure your services and settings based on your {data.businessCategory === 'removalist' ? 'removalist' : 'beauty salon'} business type. You can customize everything in the next steps.
          </p>
        </div>
      )}
    </div>
  );
}