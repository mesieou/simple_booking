import { type ServiceData, type PricingType } from '../database/models/service';
import { type ProviderWorkingHours } from '../database/models/calendar-settings';

export type BusinessCategoryType = 'removalist' | 'salon';

export interface ServiceTemplate extends Omit<ServiceData, 'businessId' | 'id'> {
  name: string;
  pricingType: PricingType;
  fixedPrice?: number;
  baseCharge?: number;
  ratePerMinute?: number;
  description: string;
  durationEstimate: number;
  mobile: boolean;
}

export interface BusinessTemplate {
  id: BusinessCategoryType;
  name: string;
  services: ServiceTemplate[];
  numberOfProviders: number;
  depositType?: 'percentage' | 'fixed';
  depositPercentage?: number;
  depositFixedAmount?: number;
}

const REMOVALIST_TEMPLATE: BusinessTemplate = {
  id: 'removalist',
  name: 'Removalist / Moving Company',
  services: [
    {
      name: 'Single item move - One person',
      pricingType: 'per_minute' as PricingType,
      ratePerMinute: 1.50,
      baseCharge: 135.00,
      description: 'One removalist and a truck. Assistance is required',
      durationEstimate: 60,
      mobile: true
    },
    {
      name: 'Single item move - Two people',
      pricingType: 'per_minute' as PricingType,
      ratePerMinute: 2.42,
      baseCharge: 217.00,
      description: 'Two removalists and a truck.',
      durationEstimate: 60,
      mobile: true
    },
    {
      name: 'Few items move - One person',
      pricingType: 'per_minute' as PricingType,
      ratePerMinute: 1.50,
      baseCharge: 135.00,
      description: 'One removalist and a truck. Assistance is required',
      durationEstimate: 60,
      mobile: true
    },
    {
      name: 'Few items move - Two people',
      pricingType: 'per_minute' as PricingType,
      ratePerMinute: 2.42,
      baseCharge: 217.00,
      description: 'Two removalists and a truck. Assistance is required',
      durationEstimate: 60,
      mobile: true
    },
    {
      name: 'House Move 1 bedroom - One person',
      pricingType: 'per_minute' as PricingType,
      ratePerMinute: 1.50,
      baseCharge: 135.00,
      description: 'One removalist and a truck. Assistance is required',
      durationEstimate: 120,
      mobile: true
    },
    {
      name: 'House Move 1 bedroom - Two people',
      pricingType: 'per_minute' as PricingType,
      ratePerMinute: 2.42,
      baseCharge: 217.00,
      description: 'Two removalists and a truck.',
      durationEstimate: 120,
      mobile: true
    },
    {
      name: 'House Move 2+ bedroom - One person',
      pricingType: 'per_minute' as PricingType,
      ratePerMinute: 1.50,
      baseCharge: 135.00,
      description: 'One removalist and a truck. Assistance is required',
      durationEstimate: 180,
      mobile: true
    },
    {
      name: 'House Move 2+ bedroom - Two people',
      pricingType: 'per_minute' as PricingType,
      ratePerMinute: 2.42,
      baseCharge: 217.00,
      description: 'Two removalists and a truck.',
      durationEstimate: 180,
      mobile: true
    }
  ],
  numberOfProviders: 4,
  depositType: 'percentage',
  depositPercentage: 25,
  depositFixedAmount: 0
};

const SALON_TEMPLATE: BusinessTemplate = {
  id: 'salon',
  name: 'Beauty Salon',
  services: [
    // Manicures
    {
      name: 'Basic Manicure',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 30.00,
      description: 'Cleaning, exfoliation, and moisturizing.',
      durationEstimate: 60,
      mobile: false
    },
    {
      name: 'Express Manicure',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 35.00,
      description: 'Cleaning, exfoliation, moisturizing, nail polish.',
      durationEstimate: 60,
      mobile: false
    },
    {
      name: 'Gel Manicure',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 40.00,
      description: 'Cleaning, exfoliation, moisturizing, gel.',
      durationEstimate: 60,
      mobile: false
    },
    {
      name: 'Press on Manicure',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 80.00,
      description: 'Cleaning, exfoliation, moisturizing, press-on nail extension, gel, nail art.',
      durationEstimate: 90,
      mobile: false
    },
    {
      name: 'Nail Art',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 5.00,
      description: 'Nail art design (2 nails $5 / 5-10 nails $10).',
      durationEstimate: 60,
      mobile: false
    },
    // Pedicures
    {
      name: 'Basic Pedicure',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 45.00,
      description: 'Cleaning, exfoliation, moisturizing, nail polish.',
      durationEstimate: 60,
      mobile: false
    },
    {
      name: 'Gel Pedicure',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 50.00,
      description: 'Cleaning, exfoliation, moisturizing, gel.',
      durationEstimate: 60,
      mobile: false
    },
    // Hair Services
    {
      name: 'Ladies Haircut',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 50.00,
      description: 'Professional ladies haircut.',
      durationEstimate: 60,
      mobile: false
    },
    {
      name: 'Hair Styling',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 50.00,
      description: 'Complete styling with braids, brushing, or updos.',
      durationEstimate: 60,
      mobile: false
    },
    {
      name: 'Braids',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 30.00,
      description: '1-3 braids (1 hour).',
      durationEstimate: 60,
      mobile: false
    },
    {
      name: 'Blow Dry',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 35.00,
      description: 'Professional blow dry service.',
      durationEstimate: 60,
      mobile: false
    },
    {
      name: 'Waves',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 30.00,
      description: 'Professional wave styling.',
      durationEstimate: 60,
      mobile: false
    },
    {
      name: 'Treatments',
      pricingType: 'fixed' as PricingType,
      fixedPrice: 60.00,
      description: 'Hair treatment services.',
      durationEstimate: 60,
      mobile: false
    }
  ],
  numberOfProviders: 2,
  depositType: 'percentage',
  depositPercentage: 50,
  depositFixedAmount: 0
};

export const BUSINESS_TEMPLATES: Record<BusinessCategoryType, BusinessTemplate> = {
  removalist: REMOVALIST_TEMPLATE,
  salon: SALON_TEMPLATE
};

export function getBusinessTemplate(category: BusinessCategoryType): BusinessTemplate {
  return BUSINESS_TEMPLATES[category];
}

export function getAllBusinessCategories(): Array<{ value: BusinessCategoryType; label: string; description: string }> {
  return Object.entries(BUSINESS_TEMPLATES).map(([key, template]) => ({
    value: key as BusinessCategoryType,
    label: template.name,
    description: template.services.length > 0 ? template.services[0].description : ''
  }));
}