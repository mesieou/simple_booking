'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Banknote, Shield, Building2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';

interface PaymentStepProps {
  data: {
    depositPercentage: number;
    preferredPaymentMethod: string;
    setupPayments: boolean;
  };
  onUpdate: (data: any) => void;
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
    value: 'both',
    label: 'All Methods',
    description: 'Accept cash, card, and bank transfers',
    icon: Shield,
  },
];

export function PaymentStep({ data, onUpdate }: PaymentStepProps) {
  // New: paymentType = 'full' | 'deposit'
  const paymentType = data.depositPercentage === 0 && !data.setupPayments ? 'no_payment' : (data.depositPercentage === 0 ? 'full' : 'deposit');
  const handlePaymentTypeChange = (type: 'full' | 'deposit' | 'no_payment') => {
    if (type === 'full') {
      onUpdate({ depositPercentage: 0, setupPayments: true });
    } else if (type === 'deposit') {
      onUpdate({ depositPercentage: 25, setupPayments: true });
    } else {
      onUpdate({ depositPercentage: 0, setupPayments: false });
    }
  };
  const handleDepositChange = (value: string) => {
    const percentage = parseInt(value) || 0;
    onUpdate({ depositPercentage: Math.min(100, Math.max(0, percentage)) });
  };
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-gray-700">
          Configure how you want to handle payments and deposits for bookings.
        </p>
      </div>
      {/* Payment Type Selection */}
      <Card className="border border-gray-200 rounded-xl bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-900">When and how do you want to collect payment?</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={paymentType}
            onValueChange={val => handlePaymentTypeChange(val as 'full' | 'deposit' | 'no_payment')}
            className="flex flex-col gap-3"
          >
            <Label className="flex items-center gap-2 cursor-pointer text-gray-900">
              <RadioGroupItem value="full" id="full" />
              <span className="font-medium">Full payment required before service</span>
            </Label>
            <Label className="flex items-center gap-2 cursor-pointer text-gray-900">
              <RadioGroupItem value="deposit" id="deposit" />
              <span className="font-medium">Deposit required to confirm booking (rest paid later)</span>
            </Label>
            <Label className="flex items-center gap-2 cursor-pointer text-gray-900">
              <RadioGroupItem value="no_payment" id="no_payment" />
              <span className="font-medium">Payment after the service (no deposit required)</span>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>
      {/* Deposit Percentage */}
      {paymentType === 'deposit' && (
        <Card className="border border-gray-200 rounded-xl bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900">Deposit Requirements</CardTitle>
            <CardDescription className="text-gray-700">
              Set the deposit percentage required to confirm bookings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="1"
                      max="99"
                      value={data.depositPercentage}
                      onChange={(e) => handleDepositChange(e.target.value)}
                      className="w-24 bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-lg"
                    />
                    <span className="text-sm text-gray-600">% of total booking amount</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Customers will need to pay this percentage upfront to confirm their booking.
              </p>
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
      {/* Stripe info text for full or deposit */}
      {(paymentType === 'full' || paymentType === 'deposit') && (
        <div className="mt-6 text-sm text-gray-700 bg-primary/5 border border-primary/20 rounded-lg p-4">
          After creating your business, you’ll be redirected to set up Stripe Connect for secure online payment processing.
        </div>
      )}
    </div>
  );
}