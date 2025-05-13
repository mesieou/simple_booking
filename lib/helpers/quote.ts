import { JobType } from '../models/quote';
import { Service } from '../models/service';

// Job durations in minutes
export const JOB_DURATIONS: Record<JobType, number> = {
  "one item": 30,
  "few items": 60,
  "house/apartment move": 180
};

export function calculateTravelCostEstimate(
  travelTimeEstimate: number,
  service: Service
): number {
  if (service.pricingType === 'fixed') {
    return 0; // Fixed price services don't charge for travel time
  }
  return Math.round(travelTimeEstimate * (service.ratePerMinute || 0));
}

export function calculateServiceCost(service: Service): number {
  if (service.pricingType === 'fixed') {
    return service.fixedPrice || 0;
  }
  
  // For per-minute pricing
  const baseCost = service.baseCharge || 0;
  const includedMinutes = service.includedMinutes || 0;
  const ratePerMinute = service.ratePerMinute || 0;
  
  // If duration is within included minutes, only charge base cost
  if (service.durationEstimate <= includedMinutes) {
    return baseCost;
  }
  
  // Otherwise charge base cost plus rate for additional minutes
  const additionalMinutes = service.durationEstimate - includedMinutes;
  return baseCost + (additionalMinutes * ratePerMinute);
}

export function calculateTotalJobCostEstimation(
  travelTimeEstimate: number,
  service: Service
): number {
  const serviceCost = calculateServiceCost(service);
  const travelCost = calculateTravelCostEstimate(travelTimeEstimate, service);
  return serviceCost + travelCost;
}

export function calculateTotalJobDurationEstimation(
  travelTimeEstimate: number,
  service: Service
): number {
  return service.durationEstimate + travelTimeEstimate;
}
