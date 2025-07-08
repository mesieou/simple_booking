// The Service class is server-side only. We must not import it here.
// Instead, we import only the TYPE of ServiceData.
import { type ServiceData, type PricingType } from '../database/models/service';
import { Service } from '../database/models/service';

type InterfaceType = 'mobile' | 'not_mobile';

export interface QuoteEstimation {
  totalJobCost: number;
  serviceCost: number;
  travelCost: number;
  totalJobDuration: number;
  travelTime: number;
}

// --- Helper Functions refactored to use ServiceData ---

export function calculateServiceCost(service: ServiceData): number {
  if (service.pricingType === 'fixed') {
    return Math.round(service.fixedPrice ?? 0);
  }
  return Math.round((service.durationEstimate ?? 0) * (service.ratePerMinute ?? 0));
}

export function calculateTravelCost(
  service: ServiceData,
  travelTimeEstimate: number
): number {
  if (!service.mobile || service.pricingType === 'fixed') {
    return 0;
  }
  return Math.round((travelTimeEstimate ?? 0) * (service.ratePerMinute ?? 0));
}

export function calculateTotalJobDuration(
  service: ServiceData,
  travelTimeEstimate: number
): number {
  if (service.mobile && service.pricingType === 'per_minute') {
    return (service.durationEstimate ?? 0) + (travelTimeEstimate ?? 0);
  }
  return service.durationEstimate ?? 0;
}

export function calculateTravelTime(travelTimeEstimate: number): number {
  return travelTimeEstimate ?? 0;
}

function isMobilePerMinuteWithMissingTravelTime(
  service: ServiceData,
  travelTimeEstimate?: number
): boolean {
  return (
    !!service.mobile &&
    service.pricingType === 'per_minute' &&
    (travelTimeEstimate === undefined || travelTimeEstimate === null)
  );
}

function shouldApplyBaseCharge(
  service: ServiceData,
  totalJobCost: number
): boolean {
  return (
    !!service.mobile &&
    service.pricingType === 'per_minute' &&
    !!service.baseCharge &&
    totalJobCost < service.baseCharge
  );
}

export function calculateTotalJobCost(
  service: ServiceData,
  travelTimeEstimate: number
): { totalJobCost: number; serviceCost: number; travelCost: number } {
  let serviceCost = calculateServiceCost(service);
  let travelCost = calculateTravelCost(service, travelTimeEstimate);
  let totalJobCost = serviceCost + travelCost;

  if (shouldApplyBaseCharge(service, totalJobCost)) {
    totalJobCost = Math.round(service.baseCharge!);
    travelCost = Math.round(service.baseCharge! - serviceCost);
  } else {
    totalJobCost = Math.round(totalJobCost);
  }

  return { totalJobCost, serviceCost, travelCost };
}

// --- Orchestrator Functions ---

// V1 - The original function that works with a Service class instance.
// This is safe for server-side use, like in the bot engine.
export function computeQuoteEstimation(
  service: Service,
  travelTimeEstimate?: number
): QuoteEstimation {
  // We can convert the class to data to use the shared, client-safe helpers
  const serviceData = service.getData();

  if (isMobilePerMinuteWithMissingTravelTime(serviceData, travelTimeEstimate)) {
    throw new Error('travelTimeEstimate is required for mobile services with per-minute pricing.');
  }

  const { totalJobCost, serviceCost, travelCost } = calculateTotalJobCost(serviceData, travelTimeEstimate ?? 0);
  const totalJobDuration = calculateTotalJobDuration(serviceData, travelTimeEstimate ?? 0);
  const travelTime = calculateTravelTime(travelTimeEstimate ?? 0);

  return {
    totalJobCost,
    serviceCost,
    travelCost,
    totalJobDuration,
    travelTime
  };
}

// V2 - New function that works with raw ServiceData, safe for client components.
export function computeQuoteEstimationFromData(
  serviceData: ServiceData,
  travelTimeEstimate?: number
): QuoteEstimation {
  if (isMobilePerMinuteWithMissingTravelTime(serviceData, travelTimeEstimate)) {
    throw new Error('travelTimeEstimate is required for mobile services with per-minute pricing.');
  }

  const { totalJobCost, serviceCost, travelCost } = calculateTotalJobCost(serviceData, travelTimeEstimate ?? 0);
  const totalJobDuration = calculateTotalJobDuration(serviceData, travelTimeEstimate ?? 0);
  const travelTime = calculateTravelTime(travelTimeEstimate ?? 0);

  return {
    totalJobCost,
    serviceCost,
    travelCost,
    totalJobDuration,
    travelTime
  };
}
// --- END OF QUOTE LOGIC ---
