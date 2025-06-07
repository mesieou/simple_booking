import { createClient } from "../supabase/server";
import { v4 as uuidv4 } from 'uuid';
import { handleModelError } from '@/lib/general-helpers/error';

export type PricingType = 'fixed' | 'per_minute';

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
    mobile?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export class Service {
    private data: ServiceData;

    constructor(data: ServiceData) {
        // Normalizar el tipo de pricing a minúsculas
        const normalizedData = {
            ...data,
            pricingType: data.pricingType.toLowerCase() as PricingType,
            mobile: data.mobile === undefined ? false : data.mobile,
        };

        if (!normalizedData.businessId) handleModelError("Business ID is required", new Error("Missing businessId"));
        if (!normalizedData.name) handleModelError("Name is required", new Error("Missing name"));
        if (!normalizedData.pricingType || !['fixed', 'per_minute'].includes(normalizedData.pricingType)) {
            handleModelError("Pricing type must be 'fixed' or 'per_minute'", new Error("Invalid pricingType"));
        }
        if (normalizedData.pricingType === 'fixed') {
            if (normalizedData.fixedPrice === undefined || normalizedData.fixedPrice < 0) {
                handleModelError("Fixed price is required and must be non-negative for 'fixed' pricing type", new Error("Invalid fixedPrice"));
            }
        }
        if (normalizedData.pricingType === 'per_minute') {
            if (normalizedData.ratePerMinute === undefined || normalizedData.ratePerMinute < 0) {
                handleModelError("Rate per minute is required and must be non-negative for 'per_minute' pricing type", new Error("Invalid ratePerMinute"));
            }
        }
        if (normalizedData.baseCharge !== undefined && normalizedData.baseCharge < 0) {
            handleModelError("Base charge cannot be negative", new Error("Invalid baseCharge"));
        }
        if (normalizedData.includedMinutes !== undefined && normalizedData.includedMinutes < 0) {
            handleModelError("Included minutes cannot be negative", new Error("Invalid includedMinutes"));
        }
        if (normalizedData.durationEstimate < 0) {
            handleModelError("Duration estimate cannot be negative", new Error("Invalid durationEstimate"));
        }
        this.data = normalizedData;
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
            "mobile": this.data.mobile,
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
            "mobile": serviceData.mobile,
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
    get mobile(): boolean | undefined { return this.data.mobile; }
    get createdAt(): string | undefined { return this.data.createdAt; }
    get updatedAt(): string | undefined { return this.data.updatedAt; }
} 