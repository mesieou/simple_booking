import { Business } from '../models/business';
import { User } from '../models/user';
import { Quote } from '../models/quote';
import { Booking } from '../models/booking';
import { Event } from '../models/events';

export interface SeedResult {
  businesses: string[];
  clients: string[];
  providers: string[];
  quotes: string[];
  bookings: string[];
}

export interface SeedContext {
  businesses: Business[];
  users: User[];
  quotes: Quote[];
  bookings: Booking[];
  calendarIds: Map<string, string>;
} 