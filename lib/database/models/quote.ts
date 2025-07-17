import { Business } from "./business";
import { User } from "./user";
import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "../supabase/environment";
import { v4 as uuidv4 } from 'uuid';
import { handleModelError } from '@/lib/general-helpers/error';

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
    serviceIds: string[]; // Multi-service support - now the primary field
    depositAmount?: number;
    remainingBalance?: number;
    proposedDateTime?: string;
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
        if (!data.serviceIds || data.serviceIds.length === 0) handleModelError("At least one service ID is required", new Error("Missing serviceIds"));
        if (data.totalJobCostEstimation < 0) handleModelError("Total job cost estimation cannot be negative", new Error("Invalid totalJobCostEstimation"));
        if (data.totalJobDurationEstimation < 0) handleModelError("Total job duration estimation cannot be negative", new Error("Invalid totalJobDurationEstimation"));
        if (data.depositAmount !== undefined && data.depositAmount < 0) handleModelError("Deposit amount cannot be negative", new Error("Invalid depositAmount"));
        if (data.remainingBalance !== undefined && data.remainingBalance < 0) handleModelError("Remaining balance cannot be negative", new Error("Invalid remainingBalance"));
        this.data = data;
    }

    // Calculate deposit amount and remaining balance
    async calculatePaymentDetails(): Promise<{ depositAmount: number | undefined; remainingBalance: number }> {
        try {
            const { Business } = await import('./business');
            const business = await Business.getById(this.data.businessId);
            
            // Calculate deposit and remaining balance
            let depositAmount: number | undefined = undefined;
            let remainingBalance = this.data.totalJobCostEstimation;
            
            // Only calculate deposit if business has a deposit percentage set
            if (business.depositPercentage !== undefined && business.depositPercentage > 0) {
                depositAmount = Math.round((this.data.totalJobCostEstimation * business.depositPercentage) / 100);
                remainingBalance = this.data.totalJobCostEstimation - depositAmount;
                
                this.data.depositAmount = depositAmount;
                this.data.remainingBalance = remainingBalance;
            } else {
                // No deposit required - full amount is remaining balance
                this.data.depositAmount = undefined;
                this.data.remainingBalance = remainingBalance;
            }
            
            return { depositAmount, remainingBalance };
        } catch (error) {
            console.error('Error calculating payment details:', error);
            // Fallback values
            this.data.remainingBalance = this.data.totalJobCostEstimation;
            return { 
                depositAmount: undefined, 
                remainingBalance: this.data.totalJobCostEstimation
            };
        }
    }

    // Backward compatibility method
    async calculateDepositAmount(): Promise<number | undefined> {
        const { depositAmount } = await this.calculatePaymentDetails();
        return depositAmount;
    }

    //creates a Quote in supa
    async add(options?: { useServiceRole?: boolean }): Promise<QuoteData> {
        // Calculate all payment details before saving
        await this.calculatePaymentDetails();

        // Use service role client for bot operations or when explicitly requested
        // This bypasses RLS for scenarios like bot-created quotes where no user auth context exists
        const supa = options?.useServiceRole ? getEnvironmentServiceRoleClient() : await getEnvironmentServerClient();
        
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
            "serviceIds": this.data.serviceIds,
            "depositAmount": this.data.depositAmount,
            "remainingBalance": this.data.remainingBalance,
            "proposedDateTime": this.data.proposedDateTime,
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString()
        }
        
        if (options?.useServiceRole) {
            console.log('[Quote.add] Using service role client (bypasses RLS for quote creation)');
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

        const supa = await getEnvironmentServerClient();
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

        const supa = await getEnvironmentServerClient();
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

        const supa = await getEnvironmentServerClient();
        const { data, error } = await supa.from("quotes").select("*").eq("businessId", businessId);
        
        if (error) {
            handleModelError("Failed to fetch quotes by business", error);
        }
        
        return data.map(quoteData => new Quote(quoteData));
    }

    // Update quote
    static async update(id: string, quoteData: QuoteData, options?: { useServiceRole?: boolean }): Promise<Quote> {
        if (!Quote.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        // Use service role client for bot operations or when explicitly requested
        const supa = options?.useServiceRole ? getEnvironmentServiceRoleClient() : await getEnvironmentServerClient();
        
        if (options?.useServiceRole) {
            console.log('[Quote.update] Using service role client (bypasses RLS for quote update)');
        }
        
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
            "serviceIds": quoteData.serviceIds,
            "depositAmount": quoteData.depositAmount,
            "remainingBalance": quoteData.remainingBalance,
            "proposedDateTime": quoteData.proposedDateTime,
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

        const supa = await getEnvironmentServerClient();
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
    get serviceIds(): string[] { return this.data.serviceIds; }
    get createdAt(): string | undefined { return this.data.createdAt; }
    get updatedAt(): string | undefined { return this.data.updatedAt; }
    get depositAmount(): number | undefined { return this.data.depositAmount; }
    get remainingBalance(): number | undefined { return this.data.remainingBalance; }
    get proposedDateTime(): string | undefined { return this.data.proposedDateTime; }

    // Utility method to get all service IDs (handles both single and multi-service)
    getAllServiceIds(): string[] {
        return this.data.serviceIds;
    }

    // Get primary service ID (first one) for backward compatibility
    getPrimaryServiceId(): string {
        return this.data.serviceIds[0];
    }

    // Check if this is a multi-service quote
    isMultiService(): boolean {
        return this.data.serviceIds.length > 1;
    }
}
