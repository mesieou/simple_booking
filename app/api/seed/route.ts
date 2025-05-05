import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Business } from '@/lib/models/business';
import { User } from '@/lib/models/user';
import { Quote } from '@/lib/models/quote';
import { Booking } from '@/lib/models/booking';
import { DateTime } from 'luxon';
import { v4 as uuidv4 } from 'uuid';
import { faker } from '@faker-js/faker';

// Helper function to clear all data
async function clearData(supabase: any) {
  console.log('Clearing existing data...');
  
  // Delete in correct order to respect foreign key constraints
  const tables = ['bookings', 'quotes', 'users', 'businesses'];
  
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all but keep a dummy record
    
    if (error) {
      console.error(`Error clearing ${table}:`, error);
      throw error;
    }
  }
  
  console.log('Data cleared successfully');
}

// Helper function to create a business with server-side client
async function createBusinessWithServerClient(supabase: any, business: Business) {
  const businessData = {
    id: uuidv4(),
    name: business.name,
    email: business.email,
    phone: business.phone,
    timeZone: business.timeZone,
    workingHours: business.workingHours,
    serviceRatePerMinute: business.serviceRatePerMinute
  };

  console.log('Attempting to insert business with data:', businessData);

  const { data, error } = await supabase
    .from('businesses')
    .insert(businessData)
    .select()
    .single();

  if (error) {
    console.error('Error inserting business:', error);
    throw error;
  }
  return data;
}

// Helper function to create a user in Auth and database
async function createUserWithServerClient(supabase: any, user: User, password: string) {
  // Generate a unique email using Faker
  const email = faker.internet.email({
    firstName: user.firstName.toLowerCase(),
    lastName: user.lastName.toLowerCase()
  });
  
  // First create the user in Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: {
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    }
  });

  if (authError) {
    console.error('Error creating auth user:', authError);
    throw authError;
  }

  // Then create the user in the database
  const userData = {
    id: authData.user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    businessId: user.businessId
  };

  console.log('Attempting to insert user with data:', userData);

  const { data, error } = await supabase
    .from('users')
    .insert(userData)
    .select()
    .single();

  if (error) {
    console.error('Error inserting user:', error);
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
    await clearData(supabase);

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
        {
          Monday: { start: "09:00", end: "17:00" },
          Tuesday: { start: "09:00", end: "17:00" },
          Wednesday: { start: "09:00", end: "17:00" },
          Thursday: { start: "09:00", end: "17:00" },
          Friday: { start: "09:00", end: "17:00" }
        },
        faker.number.float({ min: 1.5, max: 3, fractionDigits: 2 })
      );
    });

    const createdBusinesses = [];
    for (const business of businesses) {
      const businessData = await createBusinessWithServerClient(supabase, business);
      createdBusinesses.push(businessData);
    }

    // Create users for each business
    const createdUsers = [];
    for (const business of createdBusinesses) {
      // Create owner
      const owner = new User(
        faker.person.firstName(),
        faker.person.lastName(),
        "Owner",
        business.id
      );
      const ownerData = await createUserWithServerClient(supabase, owner, "password123");
      createdUsers.push(ownerData);

      // Create provider
      const provider = new User(
        faker.person.firstName(),
        faker.person.lastName(),
        "Provider",
        business.id
      );
      const providerData = await createUserWithServerClient(supabase, provider, "password123");
      createdUsers.push(providerData);
    }

    // Create quotes and bookings
    const createdQuotes = [];
    const createdBookings = [];
    
    for (const business of createdBusinesses) {
      console.log(`Creating quotes and bookings for business: ${business.name}`);
      
      // Find the owner and provider for this business
      const owner = createdUsers.find(u => u.businessId === business.id && u.role === "Owner");
      const provider = createdUsers.find(u => u.businessId === business.id && u.role === "Provider");
      
      console.log('Found users:', { owner, provider });
      
      if (owner && provider) {
        // Create multiple quotes for this business
        const quotes = Array.from({ length: 3 }, () => {
          const melbourneStreets = [
            "Collins St", "Bourke St", "Swanston St", "Flinders St", 
            "Elizabeth St", "Lonsdale St", "Russell St", "Exhibition St",
            "King St", "William St", "Queen St", "Little Collins St",
            "Spencer St", "La Trobe St", "Spring St", "Market St"
          ];
          
          const melbourneSuburbs = [
            { name: "Melbourne", postcode: "3000" },  // CBD
            { name: "Southbank", postcode: "3006" },
            { name: "Docklands", postcode: "3008" },
            { name: "Carlton", postcode: "3053" },
            { name: "East Melbourne", postcode: "3002" }
          ];

          const generateMelbourneAddress = () => {
            const streetNumber = faker.number.int({ min: 1, max: 300 });
            const street = faker.helpers.arrayElement(melbourneStreets);
            const suburb = faker.helpers.arrayElement(melbourneSuburbs);
            return `${streetNumber} ${street}, ${suburb.name} VIC ${suburb.postcode}`;
          };

          return {
            pickUp: generateMelbourneAddress(),
            dropOff: generateMelbourneAddress(),
            baseFare: faker.number.int({ min: 50, max: 300 }),
            travelFare: faker.number.int({ min: 20, max: 150 })
          };
        });

        for (const quoteData of quotes) {
          console.log('Creating quote with data:', quoteData);
          const quote = await createQuote(supabase, {
            businessId: business.id,
            userId: owner.id,
            ...quoteData
          });
          console.log('Created quote:', quote);
          createdQuotes.push(quote);
        }

        // Create multiple bookings for this business
        const bookings = Array.from({ length: 3 }, (_, i) => ({
          timestampTz: DateTime.now().plus({ days: i + 1 }).toFormat("yyyy-MM-dd HH:mm:ssZZ"),
          status: faker.helpers.arrayElement(["Not Completed", "In Progress", "Completed"])
        }));

        for (let i = 0; i < bookings.length; i++) {
          console.log('Creating booking with data:', bookings[i]);
          const booking = await createBooking(supabase, {
            businessId: business.id,
            userId: owner.id,
            providerId: provider.id,
            quoteId: createdQuotes[i].id,
            ...bookings[i]
          });
          console.log('Created booking:', booking);
          createdBookings.push(booking);
        }
      } else {
        console.error(`Could not find owner or provider for business ${business.name}`);
      }
    }

    return NextResponse.json({ 
      message: 'Database seeded successfully',
      businesses: createdBusinesses,
      users: createdUsers,
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