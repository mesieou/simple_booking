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
  'availability': 2.3, // High boost for availability/working hours
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000,
});

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
 * Helper function to convert structured service data into a natural language text paragraph.
 * This text is optimized for semantic search and for an LLM to generate answers from.
 * @param service The service data object.
 * @returns A string containing the descriptive text of the service.
 */
function generateServiceDocumentContent(service: ServiceData): string {
  let priceDescription = '';
  if (service.pricingType === 'fixed' && service.fixedPrice !== undefined) {
      priceDescription = `The price is $${service.fixedPrice}.`;
  } else if (service.pricingType === 'per_minute' && service.ratePerMinute !== undefined) {
      const base = service.baseCharge ? `a base charge of $${service.baseCharge}` : '';
      const included = service.includedMinutes ? `the first ${service.includedMinutes} minutes included` : '';
      
      priceDescription = `The price is calculated at $${service.ratePerMinute} per minute`;

      if (base && included) {
          priceDescription += `, with ${base} and ${included}.`;
      } else if (base) {
          priceDescription += `, with ${base}.`;
      } else if (included) {
          priceDescription += `, with ${included}.`;
      } else {
          priceDescription += '.';
      }
  }

  const description = service.description || `A ${service.name} service.`;

  return `
    Service Name: ${service.name}.
    Description: ${description}
    The estimated duration for this service is ${service.durationEstimate} minutes.
    ${priceDescription}
    This service ${service.mobile ? 'is available for house calls' : 'is not available for house calls'}.
  `.trim().replace(/\s\s+/g, ' ');
}

/**
 * Helper function to convert business data into a natural language text paragraph for RAG.
 * @param business The business data object.
 * @returns A string containing the business contact and location information.
 */
function generateBusinessDocumentContent(business: BusinessData): string {
  const paymentInfo = business.stripeAccountStatus ? 
    `Payment processing is ${business.stripeAccountStatus}.` : 
    'Payment processing setup not specified.';
  
  const depositInfo = business.depositPercentage ? 
    `Deposit required: ${business.depositPercentage}% of service cost.` : 
    'No deposit information available.';

  return `
    Business Name: ${business.name}.
    Contact Information: Phone: ${business.phone}, Email: ${business.email}.
    ${business.businessAddress ? `Address: ${business.businessAddress}.` : 'Address not specified.'}
    ${business.whatsappNumber ? `WhatsApp: ${business.whatsappNumber}.` : ''}
    Time Zone: ${business.timeZone}.
    Interface Type: ${business.interfaceType}.
    ${business.websiteUrl ? `Website: ${business.websiteUrl}.` : ''}
    ${paymentInfo}
    ${depositInfo}
  `.trim().replace(/\s\s+/g, ' ');
}

/**
 * Helper function to convert working hours and availability data into natural language for RAG.
 * @param calendarSettings The calendar settings with working hours
 * @param businessName The business name for context
 * @returns A string containing working hours and availability information
 */
function generateAvailabilityDocumentContent(
  calendarSettings: CalendarSettingsData, 
  businessName: string
): string {
  const workingHours = calendarSettings.workingHours;
  const timezone = calendarSettings.settings?.timezone || 'UTC';
  const bufferTime = calendarSettings.settings?.bufferTime || 0;
  
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

  return `
    ${businessName} Working Hours and Availability:
    Operating Hours: ${daysWithHours.join(', ')}.
    ${closedDays.length > 0 ? `Closed: ${closedDays.join(', ')}.` : 'Open all week.'}
    Time Zone: ${timezone}.
    ${bufferTime > 0 ? `Buffer time between appointments: ${bufferTime} minutes.` : 'No buffer time between appointments.'}
    Available durations: 1 hour, 1.5 hours, 2 hours, 2.5 hours, 3 hours, 4 hours, 5 hours, 6 hours.
    Appointments can be booked up to 30 days in advance.
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
    if (dayDate < now) continue;
    
    // Get slots for common durations (60min and 90min are most common)
    const slots60 = dayData.slots['60'] || [];
    const slots90 = dayData.slots['90'] || [];
    
    // Combine and deduplicate slots
    const allSlots = Array.from(new Set([...slots60, ...slots90]));
    
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
  
  // Format each day's availability
  const formattedDays = availableSlots.map(dayData => {
    const date = new Date(dayData.date);
    
    // Determine day label
    let dayLabel = '';
    if (date.toDateString() === today.toDateString()) {
      dayLabel = 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dayLabel = 'Tomorrow';
    } else {
      dayLabel = date.toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    // Format times in 12-hour format
    const formattedTimes = dayData.slots.slice(0, 4).map(time => { // Show max 4 times per day
      const [hours, minutes] = time.split(':');
      const hour24 = parseInt(hours);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minutes} ${ampm}`;
    });
    
    // Add "and more" if there are additional slots
    const moreSlots = dayData.slots.length > 4 ? ` and ${dayData.slots.length - 4} more` : '';
    
    return `${dayLabel}: ${formattedTimes.join(', ')}${moreSlots}`;
  });

  // Create summary
  const totalSlots = availableSlots.reduce((sum, day) => sum + day.slots.length, 0);
  const availabilityLevel = totalSlots > 15 ? 'excellent' : totalSlots > 8 ? 'good' : 'limited';
  
  return `
    ${businessName} Current Availability (${availabilityLevel} availability this week):
    ${formattedDays.join('. ')}.
    
    Total available appointment slots: ${totalSlots}.
    These are the actual times customers can book right now.
  `.trim().replace(/\s\s+/g, ' ');
}

