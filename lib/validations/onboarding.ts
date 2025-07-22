import { z } from 'zod';

// Phone number validation that accepts various international formats
const phoneSchema = z.string()
  .min(1, 'Phone number is required')
  .regex(/^\+?[1-9]\d{8,14}$/, 'Please enter a valid phone number with country code (minimum 9 digits)');

// Email validation
const emailSchema = z.string()
  .email('Please enter a valid email address')
  .min(1, 'Email is required');

// Business category validation
export const businessCategorySchema = z.enum(['removalist', 'salon'], {
  errorMap: () => ({ message: 'Please select a business category' })
});

// User role validation
export const userRoleSchema = z.enum(['admin', 'admin/provider'], {
  errorMap: () => ({ message: 'Please select your role' })
});

// Business Information Step Schema
export const businessInfoSchema = z.object({
  // Business Category
  businessCategory: businessCategorySchema,
  
  // Business Details
  businessName: z.string()
    .min(2, 'Business name must be at least 2 characters')
    .max(100, 'Business name must be less than 100 characters'),
  
  timeZone: z.string()
    .min(1, 'Please select a timezone'),
  
  // Owner Information
  ownerFirstName: z.string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters'),
  
  ownerLastName: z.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters'),
  
  // User Role
  userRole: userRoleSchema,
  
  // Contact Information
  email: emailSchema,
  
  phone: phoneSchema,
  
  whatsappNumber: phoneSchema,
  
  // Optional fields
  websiteUrl: z.string()
    .url('Please enter a valid website URL')
    .optional()
    .or(z.literal('')),
  
  // Business Address
  businessAddress: z.string()
    .min(5, 'Please enter a complete business address')
    .max(500, 'Address must be less than 500 characters'),
});

// Services Step Schema
export const servicesSchema = z.object({
  services: z.array(z.object({
    name: z.string()
      .min(2, 'Service name must be at least 2 characters')
      .max(100, 'Service name must be less than 100 characters'),
    
    description: z.string()
      .min(10, 'Description must be at least 10 characters')
      .max(500, 'Description must be less than 500 characters'),
    
    basePrice: z.number()
      .min(0, 'Price must be 0 or greater')
      .max(99999, 'Price must be less than $99,999'),
    
    durationMinutes: z.number()
      .min(15, 'Duration must be at least 15 minutes')
      .max(1440, 'Duration must be less than 24 hours'),
    
    category: z.string()
      .min(1, 'Please select a service category'),
    
    pricingType: z.enum(['fixed', 'hourly', 'quote'], {
      errorMap: () => ({ message: 'Please select a pricing type' })
    }).default('fixed'),
  }))
  .min(1, 'Please add at least one service')
  .max(20, 'Maximum 20 services allowed'),
});

// Calendar Settings Schema
export const calendarSchema = z.object({
  timeZone: z.string()
    .min(1, 'Please select a timezone'),
  
  workDays: z.array(z.number().min(0).max(6))
    .min(1, 'Please select at least one work day')
    .max(7, 'Maximum 7 work days allowed'),
  
  workHoursStart: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid start time (HH:MM)'),
  
  workHoursEnd: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid end time (HH:MM)'),
  
  slotDuration: z.number()
    .min(15, 'Slot duration must be at least 15 minutes')
    .max(480, 'Slot duration must be less than 8 hours'),
  
  bufferTime: z.number()
    .min(0, 'Buffer time must be 0 or greater')
    .max(60, 'Buffer time must be less than 60 minutes'),
  
  maxAdvanceDays: z.number()
    .min(1, 'Must allow at least 1 day advance booking')
    .max(365, 'Maximum 365 days advance booking allowed'),
  
  minAdvanceHours: z.number()
    .min(1, 'Must require at least 1 hour advance booking')
    .max(168, 'Maximum 7 days (168 hours) advance requirement allowed'),
}).refine(
  (data) => data.workHoursStart < data.workHoursEnd,
  {
    message: 'End time must be after start time',
    path: ['workHoursEnd'],
  }
);

// Payment Step Schema
export const paymentSchema = z.object({
  setupPayments: z.boolean(),
  
  // Conditional validation - if setupPayments is true, these fields are required
  businessType: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
}).refine(
  (data) => {
    if (data.setupPayments) {
      return data.businessType && data.country && data.currency;
    }
    return true;
  },
  {
    message: 'Please complete payment setup information',
    path: ['setupPayments'],
  }
);

// Complete Onboarding Schema (all steps combined)
export const completeOnboardingSchema = z.object({
  // Business Info
  ...businessInfoSchema.shape,
  
  // Services
  services: servicesSchema.shape.services,
  
  // Calendar Settings
  calendarSettings: calendarSchema,
  
  // Payment Setup
  paymentSetup: paymentSchema,
  
  // Additional onboarding fields
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  confirmPassword: z.string(),
  
  agreeToTerms: z.boolean()
    .refine((val) => val === true, {
      message: 'You must agree to the terms and conditions',
    }),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

// Individual step validation schemas for frontend use
export type BusinessInfoData = z.infer<typeof businessInfoSchema>;
export type ServicesData = z.infer<typeof servicesSchema>;
export type CalendarData = z.infer<typeof calendarSchema>;
export type PaymentData = z.infer<typeof paymentSchema>;
export type CompleteOnboardingData = z.infer<typeof completeOnboardingSchema>;