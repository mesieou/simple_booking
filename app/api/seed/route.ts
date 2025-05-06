import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';
import { ProviderSettingsModel, ProviderWorkingHours } from '@/lib/models/provider-settings';
import { Business } from '@/lib/models/business';
import { User } from '@/lib/models/user';
import { Quote } from '@/lib/models/quote';
import { Booking } from '@/lib/models/booking';
import { DateTime } from 'luxon';
import { v4 as uuidv4 } from 'uuid';

// Helper function to clear all data
async function clearExistingData(supabase: any) {
  const tables = ['bookings', 'quotes', 'calendarSettings', 'users', 'businesses'];
  
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
      console.error(`Error clearing ${table}:`, error);
      throw error;
    }
  }
}

// Helper function to create a business with server client
async function createBusinessWithServerClient(supabase: any, business: Business) {
  const { data, error } = await supabase
    .from('businesses')
    .insert(business)
    .select()
    .single();

  if (error) {
    console.error('Error creating business:', error);
    throw error;
  }

  return data;
}

// Helper function to create a user with server client
async function createUserWithServerClient(supabase: any, user: User) {
  // First create the auth user
  const email = faker.internet.email({
    firstName: user.firstName.toLowerCase(),
    lastName: user.lastName.toLowerCase()
  });
  
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: 'password123',  // Default password for testing
    email_confirm: true,
    user_metadata: {
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    }
  });

  if (authError) {
    console.error('Error creating auth user:', authError);
    throw authError;
  }

  // Then create the database user with the auth user's ID
  const userData = {
    id: authUser.user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    businessId: user.businessId,
    createdAt: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('users')
    .insert(userData)
    .select()
    .single();

  if (error) {
    console.error('Error creating database user:', error);
    throw error;
  }

  return data;
}

