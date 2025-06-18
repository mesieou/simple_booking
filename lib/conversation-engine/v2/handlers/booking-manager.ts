import { DetectedIntent, BookingIntent, DialogueState, TaskHandlerResult, ButtonConfig } from '../nlu/types';
import { UserContext } from '@/lib/database/models/user-context';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';
import { Service, ServiceData } from '@/lib/database/models/service';
import { User } from '@/lib/database/models/user';
import { enrichServiceDataWithVectorSearch } from '../../llm-actions/chat-interactions/functions/vector-search';

/**
 * AvailabilityService - Wrapper for availability operations (matching old system pattern)
 */
class AvailabilityService {
  
  // Gets the actual user UUID by looking up which business this user is associated with
  static async findUserIdByBusinessId(businessId: string): Promise<string | null> {
    try {
      const userOwningThisBusiness = await User.findUserByBusinessId(businessId);
      return userOwningThisBusiness ? userOwningThisBusiness.id : null;
    } catch (error) {
      console.error('[AvailabilityService] Error finding user by business ID:', error);
      return null;
    }
  }
  
  // Gets next 3 chronologically available time slots for the given business
  static async getNext3AvailableSlotsForBusiness(
    businessId: string, 
    serviceDuration: number
  ): Promise<Array<{ date: string; time: string; displayText: string }>> {
    try {
      console.log(`[AvailabilityService] Getting next 3 slots for business ${businessId}, service duration ${serviceDuration} minutes`);
      
      const userIdOfBusinessOwner = await this.findUserIdByBusinessId(businessId);
      if (!userIdOfBusinessOwner) {
        console.error('[AvailabilityService] No business owner found for this business ID');
        return [];
      }
      
      const rawSlots = await AvailabilitySlots.getNext3AvailableSlots(userIdOfBusinessOwner, serviceDuration);
      
      // Simple display formatting (same as old system)
      return rawSlots.map(slot => {
        const date = new Date(slot.date);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        let dateText = '';
        if (date.toDateString() === today.toDateString()) {
          dateText = 'Today';
        } else if (date.toDateString() === tomorrow.toDateString()) {
          dateText = 'Tomorrow';
        } else {
          dateText = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
        }
        
        // Simple time formatting (same as old system)
        const [hours, minutes] = slot.time.split(':');
        const hour24 = parseInt(hours);
        const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
        const ampm = hour24 >= 12 ? 'pm' : 'am';
        const timeText = `${hour12}${minutes !== '00' ? `:${minutes}` : ''} ${ampm}`;
        
        return {
          ...slot,
          displayText: `${dateText} ${timeText}`
        };
      });
      
    } catch (error) {
      console.error('[AvailabilityService] Error getting next 3 available slots for business:', error);
      return [];
    }
  }
  
  // Gets available hours for a specific date for the given business
  static async getAvailableHoursForDateByBusiness(
    businessId: string,
    date: string,
    serviceDuration: number
  ): Promise<string[]> {
    try {
      const userIdOfBusinessOwner = await this.findUserIdByBusinessId(businessId);
      if (!userIdOfBusinessOwner) {
        console.error('[AvailabilityService] No business owner found for this business ID');
        return [];
      }
      
      return await AvailabilitySlots.getAvailableHoursForDate(userIdOfBusinessOwner, date, serviceDuration);
    } catch (error) {
      console.error('[AvailabilityService] Error getting available hours for business:', error);
      return [];
    }
  }
  
  // Validates if a custom date has availability for the given business
  static async validateCustomDateForBusiness(
    businessId: string,
    date: string,
    serviceDuration: number
  ): Promise<boolean> {
    try {
      const availableHoursForThisBusinessAndDate = await AvailabilityService.getAvailableHoursForDateByBusiness(businessId, date, serviceDuration);
      return availableHoursForThisBusinessAndDate.length > 0;
    } catch (error) {
      console.error('[AvailabilityService] Error validating custom date for business:', error);
      return false;
    }
  }
}

