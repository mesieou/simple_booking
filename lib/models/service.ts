import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from 'uuid';

export type PricingType = 'FIXED' | 'PER_MINUTE';

export interface ServiceData {
    id?: string;
    businessId: string;
    name: string;
    pricingType: PricingType;
    fixedPrice?: number;
    baseCharge?: number;
    includedMinutes?: number;
    ratePerMinute?: number;
    description?: string;
    durationEstimate: number;
    createdAt?: string;
    updatedAt?: string;
}

export class ServiceError extends Error {
    constructor(message: string, public originalError?: any) {
        super(message);
        this.name = 'ServiceError';
    }
}

export class Service {
    private data: ServiceData;

    constructor(data: ServiceData) {
        if (!data.businessId) throw new ServiceError("Business ID is required");
        if (!data.name) throw new ServiceError("Name is required");
        if (!data.pricingType || !['FIXED', 'PER_MINUTE'].includes(data.pricingType)) {
            throw new ServiceError("Pricing type must be 'FIXED' or 'PER_MINUTE'");
        }
        if (data.pricingType === 'FIXED') {
            if (data.fixedPrice === undefined || data.fixedPrice < 0) {
                throw new ServiceError("Fixed price is required and must be non-negative for 'FIXED' pricing type");
            }
        }
        if (data.pricingType === 'PER_MINUTE') {
            if (data.ratePerMinute === undefined || data.ratePerMinute < 0) {
                throw new ServiceError("Rate per minute is required and must be non-negative for 'PER_MINUTE' pricing type");
            }
        }
        if (data.baseCharge !== undefined && data.baseCharge < 0) {
            throw new ServiceError("Base charge cannot be negative");
        }
        if (data.includedMinutes !== undefined && data.includedMinutes < 0) {
            throw new ServiceError("Included minutes cannot be negative");
        }
        if (data.durationEstimate < 0) {
            throw new ServiceError("Duration estimate cannot be negative");
        }
        this.data = data;
    }

    // Getter method to access service data
    getData(): ServiceData {
        return { ...this.data };
    }

    async add(): Promise<ServiceData> {
        const supa = createClient();
        const service = {
            "id": this.data.id || uuidv4(),
            "businessId": this.data.businessId,
            "name": this.data.name,
            "pricingType": this.data.pricingType,
            "fixedPrice": this.data.fixedPrice,
            "baseCharge": this.data.baseCharge,
            "includedMinutes": this.data.includedMinutes,
            "ratePerMinute": this.data.ratePerMinute,
            "description": this.data.description,
            "durationEstimate": this.data.durationEstimate,
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString()
        };
        const { data, error } = await supa.from("services").insert(service).select().single();
        if (error) {
            console.error("Supabase insert error:", {
                message: error.message,
                details: error.details,
                code: error.code,
                hint: error.hint,
                table: "services",
                data: service
            });
            throw new ServiceError(`Failed to create service: ${error.message}`, error);
        }
        if (!data) {
            throw new ServiceError("Failed to create service: No data returned");
        }
        this.data = data;
        return data;
    }

    static async getById(id: string): Promise<Service> {
        const supa = createClient();
        const { data, error } = await supa.from("services").select("*").eq("id", id).single();
        if (error) {
            console.error("Supabase fetch error:", {
                message: error.message,
                details: error.details,
                code: error.code,
                hint: error.hint,
                table: "services",
                id
            });
            throw new ServiceError(`Failed to fetch service: ${error.message}`, error);
        }
        if (!data) {
            throw new ServiceError(`Service with id ${id} not found`);
        }
        return new Service(data);
    }

    static async getByBusiness(businessId: string): Promise<Service[]> {
        const supa = createClient();
        const { data, error } = await supa.from("services").select("*").eq("businessId", businessId);
        if (error) {
            console.error("Supabase fetch error:", {
                message: error.message,
                details: error.details,
                code: error.code,
                hint: error.hint,
                table: "services",
                businessId
            });
            throw new ServiceError(`Failed to fetch services by business: ${error.message}`, error);
        }
        return data.map((serviceData: ServiceData) => new Service(serviceData));
    }

    static async update(id: string, serviceData: ServiceData): Promise<Service> {
        const supa = createClient();
        const service = {
            "businessId": serviceData.businessId,
            "name": serviceData.name,
            "pricingType": serviceData.pricingType,
            "fixedPrice": serviceData.fixedPrice,
            "baseCharge": serviceData.baseCharge,
            "includedMinutes": serviceData.includedMinutes,
            "ratePerMinute": serviceData.ratePerMinute,
            "description": serviceData.description,
            "durationEstimate": serviceData.durationEstimate,
            "updatedAt": new Date().toISOString()
        };
        const { data, error } = await supa.from("services").update(service).eq("id", id).select().single();
        if (error) {
            console.error("Supabase update error:", {
                message: error.message,
                details: error.details,
                code: error.code,
                hint: error.hint,
                table: "services",
                id,
                data: service
            });
            throw new ServiceError(`Failed to update service: ${error.message}`, error);
        }
        if (!data) {
            throw new ServiceError("Failed to update service: No data returned");
        }
        return new Service(data);
    }

    static async delete(id: string): Promise<void> {
        const supa = createClient();
        const { error } = await supa.from("services").delete().eq("id", id);
        if (error) {
            console.error("Supabase delete error:", {
                message: error.message,
                details: error.details,
                code: error.code,
                hint: error.hint,
                table: "services",
                id
            });
            throw new ServiceError(`Failed to delete service: ${error.message}`, error);
        }
    }

    get id(): string | undefined { return this.data.id; }
    get businessId(): string { return this.data.businessId; }
    get name(): string { return this.data.name; }
    get pricingType(): string { return this.data.pricingType; }
    get fixedPrice(): number | undefined { return this.data.fixedPrice; }
    get baseCharge(): number | undefined { return this.data.baseCharge; }
    get includedMinutes(): number | undefined { return this.data.includedMinutes; }
    get ratePerMinute(): number | undefined { return this.data.ratePerMinute; }
    get description(): string | undefined { return this.data.description; }
    get durationEstimate(): number { return this.data.durationEstimate; }
    get createdAt(): string | undefined { return this.data.createdAt; }
    get updatedAt(): string | undefined { return this.data.updatedAt; }
} 