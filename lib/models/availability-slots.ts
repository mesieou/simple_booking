import { createClient } from "@/lib/supabase/server";

export interface AvailabilitySlotsData {
    providerId: string;
    date: string; // YYYY-MM-DD format
    slots: {
        [key: string]: string[]; // e.g., "1h": ["08:00", "09:00", ...]
    };
    createdAt?: string;
}

export class AvailabilitySlotsError extends Error {
    originalError?: any;
    constructor(message: string, originalError?: any) {
        super(message);
        this.name = 'AvailabilitySlotsError';
        this.originalError = originalError;
    }
}

export class AvailabilitySlots {
    private data: AvailabilitySlotsData;

    constructor(data: AvailabilitySlotsData) {
        if (!data.providerId) throw new AvailabilitySlotsError("Provider ID is required");
        if (!data.date) throw new AvailabilitySlotsError("Date is required");
        if (!data.slots) throw new AvailabilitySlotsError("Slots are required");
        
        this.data = data;
    }

    // Add new availability slots
    async add(): Promise<AvailabilitySlotsData> {
        const supa = createClient();

        const availabilitySlots = {
            "providerId": this.data.providerId,
            "date": this.data.date,
            "slots": this.data.slots,
            "createdAt": new Date().toISOString()
        }

        const { data, error } = await supa
            .from("availabilitySlots")
            .insert(availabilitySlots)
            .select()
            .single();

        if (error) {
            console.error("Supabase insert error:", error); // 👈 log the actual error
            throw new AvailabilitySlotsError("Failed to create availability slots", error);
        }

        if (!data) {
            throw new AvailabilitySlotsError("Failed to create availability slots: No data returned");
        }

        this.data = data;
        return data;
    }

    // Get availability slots for a provider and date range
    static async getByProviderAndDateRange(
        providerId: string,
        startDate: string,
        endDate: string
    ): Promise<AvailabilitySlotsData[]> {
        const supa = createClient();

        const { data, error } = await supa
            .from("availabilitySlots")
            .select("*")
            .eq("providerId", providerId)
            .gte("date", startDate)
            .lte("date", endDate);

        if (error) {
            throw new AvailabilitySlotsError("Failed to fetch availability slots", error);
        }

        return data;
    }

    // Get availability slots for a specific provider and date
    static async getByProviderAndDate(
        providerId: string,
        date: string
    ): Promise<AvailabilitySlotsData | null> {
        const supa = createClient();

        const { data, error } = await supa
            .from("availabilitySlots")
            .select("*")
            .eq("providerId", providerId)
            .eq("date", date)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // No data found
            }
            throw new AvailabilitySlotsError("Failed to fetch availability slots", error);
        }

        return data;
    }

    // Update availability slots
    static async update(providerId: string, date: string, slotsData: AvailabilitySlotsData): Promise<AvailabilitySlots> {
        const supa = createClient();
        
        const availabilitySlots = {
            "providerId": slotsData.providerId,
            "date": slotsData.date,
            "slots": slotsData.slots
        }
        
        const { data, error } = await supa
            .from("availabilitySlots")
            .update(availabilitySlots)
            .eq("providerId", providerId)
            .eq("date", date)
            .select()
            .single();

        if (error) {
            throw new AvailabilitySlotsError("Failed to update availability slots", error);
        }

        if (!data) {
            throw new AvailabilitySlotsError("Failed to update availability slots: No data returned");
        }

        return new AvailabilitySlots(data);
    }

    // Delete availability slots
    static async delete(providerId: string, date: string): Promise<void> {
        const supa = createClient();
        
        const { error } = await supa
            .from("availabilitySlots")
            .delete()
            .eq("providerId", providerId)
            .eq("date", date);

        if (error) {
            throw new AvailabilitySlotsError("Failed to delete availability slots", error);
        }
    }

    // Helper method to get slots for a specific duration
    getSlotsForDuration(duration: string): string[] {
        return this.data.slots[duration] || [];
    }

    // Helper method to check if a specific time slot is available for a duration
    isSlotAvailable(time: string, duration: string): boolean {
        const slots = this.getSlotsForDuration(duration);
        return slots.includes(time);
    }

    // Getters
    get providerId(): string { return this.data.providerId; }
    get date(): string { return this.data.date; }
    get slots(): { [key: string]: string[] } { return this.data.slots; }
    get createdAt(): string | undefined { return this.data.createdAt; }
} 