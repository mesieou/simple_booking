import { Service } from '../database/models/service';

type PricingType = 'fixed' | 'per_minute';
type InterfaceType = 'mobile' | 'not_mobile';

export interface QuoteEstimation {
  totalJobCost: number;
  serviceCost: number;
  travelCost: number;
  totalJobDuration: number;
  travelTime: number;
}

// --- Helper Functions ---

// Calculates the service cost based on pricing type
export function calculateServiceCost(service: Service): number {
  // Fixed price: just return the fixed price
  if (service.pricingType === 'fixed') {
    return service.fixedPrice ?? 0;
  }
  // Per minute: durationEstimate * ratePerMinute
  return (service.durationEstimate ?? 0) * (service.ratePerMinute ?? 0);
}

// Calculates the travel cost based on service mobile property and pricing type
export function calculateTravelCost(
  service: Service,
  travelTimeEstimate: number
): number {
  // No travel cost for non-mobile services or fixed price services
  if (!service.mobile || service.pricingType === 'fixed') {
    return 0;
  }
  // Mobile + per minute: travelTimeEstimate * ratePerMinute
  return (travelTimeEstimate ?? 0) * (service.ratePerMinute ?? 0);
}

// Calculates the total job duration (service + travel if mobile/per_minute)
export function calculateTotalJobDuration(
  service: Service,
  travelTimeEstimate: number
): number {
  // Mobile + per minute: sum travel and service duration
  if (service.mobile && service.pricingType === 'per_minute') {
    return (service.durationEstimate ?? 0) + (travelTimeEstimate ?? 0);
  }
  // All other cases: just the service duration
  return service.durationEstimate ?? 0;
}

// Returns the travel time (for completeness)
export function calculateTravelTime(travelTimeEstimate: number): number {
  return travelTimeEstimate ?? 0;
}

// Helper to check if travel time is missing for mobile per-minute pricing
function isMobilePerMinuteWithMissingTravelTime(
  service: Service,
  travelTimeEstimate?: number
): boolean {
  return (
    !!service.mobile &&
    service.pricingType === 'per_minute' &&
    (travelTimeEstimate === undefined || travelTimeEstimate === null)
  );
}

// Helper to check if base charge should be applied for mobile per-minute pricing
function shouldApplyBaseCharge(
  service: Service,
  totalJobCost: number
): boolean {
  return (
    !!service.mobile &&
    service.pricingType === 'per_minute' &&
    !!service.baseCharge &&
    totalJobCost < service.baseCharge
  );
}

// --- Main Calculation Function ---

// Calculates the total job cost, service cost, and travel cost for all service/pricing combinations
export function calculateTotalJobCost(
  service: Service,
  travelTimeEstimate: number
): { totalJobCost: number; serviceCost: number; travelCost: number } {
  // --- Not mobile, fixed price ---
  // totalJobCost = fixedPrice, no travel cost, duration = service.durationEstimate
  // --- Not mobile, per minute ---
  // totalJobCost = service.durationEstimate * ratePerMinute, no travel cost, duration = service.durationEstimate
  // --- Mobile, fixed price ---
  // totalJobCost = fixedPrice, no travel cost, duration = service.durationEstimate
  // --- Mobile, per minute ---
  // travelCost = travelTimeEstimate * ratePerMinute
  // serviceCost = service.durationEstimate * ratePerMinute
  // totalJobCost = travelCost + serviceCost
  // If totalJobCost < baseCharge, recalculate:
  //   totalJobCost = baseCharge
  //   travelCost = baseCharge - serviceCost

  let serviceCost = calculateServiceCost(service);
  let travelCost = calculateTravelCost(service, travelTimeEstimate);
  let totalJobCost = serviceCost + travelCost;

  if (shouldApplyBaseCharge(service, totalJobCost)) {
    totalJobCost = service.baseCharge!;
    travelCost = service.baseCharge! - serviceCost;
  }

  return { totalJobCost, serviceCost, travelCost };
}

// --- Orchestrator Function ---

// Computes all fields for the quote using the service's mobile property
export function computeQuoteEstimation(
  service: Service,
  travelTimeEstimate?: number
): QuoteEstimation {
  // Enforce travelTimeEstimate is provided for mobile + per_minute
  if (isMobilePerMinuteWithMissingTravelTime(service, travelTimeEstimate)) {
    throw new Error('travelTimeEstimate is required for mobile services with per-minute pricing.');
  }

  const { totalJobCost, serviceCost, travelCost } = calculateTotalJobCost(service, travelTimeEstimate ?? 0);
  const totalJobDuration = calculateTotalJobDuration(service, travelTimeEstimate ?? 0);
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