/**
 * BookingManager - Intelligent booking intent handler for V2 system
 * 
 * Handles booking intents with context awareness:
 * - Availability checking vs actual booking requests
 * - Service matching using natural language + vector search
 * - Prevents booking conflicts and manages state transitions
 * - Integrates with existing availability and booking systems
 */
export class BookingManager {
  
  /**
   * Main entry point for processing booking intents
   */
  static async processIntent(
    intent: DetectedIntent,
    currentContext: DialogueState | null,
    userContext: UserContext,
    userMessage: string
  ): Promise<TaskHandlerResult> {
    
    const bookingData = intent.data as BookingIntent;
    const businessId = userContext.businessId;
    
    if (!businessId) {
      return this.createErrorResponse('Business configuration error. Please contact support.');
    }
    
    if (bookingData.checkingAvailability) {
      return this.handleAvailabilityCheck(bookingData, businessId);
    } else {
      return this.handleBookingRequest(bookingData, businessId, currentContext);
    }
  }
  
  /**
   * Handles availability checking requests
   * Example: "Do you have time Friday at 2pm?"
   */
  private static async handleAvailabilityCheck(
    bookingData: BookingIntent,
    businessId: string
  ): Promise<TaskHandlerResult> {
    
    try {
      const serviceDuration = await this.estimateServiceDuration(businessId, bookingData.serviceInquiry);
      const date = this.normalizeDateToISO(bookingData.date || new Date().toISOString());

      if (bookingData.time) {
        // Handle "tomorrow morning", "Friday afternoon"
        const timeRange = this.getTimeRange(bookingData.time);
        if (timeRange.isRange) {
          const firstSlot = await this.findFirstAvailableSlotInRange(businessId, date, timeRange, serviceDuration);
          if (firstSlot) {
            return {
              response: `✅ Yes! I do have availability on ${this.formatDateForDisplay(date)} in the ${bookingData.time}. My first opening is at ${this.formatTimeForDisplay(firstSlot)}. Would you like to book it?`,
              shouldUpdateContext: true,
              contextUpdates: {
                activeBooking: {
                  date: date,
                  time: firstSlot,
                  serviceName: bookingData.serviceInquiry,
                  status: 'collecting_info',
                  createdAt: new Date().toISOString(),
                  lastUpdatedAt: new Date().toISOString()
                }
              },
              buttons: [
                { buttonText: '✅ Yes, book it', buttonValue: `book_${date}_${firstSlot}` },
                { buttonText: '📅 See other times', buttonValue: `browse_times_${date}` }
              ]
            };
          } else {
             return this.handleUnavailableDate(businessId, date, bookingData.serviceInquiry);
          }
        }
        
        // Handle specific time "tomorrow at 2pm"
        const isAvailable = await this.checkSpecificDateTime(businessId, date, bookingData.time, serviceDuration);
        if (isAvailable) {
          const normalizedTime = this.normalizeTimeToSlot(bookingData.time);
          return {
            response: `✅ Yes! I have availability on ${this.formatDateForDisplay(date)} at ${this.formatTimeForDisplay(normalizedTime)}. Would you like to book it?`,
            shouldUpdateContext: true,
            contextUpdates: { activeBooking: { date: date, time: normalizedTime, serviceName: bookingData.serviceInquiry, status: 'collecting_info', createdAt: new Date().toISOString(), lastUpdatedAt: new Date().toISOString() }},
            buttons: [
              { buttonText: '✅ Yes, book it', buttonValue: `book_${date}_${normalizedTime}` },
              { buttonText: '📅 See other times', buttonValue: `browse_times_${date}` }
            ]
          };
        } else {
          return this.handleUnavailableSlot(businessId, date, bookingData.time, bookingData.serviceInquiry);
        }
      }
      
      // Handle "do you have time tomorrow?" -> show available times for that date
      return this.showAvailableTimesForDate(businessId, date, bookingData.serviceInquiry);
      
    } catch (error) {
      console.error('[BookingManager] Error checking availability:', error);
      return {
        response: 'I\'m having trouble checking availability right now. Please try again in a moment.',
        shouldUpdateContext: false,
        buttons: [
          { buttonText: '🔄 Try again', buttonValue: 'retry' },
          { buttonText: '📞 Contact support', buttonValue: 'contact_support' }
        ]
      };
    }
  }
  
