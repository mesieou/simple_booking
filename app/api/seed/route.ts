import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clearExistingData } from '@/lib/seed/clear-database';
import { createBusinesses } from '@/lib/seed/create-businesses';
import { createAllUsers } from '@/lib/seed/create-all-users';
import { createQuotes } from '@/lib/seed/create-quotes';
import { createBookings } from '@/lib/seed/create-bookings';
import { SeedResult } from '@/lib/seed/types';
import { User } from '@/lib/models/user';
import { createDocuments } from '../../../lib/seed/create-documents';
import { createEmbeddings } from '../../../lib/seed/create-embeddings';
 

export async function POST(request: Request) {
  try {
    // Create a Supabase client with service role key
    const supabase = createClient();
    
    // Clear existing data
    await clearExistingData(supabase);

    const result: SeedResult = {
      businesses: [],
      clients: [],
      providers: [],
      quotes: [],
      bookings: [],
      documents: [],
      embeddings: []
    };

    // Create businesses
    const businesses = await createBusinesses(5);
    result.businesses = businesses.map(b => b.id!);

    // For each business, create users, quotes, and bookings
    for (const business of businesses) {
      // Create all users (owner, providers, and client)
      const { providers, client } = await createAllUsers(business);
      
      // Add providers to result
      result.providers.push(...providers.map((u: User) => u.id!));
      
      // Add client to result if exists
      if (client) {
        result.clients.push(client.id!);

        // Create quotes for the client
        const quotes = await createQuotes(client, business);
        result.quotes.push(...quotes.map(q => q.id!));

        // Create bookings for accepted quotes
        const bookings = await createBookings(client, providers, quotes, business);
        result.bookings.push(...bookings.map(b => b.id));
      } else {
        console.warn(`No client created for business ${business.id}`);
      }
    }

    result.documents = [];
    result.embeddings = [];

    const documents = await createDocuments(businesses);
    result.documents = documents.map(d => d.id!).filter(id => id !== undefined);

    const embeddings = await createEmbeddings(documents);
    result.embeddings = embeddings.map(e => e.id!).filter(id => id !== undefined);

    return NextResponse.json({
      message: 'Database seeded successfully',
      ...result
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      { error: 'Failed to seed database', details: error },
      { status: 500 }
    );
  }
}
