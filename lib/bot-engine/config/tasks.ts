import { IndividualStepHandler } from "@/lib/bot-engine/types";

// Import step handlers
import { askAddressHandler } from '../steps/booking/ask-address';
import { validateAddressHandler } from '../steps/booking/validate-address';
import { selectServiceHandler } from "../steps/booking/select-service";
import { addAdditionalServicesHandler } from "../steps/booking/add-additional-services";
import { confirmLocationHandler } from "../steps/booking/confirm-location";
import { showAvailableTimesHandler } from '../steps/booking/show-available-times';
import { handleTimeChoiceHandler } from '../steps/booking/handle-time-choice';
import { showDayBrowserHandler } from '../steps/booking/show-day-browser';
import { selectSpecificDayHandler } from '../steps/booking/select-specific-day';
import { showHoursForDayHandler } from '../steps/booking/show-hours-for-day';
import { selectSpecificTimeHandler } from '../steps/booking/select-specific-time';
import { quoteSummaryHandler } from '../steps/booking/quote-summary';
import { handleQuoteChoiceHandler } from '../steps/booking/handle-quote-choice';
import { checkExistingUserHandler } from '../steps/booking/check-existing-user';
import { handleUserStatusHandler } from '../steps/booking/handle-user-status';
import { askUserNameHandler } from '../steps/booking/ask-user-name';
import { createNewUserHandler } from '../steps/booking/create-new-user';
import { askEmailHandler } from '../steps/booking/ask-email';
import { createBookingHandler } from '../steps/booking/create-booking';
import { bookingConfirmationHandler } from '../steps/booking/booking-confirmation';
import { getBusinessEmailHandler } from '../steps/account/business-account-steps';

export const botTasks: Record<string, IndividualStepHandler> = {
  // Business account handlers
  getBusinessEmail: getBusinessEmailHandler,
  // Customer booking handlers
  askAddress: askAddressHandler,
  validateAddress: validateAddressHandler,
  selectService: selectServiceHandler,
  addAdditionalServices: addAdditionalServicesHandler,
  confirmLocation: confirmLocationHandler,
  // New simplified time/date handlers
  showAvailableTimes: showAvailableTimesHandler,
  handleTimeChoice: handleTimeChoiceHandler,
  showDayBrowser: showDayBrowserHandler,
  selectSpecificDay: selectSpecificDayHandler,
  showHoursForDay: showHoursForDayHandler,
  selectSpecificTime: selectSpecificTimeHandler,
  // Quote and booking handlers
  quoteSummary: quoteSummaryHandler,
  handleQuoteChoice: handleQuoteChoiceHandler,
  // User management handlers
  checkExistingUser: checkExistingUserHandler,
  handleUserStatus: handleUserStatusHandler,
  askUserName: askUserNameHandler,
  createNewUser: createNewUserHandler,
  // Other handlers
  askEmail: askEmailHandler,
  createBooking: createBookingHandler,
  bookingConfirmation: bookingConfirmationHandler,
}; 