  /**
   * Handles booking creation/update requests
   * Example: "I want to book a manicure for tomorrow"
   */
  private static async handleBookingRequest(
    bookingData: BookingIntent,
    businessId: string,
    currentContext: DialogueState | null
  ): Promise<TaskHandlerResult> {
    
    if (currentContext?.activeBooking) {
      return this.handleBookingUpdate(bookingData, currentContext, businessId);
    }
    
    return this.handleNewBookingRequest(bookingData, businessId);
  }
  
  /**
   * Handles updates to existing booking
   */
  private static async handleBookingUpdate(
    bookingData: BookingIntent,
    currentContext: DialogueState,
    businessId: string
  ): Promise<TaskHandlerResult> {
    
    const activeBooking = currentContext.activeBooking!;
    const updates: Partial<DialogueState['activeBooking']> = {};
    
    if (bookingData.date) updates.date = this.normalizeDateToISO(bookingData.date);
    if (bookingData.time) updates.time = this.normalizeTimeToSlot(bookingData.time);
    if (bookingData.serviceInquiry) updates.serviceName = bookingData.serviceInquiry;
    if (bookingData.userName) updates.userName = bookingData.userName;
    
    const updatedBooking: DialogueState['activeBooking'] = { ...activeBooking, ...updates, lastUpdatedAt: new Date().toISOString() };
    
    const missingInfo = this.detectMissingBookingInfo(updatedBooking);
    if (missingInfo.length > 0) {
      return this.requestMissingInformation(updatedBooking, missingInfo, businessId);
    }
    
    return this.showQuoteSummary(updatedBooking);
  }
  
  /**
   * Handles new booking requests
   */
  private static async handleNewBookingRequest(
    bookingData: BookingIntent,
    businessId: string
  ): Promise<TaskHandlerResult> {
    
    const newBooking: Partial<DialogueState['activeBooking']> = {
      status: 'collecting_info',
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      userName: bookingData.userName,
      serviceName: bookingData.serviceInquiry,
      date: bookingData.date ? this.normalizeDateToISO(bookingData.date) : undefined,
      time: bookingData.time ? this.normalizeTimeToSlot(bookingData.time) : undefined,
    };
    
    const missingInfo = this.detectMissingBookingInfo(newBooking);
    if (missingInfo.length === 0) {
      return this.showQuoteSummary(newBooking);
    }
    
    return this.requestMissingInformation(newBooking, missingInfo, businessId);
  }
  
  /**
   * Checks availability for a specific date and time
   */
  private static async checkSpecificDateTime(
    businessId: string,
    date: string,
    time: string,
    serviceDuration: number
  ): Promise<boolean> {
    const availableHours = await AvailabilityService.getAvailableHoursForDateByBusiness(businessId, date, serviceDuration);
    return availableHours.includes(this.normalizeTimeToSlot(time));
  }
  
  /**
   * Shows available times for a specific date (follows old system pattern)
   */
  private static async showAvailableTimesForDate(
    businessId: string,
    date: string,
    serviceInquiry?: string
  ): Promise<TaskHandlerResult> {
    const serviceDuration = await this.estimateServiceDuration(businessId, serviceInquiry);
    const availableHours = await AvailabilityService.getAvailableHoursForDateByBusiness(businessId, date, serviceDuration);
      
    if (availableHours.length === 0) {
      return this.handleUnavailableDate(businessId, date, serviceInquiry);
    }
    
    const timeButtons: ButtonConfig[] = availableHours.slice(0, 8).map(time => ({
      buttonText: this.formatTimeForDisplay(time),
      buttonValue: `book_${date}_${time}`
    }));
    
    return {
      response: `📅 Available times for ${this.formatDateForDisplay(date)}:`,
      shouldUpdateContext: true,
      contextUpdates: { activeBooking: { date: date, serviceName: serviceInquiry, status: 'collecting_info', createdAt: new Date().toISOString(), lastUpdatedAt: new Date().toISOString() }},
      buttons: timeButtons
    };
  }
  