// Helper function to create provider settings
async function createProviderSettings(supabase: any, settings: any) {
  const formattedSettings = {
    userId: settings.userId,
    businessId: settings.businessId,
    workingHours: settings.workingHours || null,
    calendarType: settings.calendarType || null,
    calendarId: settings.calendarId || null,
    settings: settings.settings || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('calendarSettings')
    .insert(formattedSettings)
    .select()
    .single();

  if (error) {
    console.error('Error creating provider settings:', error);
    throw error;
  }

  return data;
}

// Helper function to create a quote
async function createQuote(supabase: any, quoteData: any) {
  const { data, error } = await supabase
    .from('quotes')
    .insert({
      id: uuidv4(),
      ...quoteData
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting quote:', error);
    throw error;
  }
  return data;
}

// Helper function to create a booking
async function createBooking(supabase: any, bookingData: any) {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      id: uuidv4(),
      ...bookingData
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting booking:', error);
    throw error;
  }
  return data;
}

export async function POST(request: Request) {
  try {
    // Create a Supabase client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Clear existing data
    await clearExistingData(supabase);

    const createdBusinesses: Business[] = [];
    const createdUsers: User[] = [];
    const createdQuotes: Quote[] = [];
    const createdBookings: Booking[] = [];

    // Create multiple businesses with random data
    const businesses = Array.from({ length: 5 }, () => {
      const businessName = faker.company.name();
      return new Business(
        businessName,
        faker.internet.email({ provider: businessName.toLowerCase().replace(/\s+/g, '') }),
        `+61${faker.string.numeric(9)}`,
        faker.helpers.arrayElement([
          "Australia/Melbourne",
          "America/New_York",
          "Europe/London",
          "Asia/Tokyo",
          "America/Los_Angeles"
        ]),
        faker.number.float({ min: 1.5, max: 3, fractionDigits: 2 })
      );
    });

    const createdBusinessesData = [];
    for (const business of businesses) {
      const businessData = await createBusinessWithServerClient(supabase, business);
      createdBusinessesData.push(businessData);
    }

    // Create users for each business
    const createdUsersData = [];
    for (const business of createdBusinessesData) {
      // Create owner (who might also be a provider)
      const owner = new User(
        faker.person.firstName(),
        faker.person.lastName(),
        'owner',
        business.id
      );
      
      const ownerData = await createUserWithServerClient(supabase, owner);
      createdUsersData.push(ownerData);

      // Create owner's provider settings (owner might also be a provider)
      const ownerIsProvider = faker.datatype.boolean();
      if (ownerIsProvider) {
        const useCalendar = faker.datatype.boolean();
        const ownerSettings = {
          userId: ownerData.id,
          businessId: business.id,
          workingHours: useCalendar ? null : {
            monday: { start: '09:00', end: '17:00' },
            tuesday: { start: '09:00', end: '17:00' },
            wednesday: { start: '09:00', end: '17:00' },
            thursday: { start: '09:00', end: '17:00' },
            friday: { start: '09:00', end: '17:00' },
            saturday: null,
            sunday: null
          },
          calendarType: useCalendar ? faker.helpers.arrayElement(['google', 'outlook']) : null,
          calendarId: useCalendar ? faker.string.uuid() : null,
          settings: {
            bufferTime: faker.helpers.arrayElement([15, 30, 45]),
            timezone: business.timezone,
            maxBookingsPerDay: faker.helpers.arrayElement([2, 3, 4, 5]),
            minNoticeHours: faker.helpers.arrayElement([24, 48, 72])
          }
        };

        await createProviderSettings(supabase, ownerSettings);
      }

      // Create 1-3 additional providers per business
      const numProviders = faker.number.int({ min: 1, max: 3 });
      
      for (let i = 0; i < numProviders; i++) {
        const user = new User(
          faker.person.firstName(),
          faker.person.lastName(),
          'provider',
          business.id
        );
        
        const userData = await createUserWithServerClient(supabase, user);
        createdUsersData.push(userData);

        // Create provider settings
        const useCalendar = faker.datatype.boolean();
        const calendarType = useCalendar ? faker.helpers.arrayElement(['google', 'outlook']) : null;
        const providerSettings = {
          userId: userData.id,
          businessId: business.id,
          workingHours: useCalendar ? null : {
            monday: { start: '09:00', end: '17:00' },
            tuesday: { start: '09:00', end: '17:00' },
            wednesday: { start: '09:00', end: '17:00' },
            thursday: { start: '09:00', end: '17:00' },
            friday: { start: '09:00', end: '17:00' },
            saturday: null,
            sunday: null
          },
          calendarType: calendarType,
          calendarId: useCalendar ? faker.string.uuid() : null,
          settings: {
            bufferTime: faker.helpers.arrayElement([15, 30, 45]),
            timezone: business.timezone,
            maxBookingsPerDay: faker.helpers.arrayElement([2, 3, 4, 5]),
            minNoticeHours: faker.helpers.arrayElement([24, 48, 72])
          }
        };

        await createProviderSettings(supabase, providerSettings);
      }

      // Create quotes for this business
      const numQuotes = faker.number.int({ min: 3, max: 5 });
      for (let i = 0; i < numQuotes; i++) {
        const quoteData = {
          pickUp: faker.location.streetAddress(),
          dropOff: faker.location.streetAddress(),
          baseFare: faker.number.int({ min: 50, max: 300 }),
          travelFare: faker.number.int({ min: 20, max: 150 }),
          userId: ownerData.id,
          businessId: business.id,
          jobType: faker.helpers.arrayElement(["one item", "few items", "house/apartment move"]),
          status: faker.helpers.arrayElement(["pending", "accepted", "rejected"]),
          labourFare: faker.number.int({ min: 50, max: 200 }),
          total: 0 // Will be calculated after
        };
        quoteData.total = quoteData.baseFare + quoteData.travelFare + quoteData.labourFare;

        const { data: quote, error: quoteError } = await supabase
          .from('quotes')
          .insert(quoteData)
          .select()
          .single();

        if (quoteError) {
          console.error('Error creating quote:', quoteError);
        } else {
          createdQuotes.push(quote);
          
          // Create a booking for this quote
          const providers = createdUsersData.filter(u => u.businessId === business.id && u.role === "provider");
          const provider = providers[Math.floor(Math.random() * providers.length)];
          const bookingData = {
            timestampTz: new Date(Date.now() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(), // Random date in next 30 days
            status: faker.helpers.arrayElement(["Not Completed", "In Progress", "Completed"]),
            userId: quote.userId,
            providerId: provider.id,
            quoteId: quote.id,
            businessId: quote.businessId
          };

          const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .insert(bookingData)
            .select()
            .single();

          if (bookingError) {
            console.error('Error creating booking:', bookingError);
          } else {
            createdBookings.push(booking);
          }
        }
      }
    }

    // Create quotes and bookings
    for (const business of createdBusinessesData) {
      console.log(`Creating quotes and bookings for business: ${business.name}`);
      
      // Find the owner and providers for this business
      const owner = createdUsersData.find(u => u.businessId === business.id && u.role === "owner");
      const providers = createdUsersData.filter(u => u.businessId === business.id && u.role === "provider");
      
      console.log('Found users:', { owner, providers });
      
      if (owner) {
        // Create multiple quotes for this business
        const numQuotes = faker.number.int({ min: 3, max: 5 });
        for (let i = 0; i < numQuotes; i++) {
          const quoteData = {
            pickUp: faker.location.streetAddress(),
            dropOff: faker.location.streetAddress(),
            baseFare: faker.number.int({ min: 50, max: 300 }),
            travelFare: faker.number.int({ min: 20, max: 150 }),
            userId: owner.id,
            businessId: business.id,
            jobType: faker.helpers.arrayElement(["one item", "few items", "house/apartment move"]),
            status: faker.helpers.arrayElement(["pending", "accepted", "rejected"]),
            labourFare: faker.number.int({ min: 50, max: 200 }),
            total: 0 // Will be calculated after
          };
          quoteData.total = quoteData.baseFare + quoteData.travelFare + quoteData.labourFare;

          const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .insert(quoteData)
            .select()
            .single();

          if (quoteError) {
            console.error('Error creating quote:', quoteError);
          } else {
            createdQuotes.push(quote);
            
            // Create a booking for this quote
            const provider = providers[Math.floor(Math.random() * providers.length)];
            const bookingData = {
              timestampTz: new Date(Date.now() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(), // Random date in next 30 days
              status: faker.helpers.arrayElement(["Not Completed", "In Progress", "Completed"]),
              userId: quote.userId,
              providerId: provider.id,
              quoteId: quote.id,
              businessId: quote.businessId
            };

            const { data: booking, error: bookingError } = await supabase
              .from('bookings')
              .insert(bookingData)
              .select()
              .single();

            if (bookingError) {
              console.error('Error creating booking:', bookingError);
            } else {
              createdBookings.push(booking);
            }
          }
        }
      } else {
        console.error(`Could not find owner for business ${business.name}`);
      }
    }

    return NextResponse.json({
      message: 'Database seeded successfully',
      businesses: createdBusinessesData,
      users: createdUsersData,
      quotes: createdQuotes,
      bookings: createdBookings
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      { error: 'Failed to seed database', details: error },
      { status: 500 }
    );
  }
} 