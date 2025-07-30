'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Banknote, Shield, Building2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';
import { getBusinessTemplate, type BusinessCategoryType } from '@/lib/config/business-templates';

interface PaymentStepProps {
  data: {
    depositType?: 'percentage' | 'fixed';
    depositPercentage: number | string;
    depositFixedAmount?: number | string;
    preferredPaymentMethod: string;
    setupPayments: boolean;
    businessCategory?: BusinessCategoryType | ''; // 🆕 Add business category to get template defaults
  };
  onUpdate: (updates: Partial<PaymentStepProps['data']>) => void;
}

const PAYMENT_METHODS = [
  {
    value: 'cash',
    label: 'Cash',
    description: 'Accept cash payments on arrival',
    icon: Banknote,
  },
  {
    value: 'card',
    label: 'Card',
    description: 'Accept credit/debit card payments',
    icon: CreditCard,
  },
  {
    value: 'bank_transfer',
    label: 'Bank Transfer',
    description: 'Accept payments via bank transfer',
    icon: Building2,
  },
  {
    value: 'cash, card and bank transfers',
    label: 'All Methods',
    description: 'Accept cash, card, and bank transfers',
    icon: Shield,
  },
];

export function PaymentStep({ data, onUpdate }: PaymentStepProps) {
  // 🆕 Get deposit defaults from business template data, not hardcoded values
  const getDepositDefaults = () => {
    // Try to get defaults from business templates based on category
    try {
      const template = data.businessCategory ? getBusinessTemplate(data.businessCategory) : null;
      
      return {
        PERCENTAGE: {
          DEFAULT: template?.depositPercentage || 25,
          MIN: 1,
          MAX: 99
        },
        FIXED: {
          DEFAULT: template?.depositFixedAmount || 50,
          MIN: 0,
          MAX: 10000
        }
      };
    } catch (error) {
      // Fallback to reasonable defaults if template not found
      return {
        PERCENTAGE: { DEFAULT: 25, MIN: 1, MAX: 99 },
        FIXED: { DEFAULT: 50, MIN: 0, MAX: 10000 }
      };
    }
  };

  const depositDefaults = getDepositDefaults();

  // Determine if deposits are required based on deposit type and values
  const isDepositRequired = () => {
    const depositType = data.depositType || 'percentage';
    if (depositType === 'percentage') {
      return data.depositPercentage !== 0 && data.depositPercentage !== '';
    } else {
      return data.depositFixedAmount !== 0 && data.depositFixedAmount !== '';
    }
  };

  // Track payment type separately to avoid auto-switching
  const [paymentType, setPaymentType] = useState<'deposit' | 'no_payment'>(
    isDepositRequired() ? 'deposit' : 'no_payment'
  );

  const handlePaymentTypeChange = (type: 'deposit' | 'no_payment') => {
    setPaymentType(type);
    if (type === 'deposit') {
      // Set default values if switching to deposit - use template data
      if (!isDepositRequired()) {
        onUpdate({ 
          depositType: 'percentage',
          depositPercentage: depositDefaults.PERCENTAGE.DEFAULT,
          depositFixedAmount: 0
        });
      }
    } else {
      // Clear deposit values when switching to no payment
      onUpdate({ 
        depositType: 'percentage',
        depositPercentage: 0, 
        depositFixedAmount: 0 
      });
    }
  };

  const handleDepositTypeChange = (depositType: 'percentage' | 'fixed') => {
    onUpdate({ 
      depositType,
      // Set defaults from template data for the selected type
      depositPercentage: depositType === 'percentage' ? (data.depositPercentage || depositDefaults.PERCENTAGE.DEFAULT) : 0,
      depositFixedAmount: depositType === 'fixed' ? (data.depositFixedAmount || depositDefaults.FIXED.DEFAULT) : 0
    });
  };

  const handlePercentageChange = (value: string) => {
    if (value === '') {
      onUpdate({ depositPercentage: '' as any });
      return;
    }
    
    const percentage = parseInt(value);
    if (!isNaN(percentage)) {
      onUpdate({ 
        depositPercentage: Math.min(
          depositDefaults.PERCENTAGE.MAX, 
          Math.max(depositDefaults.PERCENTAGE.MIN, percentage)
        ) 
      });
    }
  };

  const handleFixedAmountChange = (value: string) => {
    if (value === '') {
      onUpdate({ depositFixedAmount: '' as any });
      return;
    }
    
    const amount = parseFloat(value);
    if (!isNaN(amount)) {
      onUpdate({ 
        depositFixedAmount: Math.min(
          depositDefaults.FIXED.MAX, 
          Math.max(depositDefaults.FIXED.MIN, amount)
        ) 
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment Type Selection */}
      <Card className="border border-gray-200 rounded-xl bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-900">Payment Requirements</CardTitle>
          <CardDescription className="text-gray-700">
            Choose when customers need to pay for their bookings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={paymentType}
            onValueChange={(value: 'deposit' | 'no_payment') => handlePaymentTypeChange(value)}
            className="grid gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="deposit" id="deposit" />
              <Label htmlFor="deposit" className="font-medium text-gray-900">Require deposit to confirm booking</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no_payment" id="no_payment" />
              <Label htmlFor="no_payment" className="font-medium text-gray-900">Payment after service completion</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {paymentType === 'deposit' && (
        <Card className="border border-gray-200 rounded-xl bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900">Deposit Configuration</CardTitle>
            <CardDescription className="text-gray-700">
              Set how much customers need to pay upfront to confirm bookings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Deposit Type Selection */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">Deposit Type</Label>
                <RadioGroup
                  value={data.depositType || 'percentage'}
                  onValueChange={(value: 'percentage' | 'fixed') => handleDepositTypeChange(value)}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentage" id="percentage" />
                    <Label htmlFor="percentage" className="font-medium text-gray-900">Percentage of total</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixed" id="fixed" />
                    <Label htmlFor="fixed" className="font-medium text-gray-900">Fixed amount</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Percentage Input */}
              {(data.depositType || 'percentage') === 'percentage' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Percentage</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={depositDefaults.PERCENTAGE.MIN}
                      max={depositDefaults.PERCENTAGE.MAX}
                      value={data.depositPercentage}
                      onChange={(e) => handlePercentageChange(e.target.value)}
                      className="w-24 bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-lg"
                      placeholder={depositDefaults.PERCENTAGE.DEFAULT.toString()}
                    />
                    <span className="text-sm text-gray-600">% of total booking amount</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Customers will pay this percentage upfront to confirm their booking.
                  </p>
                </div>
              )}

              {/* Fixed Amount Input */}
              {data.depositType === 'fixed' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Fixed Deposit Amount</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        type="number"
                        min={depositDefaults.FIXED.MIN}
                        max={depositDefaults.FIXED.MAX}
                        step="0.01"
                        value={data.depositFixedAmount || ''}
                        onChange={(e) => handleFixedAmountChange(e.target.value)}
                        className="pl-8 w-32 bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-lg"
                        placeholder={depositDefaults.FIXED.DEFAULT.toString() + '.00'}
                      />
                    </div>
                    <span className="text-sm text-gray-600">fixed deposit amount</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Customers will pay this fixed amount upfront, regardless of the total booking cost.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preferred Payment Method */}
      {paymentType === 'deposit' && (
        <Card className="border border-gray-200 rounded-xl bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900">How should the customer pay the remaining balance?</CardTitle>
            <CardDescription className="text-gray-700">
              Choose your preferred payment method for the remaining balance to be paid at the time of service.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={data.preferredPaymentMethod}
              onValueChange={(value) => onUpdate({ preferredPaymentMethod: value })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;
                  const isSelected = data.preferredPaymentMethod === method.value;
                  return (
                    <Label
                      key={method.value}
                      htmlFor={method.value}
                      className="cursor-pointer"
                    >
                      <Card className={`transition-all duration-200 border ${
                        isSelected 
                          ? 'ring-2 ring-primary border-primary bg-white shadow-lg' 
                          : 'border-gray-200 hover:border-primary/50 hover:shadow-md bg-white'
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
                                  {method.label}
                                </CardTitle>
                                <CardDescription className="text-sm text-gray-700 mt-0.5">
                                  {method.description}
                                </CardDescription>
                              </div>
                            </div>
                            <RadioGroupItem
                              value={method.value}
                              id={method.value}
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
          </CardContent>
        </Card>
      )}
      {/* Stripe Setup Section */}
      <Card className="border border-gray-200 rounded-xl bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-900">Online Payment Processing</CardTitle>
          <CardDescription className="text-gray-700">
            Set up secure online payment processing with Stripe Connect (recommended for all businesses)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-gray-900">Enable Stripe Connect</p>
                  <p className="text-sm text-gray-600">
                    Accept credit cards, debit cards, and digital wallets securely
                  </p>
                </div>
              </div>
            </div>
            <Switch
              checked={data.setupPayments}
              onCheckedChange={(checked) => onUpdate({ setupPayments: checked })}
              id="setupPayments"
            />
          </div>
          
          {data.setupPayments && (
            <div className="mt-4 text-sm text-gray-700 bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="font-medium text-primary mb-2">What happens next:</p>
              <ul className="space-y-1 text-gray-700">
                <li>• After creating your business, you'll be redirected to Stripe</li>
                <li>• Complete a quick verification process (2-3 minutes)</li>
                <li>• Start accepting online payments immediately</li>
                <li>• Funds are deposited directly to your bank account</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}