  /**
   * Handles when a requested slot is unavailable
   */
  private static async handleUnavailableSlot(
    businessId: string,
    date: string,
    requestedTime: string,
    serviceInquiry?: string
  ): Promise<TaskHandlerResult> {
    
    const alternativeButtons = await this.findAlternativeTimeSlots(businessId, date, requestedTime, serviceInquiry);
    
    if (alternativeButtons.length > 0) {
      return {
        response: `❌ Sorry, that specific time is unavailable. However, I have these other times on the same day:`,
        shouldUpdateContext: false,
        buttons: [
          ...alternativeButtons,
          { buttonText: '📅 Choose a different day', buttonValue: 'browse_other_days' }
        ]
      };
    }
    
    return this.handleUnavailableDate(businessId, date, serviceInquiry);
  }
  
  /**
   * Handles when a requested date has no availability
   */
  private static async handleUnavailableDate(
    businessId: string,
    date: string,
    serviceInquiry?: string
  ): Promise<TaskHandlerResult> {
    
    const alternativeButtons = await this.findNextAvailableDays(businessId, date, serviceInquiry);
    
    if (alternativeButtons.length > 0) {
      return {
        response: `❌ Sorry, no availability on ${this.formatDateForDisplay(date)}. My next available days are:`,
        shouldUpdateContext: false,
        buttons: [
          ...alternativeButtons,
          { buttonText: '🗓️ See more dates', buttonValue: 'browse_calendar' }
        ]
      };
    }

    return {
      response: "❌ Sorry, no availability in the near future. My next available days are:",
      shouldUpdateContext: false,
      buttons: [
        { buttonText: '🔄 Try again', buttonValue: 'retry' },
        { buttonText: '📞 Contact support', buttonValue: 'contact_support' }
      ]
    };
  }
  
  /**
   * Detects what information is missing for a complete booking
   */
  private static detectMissingBookingInfo(booking: Partial<DialogueState['activeBooking']>): string[] {
    const missing: string[] = [];
    if (!booking?.serviceName) missing.push('service');
    if (!booking?.date) missing.push('date');
    if (!booking?.time) missing.push('time');
    if (!booking?.userName) missing.push('name');
    return missing;
  }
  
  /**
   * Requests missing information from the user (following old system pattern)
   */
  private static async requestMissingInformation(
    booking: Partial<DialogueState['activeBooking']>,
    missingInfo: string[],
    businessId: string
  ): Promise<TaskHandlerResult> {
    
    const firstMissing = missingInfo[0];
    
    switch (firstMissing) {
      case 'service':
        return this.requestServiceSelection(booking, businessId);
      case 'date':
        return this.requestDateSelection(booking, businessId);
      case 'time':
        return this.requestTimeSelection(booking, businessId);
      case 'name':
        return this.requestNameInput(booking);
      default:
        return this.createErrorResponse('Unable to process booking information.');
    }
  }
  
  /**
   * Requests service selection from available services
   */
  private static async requestServiceSelection(booking: Partial<DialogueState['activeBooking']>, businessId: string): Promise<TaskHandlerResult> {
    const serviceButtons = await this.createServiceSelectionButtons(businessId);
    return {
      response: '🛍️ What service would you like to book?',
      shouldUpdateContext: true,
      contextUpdates: { 
        activeBooking: {
          ...booking,
          createdAt: booking?.createdAt || new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString()
        }
      },
      buttons: serviceButtons
    };
  }
  
