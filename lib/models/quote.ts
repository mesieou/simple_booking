import { Business } from "./business";
import { User } from "./user";
import { createClient } from "@/lib/supabase/server"
import { v4 as uuidv4 } from 'uuid';
import { handleModelError } from '@/lib/helpers/error';

export type JobType = "one item" | "few items" | "house/apartment move";
export type QuoteStatus = "pending" | "accepted" | "rejected";

export interface QuoteData {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
    userId: string;
    pickUp: string;
    dropOff: string;
    businessId: string;
    travelCostEstimate: number;
    status: string;
    totalJobCostEstimation: number;
    travelTimeEstimate: number;
    totalJobDurationEstimation: number;
    serviceId: string;
}

export class Quote {
    private data: QuoteData;

    constructor(data: QuoteData, businessIsMobile?: boolean) {
        // pickUp and dropOff, travelTimeEstimate, and travelCostEstimate are only required if the business is mobile
        if (businessIsMobile) {
            if (!data.pickUp) handleModelError("Pick up location is required for mobile businesses", new Error("Missing pickUp"));
            if (!data.dropOff) handleModelError("Drop off location is required for mobile businesses", new Error("Missing dropOff"));
            if (data.travelTimeEstimate === undefined || data.travelTimeEstimate < 0) handleModelError("Travel time estimate is required and must be non-negative for mobile businesses", new Error("Invalid travelTimeEstimate"));
            if (data.travelCostEstimate === undefined || data.travelCostEstimate < 0) handleModelError("Travel cost estimate is required and must be non-negative for mobile businesses", new Error("Invalid travelCostEstimate"));
        }
        if (!data.userId) handleModelError("User ID is required", new Error("Missing userId"));
        if (!data.businessId) handleModelError("Business ID is required", new Error("Missing businessId"));
        if (!data.status) handleModelError("Status is required", new Error("Missing status"));
        if (!data.serviceId) handleModelError("Service ID is required", new Error("Missing serviceId"));
        if (data.totalJobCostEstimation < 0) handleModelError("Total job cost estimation cannot be negative", new Error("Invalid totalJobCostEstimation"));
        if (data.totalJobDurationEstimation < 0) handleModelError("Total job duration estimation cannot be negative", new Error("Invalid totalJobDurationEstimation"));
        this.data = data;
    }

    //creates a Quote in supa
    async add(): Promise<QuoteData> {
        const supa = createClient();
        const quote = {
            "id": this.data.id || uuidv4(),
            "pickUp": this.data.pickUp,
            "dropOff": this.data.dropOff,
            "userId": this.data.userId,
            "businessId": this.data.businessId,
            "travelCostEstimate": this.data.travelCostEstimate,
            "status": this.data.status,
            "totalJobCostEstimation": this.data.totalJobCostEstimation,
            "travelTimeEstimate": this.data.travelTimeEstimate,
            "totalJobDurationEstimation": this.data.totalJobDurationEstimation,
            "serviceId": this.data.serviceId,
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString()
        }
        const { data, error } = await supa.from("quotes").insert(quote).select().single();
        if(error) {
            handleModelError("Failed to create quote", error);
        }
        if (!data) {
            handleModelError("Failed to create quote: No data returned", new Error("No data returned from insert"));
        }
        this.data = data;
        return data;
    }

    // Get quote by ID
    static async getById(id: string): Promise<Quote> {
        if (!Quote.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = createClient();
        const { data, error } = await supa.from("quotes").select("*").eq("id", id).single();
        
        if (error) {
            handleModelError("Failed to fetch quote", error);
        }
        
        if (!data) {
            handleModelError(`Quote with id ${id} not found`, new Error("Quote not found"));
        }
        
        return new Quote(data);
    }

    // Get quotes by user
    static async getByUser(userId: string): Promise<Quote[]> {
        if (!Quote.isValidUUID(userId)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = createClient();
        const { data, error } = await supa.from("quotes").select("*").eq("userId", userId);
        
        if (error) {
            handleModelError("Failed to fetch quotes by user", error);
        }
        
        return data.map(quoteData => new Quote(quoteData));
    }

    // Get quotes by business
    static async getByBusiness(businessId: string): Promise<Quote[]> {
        if (!Quote.isValidUUID(businessId)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = createClient();
        const { data, error } = await supa.from("quotes").select("*").eq("businessId", businessId);
        
        if (error) {
            handleModelError("Failed to fetch quotes by business", error);
        }
        
        return data.map(quoteData => new Quote(quoteData));
    }

    // Update quote
    static async update(id: string, quoteData: QuoteData): Promise<Quote> {
        if (!Quote.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }
        const supa = createClient();
        const quote = {
            "pickUp": quoteData.pickUp,
            "dropOff": quoteData.dropOff,
            "userId": quoteData.userId,
            "businessId": quoteData.businessId,
            "travelCostEstimate": quoteData.travelCostEstimate,
            "status": quoteData.status,
            "totalJobCostEstimation": quoteData.totalJobCostEstimation,
            "travelTimeEstimate": quoteData.travelTimeEstimate,
            "totalJobDurationEstimation": quoteData.totalJobDurationEstimation,
            "serviceId": quoteData.serviceId,
            "updatedAt": new Date().toISOString()
        }
        const { data, error } = await supa.from("quotes").update(quote).eq("id", id).select().single();
        if (error) {
            handleModelError("Failed to update quote", error);
        }
        if (!data) {
            handleModelError("Failed to update quote: No data returned", new Error("No data returned from update"));
        }
        return new Quote(data);
    }

    // Delete quote
    static async delete(id: string): Promise<void> {
        if (!Quote.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = createClient();
        const { error } = await supa.from("quotes").delete().eq("id", id);

        if (error) {
            handleModelError("Failed to delete quote", error);
        }
    }

    private static isValidUUID(id: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    }

    // Getters for the quote data
    get id(): string | undefined { return this.data.id; }
    get pickUp(): string { return this.data.pickUp; }
    get dropOff(): string { return this.data.dropOff; }
    get userId(): string { return this.data.userId; }
    get businessId(): string { return this.data.businessId; }
    get travelCostEstimate(): number { return this.data.travelCostEstimate; }
    get status(): string { return this.data.status; }
    get totalJobCostEstimation(): number { return this.data.totalJobCostEstimation; }
    get travelTimeEstimate(): number { return this.data.travelTimeEstimate; }
    get totalJobDurationEstimation(): number { return this.data.totalJobDurationEstimation; }
    get serviceId(): string { return this.data.serviceId; }
    get createdAt(): string | undefined { return this.data.createdAt; }
    get updatedAt(): string | undefined { return this.data.updatedAt; }
}
