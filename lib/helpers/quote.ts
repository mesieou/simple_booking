import { JobType } from '../models/quote';

// Job durations in minutes
export const JOB_DURATIONS: Record<JobType, number> = {
  "one item": 30,
  "few items": 60,
  "house/apartment move": 180
};

export function calculateBaseFare(baseTime: number, ratePerMinute: number): number {
  return Math.round(baseTime * ratePerMinute);
}

export function calculateTravelFare(travelTime: number, ratePerMinute: number): number {
  return Math.round(travelTime * ratePerMinute);
}

export function calculateLabourFare(jobType: JobType, ratePerMinute: number): number {
  const jobDuration = JOB_DURATIONS[jobType];
  return Math.round(jobDuration * ratePerMinute);
}

export function calculateTotalFare(
  baseTime: number, 
  travelTime: number, 
  jobType: JobType,
  ratePerMinute: number
): number {
  const baseFare = calculateBaseFare(baseTime, ratePerMinute);
  const travelFare = calculateTravelFare(travelTime, ratePerMinute);
  const labourFare = calculateLabourFare(jobType, ratePerMinute);
  return baseFare + travelFare + labourFare;
}

export function calculateTotalDuration(baseTime: number, travelTime: number, jobType: JobType): number {
  const jobDuration = JOB_DURATIONS[jobType];
  return baseTime + travelTime + jobDuration;
}