  /**
   * Requests date selection (following old system pattern - show available dates)
   */
  private static async requestDateSelection(booking: Partial<DialogueState['activeBooking']>, businessId: string): Promise<TaskHandlerResult> {
    const nextDaysButtons = await this.findNextAvailableDays(businessId, new Date().toISOString(), booking?.serviceName);
    return {
      response: '📅 What date would you prefer for your appointment?',
      shouldUpdateContext: true,
      contextUpdates: { 
        activeBooking: {
          ...booking,
          createdAt: booking?.createdAt || new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString()
        }
      },
      buttons: [
        ...nextDaysButtons,
        { buttonText: '🗓️ See more dates', buttonValue: 'browse_calendar' }
      ]
    };
  }
  
  /**
   * Requests time selection (following old system pattern - show actual available times)
   */
  private static async requestTimeSelection(booking: Partial<DialogueState['activeBooking']>, businessId: string): Promise<TaskHandlerResult> {
    if (!booking?.date) {
        return this.requestDateSelection(booking, businessId);
    }
    return this.showAvailableTimesForDate(businessId, booking.date, booking?.serviceName);
  }
  
  /**
   * Requests name input
   */
  private static async requestNameInput(booking: Partial<DialogueState['activeBooking']>): Promise<TaskHandlerResult> {
    return {
      response: '👋 To offer a personal touch, what name should I put the quote under?',
      shouldUpdateContext: true,
      contextUpdates: { 
        activeBooking: {
          ...booking,
          createdAt: booking?.createdAt || new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString()
        }
      },
      buttons: []
    };
  }
  
  /**
   * Shows booking summary for confirmation
   */
  private static async showQuoteSummary(booking: Partial<DialogueState['activeBooking']>): Promise<TaskHandlerResult> {
    if (!booking?.userName || !booking?.serviceName || !booking?.date || !booking?.time) {
        return this.createErrorResponse("I'm missing some details to create a quote. Let's try again.");
    }
    const summary = [
      `📋 **Quote Summary**`,
      `👤 Name: ${this.sanitizeInput(booking.userName)}`,
      `🛍️ Service: ${this.sanitizeInput(booking.serviceName)}`,
      `📅 Date: ${this.formatDateForDisplay(booking.date)}`,
      `🕐 Time: ${this.formatTimeForDisplay(booking.time)}`,
    ].join('\n');
    
    return {
      response: summary + '\n\nDoes this look correct? I can create a quote for you.',
      shouldUpdateContext: true,
      contextUpdates: { 
        activeBooking: { 
          ...booking, 
          status: 'ready_for_quote' as const,
          createdAt: booking?.createdAt || new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString()
        } 
      },
      buttons: [
        { buttonText: '✅ Yes, looks good!', buttonValue: 'confirm_quote' },
        { buttonText: '✏️ Make changes', buttonValue: 'edit_booking' },
        { buttonText: '❌ Cancel', buttonValue: 'cancel_booking' }
      ]
    };
  }
  
  // --- INTELLIGENT HELPER FUNCTIONS ---

  private static async createServiceSelectionButtons(businessId: string): Promise<ButtonConfig[]> {
    try {
        const services = await Service.getByBusiness(businessId);
        if (services.length === 0) return [];

        return services.slice(0, 8).map(service => {
            const serviceData = service.getData();
            const details = [];
            if (serviceData.fixedPrice) details.push(`$${serviceData.fixedPrice}`);
            if (serviceData.durationEstimate) details.push(`${serviceData.durationEstimate}min`);
            const detailsDisplay = details.length > 0 ? ` (${details.join(', ')})` : '';
            return {
                buttonText: `${serviceData.name}${detailsDisplay}`,
                buttonValue: `select_service_${serviceData.id}`
            };
        });
    } catch (error) {
        console.error('[BookingManager] Error creating service buttons:', error);
        return [];
    }
  }
  
