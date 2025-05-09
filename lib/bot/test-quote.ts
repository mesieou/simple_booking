import {Quote, QuoteData} from "../models/quote";
import { v4 as uuidv4 } from 'uuid';


export async function testQuoteCreation(keyword: string): Promise<QuoteData> {
    // Create test data with the provided kword
    const testQuoteData: QuoteData = {
        pickUp: `Test Pickup ${keyword}`,
        dropOff: `Test Dropoff ${keyword}`,
        baseFare: 100,
        travelFare: 50,
        userId: uuidv4(), // Generate a random UUID for testing
        businessId: uuidv4(), // Generate a random UUID for testing
        jobType: "one item",
        status: "pending",
        labourFare: 75,
        total: 225,
        baseTime: 60,
        travelTime: 30,
        jobDuration: 90,
        totalDuration: 120
    };

    // Create and add the quote
    const quote = new Quote(testQuoteData);
    return await quote.add();
}