// --- Conversation Flow Configuration ---
export const conversationFlowBlueprints: Record<string, string[]> = {
  // Business-specific booking flows
  removalistBookingCreation: [
    'askPickupAddress',
    'validateAddress',
    'askDropoffAddress',
    'validateAddress',
    'selectService',
    'addAdditionalServices',
    'confirmLocation',
    'showAvailableTimes',
    'handleTimeChoice',
    'showDayBrowser',
    'selectSpecificDay',
    'showHoursForDay',
    'selectSpecificTime',
    'quoteSummary',
    'handleQuoteChoice',
    'createBooking'
  ],
  salonBookingCreation: [
    'selectService',
    'addAdditionalServices',
    'confirmLocation',
    'showAvailableTimes',
    'handleTimeChoice',
    'showDayBrowser',
    'selectSpecificDay',
    'showHoursForDay',
    'selectSpecificTime',
    'quoteSummary',
    'handleQuoteChoice',
    'createBooking'
  ],
  // Legacy flows (kept for compatibility)
  businessAccountCreation: ['getName', 'getBusinessEmail', 'getBusinessPhone', 'selectTimeZone', 'confirmAccountDetails'],
  businessAccountDeletion: ['confirmDeletionRequest', 'verifyUserPassword', 'initiateAccountDeletion'],
  bookingCreatingForMobileService: ['askAddress', 'validateAddress', 'selectService', 'addAdditionalServices', 'confirmLocation', 'showAvailableTimes', 'handleTimeChoice', 'showDayBrowser', 'selectSpecificDay', 'showHoursForDay', 'selectSpecificTime', 'quoteSummary', 'handleQuoteChoice', 'createBooking'],
  bookingCreatingForNoneMobileService: ['selectService', 'addAdditionalServices', 'confirmLocation', 'showAvailableTimes', 'handleTimeChoice', 'showDayBrowser', 'selectSpecificDay', 'showHoursForDay', 'selectSpecificTime', 'quoteSummary', 'handleQuoteChoice', 'createBooking'],
  customerFaqHandling: ['handleFaqQuestion'],
}; 

// Mapping from businessCategory to booking flow key
export const businessCategoryToBookingFlowKey: Record<string, string> = {
  removalist: 'removalistBookingCreation',
  salon: 'salonBookingCreation',
  default: 'bookingCreatingForMobileService', // Default to mobile service flow
}; 