  private static async findAlternativeTimeSlots(
    businessId: string,
    date: string,
    requestedTime: string,
    serviceInquiry?: string
  ): Promise<ButtonConfig[]> {
    const serviceDuration = await this.estimateServiceDuration(businessId, serviceInquiry);
    const availableHours = await AvailabilityService.getAvailableHoursForDateByBusiness(businessId, date, serviceDuration);

    if (availableHours.length === 0) return [];

    const requestedMinutes = this.timeToMinutes(this.normalizeTimeToSlot(requestedTime));
    const availableMinutes = availableHours.map(this.timeToMinutes).sort((a,b) => a - b);

    let beforeSlot: number | undefined;
    let afterSlot: number | undefined;

    for (let i = availableMinutes.length - 1; i >= 0; i--) {
        if (availableMinutes[i] < requestedMinutes) {
            beforeSlot = availableMinutes[i];
            break;
        }
    }
    for (const slot of availableMinutes) {
        if (slot > requestedMinutes) {
            afterSlot = slot;
            break;
        }
    }

    const alternativeButtons: ButtonConfig[] = [];
    if (beforeSlot) alternativeButtons.push({ buttonText: `🕒 ${this.formatTimeForDisplay(this.minutesToTime(beforeSlot))}`, buttonValue: `book_${date}_${this.minutesToTime(beforeSlot)}`});
    if (afterSlot) alternativeButtons.push({ buttonText: `🕒 ${this.formatTimeForDisplay(this.minutesToTime(afterSlot))}`, buttonValue: `book_${date}_${this.minutesToTime(afterSlot)}`});

    if (alternativeButtons.length < 2) {
      if (!beforeSlot && afterSlot) {
        const nextAfterIndex = availableMinutes.indexOf(afterSlot) + 1;
        if(nextAfterIndex < availableMinutes.length) alternativeButtons.push({ buttonText: `🕒 ${this.formatTimeForDisplay(this.minutesToTime(availableMinutes[nextAfterIndex]))}`, buttonValue: `book_${date}_${this.minutesToTime(availableMinutes[nextAfterIndex])}`});
      }
      if (beforeSlot && !afterSlot) {
        const prevBeforeIndex = availableMinutes.indexOf(beforeSlot) - 1;
        if(prevBeforeIndex >= 0) alternativeButtons.unshift({ buttonText: `🕒 ${this.formatTimeForDisplay(this.minutesToTime(availableMinutes[prevBeforeIndex]))}`, buttonValue: `book_${date}_${this.minutesToTime(availableMinutes[prevBeforeIndex])}`});
      }
    }

    return alternativeButtons.slice(0, 2);
  }
  
  private static async findNextAvailableDays(
    businessId: string,
    startDate: string,
    serviceInquiry?: string
  ): Promise<ButtonConfig[]> {
    const serviceDuration = await this.estimateServiceDuration(businessId, serviceInquiry);
    const availableDays: ButtonConfig[] = [];
    const today = new Date(this.normalizeDateToISO(startDate));
    
    for (let i = 1; i < 90; i++) { 
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        
        if (await AvailabilityService.validateCustomDateForBusiness(businessId, dateString, serviceDuration)) {
            const displayText = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            availableDays.push({ buttonText: `🗓️ ${displayText}`, buttonValue: `day_${dateString}` });
            if (availableDays.length >= 2) break;
        }
    }
    return availableDays;
  }
  
  private static async findFirstAvailableSlotInRange(
    businessId: string,
    date: string,
    timeRange: { isRange: boolean; start: number; end: number },
    serviceDuration: number
  ): Promise<string | null> {
      const availableHours = await AvailabilityService.getAvailableHoursForDateByBusiness(businessId, date, serviceDuration);
      if (availableHours.length === 0) return null;

      for (const slot of availableHours) {
          const slotMinutes = this.timeToMinutes(slot);
          if (slotMinutes >= timeRange.start && slotMinutes <= timeRange.end) {
              return slot; // Return the first slot found in range
          }
      }
      return null;
  }
  
