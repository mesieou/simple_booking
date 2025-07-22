'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, X, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface ServiceData {
  name: string;
  pricingType: 'fixed' | 'per_minute';
  fixedPrice?: number;
  baseCharge?: number;
  ratePerMinute?: number;
  description: string;
  durationEstimate: number;
  mobile: boolean;
}

interface ServicesStepProps {
  data: {
    services: ServiceData[];
  };
  onUpdate: (data: { services: ServiceData[] }) => void;
}

function ServiceCardForm({
  service,
  onChange,
  onDelete,
  onSave,
  onCancel,
  isNew,
  disableDelete
}: {
  service: ServiceData;
  onChange: (service: ServiceData) => void;
  onDelete?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  isNew?: boolean;
  disableDelete?: boolean;
}) {
  // Local state for ratePerMinute string
  const [ratePerMinuteInput, setRatePerMinuteInput] = useState(
    service.ratePerMinute !== undefined && service.ratePerMinute !== null ? String(service.ratePerMinute) : ''
  );

  useEffect(() => {
    setRatePerMinuteInput(
      service.ratePerMinute !== undefined && service.ratePerMinute !== null ? String(service.ratePerMinute) : ''
    );
  }, [service.ratePerMinute]);

  const handleRatePerMinuteChange = (val: string) => {
    // Allow: '', '1', '1.', '1.5', '1.50', '.5'
    if (/^\d*\.?\d{0,2}$/.test(val)) {
      setRatePerMinuteInput(val);
      if (val === '' || val === '.') {
        onChange({ ...service, ratePerMinute: undefined });
      } else {
        const floatVal = parseFloat(val);
        if (!isNaN(floatVal)) {
          onChange({ ...service, ratePerMinute: floatVal });
        }
      }
    }
  };

  return (
    <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all">
      <CardContent className="pt-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Service Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="serviceName" className="block text-sm font-medium text-gray-700 mb-1">Service Name</Label>
              <Input
                id="serviceName"
                value={service.name}
                onChange={(e) => onChange({ ...service, name: e.target.value })}
                placeholder="Enter service name"
                className="bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 w-full"
              />
            </div>
            <div>
              <Label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</Label>
              <Textarea
                id="description"
                value={service.description}
                onChange={(e) => onChange({ ...service, description: e.target.value })}
                placeholder="Describe the service"
                rows={2}
                className="bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 w-full"
              />
            </div>
            <div>
              <Label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={service.durationEstimate}
                onChange={(e) => onChange({ ...service, durationEstimate: parseInt(e.target.value) || 0 })}
                className="bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 w-full"
              />
            </div>
          </div>

          {/* Right: Pricing & Options */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="block text-sm font-medium text-gray-700 mb-1">Pricing Type</Label>
              <div className="flex items-center gap-3">
                <Switch
                  checked={service.pricingType === 'per_minute'}
                  onCheckedChange={(checked) => onChange({ ...service, pricingType: checked ? 'per_minute' : 'fixed' })}
                  id="pricingType"
                />
                <span className="text-sm text-gray-700">{service.pricingType === 'per_minute' ? 'Per Minute' : 'Fixed'}</span>
              </div>
            </div>
            {service.pricingType === 'fixed' ? (
              <div className="space-y-2">
                <Label htmlFor="fixedPrice" className="block text-sm font-medium text-gray-700 mb-1">Fixed Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <Input
                    id="fixedPrice"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={service.fixedPrice || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      onChange({ ...service, fixedPrice: val === '' ? undefined : parseFloat(val) });
                    }}
                    className="bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 w-full pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="baseCharge" className="block text-sm font-medium text-gray-700 mb-1">Base Charge</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <Input
                      id="baseCharge"
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]*"
                      value={service.baseCharge || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        onChange({ ...service, baseCharge: val === '' ? undefined : parseFloat(val) });
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 w-full pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ratePerMinute" className="block text-sm font-medium text-gray-700 mb-1">Rate per Minute</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <Input
                      id="ratePerMinute"
                      type="text"
                      inputMode="decimal"
                      value={ratePerMinuteInput}
                      onChange={(e) => handleRatePerMinuteChange(e.target.value)}
                      className="bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 w-full pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label className="block text-sm font-medium text-gray-700 mb-1">Mobile Service</Label>
              <div className="flex items-center gap-3">
                <Switch
                  checked={service.mobile}
                  onCheckedChange={(checked) => onChange({ ...service, mobile: checked })}
                  id="mobileService"
                />
                <span className="text-sm text-gray-700">{service.mobile ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          {isNew && onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          )}
          {isNew && onSave && (
            <Button size="sm" onClick={onSave} disabled={!service.name}>
              <Check className="w-4 h-4 mr-1" />
              Save
            </Button>
          )}
          {!isNew && onDelete && (
            <Button
              className="bg-primary text-white hover:bg-primary/90 border-none"
              size="sm"
              onClick={onDelete}
              disabled={disableDelete}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ServicesStep({ data, onUpdate }: ServicesStepProps) {
  const [editingService, setEditingService] = useState<ServiceData | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleDelete = (index: number) => {
    const updatedServices = data.services.filter((_, i) => i !== index);
    onUpdate({ services: updatedServices });
  };

  const handleAddNew = () => {
    const newService: ServiceData = {
      name: '',
      pricingType: 'fixed',
      fixedPrice: 0,
      description: '',
      durationEstimate: 60,
      mobile: data.services[0]?.mobile || false
    };
    setEditingService(newService);
    setIsAddingNew(true);
  };

  const handleSaveNew = () => {
    if (editingService && editingService.name) {
      const updatedServices = [...data.services, editingService];
      onUpdate({ services: updatedServices });
      setIsAddingNew(false);
      setEditingService(null);
    }
  };

  const handleCancelNew = () => {
    setIsAddingNew(false);
    setEditingService(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Review and customize your services. These have been pre-configured based on your business type.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddNew}
          disabled={isAddingNew}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Service
        </Button>
      </div>

      {/* Add New Service Form */}
      {isAddingNew && editingService && (
        <ServiceCardForm
          service={editingService}
          onChange={setEditingService}
          onSave={handleSaveNew}
          onCancel={handleCancelNew}
          isNew
        />
      )}

      {/* Services List */}
      <div className="space-y-6">
        {data.services.map((service, index) => (
          <ServiceCardForm
            key={index}
            service={service}
            onChange={(updated) => {
              const updatedServices = [...data.services];
              updatedServices[index] = updated;
              onUpdate({ services: updatedServices });
            }}
            onDelete={() => handleDelete(index)}
            disableDelete={data.services.length <= 1}
          />
        ))}
      </div>

      {data.services.length === 0 && !isAddingNew && (
        <div className="text-center py-8 text-gray-500">
          <p>No services configured yet.</p>
          <p className="text-sm mt-2">Click "Add Service" to get started.</p>
        </div>
      )}
    </div>
  );
}