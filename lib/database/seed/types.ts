import { Business } from '../models/business';
import { User } from '../models/user';
import { Quote } from '../models/quote';
import { Booking } from '../models/booking';
import { Event } from '../models/events';
import { Document } from '../models/documents';
import { Embedding } from '../models/embeddings';

export interface SeedResult {
  businesses: string[];
  clients: string[];
  providers: string[];
  quotes: string[];
  bookings: string[];
  documents: string[];
  embeddings: string[];
}

export interface SeedContext {
  businesses: Business[];
  users: User[];
  quotes: Quote[];
  bookings: Booking[];
  documents: Document[];
  embeddings: Embedding[];
  calendarIds: Map<string, string>;
} 