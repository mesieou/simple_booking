/**
 * @fileoverview Defines the step-by-step "recipes" for different booking scenarios.
 * These arrays represent the ordered sequence of steps the state manager will follow.
 */

// Flow for businesses that require the customer's address first (e.g., removalists, mobile hairdressers).
export const bookingCreatingForMobileService = [
  'askAddress', 
  'validateAddress', 
  'selectService', 
  'confirmLocation', 
  'displayQuote', 
  'askToBook', 
  'showAvailableTimes', 
  'handleTimeChoice', 
  'showDayBrowser', 
  'selectSpecificDay', 
  'showHoursForDay', 
  'selectSpecificTime', 
  'isNewUser', 
  'askEmail', 
  'createBooking', 
  'displayConfirmedBooking', 
  'sendEmailBookingConfirmation'
];

// Flow for businesses with a fixed location where the customer comes to them (e.g., salons, studios).
export const bookingCreatingForNoneMobileService = [
  'selectService', 
  'confirmLocation', 
  'showAvailableTimes', 
  'handleTimeChoice', 
  'showDayBrowser', 
  'selectSpecificDay', 
  'showHoursForDay', 
  'selectSpecificTime', 
  'isNewUser', 
  'askEmail', 
  'createBooking', 
  'displayConfirmedBooking', 
  'sendEmailBookingConfirmation'
]; 