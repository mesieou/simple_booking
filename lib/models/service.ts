import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from 'uuid';
import { handleModelError } from '@/lib/helpers/error';

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

export class Service {
    private data: ServiceData;

    constructor(data: ServiceData) {
        if (!data.businessId) handleModelError("Business ID is required", new Error("Missing businessId"));
        if (!data.name) handleModelError("Name is required", new Error("Missing name"));
        if (!data.pricingType || !['FIXED', 'PER_MINUTE'].includes(data.pricingType)) {
            handleModelError("Pricing type must be 'FIXED' or 'PER_MINUTE'", new Error("Invalid pricingType"));
        }
        if (data.pricingType === 'FIXED') {
            if (data.fixedPrice === undefined || data.fixedPrice < 0) {
                handleModelError("Fixed price is required and must be non-negative for 'FIXED' pricing type", new Error("Invalid fixedPrice"));
            }
        }
        if (data.pricingType === 'PER_MINUTE') {
            if (data.ratePerMinute === undefined || data.ratePerMinute < 0) {
                handleModelError("Rate per minute is required and must be non-negative for 'PER_MINUTE' pricing type", new Error("Invalid ratePerMinute"));
            }
        }
        if (data.baseCharge !== undefined && data.baseCharge < 0) {
            handleModelError("Base charge cannot be negative", new Error("Invalid baseCharge"));
        }
        if (data.includedMinutes !== undefined && data.includedMinutes < 0) {
            handleModelError("Included minutes cannot be negative", new Error("Invalid includedMinutes"));
        }
        if (data.durationEstimate < 0) {
            handleModelError("Duration estimate cannot be negative", new Error("Invalid durationEstimate"));
        }
        this.data = data;
    }

    // Getter method to access service data
    getData(): ServiceData {
        return { ...this.data };
    }

    async add(): Promise<ServiceData> {
        const supa = await createClient();
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
            handleModelError("Failed to create service", error);
        }
        if (!data) {
            handleModelError("Failed to create service: No data returned", new Error("No data returned from insert"));
        }
        this.data = data;
        return data;
    }

    static async getById(id: string): Promise<Service> {
        const supa = await createClient();
        const { data, error } = await supa.from("services").select("*").eq("id", id).single();
        if (error) {
            handleModelError("Failed to fetch service", error);
        }
        if (!data) {
            handleModelError(`Service with id ${id} not found`, new Error("Service not found"));
        }
        return new Service(data);
    }

    static async getByBusiness(businessId: string): Promise<Service[]> {
        const supa = await createClient();
        const { data, error } = await supa.from("services").select("*").eq("businessId", businessId);
        if (error) {
            handleModelError("Failed to fetch services by business", error);
        }
        return data.map((serviceData: ServiceData) => new Service(serviceData));
    }

    static async update(id: string, serviceData: ServiceData): Promise<Service> {
        const supa = await createClient();
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
            handleModelError("Failed to update service", error);
        }
        if (!data) {
            handleModelError("Failed to update service: No data returned", new Error("No data returned from update"));
        }
        return new Service(data);
    }

    static async delete(id: string): Promise<void> {
        const supa = await createClient();
        const { error } = await supa.from("services").delete().eq("id", id);
        if (error) {
            handleModelError("Failed to delete service", error);
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