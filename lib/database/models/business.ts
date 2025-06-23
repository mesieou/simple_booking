import { createClient } from "../supabase/server";
import { handleModelError } from '@/lib/general-helpers/error';

export type InterfaceType = 'whatsapp' | 'website';

export interface BusinessData {
    id?: string;
    name: string;
    email: string;
    phone: string;
    timeZone: string;
    interfaceType: InterfaceType;
    websiteUrl?: string;
    whatsappNumber?: string;
    businessAddress?: string;
    createdAt?: string;
    updatedAt?: string;
    depositPercentage?: number;
    stripeConnectAccountId?: string;
    stripeAccountStatus?: 'pending' | 'active' | 'disabled';
}

export class Business {
    private data: BusinessData;

    constructor(data: BusinessData) {
        if (!data.name) handleModelError("Name is required", new Error("Missing name"));
        if (!data.email) handleModelError("Email is required", new Error("Missing email"));
        if (!data.phone) handleModelError("Phone is required", new Error("Missing phone"));
        if (!data.timeZone) handleModelError("Time zone is required", new Error("Missing timeZone"));
        if (!['whatsapp', 'website'].includes(data.interfaceType)) handleModelError("Interface type must be 'whatsapp' or 'website'", new Error("Invalid interfaceType"));
        if (data.interfaceType === 'whatsapp' && !data.whatsappNumber) handleModelError("Whatsapp number is required if interface type is 'whatsapp'", new Error("Missing whatsappNumber"));
        if (data.depositPercentage !== undefined && (data.depositPercentage < 0 || data.depositPercentage > 100)) handleModelError("Deposit percentage must be between 0 and 100", new Error("Invalid depositPercentage"));
        this.data = data;
    }

    //creates a business in supa
    async add(): Promise<BusinessData> {
        const supa = await createClient();

        const business = {
            "name": this.data.name,
            "email": this.data.email,
            "phone": this.data.phone,
            "timeZone": this.data.timeZone,
            "interfaceType": this.data.interfaceType,
            "websiteUrl": this.data.websiteUrl,
            "whatsappNumber": this.data.whatsappNumber,
            "businessAddress": this.data.businessAddress,
            "depositPercentage": this.data.depositPercentage,
            "stripeConnectAccountId": this.data.stripeConnectAccountId,
            "stripeAccountStatus": this.data.stripeAccountStatus,
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString()
        }
        
        const { data, error } = await supa.from("businesses").insert(business).select().single();

        if(error) {
            handleModelError("Failed to create business", error);
        }

        if (!data) {
            handleModelError("Failed to create business: No data returned", new Error("No data returned from insert"));
        }

        this.data = data;
        return data;
    }

    // Get business by ID
    static async getById(id: string): Promise<Business> {
        if (!Business.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await createClient();
        const { data, error } = await supa.from("businesses").select("*").eq("id", id).single();
        
        if (error) {
            handleModelError("Failed to fetch business", error);
        }
        
        if (!data) {
            handleModelError(`Business with id ${id} not found`, new Error("Business not found"));
        }
        
        return new Business(data);
    }

    // Get business by WhatsApp number
    static async getByWhatsappNumber(whatsappNumber: string): Promise<Business | null> {
        const supa = await createClient();

        // Normalize the input to handle cases with or without a '+' prefix
        const numberWithoutPlus = whatsappNumber.startsWith('+') ? whatsappNumber.substring(1) : whatsappNumber;
        const numberWithPlus = `+${numberWithoutPlus}`;

        const { data, error } = await supa
            .from("businesses")
            .select("*")
            .or(`whatsappNumber.eq.${numberWithPlus},whatsappNumber.eq.${numberWithoutPlus}`)
            .limit(1)
            .single();

        if (error) {
            // It's better to return null if not found, rather than throwing an error
            if (error.code === 'PGRST116') { // PostgREST error for "exact one row not found"
                return null;
            }
            handleModelError(`Failed to fetch business by WhatsApp number ${whatsappNumber}`, error);
        }

        return data ? new Business(data) : null;
    }

    // Get all businesses
    static async getAll(): Promise<Business[]> {
        const supa = await createClient();
        const { data, error } = await supa.from("businesses").select("*");
        
        if (error) {
            handleModelError("Failed to fetch businesses", error);
        }
        
        return data.map(businessData => new Business(businessData));
    }

    // Update business
    static async update(id: string, businessData: BusinessData): Promise<Business> {
        if (!Business.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await createClient();
        const business = {
            "name": businessData.name,
            "email": businessData.email,
            "phone": businessData.phone,
            "timeZone": businessData.timeZone,
            "interfaceType": businessData.interfaceType,
            "websiteUrl": businessData.websiteUrl,
            "whatsappNumber": businessData.whatsappNumber,
            "businessAddress": businessData.businessAddress,
            "depositPercentage": businessData.depositPercentage,
            "stripeConnectAccountId": businessData.stripeConnectAccountId,
            "stripeAccountStatus": businessData.stripeAccountStatus,
            "updatedAt": new Date().toISOString()
        }
        
        const { data, error } = await supa
            .from("businesses")
            .update(business)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            handleModelError("Failed to update business", error);
        }

        if (!data) {
            handleModelError("Failed to update business: No data returned", new Error("No data returned from update"));
        }

        return new Business(data);
    }

    // Delete business
    static async delete(id: string): Promise<void> {
        if (!Business.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await createClient();
        const { error } = await supa.from("businesses").delete().eq("id", id);

        if (error) {
            handleModelError("Failed to delete business", error);
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
    get createdAt(): string | undefined { return this.data.createdAt; }
    get updatedAt(): string | undefined { return this.data.updatedAt; }
    get interfaceType(): InterfaceType { return this.data.interfaceType; }
    get websiteUrl(): string | undefined { return this.data.websiteUrl; }
    get whatsappNumber(): string | undefined { return this.data.whatsappNumber; }
    get businessAddress(): string | undefined { return this.data.businessAddress; }
    get depositPercentage(): number | undefined { return this.data.depositPercentage; }
    get stripeConnectAccountId(): string | undefined { return this.data.stripeConnectAccountId; }
    get stripeAccountStatus(): 'pending' | 'active' | 'disabled' | undefined { return this.data.stripeAccountStatus; }

    static async findByWhatsappNumber(whatsappNumber: string): Promise<Business | null> {
        console.log(`[Business] Finding business by WhatsApp number: ${whatsappNumber}`);
        const supabase = await createClient();
        
        const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('whatsappNumber', whatsappNumber)
            .single();
    
        if (error) {
            if (error.code === 'PGRST116') { // PostgREST error for "No rows found"
                console.log(`[Business] No business found with WhatsApp number: ${whatsappNumber}`);
                return null;
            }
            console.error(`[Business] Error finding business by WhatsApp number:`, error);
            throw error;
        }
    
        console.log(`[Business] Found business: ${data ? data.name : 'None'}`);
        return data ? new Business(data) : null;
    }
}