/**
 * Helper function to detect if user query is asking about business contact or address info specifically.
 * @param userMessage - The user's message to analyze
 * @returns boolean - True if the query is specifically about business contact/address
 */
function isBusinessContactQuery(userMessage: string): boolean {
  const lowerMessage = userMessage.toLowerCase();
  const contactKeywords = [
    // English - Contact & Location
    'address', 'location', 'where', 'contact', 'phone', 'email', 'hours', 'open',
    'closed', 'schedule', 'find you', 'located', 'directions', 'how to reach',
    'business hours', 'operating hours', 'when are you open',
    
    // Spanish - Contact & Location
    'dirección', 'ubicación', 'dónde', 'contacto', 'teléfono', 'correo', 'horarios', 'abierto',
    'cerrado', 'horario', 'encontrarlos', 'ubicado', 'direcciones', 'cómo llegar',
    'horarios de atención', 'horarios de trabajo', 'cuándo están abiertos', 'dónde están'
  ];
  
  return contactKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Helper function to detect if user query is asking about availability, working hours, or schedule.
 * @param userMessage - The user's message to analyze
 * @returns boolean - True if the query is about availability/schedule
 */
function isAvailabilityQuery(userMessage: string): boolean {
  const lowerMessage = userMessage.toLowerCase();
  const availabilityKeywords = [
    // English - Availability & Schedule
    'available', 'availability', 'when can', 'hours', 'schedule', 'working hours',
    'open', 'closed', 'book', 'appointment', 'time slots', 'free time',
    'operating hours', 'business hours', 'what time', 'when are you',
    
    // Spanish - Availability & Schedule  
    'disponible', 'disponibilidad', 'cuándo pueden', 'horarios', 'horario',
    'abierto', 'cerrado', 'reservar', 'cita', 'turnos', 'tiempo libre',
    'horarios de trabajo', 'horarios de atención', 'qué hora', 'cuándo están'
  ];
  
  return availabilityKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Helper function to detect if a user query is asking specifically about services, business info, or contact details.
 * Supports multiple languages (English and Spanish).
 * @param userMessage - The user's message to analyze
 * @returns boolean - True if the query should return comprehensive information
 */
function isServiceRelatedQuery(userMessage: string): boolean {
  const lowerMessage = userMessage.toLowerCase();
  
  // Service-related keywords (English & Spanish)
  const serviceKeywords = [
    // English - Services
    'service', 'services', 'what do you offer', 'what services', 'available services',
    'what can you do', 'what are your', 'options available', 'list all', 'show all',
    'tell me about', 'what is', 'describe',
    
    // Spanish - Services  
    'servicio', 'servicios', 'qué ofrecen', 'qué servicios', 'servicios disponibles',
    'qué pueden hacer', 'cuáles son sus', 'opciones disponibles', 'lista todos', 'muestra todos',
    'cuéntame sobre', 'qué es', 'describe', 'háblame de',
  ];

  // Pricing-related keywords (English & Spanish)
  const pricingKeywords = [
    // English - Pricing
    'price', 'prices', 'cost', 'costs', 'how much', 'pricing', 'rate', 'rates',
    'fee', 'fees', 'charge', 'charges', 'budget', 'afford', 'expensive', 'cheap',
    
    // Spanish - Pricing
    'precio', 'precios', 'costo', 'costos', 'cuánto cuesta', 'cuánto vale', 'tarifa', 'tarifas',
    'cobran', 'cobra', 'presupuesto', 'barato', 'caro', 'económico'
  ];

  // Duration/time-related keywords (English & Spanish)
  const durationKeywords = [
    // English - Duration
    'duration', 'durations', 'how long', 'time', 'minutes', 'hours', 'takes',
    'long does it take', 'session length', 'appointment length',
    
    // Spanish - Duration
    'duración', 'duraciones', 'cuánto tiempo', 'tiempo', 'minutos', 'horas', 'toma',
    'cuánto tarda', 'cuánto dura', 'duración de la sesión', 'duración de la cita'
  ];

  // Business info keywords (English & Spanish)
  const businessInfoKeywords = [
    // English - Contact & Location
    'address', 'location', 'where', 'contact', 'phone', 'email', 'hours', 'open',
    'closed', 'schedule', 'find you', 'located', 'directions', 'how to reach',
    'business hours', 'operating hours', 'when are you open',
    
    // Spanish - Contact & Location
    'dirección', 'ubicación', 'dónde', 'contacto', 'teléfono', 'correo', 'horarios', 'abierto',
    'cerrado', 'horario', 'encontrarlos', 'ubicado', 'direcciones', 'cómo llegar',
    'horarios de atención', 'horarios de trabajo', 'cuándo están abiertos', 'dónde están'
  ];

  // Description-related keywords (English & Spanish)
  const descriptionKeywords = [
    // English - Descriptions
    'description', 'descriptions', 'what does', 'explain', 'details', 'information',
    'about', 'include', 'involves', 'process', 'procedure',
    
    // Spanish - Descriptions
    'descripción', 'descripciones', 'qué hace', 'explica', 'detalles', 'información',
    'sobre', 'incluye', 'involucra', 'proceso', 'procedimiento', 'en qué consiste'
  ];

  // Combine all keyword arrays
  const allKeywords = [
    ...serviceKeywords,
    ...pricingKeywords, 
    ...durationKeywords,
    ...businessInfoKeywords,
    ...descriptionKeywords
  ];
  
  // Check if any keyword matches
  return allKeywords.some(keyword => lowerMessage.includes(keyword));
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
 * RAG (Retrieval-Augmented Generation) function that combines embedding generation 
 * with vector search to find the most relevant documents for a user query.
 * It searches pre-existing documents, live service data, business information, and availability/working hours.
 * For service-related queries, business info, or availability queries, it returns ALL relevant database table data only (no documents).
 * 
 * Supported query types:
 * - Services: Returns all services with prices, durations, descriptions, mobile availability
 * - Business Info: Returns complete business contact information, address, payment setup
 * - Availability: Returns working hours, schedule, buffer times, timezone information
 * - Combined: Returns all above information for comprehensive queries
 * 
 * @param businessId - The ID of the business to search within
 * @param userMessage - The user's message/query to search for
 * @returns Promise<VectorSearchResult[]> - Array of relevant results (database tables only for comprehensive queries, top 3 mixed for others)
 */
export async function RAGfunction(
  businessId: string,
  userMessage: string
): Promise<VectorSearchResult[]> {
  console.log(`[RAGfunction] Starting RAG search for business ${businessId} with message: "${userMessage.substring(0, 100)}..."`);
  
  // Detect if this is a service-related, business info, or contact query
  const isComprehensiveQuery = isServiceRelatedQuery(userMessage);
  const isContactQuery = isBusinessContactQuery(userMessage);
  const isScheduleQuery = isAvailabilityQuery(userMessage);
  console.log(`[RAGfunction] Comprehensive information query detected: ${isComprehensiveQuery}`);
  console.log(`[RAGfunction] Business contact query detected: ${isContactQuery}`);
  console.log(`[RAGfunction] Availability/schedule query detected: ${isScheduleQuery}`);
  
  try {
    const userEmbedding = await generateEmbedding(userMessage);
    console.log(`[RAGfunction] Successfully generated embedding for user message`);
    
    // Step 2: Perform vector search on documents, fetch live services, and fetch business/availability info in parallel
    const promises: Promise<any>[] = [
      findBestVectorResult(userEmbedding, businessId),
      Service.getByBusiness(businessId)
    ];
    
    // Add business info fetching if it's a contact/comprehensive/availability query
    // (availability queries need business info to format the response properly)
    if (isContactQuery || isComprehensiveQuery || isScheduleQuery) {
      promises.push(Business.getById(businessId));
    }
    
    // Add availability info fetching if it's a schedule/availability query or comprehensive query
    if (isScheduleQuery || isComprehensiveQuery) {
      // Fetch calendar settings for the business - this returns an array
      promises.push(CalendarSettings.getByBusiness(businessId));
      // Also fetch actual available slots - need to find the provider first
      promises.push(
        (async () => {
          try {
            // Find the provider user for this business
            const { User } = await import('@/lib/database/models/user');
            const provider = await User.findUserByBusinessId(businessId);
            if (provider) {
              // Get comprehensive availability for the next 7 days
              const { AvailabilitySlots } = await import('@/lib/database/models/availability-slots');
              const today = new Date();
              const oneWeekFromNow = new Date();
              oneWeekFromNow.setDate(today.getDate() + 7);
              
              const availabilityData = await AvailabilitySlots.getByProviderAndDateRange(
                provider.id,
                today.toISOString().split('T')[0],
                oneWeekFromNow.toISOString().split('T')[0]
              );
              
              // Convert raw availability data to a more usable format
              const availableSlots = convertAvailabilityDataToSlots(availabilityData);
              return { provider, availableSlots };
            }
            return null;
          } catch (error) {
            console.error('[RAGfunction] Error fetching availability slots:', error);
            return null;
          }
        })()
      );
    }
    
    const results = await Promise.all(promises);
    const [documentResults, serviceInstances] = results;
    let businessInstance = null;
    let calendarSettings = null;
    let availabilityData = null;
    
    // Extract business and calendar settings from results based on what was requested
    let resultIndex = 2;
    if (isContactQuery || isComprehensiveQuery || isScheduleQuery) {
      businessInstance = results[resultIndex];
      resultIndex++;
    }
    if (isScheduleQuery || isComprehensiveQuery) {
      const calendarSettingsArray = results[resultIndex];
      // Take the first calendar settings if available (most businesses have one provider)
      calendarSettings = calendarSettingsArray && calendarSettingsArray.length > 0 ? calendarSettingsArray[0] : null;
      resultIndex++;
      // Extract availability slots data
      availabilityData = results[resultIndex];
    }
    
    console.log(`[RAGfunction] Vector search returned ${documentResults.length} documents.`);
    console.log(`[RAGfunction] Fetched ${serviceInstances.length} live services.`);
    if (businessInstance) {
      console.log(`[RAGfunction] Fetched business information for ${businessInstance.name}.`);
    }
    if (calendarSettings) {
      console.log(`[RAGfunction] Fetched availability/calendar settings.`);
    }
    if (availabilityData) {
      const totalSlots = availabilityData.availableSlots ? 
        availabilityData.availableSlots.reduce((sum: number, day: any) => sum + (day.slots?.length || 0), 0) : 0;
      console.log(`[RAGfunction] Fetched availability slots data:`, {
        hasProvider: !!availabilityData.provider,
        providerId: availabilityData.provider?.id,
        availableDays: availabilityData.availableSlots?.length || 0,
        totalSlots: totalSlots
      });
    }

    let serviceResults: VectorSearchResult[] = [];
    if (serviceInstances.length > 0) {
      const serviceData = serviceInstances.map((s: any) => s.getData());
      const serviceContents = serviceData.map(generateServiceDocumentContent);

      // Batch generate embeddings for all services
      const serviceEmbeddingsResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: serviceContents,
      });
      const serviceEmbeddings = serviceEmbeddingsResponse.data.map(e => e.embedding);

      serviceResults = serviceData.map((service: any, index: number) => {
        const similarity = cosineSimilarity(userEmbedding, serviceEmbeddings[index]);
        return {
          documentId: service.id!,
          content: serviceContents[index],
          similarityScore: similarity,
          type: 'service',
          source: 'Business Service',
          category: 'Services',
          confidenceScore: 1.0,
        };
      });
      console.log(`[RAGfunction] Generated ${serviceResults.length} search results from live services.`);
    }

    // Add business information result if available
    let businessResults: VectorSearchResult[] = [];
    if (businessInstance) {
      const businessData = businessInstance;
      const businessContent = generateBusinessDocumentContent(businessData);
      
      // Generate embedding for business info
      const businessEmbedding = await generateEmbedding(businessContent);
      const businessSimilarity = cosineSimilarity(userEmbedding, businessEmbedding);
      
      businessResults = [{
        documentId: businessData.id!,
        content: businessContent,
        similarityScore: businessSimilarity,
        type: 'business',
        source: 'Business Information',
        category: 'Contact',
        confidenceScore: 1.0,
      }];
      console.log(`[RAGfunction] Generated business information search result.`);
    }

    // Add availability information result if available
    let availabilityResults: VectorSearchResult[] = [];
    if (calendarSettings && businessInstance) {
      const businessData = businessInstance;
      
      // Enhanced availability content that includes actual available slots
      let availabilityContent = generateAvailabilityDocumentContent(
        {
          userId: calendarSettings.userId,
          businessId: calendarSettings.businessId,
          workingHours: calendarSettings.workingHours,
          manageCalendar: calendarSettings.manageCalendar,
          calendarId: calendarSettings.calendarId,
          calendarType: calendarSettings.calendarType,
          settings: calendarSettings.settings,
          lastSync: calendarSettings.lastSync
        }, 
        businessData.name
      );
      
      // Add actual available slots if we have them
      if (availabilityData && availabilityData.availableSlots && availabilityData.availableSlots.length > 0) {
        const slotsText = generateAvailableSlotsContent(availabilityData.availableSlots, businessData.name);
        availabilityContent += `\n\n${slotsText}`;
        const totalSlots = availabilityData.availableSlots.reduce((sum: number, day: any) => sum + (day.slots?.length || 0), 0);
        console.log(`[RAGfunction] Added ${availabilityData.availableSlots.length} days with ${totalSlots} total available slots to availability content.`);
      } else {
        console.log(`[RAGfunction] No actual available slots found - showing working hours only.`);
      }
      
      // Generate embedding for availability info
      const availabilityEmbedding = await generateEmbedding(availabilityContent);
      const availabilitySimilarity = cosineSimilarity(userEmbedding, availabilityEmbedding);
      
      availabilityResults = [{
        documentId: `${businessData.id}-availability`,
        content: availabilityContent,
        similarityScore: availabilitySimilarity,
        type: 'availability',
        source: 'Working Hours & Availability',
        category: 'Availability',
        confidenceScore: 1.0,
      }];
      console.log(`[RAGfunction] Generated availability information search result with ${availabilityContent.length} characters of content.`);
    }

    // Step 3: Combine and re-rank matches by applying boost factors
    const allResults = [...documentResults, ...serviceResults, ...businessResults, ...availabilityResults];

    const reRankedMatches = allResults.map(match => {
      const isServiceDoc = match.source === 'Business Service';
      const isBusinessDoc = match.source === 'Business Information';
      const isAvailabilityDoc = match.source === 'Working Hours & Availability';
      let boost = 1;
      
      if (isAvailabilityDoc) {
        boost = BOOST_FACTORS['availability'] || 2.3;
      } else if (isBusinessDoc) {
        boost = BOOST_FACTORS['business'] || 2.5;
      } else if (isServiceDoc) {
        boost = BOOST_FACTORS['service'] || 2.0;
      }

      if (boost > 1) {
        console.log(`[RAGfunction] Boosting score for doc ID ${match.documentId} (Type: ${match.type}, Source: ${match.source}) by ${((boost - 1) * 100).toFixed(0)}%`);
      }
      return {
        ...match,
        similarityScore: match.similarityScore * boost
      };
    });

    // Step 4: Sort the matches by their new boosted score
    reRankedMatches.sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Step 5: Return results based on query type
    if (isComprehensiveQuery || isContactQuery || isScheduleQuery) {
      // For comprehensive queries (services, pricing, business info, contact, availability), return ONLY database table data
      // All service, business, and availability information is already in the tables, no need for potentially outdated documents
      const services = reRankedMatches.filter(match => match.source === 'Business Service');
      const business = reRankedMatches.filter(match => match.source === 'Business Information');
      const availability = reRankedMatches.filter(match => match.source === 'Working Hours & Availability');
      const combinedResults = [...business, ...availability, ...services];
      
      console.log(`[RAGfunction] Comprehensive query detected - returning ${business.length} business info + ${availability.length} availability + ${services.length} services = ${combinedResults.length} total results (excluding documents - using only database tables)`);
      return combinedResults;
    } else {
      // For general queries, return top 3 results as before (can include documents)
      const top3Results = reRankedMatches.slice(0, 3);
      console.log(`[RAGfunction] General query - returning top ${top3Results.length} results`);
      return top3Results;
    }
  } catch (error) {
    console.error(`[RAGfunction] Error during RAG search:`, error);
    throw new Error(`RAG function failed: ${error instanceof Error ? error.message : String(error)}`);
  }
} 