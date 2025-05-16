import { createClient } from "@/lib/supabase/server";
import { handleModelError } from '@/lib/helpers/error';

export interface AvailabilitySlotsData {
    providerId: string;
    date: string; // YYYY-MM-DD format
    slots: {
        [key: string]: string[]; // e.g., "1h": ["08:00", "09:00", ...]
    };
    createdAt?: string;
}

export class AvailabilitySlots {
    private data: AvailabilitySlotsData;

    constructor(data: AvailabilitySlotsData) {
        if (!data.providerId) handleModelError("Provider ID is required", new Error("Missing providerId"));
        if (!data.date) handleModelError("Date is required", new Error("Missing date"));
        if (!data.slots) handleModelError("Slots are required", new Error("Missing slots"));
        
        this.data = data;
    }

    // Add new availability slots
    async add(): Promise<AvailabilitySlotsData> {
        const supa = await createClient();

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
            handleModelError("Failed to create availability slots", error);
        }

        if (!data) {
            handleModelError("Failed to create availability slots: No data returned", new Error("No data returned from insert"));
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
        const supa = await createClient();

        const { data, error } = await supa
            .from("availabilitySlots")
            .select("*")
            .eq("providerId", providerId)
            .gte("date", startDate)
            .lte("date", endDate);

        if (error) {
            handleModelError("Failed to fetch availability slots", error);
        }

        return data;
    }

    // Get availability slots for a specific provider and date
    static async getByProviderAndDate(
        providerId: string,
        date: string
    ): Promise<AvailabilitySlotsData | null> {
        const supa = await createClient();

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
            handleModelError("Failed to fetch availability slots", error);
        }

        return data;
    }

    // Update availability slots
    static async update(providerId: string, date: string, slotsData: AvailabilitySlotsData): Promise<AvailabilitySlots> {
        const supa = await createClient();
        
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
            handleModelError("Failed to update availability slots", error);
        }

        if (!data) {
            handleModelError("Failed to update availability slots: No data returned", new Error("No data returned from update"));
        }

        return new AvailabilitySlots(data);
    }

    // Delete availability slots
    static async delete(providerId: string, date: string): Promise<void> {
        const supa = await createClient();
        
        const { error } = await supa
            .from("availabilitySlots")
            .delete()
            .eq("providerId", providerId)
            .eq("date", date);

        if (error) {
            handleModelError("Failed to delete availability slots", error);
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