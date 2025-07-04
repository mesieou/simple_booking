import { createClient } from "../supabase/server";
import { getServiceRoleClient } from "../supabase/service-role";
import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "../supabase/environment";
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
    whatsappNumber?: string; // The actual phone number users dial (e.g., "+1234567890")
    whatsappPhoneNumberId?: string; // WhatsApp Business API Phone Number ID for webhook routing (e.g., "108123456789")
    businessAddress?: string;
    createdAt?: string;
    updatedAt?: string;
    depositPercentage?: number;
    stripeConnectAccountId?: string;
    stripeAccountStatus?: 'pending' | 'active' | 'disabled';
    preferredPaymentMethod?: string;
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

    // Getter method to access business data
    getData(): BusinessData {
        return { ...this.data };
    }

    //creates a business in supa
    async add(): Promise<BusinessData> {
        // Use environment-aware service role client to bypass RLS for business creation (needed for seeding)
        const supa = getEnvironmentServiceRoleClient();
        return this.addWithClient(supa);
    }

    //creates a business in supa with provided client
    async addWithClient(supaClient: any): Promise<BusinessData> {
        const business = {
            "name": this.data.name,
            "email": this.data.email,
            "phone": this.data.phone,
            "timeZone": this.data.timeZone,
            "interfaceType": this.data.interfaceType,
            "websiteUrl": this.data.websiteUrl,
            "whatsappNumber": this.data.whatsappNumber,
            "whatsappPhoneNumberId": this.data.whatsappPhoneNumberId,
            "businessAddress": this.data.businessAddress,
            "depositPercentage": this.data.depositPercentage,
            "stripeConnectAccountId": this.data.stripeConnectAccountId,
            "stripeAccountStatus": this.data.stripeAccountStatus,
            "preferredPaymentMethod": this.data.preferredPaymentMethod,
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString()
        }
        
        const { data, error } = await supaClient.from("businesses").insert(business).select().single();

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

        const supa = getEnvironmentServerClient();
        const { data, error } = await supa.from("businesses").select("*").eq("id", id).single();
        
        if (error) {
            handleModelError("Failed to fetch business", error);
        }
        
        if (!data) {
            handleModelError(`Business with id ${id} not found`, new Error("Business not found"));
        }
        
        return new Business(data);
    }

    // Get business by ID using service role (for admin operations that need to bypass RLS)
    static async getByIdWithServiceRole(id: string): Promise<Business> {
        if (!Business.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = getEnvironmentServiceRoleClient();
        const { data, error } = await supa.from("businesses").select("*").eq("id", id).single();
        
        if (error) {
            handleModelError("Failed to fetch business", error);
        }
        
        if (!data) {
            handleModelError(`Business with id ${id} not found`, new Error("Business not found"));
        }
        
        return new Business(data);
    }

    // Get business by WhatsApp number (consolidated method with better normalization)
    static async getByWhatsappNumber(whatsappNumber: string): Promise<Business | null> {
        console.log(`[Business] Finding business by WhatsApp number: ${whatsappNumber}`);
        const supa = getEnvironmentServerClient();

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
            if (error.code === 'PGRST116') { // PostgREST error for "exact one row not found"
                console.log(`[Business] No business found with WhatsApp number: ${whatsappNumber}`);
                return null;
            }
            console.error(`[Business] Error finding business by WhatsApp number:`, error);
            handleModelError(`Failed to fetch business by WhatsApp number ${whatsappNumber}`, error);
        }

        console.log(`[Business] Found business: ${data ? data.name : 'None'}`);
        return data ? new Business(data) : null;
    }

    // Get all businesses
    static async getAll(): Promise<Business[]> {
        const supa = getEnvironmentServerClient();
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

        const supa = getEnvironmentServiceRoleClient();
        const business = {
            "name": businessData.name,
            "email": businessData.email,
            "phone": businessData.phone,
            "timeZone": businessData.timeZone,
            "interfaceType": businessData.interfaceType,
            "websiteUrl": businessData.websiteUrl,
            "whatsappNumber": businessData.whatsappNumber,
            "whatsappPhoneNumberId": businessData.whatsappPhoneNumberId,
            "businessAddress": businessData.businessAddress,
            "depositPercentage": businessData.depositPercentage,
            "stripeConnectAccountId": businessData.stripeConnectAccountId,
            "stripeAccountStatus": businessData.stripeAccountStatus,
            "preferredPaymentMethod": businessData.preferredPaymentMethod,
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

        const supa = getEnvironmentServerClient();
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
    get whatsappPhoneNumberId(): string | undefined { return this.data.whatsappPhoneNumberId; }
    get businessAddress(): string | undefined { return this.data.businessAddress; }
    get depositPercentage(): number | undefined { return this.data.depositPercentage; }
    get stripeConnectAccountId(): string | undefined { return this.data.stripeConnectAccountId; }
    get stripeAccountStatus(): 'pending' | 'active' | 'disabled' | undefined { return this.data.stripeAccountStatus; }
        get preferredPaymentMethod(): string | undefined { return this.data.preferredPaymentMethod; }

    static async findByWhatsappNumber(whatsappNumber: string): Promise<Business | null> {
        console.log(`[Business] Finding business by WhatsApp number: ${whatsappNumber}`);
        const supabase = getEnvironmentServerClient();
        
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

    /**
     * Automatically maps and saves the WhatsApp Phone Number ID for a business
     * based on the WhatsApp number. This should be called when receiving webhook data.
     * @param whatsappNumber The WhatsApp number (e.g., "+1234567890")
     * @param phoneNumberId The WhatsApp Phone Number ID (e.g., "108123456789")
     * @returns Promise<boolean> - true if updated successfully, false otherwise
     */
    static async autoMapWhatsappPhoneNumberId(
        whatsappNumber: string, 
        phoneNumberId: string
    ): Promise<boolean> {
        try {
            console.log(`[Business] Auto-mapping WhatsApp Phone Number ID for ${whatsappNumber} -> ${phoneNumberId}`);
            
            const supa = getEnvironmentServiceRoleClient();
            
            // Find business by WhatsApp number and update if Phone Number ID is missing
            const { data, error } = await supa
                .from("businesses")
                .update({ 
                    whatsappPhoneNumberId: phoneNumberId,
                    updatedAt: new Date().toISOString()
                })
                .eq("whatsappNumber", whatsappNumber)
                .is("whatsappPhoneNumberId", null) // Only update if not already set
                .select("id, name")
                .maybeSingle();

            if (error) {
                console.error(`[Business] Error auto-mapping Phone Number ID:`, error);
                return false;
            }

            if (data) {
                console.log(`[Business] Successfully auto-mapped Phone Number ID for business: ${data.name} (${data.id})`);
                return true;
            } else {
                console.log(`[Business] No business found with WhatsApp number ${whatsappNumber} or Phone Number ID already set`);
                return false;
            }
        } catch (error) {
            console.error(`[Business] Exception in autoMapWhatsappPhoneNumberId:`, error);
            return false;
        }
    }

    /**
     * Gets the WhatsApp Phone Number ID for a business by WhatsApp number
     * @param whatsappNumber The WhatsApp number to look up
     * @returns Promise<string | null> - the Phone Number ID or null if not found
     */
    static async getWhatsappPhoneNumberId(whatsappNumber: string): Promise<string | null> {
        try {
            const supa = getEnvironmentServerClient();
            
            const { data, error } = await supa
                .from("businesses")
                .select("whatsappPhoneNumberId")
                .eq("whatsappNumber", whatsappNumber)
                .single();

            if (error || !data?.whatsappPhoneNumberId) {
                return null;
            }

            return data.whatsappPhoneNumberId;
        } catch (error) {
            console.error(`[Business] Error getting WhatsApp Phone Number ID:`, error);
            return null;
        }
    }

    /**
     * Finds a business by its WhatsApp Phone Number ID (NOT the same as WhatsApp number)
     * WhatsApp Phone Number ID is the internal API identifier (e.g., "108123456789")
     * WhatsApp Number is the actual phone number (e.g., "+1234567890")
     * @param phoneNumberId The WhatsApp Phone Number ID to look up
     * @returns Promise<Business | null> - the Business or null if not found
     */
    static async findByPhoneNumberId(phoneNumberId: string): Promise<Business | null> {
        try {
            console.log(`[Business] Finding business by Phone Number ID: ${phoneNumberId}`);
            const supa = getEnvironmentServiceRoleClient();
            
            const { data, error } = await supa
                .from("businesses")
                .select("*")
                .eq("whatsappPhoneNumberId", phoneNumberId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') { // PostgREST error for "No rows found"
                    console.log(`[Business] No business found with Phone Number ID: ${phoneNumberId}`);
                    return null;
                }
                console.error(`[Business] Error finding business by Phone Number ID:`, error);
                return null;
            }

            if (!data) {
                console.log(`[Business] No business found with Phone Number ID: ${phoneNumberId}`);
                return null;
            }

            console.log(`[Business] Found business: ${data.name} (ID: ${data.id})`);
            return new Business(data);
        } catch (error) {
            console.error(`[Business] Exception in findByPhoneNumberId:`, error);
            return null;
        }
    }
}
