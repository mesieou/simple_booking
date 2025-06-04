/**
 * Defines the structure for managing the state of the booking process.
 */
export interface BookingState {
  step: 'idle' | 'getting_size' | 'getting_date' | 'getting_time' | 'confirming' | 'completed' | 'cancelled';
  size?: 'one' | 'few' | 'house';
  jobDurationMinutes?: number;
  date?: string; // ISO string "yyyy-MM-dd"
  time?: string;
  // You might add other relevant fields like bookingId once confirmed, or user details if pertinent to this state.
} 