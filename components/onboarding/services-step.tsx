'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  onEditingChange?: (isEditing: boolean) => void;
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
  // Local state for rate per hour (displayed to user) 
  const [ratePerHourInput, setRatePerHourInput] = useState(
    service.ratePerMinute !== undefined && service.ratePerMinute !== null ? String(Math.round(service.ratePerMinute * 60)) : ''
  );

  useEffect(() => {
    // Convert rate per minute to rate per hour for display
    const hourlyRate = service.ratePerMinute !== undefined && service.ratePerMinute !== null ? (service.ratePerMinute * 60) : 0;
    setRatePerHourInput(hourlyRate > 0 ? String(Math.round(hourlyRate)) : '');
  }, [service.ratePerMinute]);

  const handleRatePerHourChange = (val: string) => {
    // Allow only integers: '', '1', '25', '150'
    if (/^\d*$/.test(val)) {
      setRatePerHourInput(val);
      if (val === '') {
        onChange({ ...service, ratePerMinute: undefined });
      } else {
        const hourlyRate = parseInt(val);
        if (!isNaN(hourlyRate)) {
          // Convert hourly rate to per minute rate for backend storage
          const minuteRate = hourlyRate / 60;
          onChange({ ...service, ratePerMinute: minuteRate });
        }
      }
    }
  };

  // Validation function to check if service is complete
  const isServiceValid = () => {
    if (!service.name || service.name.trim().length < 2) return false;
    if (!service.description || service.description.trim().length < 10) return false;
    if (!service.durationEstimate || ![60, 90, 120, 150, 180, 240, 300, 360].includes(service.durationEstimate)) return false;
    
    if (service.pricingType === 'fixed') {
      return service.fixedPrice !== undefined && service.fixedPrice > 0;
    } else {
      return service.ratePerMinute !== undefined && service.ratePerMinute > 0;
    }
  };

  return (
    <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all">
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          {/* Left: Service Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="serviceName" className="block text-sm font-medium text-gray-700 mb-1">Service Name</Label>
              <Input
                id="serviceName"
                value={service.name}
                onChange={(e) => onChange({ ...service, name: e.target.value })}
                placeholder="Enter service name"
                className="bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 w-full text-sm"
              />
            </div>
            <div>
              <Label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</Label>
              <Textarea
                id="description"
                value={service.description}
                onChange={(e) => onChange({ ...service, description: e.target.value })}
                placeholder="Describe the service"
                rows={4}
                className="bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 w-full text-sm resize-y min-h-[100px]"
              />
            </div>
            <div>
              <Label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">Duration Estimation</Label>
              <Select
                value={service.durationEstimate && [60, 90, 120, 150, 180, 240, 300, 360].includes(service.durationEstimate) ? service.durationEstimate.toString() : '60'}
                onValueChange={(value) => onChange({ ...service, durationEstimate: parseInt(value) })}
              >
                <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900 w-full text-sm">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="60" className="text-gray-900 hover:bg-gray-100">1 hour (60 minutes)</SelectItem>
                  <SelectItem value="90" className="text-gray-900 hover:bg-gray-100">1.5 hours (90 minutes)</SelectItem>
                  <SelectItem value="120" className="text-gray-900 hover:bg-gray-100">2 hours (120 minutes)</SelectItem>
                  <SelectItem value="150" className="text-gray-900 hover:bg-gray-100">2.5 hours (150 minutes)</SelectItem>
                  <SelectItem value="180" className="text-gray-900 hover:bg-gray-100">3 hours (180 minutes)</SelectItem>
                  <SelectItem value="240" className="text-gray-900 hover:bg-gray-100">4 hours (240 minutes)</SelectItem>
                  <SelectItem value="300" className="text-gray-900 hover:bg-gray-100">5 hours (300 minutes)</SelectItem>
                  <SelectItem value="360" className="text-gray-900 hover:bg-gray-100">6 hours (360 minutes)</SelectItem>
                </SelectContent>
              </Select>
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
                <span className="text-sm text-gray-700">{service.pricingType === 'per_minute' ? 'Per Hour' : 'Fixed'}</span>
              </div>
            </div>
            {service.pricingType === 'fixed' ? (
              <div className="space-y-2">
                <Label htmlFor="fixedPrice" className="block text-sm font-medium text-gray-700 mb-1">Fixed Price *</Label>
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
                    className={`bg-gray-50 border text-gray-900 placeholder:text-gray-400 w-full pl-7 text-sm ${
                      service.pricingType === 'fixed' && (!service.fixedPrice || service.fixedPrice <= 0) 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                </div>
                {service.pricingType === 'fixed' && (!service.fixedPrice || service.fixedPrice <= 0) && (
                  <p className="text-xs text-red-600">Fixed price is required</p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="baseCharge" className="block text-sm font-medium text-gray-700 mb-1">Base Charge (Optional)</Label>
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
                      className="bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 w-full pl-7 text-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ratePerHour" className="block text-sm font-medium text-gray-700 mb-1">Rate per Hour *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <Input
                      id="ratePerHour"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={ratePerHourInput}
                      onChange={(e) => handleRatePerHourChange(e.target.value)}
                      className={`bg-gray-50 border text-gray-900 placeholder:text-gray-400 w-full pl-7 text-sm ${
                        service.pricingType === 'per_minute' && (!service.ratePerMinute || service.ratePerMinute <= 0) 
                          ? 'border-red-300 focus:border-red-500' 
                          : 'border-gray-300'
                      }`}
                      placeholder="150"
                    />
                  </div>
                  {service.pricingType === 'per_minute' && (!service.ratePerMinute || service.ratePerMinute <= 0) && (
                    <p className="text-xs text-red-600">Rate per hour is required</p>
                  )}
                  <p className="text-xs text-gray-500">Rate per minute: ${service.ratePerMinute ? service.ratePerMinute.toFixed(2) : '0.00'}</p>
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
            <Button variant="outline" onClick={onCancel} className="px-3 py-1.5">
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          )}
          {isNew && onSave && (
            <Button onClick={onSave} disabled={!isServiceValid()} className="px-3 py-1.5">
              <Check className="w-4 h-4 mr-1" />
              Save
            </Button>
          )}
          {!isNew && onDelete && (
            <Button
              className="bg-primary text-white hover:bg-primary/90 border-none px-3 py-1.5"
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

export function ServicesStep({ data, onUpdate, onEditingChange }: ServicesStepProps) {
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
    onEditingChange?.(true);
  };

  const handleSaveNew = () => {
    if (editingService && editingService.name && editingService.description) {
      const updatedServices = [...data.services, editingService];
      onUpdate({ services: updatedServices });
      setIsAddingNew(false);
      setEditingService(null);
      onEditingChange?.(false);
    }
  };

  const handleCancelNew = () => {
    setIsAddingNew(false);
    setEditingService(null);
    onEditingChange?.(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-gray-600 text-center md:text-left">
          Review and customize your services. These have been pre-configured based on your business type.
        </p>
        <div className="flex justify-center md:justify-end">
          <Button
            variant="outline"
            onClick={handleAddNew}
            disabled={isAddingNew}
            className="px-4 py-2"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        </div>
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