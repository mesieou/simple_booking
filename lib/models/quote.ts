import { Business } from "./business";
import { User } from "./user";
import { createClient } from "@/lib/supabase/server"
import { v4 as uuidv4 } from 'uuid';

export type JobType = "one item" | "few items" | "house/apartment move";
export type QuoteStatus = "pending" | "accepted" | "rejected";

export interface QuoteData {
    id?: string;
    pickUp: string;
    dropOff: string;
    baseFare: number;
    travelFare: number;
    userId: string;
    businessId: string;
    jobType: JobType;
    status: QuoteStatus;
    labourFare: number;
    total: number;
    baseTime: number;
    travelTime: number;
    jobDuration: number;
    totalDuration: number;
    createdAt?: string;
    updatedAt?: string;
}

export class QuoteError extends Error {
    constructor(message: string, public originalError?: any) {
        super(message);
        this.name = 'QuoteError';
    }
}

export class Quote {
    private data: QuoteData;

    constructor(data: QuoteData) {
        if (!data.pickUp) throw new QuoteError("Pick up location is required");
        if (!data.dropOff) throw new QuoteError("Drop off location is required");
        if (data.baseFare < 0) throw new QuoteError("Base fare cannot be negative");
        if (data.travelFare < 0) throw new QuoteError("Travel fare cannot be negative");
        if (!data.userId) throw new QuoteError("User ID is required");
        if (!data.businessId) throw new QuoteError("Business ID is required");
        if (!data.jobType) throw new QuoteError("Job type is required");
        if (!data.status) throw new QuoteError("Status is required");
        if (data.labourFare < 0) throw new QuoteError("Labour fare cannot be negative");
        if (data.total < 0) throw new QuoteError("Total cannot be negative");
        if (data.baseTime < 0) throw new QuoteError("Base time cannot be negative");
        if (data.travelTime < 0) throw new QuoteError("Travel time cannot be negative");
        if (data.jobDuration < 0) throw new QuoteError("Job duration cannot be negative");
        if (data.totalDuration < 0) throw new QuoteError("Total duration cannot be negative");
        
        this.data = data;
    }

    //creates a Quote in supa
    async add(): Promise<QuoteData> {
        const supa = await createClient();

        const quote = {
            "id": this.data.id || uuidv4(),
            "pickUp": this.data.pickUp,
            "dropOff": this.data.dropOff,
            "baseFare": this.data.baseFare,
            "travelFare": this.data.travelFare,
            "userId": this.data.userId,
            "businessId": this.data.businessId,
            "jobType": this.data.jobType,
            "status": this.data.status,
            "labourFare": this.data.labourFare,
            "total": this.data.total,
            "baseTime": this.data.baseTime,
            "travelTime": this.data.travelTime,
            "jobDuration": this.data.jobDuration,
            "totalDuration": this.data.totalDuration,
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString()
        }
        const { data, error } = await supa.from("quotes").insert(quote).select().single();

        if(error) {
            throw new QuoteError("Failed to create quote", error);
        }

        if (!data) {
            throw new QuoteError("Failed to create quote: No data returned");
        }

        this.data = data;
        return data;
    }

    // Get quote by ID
    static async getById(id: string): Promise<Quote> {
        if (!Quote.isValidUUID(id)) {
            throw new QuoteError("Invalid UUID format");
        }

        const supa = await createClient();
        const { data, error } = await supa.from("quotes").select("*").eq("id", id).single();
        
        if (error) {
            throw new QuoteError("Failed to fetch quote", error);
        }
        
        if (!data) {
            throw new QuoteError(`Quote with id ${id} not found`);
        }
        
        return new Quote(data);
    }

    // Get quotes by user
    static async getByUser(userId: string): Promise<Quote[]> {
        if (!Quote.isValidUUID(userId)) {
            throw new QuoteError("Invalid UUID format");
        }

        const supa = await createClient();
        const { data, error } = await supa.from("quotes").select("*").eq("userId", userId);
        
        if (error) {
            throw new QuoteError("Failed to fetch quotes by user", error);
        }
        
        return data.map(quoteData => new Quote(quoteData));
    }

    // Get quotes by business
    static async getByBusiness(businessId: string): Promise<Quote[]> {
        if (!Quote.isValidUUID(businessId)) {
            throw new QuoteError("Invalid UUID format");
        }

        const supa = await createClient();
        const { data, error } = await supa.from("quotes").select("*").eq("businessId", businessId);
        
        if (error) {
            throw new QuoteError("Failed to fetch quotes by business", error);
        }
        
        return data.map(quoteData => new Quote(quoteData));
    }

    // Update quote
    static async update(id: string, quoteData: QuoteData): Promise<Quote> {
        if (!Quote.isValidUUID(id)) {
            throw new QuoteError("Invalid UUID format");
        }

        const supa = await createClient();
        const quote = {
            "pickUp": quoteData.pickUp,
            "dropOff": quoteData.dropOff,
            "baseFare": quoteData.baseFare,
            "travelFare": quoteData.travelFare,
            "userId": quoteData.userId,
            "businessId": quoteData.businessId,
            "jobType": quoteData.jobType,
            "status": quoteData.status,
            "labourFare": quoteData.labourFare,
            "total": quoteData.total,
            "baseTime": quoteData.baseTime,
            "travelTime": quoteData.travelTime,
            "jobDuration": quoteData.jobDuration,
            "totalDuration": quoteData.totalDuration,
            "updatedAt": new Date().toISOString()
        }
        
        const { data, error } = await supa
            .from("quotes")
            .update(quote)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            throw new QuoteError("Failed to update quote", error);
        }

        if (!data) {
            throw new QuoteError("Failed to update quote: No data returned");
        }

        return new Quote(data);
    }

    // Delete quote
    static async delete(id: string): Promise<void> {
        if (!Quote.isValidUUID(id)) {
            throw new QuoteError("Invalid UUID format");
        }

        const supa = await createClient();
        const { error } = await supa.from("quotes").delete().eq("id", id);

        if (error) {
            throw new QuoteError("Failed to delete quote", error);
        }
    }

    private static isValidUUID(id: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    }

    // Getters for the quote data
    get id(): string | undefined { return this.data.id; }
    get pickUp(): string { return this.data.pickUp; }
    get dropOff(): string { return this.data.dropOff; }
    get baseFare(): number { return this.data.baseFare; }
    get travelFare(): number { return this.data.travelFare; }
    get userId(): string { return this.data.userId; }
    get businessId(): string { return this.data.businessId; }
    get jobType(): JobType { return this.data.jobType; }
    get status(): QuoteStatus { return this.data.status; }
    get labourFare(): number { return this.data.labourFare; }
    get total(): number { return this.data.total; }
    get baseTime(): number { return this.data.baseTime; }
    get travelTime(): number { return this.data.travelTime; }
    get jobDuration(): number { return this.data.jobDuration; }
    get totalDuration(): number { return this.data.totalDuration; }
    get createdAt(): string | undefined { return this.data.createdAt; }
    get updatedAt(): string | undefined { return this.data.updatedAt; }
}
