import { createClient } from "@/lib/supabase/server"

export interface BusinessData {
    id?: string;
    name: string;
    email: string;
    phone: string;
    timeZone: string;
    serviceRatePerMinute: number;
    createdAt?: string;
    updatedAt?: string;
}

export class BusinessError extends Error {
    constructor(message: string, public originalError?: any) {
        super(message);
        this.name = 'BusinessError';
    }
}

export class Business {
    private data: BusinessData;

    constructor(data: BusinessData) {
        if (!data.name) throw new BusinessError("Name is required");
        if (!data.email) throw new BusinessError("Email is required");
        if (!data.phone) throw new BusinessError("Phone is required");
        if (!data.timeZone) throw new BusinessError("Time zone is required");
        if (data.serviceRatePerMinute === undefined) throw new BusinessError("Service rate per minute is required");
        
        this.data = data;
    }

    //creates a business in supa
    async add(): Promise<BusinessData> {
        const supa = createClient();

        const business = {
            "name": this.data.name,
            "email": this.data.email,
            "phone": this.data.phone,
            "timeZone": this.data.timeZone,
            "serviceRatePerMinute": this.data.serviceRatePerMinute,
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString()
        }
        
        const { data, error } = await supa.from("businesses").insert(business).select().single();

        if(error) {
            throw new BusinessError("Failed to create business", error);
        }

        if (!data) {
            throw new BusinessError("Failed to create business: No data returned");
        }

        this.data = data;
        return data;
    }

    // Get business by ID
    static async getById(id: string): Promise<Business> {
        if (!Business.isValidUUID(id)) {
            throw new BusinessError("Invalid UUID format");
        }

        const supa = createClient();
        const { data, error } = await supa.from("businesses").select("*").eq("id", id).single();
        
        if (error) {
            throw new BusinessError("Failed to fetch business", error);
        }
        
        if (!data) {
            throw new BusinessError(`Business with id ${id} not found`);
        }
        
        return new Business(data);
    }

    // Get all businesses
    static async getAll(): Promise<Business[]> {
        const supa = createClient();
        const { data, error } = await supa.from("businesses").select("*");
        
        if (error) {
            throw new BusinessError("Failed to fetch businesses", error);
        }
        
        return data.map(businessData => new Business(businessData));
    }

    // Update business
    static async update(id: string, businessData: BusinessData): Promise<Business> {
        if (!Business.isValidUUID(id)) {
            throw new BusinessError("Invalid UUID format");
        }

        const supa = createClient();
        const business = {
            "name": businessData.name,
            "email": businessData.email,
            "phone": businessData.phone,
            "timeZone": businessData.timeZone,
            "serviceRatePerMinute": businessData.serviceRatePerMinute,
            "updatedAt": new Date().toISOString()
        }
        
        const { data, error } = await supa
            .from("businesses")
            .update(business)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            throw new BusinessError("Failed to update business", error);
        }

        if (!data) {
            throw new BusinessError("Failed to update business: No data returned");
        }

        return new Business(data);
    }

    // Delete business
    static async delete(id: string): Promise<void> {
        if (!Business.isValidUUID(id)) {
            throw new BusinessError("Invalid UUID format");
        }

        const supa = createClient();
        const { error } = await supa.from("businesses").delete().eq("id", id);

        if (error) {
            throw new BusinessError("Failed to delete business", error);
        }
    }

    private static isValidUUID(id: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    }

    // Getters for the business data
    get id(): string | undefined { return this.data.id; }
    get name(): string { return this.data.name; }
    get email(): string { return this.data.email; }
    get phone(): string { return this.data.phone; }
    get timeZone(): string { return this.data.timeZone; }
    get serviceRatePerMinute(): number { return this.data.serviceRatePerMinute; }
    get createdAt(): string | undefined { return this.data.createdAt; }
    get updatedAt(): string | undefined { return this.data.updatedAt; }
}
