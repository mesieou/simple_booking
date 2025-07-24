'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Scissors, User, Users, Plus, Minus } from 'lucide-react';
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
    whatsappNumber: string;
    businessAddress: string;
    websiteUrl?: string;
    timeZone: string;
    userRole: 'admin' | 'admin/provider';
    password: string;
    numberOfProviders: number;
    providerNames: string[];
  };
  onUpdate: (data: any) => void;
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

export function BusinessInfoStep({ data, onUpdate }: BusinessInfoStepProps) {
  const categories = getAllBusinessCategories();

  const handleInputChange = (field: string, value: string) => {
    onUpdate({ [field]: value });
  };

  return (
    <div className="space-y-8">
      {/* Business Category Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold text-gray-800">Business Type</Label>
        <RadioGroup
          value={data.businessCategory}
          onValueChange={(value) => onUpdate({ businessCategory: value as BusinessCategoryType })}
        >
          <div className="grid gap-4 md:grid-cols-2">
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
                    <CardHeader className="space-y-1 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg transition-colors ${
                            isSelected ? 'bg-primary/10' : 'bg-gray-100'
                          }`}>
                            <Icon className={`w-5 h-5 transition-colors ${
                              isSelected ? 'text-primary' : 'text-gray-600'
                            }`} />
                          </div>
                          <div>
                            <CardTitle className="text-base font-semibold text-gray-900">
                              {category.label}
                            </CardTitle>
                            <CardDescription className="text-sm text-gray-700 mt-0.5">
                              {category.description}
                            </CardDescription>
                          </div>
                        </div>
                        <RadioGroupItem
                          value={category.value}
                          id={category.value}
                          className="mt-1"
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
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="businessName" className="text-sm font-semibold text-gray-800">Business Name</Label>
          <Input
            id="businessName"
            placeholder="Enter your business name"
            value={data.businessName}
            onChange={(e) => handleInputChange('businessName', e.target.value)}
            className="bg-white border-gray-300 text-black placeholder:text-gray-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timeZone" className="text-sm font-semibold text-gray-800">Time Zone</Label>
          <Select
            value={data.timeZone}
            onValueChange={(value) => handleInputChange('timeZone', value)}
          >
            <SelectTrigger id="timeZone" className="bg-white border-gray-300 text-black">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-300">
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value} className="text-black hover:bg-gray-100">
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
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ownerFirstName" className="text-sm font-semibold text-gray-800">First Name</Label>
            <Input
              id="ownerFirstName"
              placeholder="John"
              value={data.ownerFirstName}
              onChange={(e) => handleInputChange('ownerFirstName', e.target.value)}
              className="bg-white border-gray-300 text-black placeholder:text-gray-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerLastName" className="text-sm font-semibold text-gray-800">Last Name</Label>
            <Input
              id="ownerLastName"
              placeholder="Doe"
              value={data.ownerLastName}
              onChange={(e) => handleInputChange('ownerLastName', e.target.value)}
              className="bg-white border-gray-300 text-black placeholder:text-gray-500"
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
          <div className="flex items-center space-x-4">
            <Label htmlFor="numberOfProviders" className="text-sm font-semibold text-gray-800 min-w-fit">
              Number of Providers:
            </Label>
            <div className="flex items-center space-x-2">
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
                <span className="text-base font-semibold text-black text-center block">{data.numberOfProviders}</span>
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
                {Array.from({ length: data.numberOfProviders }, (_, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <Label className="text-sm text-gray-600 min-w-[80px]">
                      Provider {index + 1}:
                    </Label>
                    {index === 0 && data.userRole === 'admin/provider' ? (
                      <Input
                        value={`${data.ownerFirstName} ${data.ownerLastName}`.trim() || 'You'}
                        disabled
                        className="bg-gray-50 border-gray-200 text-gray-600"
                      />
                    ) : (
                      <Input
                        placeholder={`Enter provider ${index + 1} name`}
                        value={data.providerNames[index] || ''}
                        onChange={(e) => {
                          const newProviderNames = [...data.providerNames];
                          newProviderNames[index] = e.target.value;
                          onUpdate({ providerNames: newProviderNames });
                        }}
                        className="bg-white border-gray-300 text-black placeholder:text-gray-500"
                      />
                    )}
                  </div>
                ))}
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
                <CardHeader className="space-y-1 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg transition-colors ${
                        data.userRole === 'admin' ? 'bg-primary/10' : 'bg-gray-100'
                      }`}>
                        <User className={`w-5 h-5 transition-colors ${
                          data.userRole === 'admin' ? 'text-primary' : 'text-gray-600'
                        }`} />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-gray-900">
                          Admin Only
                        </CardTitle>
                        <CardDescription className="text-sm text-gray-700 mt-0.5">
                          I manage the business but don't provide services myself. I'll hire other providers to do the work.
                        </CardDescription>
                      </div>
                    </div>
                    <RadioGroupItem
                      value="admin"
                      id="admin"
                      className="mt-1"
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
                <CardHeader className="space-y-1 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        data.userRole === 'admin/provider' ? 'bg-primary/10' : 'bg-gray-100'
                      }`}>
                        <Users className={`w-5 h-5 ${
                          data.userRole === 'admin/provider' ? 'text-primary' : 'text-gray-600'
                        }`} />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-gray-900">
                          Admin & Provider
                        </CardTitle>
                        <CardDescription className="text-sm text-gray-700 mt-0.5">
                          I manage the business AND provide services myself alongside other team members.
                        </CardDescription>
                      </div>
                    </div>
                    <RadioGroupItem
                      value="admin/provider"
                      id="admin/provider"
                      className="mt-1"
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
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold text-gray-800">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={data.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="bg-white border-gray-300 text-black placeholder:text-gray-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-semibold text-gray-800">Business Phone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+61 4XX XXX XXX"
              value={data.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="bg-white border-gray-300 text-black placeholder:text-gray-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsappNumber" className="text-sm font-semibold text-gray-800">WhatsApp Number</Label>
            <Input
              id="whatsappNumber"
              type="tel"
              placeholder="+61 4XX XXX XXX"
              value={data.whatsappNumber}
              onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
              className="bg-white border-gray-300 text-black placeholder:text-gray-500"
            />
            <p className="text-sm text-gray-600">
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
              className="bg-white border-gray-300 text-black placeholder:text-gray-500"
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
            className="bg-white border-gray-300 text-black placeholder:text-gray-500"
          />
          <p className="text-sm text-gray-600">
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
          className="bg-white border-gray-300 text-black placeholder:text-gray-500"
        />
      </div>

      {data.businessCategory && (
        <div className="mt-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg shadow-sm">
          <p className="text-sm text-green-800 font-medium">
            <strong className="text-green-900">Great choice!</strong> We'll pre-configure your services and settings based on your {data.businessCategory === 'removalist' ? 'removalist' : 'beauty salon'} business type. You can customize everything in the next steps.
          </p>
        </div>
      )}
    </div>
  );
}