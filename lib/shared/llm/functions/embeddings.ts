import OpenAI from "openai";
import { findBestVectorResult, type VectorSearchResult } from "./vector-search";
import { Service, ServiceData } from "@/lib/database/models/service";
import { Business, BusinessData } from "@/lib/database/models/business";
import { CalendarSettings, type CalendarSettingsData } from "@/lib/database/models/calendar-settings";
import { AvailabilitySlots } from "@/lib/database/models/availability-slots";

export type { VectorSearchResult };

const BOOST_FACTORS: { [key: string]: number } = {
  'service': 2.0, // Increased boost for live service data
  'business': 2.5, // Higher boost for business contact info
  'availability': 3.0, // Very high boost for availability/working hours to prioritize over PDF documents
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000,
});

// Simple in-memory cache for intent classification to avoid redundant LLM calls
const intentCache = new Map<string, { 
  classification: {isAvailability: boolean, isBusiness: boolean, isService: boolean}, 
  timestamp: number 
}>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export async function generateEmbedding(text: string): Promise<number[]> {
  console.log(`[generateEmbedding] Attempting for text (first 80 chars): "${text.substring(0, 80).replace(/\n/g, ' ')}..."`);
  if (!text || text.trim().length === 0) {
    console.warn("[generateEmbedding] Received empty or whitespace-only text. Skipping API call, will throw error.");
    throw new Error("Cannot generate embedding for empty text.");
  }

  // START MOCK LOGIC
  if (process.env.MOCK_GPT === 'true') {
    console.log(`[generateEmbedding] MOCK MODE: Returning dummy embedding vector for text (first 80 chars): "${text.substring(0, 80).replace(/\n/g, ' ')}..."`);
    // Return a dummy vector of the correct dimension (1536 for text-embedding-3-small)
    // Using a simple array of 0.001 for differentiation from actual zeros if they were to occur.
    const dummyEmbedding = new Array(1536).fill(0.001);
    return dummyEmbedding;
  }
  // END MOCK LOGIC

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.replace(/\n/g, ' '),
    });
    
    if (response && response.data && response.data[0] && response.data[0].embedding) {
      console.log(`[generateEmbedding] SUCCESS for text (first 80 chars): "${text.substring(0, 80).replace(/\n/g, ' ')}..."`);
      return response.data[0].embedding;
    } else {
      console.error(`[generateEmbedding] UNEXPECTED RESPONSE structure from OpenAI. Response:`, JSON.stringify(response, null, 2));
      throw new Error("Unexpected response structure from OpenAI embedding API.");
    }
  } catch (error) {
    console.error(`[generateEmbedding] CAUGHT ERROR for text (first 80 chars): "${text.substring(0, 80).replace(/\n/g, ' ')}...". Error:`, error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper function to convert structured service data into comprehensive natural language text.
 * Includes ALL service fields from the database for complete coverage.
 * @param service The service data object.
 * @returns A string containing ALL service information.
 */
function generateServiceDocumentContent(service: ServiceData): string {
  // Comprehensive pricing description covering ALL pricing fields
  let pricingDescription = '';
  if (service.pricingType === 'fixed' && service.fixedPrice !== undefined) {
    pricingDescription = `Fixed price: $${service.fixedPrice}.`;
  } else if (service.pricingType === 'per_minute' && service.ratePerMinute !== undefined) {
    const components = [];
    components.push(`$${service.ratePerMinute} per minute`);
    
    if (service.baseCharge && service.baseCharge > 0) {
      components.push(`base charge of $${service.baseCharge}`);
    }
    
    if (service.includedMinutes && service.includedMinutes > 0) {
      components.push(`first ${service.includedMinutes} minutes included`);
    }
    
    pricingDescription = `Per-minute pricing: ${components.join(', ')}.`;
  }

  const description = service.description || `Professional ${service.name} service.`;
  const mobileService = service.mobile ? 'Available for mobile/house calls' : 'In-location service only (not mobile)';
  
  return `
    Service: ${service.name}.
    Description: ${description}
    Duration: ${service.durationEstimate} minutes estimated.
    Pricing: ${pricingDescription}
    Service Type: ${mobileService}.
    Pricing Model: ${service.pricingType} pricing.
    ${service.baseCharge ? `Base charge: $${service.baseCharge}.` : ''}
    ${service.includedMinutes ? `Included time: ${service.includedMinutes} minutes.` : ''}
    ${service.ratePerMinute ? `Rate: $${service.ratePerMinute} per minute.` : ''}
    Created: ${service.createdAt ? new Date(service.createdAt).toLocaleDateString() : 'Recently'}.
  `.trim().replace(/\s\s+/g, ' ');
}

/**
 * Helper function to convert business data into comprehensive natural language text.
 * Includes ALL business fields from the database for complete coverage.
 * @param business The business data object.
 * @returns A string containing ALL business information.
 */
function generateBusinessDocumentContent(business: BusinessData): string {
  // Payment processing status
  const paymentStatus = business.stripeAccountStatus ? 
    `Payment processing: ${business.stripeAccountStatus} via Stripe.` : 
    'Payment processing: Status not specified.';
  
  // Deposit information
  const depositInfo = (() => {
    if (business.depositType === 'percentage' && business.depositPercentage && business.depositPercentage > 0) {
      return `${business.depositPercentage}% deposit required.`;
    } else if (business.depositType === 'fixed' && business.depositFixedAmount && business.depositFixedAmount > 0) {
      return `$${business.depositFixedAmount} deposit required.`;
    } else {
      return 'No deposit required.';
    }
  })();
    
  // Contact methods
  const contactMethods = [];
  if (business.phone) contactMethods.push(`Phone: ${business.phone}`);
  if (business.email) contactMethods.push(`Email: ${business.email}`);
  if (business.whatsappNumber) contactMethods.push(`WhatsApp: ${business.whatsappNumber}`);
  
  // Interface and setup
  const interfaceInfo = `Platform: ${business.interfaceType} interface.`;
  const websiteInfo = business.websiteUrl ? `Website: ${business.websiteUrl}.` : '';
  
  return `
    Business: ${business.name}.
    Contact: ${contactMethods.join(', ')}.
    ${business.businessAddress ? `Address: ${business.businessAddress}.` : 'Address: Location details available upon booking.'}
    ${websiteInfo}
    Timezone: ${business.timeZone}.
    ${interfaceInfo}
    ${paymentStatus}
    ${depositInfo}
    ${business.preferredPaymentMethod ? `Preferred payment: ${business.preferredPaymentMethod}.` : ''}
    ${business.stripeConnectAccountId ? 'Stripe payment processing enabled.' : ''}
    ${business.whatsappPhoneNumberId ? 'WhatsApp Business API integrated.' : ''}
    Established: ${business.createdAt ? new Date(business.createdAt).toLocaleDateString() : 'Recently'}.
  `.trim().replace(/\s\s+/g, ' ');
}

/**
 * Helper function to convert calendar settings into comprehensive natural language text.
 * Includes ALL calendar and working hour fields for complete coverage.
 * @param calendarSettings The calendar settings with working hours
 * @param businessName The business name for context
 * @returns A string containing ALL schedule and calendar information
 */
function generateAvailabilityDocumentContent(
  calendarSettings: CalendarSettingsData, 
  businessName: string
): string {
  const workingHours = calendarSettings.workingHours;
  const timezone = calendarSettings.settings?.timezone || 'UTC';
  const bufferTime = calendarSettings.settings?.bufferTime || 0;
  
  // Detailed working hours
  const daysWithHours: string[] = [];
  const workingDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  workingDays.forEach((day, index) => {
    const hours = workingHours[day];
    if (hours) {
      daysWithHours.push(`${dayNames[index]}: ${hours.start} - ${hours.end}`);
    }
  });

  const closedDays = workingDays
    .map((day, index) => workingHours[day] ? null : dayNames[index])
    .filter(Boolean);

  // Calendar integration details
  const calendarIntegration = calendarSettings.manageCalendar ? 
    `Calendar sync: ${calendarSettings.calendarType || 'Enabled'} calendar integration active.` : 
    'Calendar sync: Manual scheduling only.';
    
  const lastSyncInfo = calendarSettings.lastSync ? 
    `Last synced: ${new Date(calendarSettings.lastSync).toLocaleDateString()}.` : '';

  return `
    ${businessName} Complete Schedule Information:
    Operating Hours: ${daysWithHours.join(', ')}.
    ${closedDays.length > 0 ? `Closed: ${closedDays.join(', ')}.` : 'Open every day of the week.'}
    Business Timezone: ${timezone}.
    ${bufferTime > 0 ? `Buffer time between appointments: ${bufferTime} minutes.` : 'Back-to-back appointments allowed.'}
    Available appointment durations: 1 hour, 1.5 hours, 2 hours, 2.5 hours, 3 hours, 4 hours, 5 hours, 6 hours.
    Booking window: Appointments can be scheduled up to 30 days in advance.
    ${calendarIntegration}
    ${lastSyncInfo}
    Calendar ID: ${calendarSettings.calendarId || 'Manual management'}.
  `.trim().replace(/\s\s+/g, ' ');
}

/**
 * Helper function to convert raw availability data to a more usable format for RAG.
 * @param availabilityData Raw availability data from the database
 * @returns Array of available slots grouped by day
 */
function convertAvailabilityDataToSlots(availabilityData: any[]): Array<{ date: string; slots: string[] }> {
  if (!availabilityData || availabilityData.length === 0) {
    return [];
  }

  const now = new Date();
  const result: Array<{ date: string; slots: string[] }> = [];

  // Process each day's availability
  for (const dayData of availabilityData) {
    const dayDate = new Date(dayData.date);
    
    // Skip past dates
    if (dayDate < now) {
      continue;
    }
    
    // Get slots for common durations (60min and 90min are most common)
    const slots60 = dayData.slots['60'] || [];
    const slots90 = dayData.slots['90'] || [];
    
    // Extract time strings from tuples [time, providerCount] and filter available slots
    const availableTimes60 = slots60
      .filter(([time, providerCount]: [string, number]) => providerCount > 0)
      .map(([time, providerCount]: [string, number]) => time);
    const availableTimes90 = slots90
      .filter(([time, providerCount]: [string, number]) => providerCount > 0)
      .map(([time, providerCount]: [string, number]) => time);
    
    // Combine and deduplicate time strings (not tuples!)
    const allSlots = Array.from(new Set([...availableTimes60, ...availableTimes90]));
    
    // Filter out past times for today
    const isToday = dayDate.toDateString() === now.toDateString();
    const filteredSlots = allSlots.filter(time => {
      if (!isToday) return true;
      
      // Check if time is in the future for today
      const [hours, minutes] = time.split(':').map(Number);
      const slotTime = new Date();
      slotTime.setHours(hours, minutes, 0, 0);
      return slotTime > now;
    });
    
    // Only include days with available slots
    if (filteredSlots.length > 0) {
      result.push({
        date: dayData.date,
        slots: filteredSlots.sort() // Sort times chronologically
      });
    }
  }

  return result;
}

/**
 * Helper function to convert actual available time slots into natural language for RAG.
 * @param availableSlots Array of available time slots grouped by day
 * @param businessName The business name for context
 * @returns A string containing actual available appointment times
 */
function generateAvailableSlotsContent(
  availableSlots: Array<{ date: string; slots: string[] }>,
  businessName: string
): string {
  if (!availableSlots || availableSlots.length === 0) {
    return `${businessName} currently has no available appointment slots this week.`;
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  // Format each day's availability with special handling for upcoming days
  const formattedDays = availableSlots.map(dayData => {
    const date = new Date(dayData.date);
    
    // Determine day label with more specific handling
    let dayLabel = '';
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    
    if (date.toDateString() === today.toDateString()) {
      dayLabel = 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dayLabel = 'Tomorrow';
    } else {
      // Check if it's within this week
      const daysDiff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 3600 * 24));
      if (daysDiff <= 7) {
        dayLabel = `This ${dayName}`;
      } else {
        dayLabel = `Next ${dayName} (${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
      }
    }
    
    // Format times in 12-hour format
    const formattedTimes = dayData.slots.slice(0, 6).map(time => { // Show up to 6 times per day for more options
      const [hours, minutes] = time.split(':');
      const hour24 = parseInt(hours);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minutes} ${ampm}`;
    });
    
    // Add "and more" if there are additional slots
    const moreSlots = dayData.slots.length > 6 ? ` and ${dayData.slots.length - 6} more slots` : '';
    
    return `${dayLabel}: ${formattedTimes.join(', ')}${moreSlots}`;
  });

  // Create summary with specific day mentions
  const totalSlots = availableSlots.reduce((sum, day) => sum + day.slots.length, 0);
  const availabilityLevel = totalSlots > 20 ? 'excellent' : totalSlots > 10 ? 'good' : 'limited';
  
  // Check for specific days that might be requested
  const mondaySlots = availableSlots.filter(day => {
    const date = new Date(day.date);
    return date.getDay() === 1; // Monday is day 1
  });
  
  let mondayInfo = '';
  if (mondaySlots.length > 0) {
    const mondayTimes = mondaySlots[0].slots.slice(0, 4).map(time => {
      const [hours, minutes] = time.split(':');
      const hour24 = parseInt(hours);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minutes} ${ampm}`;
    });
    const mondayDate = new Date(mondaySlots[0].date);
    const isThisMonday = Math.ceil((mondayDate.getTime() - today.getTime()) / (1000 * 3600 * 24)) <= 7;
    const mondayLabel = isThisMonday ? 'This Monday' : 'Next Monday';
    mondayInfo = ` ${mondayLabel} specifically has ${mondaySlots[0].slots.length} available slots: ${mondayTimes.join(', ')}.`;
  }
  
  return `
    ${businessName} Current Availability (${availabilityLevel} availability):
    ${formattedDays.join('. ')}.${mondayInfo}
    
    Total available appointment slots: ${totalSlots}.
    These are the actual times customers can book right now.
  `.trim().replace(/\s\s+/g, ' ');
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) {
    return 0;
  }
  return dotProduct / (magA * magB);
}

/**
 * Enhanced query classification using smart LLM analysis.
 * Determines what data the user actually needs without hardcoding keywords.
 */
async function smartQueryClassification(userMessage: string): Promise<{
  isAvailability: boolean;
  isBusiness: boolean; 
  isService: boolean;
}> {
  const cacheKey = userMessage.toLowerCase().trim();
  const now = Date.now();
  
  // Check cache first
  const cached = intentCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION_MS) {
    console.log(`[Smart Classification] Cache hit for "${userMessage.substring(0, 30)}..."`);
    // Ensure all required properties are present for type safety
    return {
      isAvailability: cached.classification.isAvailability,
      isBusiness: cached.classification.isBusiness,
      isService: cached.classification.isService,
    };
  }
  
  try {
    const systemPrompt = `You are a smart query classifier for a booking system. Determine what type of information the user needs:

AVAILABILITY: When user asks about scheduling, dates, times, when something is available, booking appointments
BUSINESS: When user asks ONLY about direct contact info (phone, email, address) or payment setup (deposits, payment methods, stripe status)
SERVICE: When user asks about what specific services are offered, individual service prices, what the business does

Examples:
- "When are you available?" → AVAILABILITY: true, BUSINESS: false, SERVICE: false
- "Para cuando tendrías cita?" → AVAILABILITY: true, BUSINESS: false, SERVICE: false  
- "What's your phone number?" → AVAILABILITY: false, BUSINESS: true, SERVICE: false
- "What's your email?" → AVAILABILITY: false, BUSINESS: true, SERVICE: false
- "What's your address?" → AVAILABILITY: false, BUSINESS: true, SERVICE: false
- "Is there any deposit?" → AVAILABILITY: false, BUSINESS: true, SERVICE: false
- "Do you require deposits?" → AVAILABILITY: false, BUSINESS: true, SERVICE: false
- "What payment methods do you accept?" → AVAILABILITY: false, BUSINESS: true, SERVICE: false
- "How much for a haircut?" → AVAILABILITY: false, BUSINESS: false, SERVICE: true
- "What services do you offer?" → AVAILABILITY: false, BUSINESS: false, SERVICE: true
- "What is your cancellation policy?" → AVAILABILITY: false, BUSINESS: false, SERVICE: false
- "What are your terms and conditions?" → AVAILABILITY: false, BUSINESS: false, SERVICE: false
- "What is your refund policy?" → AVAILABILITY: false, BUSINESS: false, SERVICE: false
- "Hello" → AVAILABILITY: false, BUSINESS: false, SERVICE: false

Respond with ONLY JSON: {"availability": true/false, "business": true/false, "service": true/false}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Classify this query: "${userMessage}"` }
      ] as any,
      temperature: 0.1,
      max_tokens: 100,
      response_format: { type: "json_object" }
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('No response from classification model');

    const parsed = JSON.parse(result);
    const classification = {
      isAvailability: parsed.availability || false,
      isBusiness: parsed.business || false,
      isService: parsed.service || false
    };
    
    // Cache the result
    intentCache.set(cacheKey, {
      classification: {
        isAvailability: classification.isAvailability,
        isBusiness: classification.isBusiness,
        isService: classification.isService,
      },
      timestamp: now
    });
    
    console.log(`[Smart Classification] "${userMessage.substring(0, 50)}..." → Availability: ${classification.isAvailability}, Business: ${classification.isBusiness}, Service: ${classification.isService}`);
    
    return classification;
    
  } catch (error) {
    console.error('[Smart Classification] Error:', error);
    
    // Simple fallback based on keyword analysis
    const lowerMessage = userMessage.toLowerCase();
    return {
      isAvailability: ['available', 'appointment', 'book', 'when', 'cita', 'fecha', 'hora'].some(w => lowerMessage.includes(w)),
      isBusiness: ['phone number', 'email', 'address', 'contact info', 'deposit', 'payment method', 'teléfono', 'dirección', 'depósito', 'método de pago'].some(w => lowerMessage.includes(w)),
      isService: ['service', 'price', 'cost', 'offer', 'do you do', 'servicio', 'precio', 'costo'].some(w => lowerMessage.includes(w))
    };
  }
}

/**
 * SIMPLIFIED RAG function that prioritizes structured data over documents.
 * 
 * **APPROACH**:
 * 1. Use smart LLM classification to understand what user needs
 * 2. Fetch ONLY the relevant structured data from database 
 * 3. Always prioritize structured data over documents
 * 4. Only fallback to documents if no structured data available
 * 
 * **SCALABLE & SIMPLE for MVP**:
 * - No complex data type detection
 * - Explicit data source mapping
 * - Predictable processing logic
 * - Always returns most relevant information first
 */
export async function RAGfunction(
  businessId: string,
  userMessage: string
): Promise<VectorSearchResult[]> {
  console.log(`[RAGfunction] Starting RAG search for business ${businessId} with message: "${userMessage.substring(0, 100)}..."`);
  
  // Step 1: Smart LLM classification to understand what user needs
  const intent = await smartQueryClassification(userMessage);
  const isBusinessQuery = intent.isAvailability || intent.isBusiness || intent.isService;
  
  console.log(`[RAGfunction] Smart classification - Business query: ${isBusinessQuery}, Availability: ${intent.isAvailability}, Business: ${intent.isBusiness}, Service: ${intent.isService}`);
  
  try {
    const userEmbedding = await generateEmbedding(userMessage);
    const results: VectorSearchResult[] = [];
    
    // Step 2: If it's a business query, fetch structured data explicitly
    if (isBusinessQuery) {
      console.log(`[RAGfunction] Fetching structured business data...`);
      
      // Get business info for business queries
      if (intent.isBusiness) {
        try {
          const business = await Business.getById(businessId);
          if (business) {
            const businessData = business.getData();
            const businessContent = generateBusinessDocumentContent(businessData);
            const businessEmbedding = await generateEmbedding(businessContent);
            const similarity = cosineSimilarity(userEmbedding, businessEmbedding);
            
            results.push({
              documentId: businessData.id!,
              content: businessContent,
              similarityScore: similarity * 3.0, // High priority boost
              type: 'business',
              source: 'Business Information',
              category: 'Business',
              confidenceScore: 1.0,
            });
            console.log(`[RAGfunction] Added business information`);
          }
        } catch (error) {
          console.error('[RAGfunction] Error fetching business data:', error);
        }
      }
      
      // Get services for service queries
      if (intent.isService) {
        try {
          const services = await Service.getByBusiness(businessId);
          if (services && services.length > 0) {
            for (const service of services) {
              const serviceData = service.getData();
              const serviceContent = generateServiceDocumentContent(serviceData);
              const serviceEmbedding = await generateEmbedding(serviceContent);
              const similarity = cosineSimilarity(userEmbedding, serviceEmbedding);
              
              results.push({
                documentId: serviceData.id!,
                content: serviceContent,
                similarityScore: similarity * 2.5, // High priority boost
                type: 'service',
                source: 'Business Service',
                category: 'Services',
                confidenceScore: 1.0,
              });
            }
            console.log(`[RAGfunction] Added ${services.length} services`);
          }
        } catch (error) {
          console.error('[RAGfunction] Error fetching services:', error);
        }
      }
      
      // Get availability for availability queries
      if (intent.isAvailability) {
        try {
          // Get calendar settings
          const calendarSettings = await CalendarSettings.getByBusiness(businessId);
          if (calendarSettings && calendarSettings.length > 0) {
            const calendar = calendarSettings[0];
            const calendarContent = generateAvailabilityDocumentContent(calendar, businessId);
            const calendarEmbedding = await generateEmbedding(calendarContent);
            const similarity = cosineSimilarity(userEmbedding, calendarEmbedding);
            
            results.push({
              documentId: `${businessId}-calendar`,
              content: calendarContent,
              similarityScore: similarity * 3.5, // Highest priority boost
              type: 'availability',
              source: 'Working Hours & Availability',
              category: 'Availability',
              confidenceScore: 1.0,
            });
            console.log(`[RAGfunction] Added calendar settings`);
          }
          
          // Get real-time availability slots
          const { User } = await import('@/lib/database/models/user');
          const provider = await User.findUserByBusinessId(businessId);
          if (provider) {
            const { AvailabilitySlots } = await import('@/lib/database/models/availability-slots');
            const today = new Date();
            const twoWeeksFromNow = new Date();
            twoWeeksFromNow.setDate(today.getDate() + 14);
            
            const availabilityData = await AvailabilitySlots.getByBusinessAndDateRange(
              businessId,
              today.toISOString().split('T')[0],
              twoWeeksFromNow.toISOString().split('T')[0]
            );
            
            if (availabilityData && availabilityData.length > 0) {
              const availableSlots = convertAvailabilityDataToSlots(availabilityData);
              if (availableSlots.length > 0) {
                const slotsContent = generateAvailableSlotsContent(availableSlots, businessId);
                const slotsEmbedding = await generateEmbedding(slotsContent);
                const similarity = cosineSimilarity(userEmbedding, slotsEmbedding);
                
                results.push({
                  documentId: `${businessId}-slots`,
                  content: slotsContent,
                  similarityScore: similarity * 4.0, // Highest priority boost
                  type: 'availability',
                  source: 'Real-time Availability',
                  category: 'Availability',
                  confidenceScore: 1.0,
                });
                console.log(`[RAGfunction] Added real-time availability slots`);
              }
            } else {
              console.log(`[RAGfunction] No availability data found for provider ${provider.id}`);
            }
          }
        } catch (error) {
          console.error('[RAGfunction] Error fetching availability:', error);
        }
      }
    }
    
    // Step 3: If we have structured data, return it. Otherwise, fallback to documents.
    if (results.length > 0) {
      // Sort by similarity score (already boosted)
      results.sort((a, b) => b.similarityScore - a.similarityScore);
      console.log(`[RAGfunction] Returning ${results.length} structured data results`);
      return results;
    } else {
      // Fallback to document search
      console.log(`[RAGfunction] No structured data found, falling back to document search`);
      const documentResults = await findBestVectorResult(userEmbedding, businessId);
      console.log(`[RAGfunction] Returning ${documentResults.length} document results`);
      return documentResults.slice(0, 3); // Limit to top 3 documents
    }
    
  } catch (error) {
    console.error(`[RAGfunction] Error during RAG search:`, error);
    throw new Error(`RAG function failed: ${error instanceof Error ? error.message : String(error)}`);
  }
} 