  private static async estimateServiceDuration(businessId: string, serviceInquiry?: string): Promise<number> {
    if (!serviceInquiry) return 60; // Default 1 hour
    
    try {
      const services = await Service.getByBusiness(businessId);
      // Use correct enrichServiceDataWithVectorSearch signature (matching old system)
      const servicesWithIds = services.filter(s => s.getData().id).map(s => ({ id: s.getData().id!, name: s.getData().name }));
      const enrichedServices = await enrichServiceDataWithVectorSearch(servicesWithIds, businessId);
      
      // Find matching service by name similarity
      const matchedService = enrichedServices.find(s => 
        s.name.toLowerCase().includes(serviceInquiry.toLowerCase()) ||
        serviceInquiry.toLowerCase().includes(s.name.toLowerCase())
      );
      
      return matchedService?.durationEstimate || 60;
    } catch (error) {
      console.error('[BookingManager] Error estimating service duration:', error);
      return 60;
    }
  }

  // --- UTILITY AND FORMATTING FUNCTIONS ---

  private static getTimeRange(timeString: string): { isRange: boolean; start: number; end: number } {
    const lowerTime = timeString.toLowerCase();
    if (lowerTime.includes('morning')) return { isRange: true, start: 8 * 60, end: 12 * 60 };
    if (lowerTime.includes('afternoon')) return { isRange: true, start: 12 * 60, end: 17 * 60 };
    if (lowerTime.includes('evening')) return { isRange: true, start: 17 * 60, end: 21 * 60 };
    return { isRange: false, start: 0, end: 0 };
  }
  
  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private static minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }
  
  private static normalizeDateToISO(dateString: string): string {
    try {
        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) return dateString;
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
    } catch (e) { /* Fallthrough */ }

    const today = new Date();
    const lowerDate = dateString.toLowerCase();
    if (lowerDate === 'today') return today.toISOString().split('T')[0];
    if (lowerDate === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    
    // Simple fallback, production system might use a date parsing library
    return today.toISOString().split('T')[0];
  }
  
  private static normalizeTimeToSlot(timeString: string): string {
    const lowerTime = timeString.toLowerCase().replace(/\s+/g, '');
    
    if (lowerTime.includes('pm') || lowerTime.includes('am')) {
      const match = lowerTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
      if (match) {
        let hours = parseInt(match[1]);
        const minutes = match[2] ? parseInt(match[2]) : 0;
        const period = match[3];
        
        if (period === 'pm' && hours !== 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }
    
    if (timeString.match(/^\d{1,2}:\d{2}$/)) return timeString;
    
    return '12:00'; // Fallback
  }
  
  private static formatDateForDisplay(dateString: string): string {
      const date = new Date(dateString);
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);

      const isToday = date.toDateString() === today.toDateString();
      const isTomorrow = date.toDateString() === tomorrow.toDateString();

      if (isToday) return 'Today';
      if (isTomorrow) return 'Tomorrow';

      return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  }
  
  private static formatTimeForDisplay(timeString: string): string {
    try {
      const [hours, minutes] = timeString.split(':');
      const hour24 = parseInt(hours);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'pm' : 'am';
      return `${hour12}${minutes !== '00' ? `:${minutes}` : ''}${ampm}`;
    } catch (error) {
      return timeString;
    }
  }
  
  private static createErrorResponse(message: string): TaskHandlerResult {
    return {
      response: message,
      shouldUpdateContext: false,
      buttons: [
        { buttonText: '🔄 Try again', buttonValue: 'retry' },
        { buttonText: '📞 Contact support', buttonValue: 'contact_support' }
      ]
    };
  }

  /**
   * Sanitizes user input to prevent XSS attacks
   */
  private static sanitizeInput(input: string): string {
    if (!input) return '';
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
} 