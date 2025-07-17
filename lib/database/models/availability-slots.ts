import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "../supabase/environment";
import { handleModelError } from '@/lib/general-helpers/error';
import { DateTime } from 'luxon';

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
    async add(options?: { useServiceRole?: boolean; supabaseClient?: any }): Promise<AvailabilitySlotsData> {
        // Use provided client, service role client, or regular client
        // This bypasses RLS for scenarios like seeding where no user auth context exists
        const supa = options?.supabaseClient || (options?.useServiceRole ? getEnvironmentServiceRoleClient() : await getEnvironmentServerClient());

        const availabilitySlots = {
            "providerId": this.data.providerId,
            "date": this.data.date,
            "slots": this.data.slots,
            "createdAt": new Date().toISOString()
        }
        
        if (options?.useServiceRole) {
            console.log('[AvailabilitySlots.add] Using service role client (bypasses RLS for availability creation)');
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

    // Bulk insert multiple availability slots - PERFORMANCE OPTIMIZATION
    static async bulkInsert(slots: AvailabilitySlots[]): Promise<AvailabilitySlotsData[]> {
        if (slots.length === 0) return [];

        const supa = await getEnvironmentServerClient();
        const currentTime = new Date().toISOString();

        const availabilitySlotsArray = slots.map(slot => ({
            providerId: slot.data.providerId,
            date: slot.data.date,
            slots: slot.data.slots,
            createdAt: currentTime
        }));

        const { data, error } = await supa
            .from("availabilitySlots")
            .insert(availabilitySlotsArray)
            .select();

        if (error) {
            handleModelError("Failed to bulk create availability slots", error);
        }

        if (!data) {
            handleModelError("Failed to bulk create availability slots: No data returned", new Error("No data returned from bulk insert"));
        }

        return data;
    }

    // Get availability slots for a provider and date range
    static async getByProviderAndDateRange(
        providerId: string,
        startDate: string,
        endDate: string
    ): Promise<AvailabilitySlotsData[]> {
        const supa = await getEnvironmentServerClient();

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
        const supa = await getEnvironmentServerClient();

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

    // Get next 3 chronologically available time slots for a provider
    static async getNext3AvailableSlots(
        providerId: string,
        serviceDuration: number,
        daysToLookAhead: number = 14,
        providerTimezone: string = 'UTC'
    ): Promise<Array<{ date: string; time: string }>> {
        try {
            console.log(`[AvailabilitySlots] Getting next 3 slots for provider ${providerId}, duration ${serviceDuration}, timezone ${providerTimezone}`);
            
            // Get availability for the specified date range
            const today = new Date();
            const endDate = new Date();
            endDate.setDate(today.getDate() + daysToLookAhead);
            
            const availabilityData = await this.getByProviderAndDateRange(
                providerId,
                today.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0]
            );
            
            console.log(`[AvailabilitySlots] Found ${availabilityData.length} days of availability data`);
            
            // Find the smallest duration that can accommodate the service
            const availableDurations = [60, 90, 120, 150, 180, 240, 300, 360]; // Standard intervals
            const suitableDuration = availableDurations.find(duration => duration >= serviceDuration);
            
            if (!suitableDuration) {
                console.log(`[AvailabilitySlots] No suitable duration found for ${serviceDuration} minutes`);
                return [];
            }
            
            const durationKey = suitableDuration.toString();
            console.log(`[AvailabilitySlots] Using duration ${durationKey} for service duration ${serviceDuration}`);
            
            // Collect all available slots chronologically, starting from the current time
            const allSlots: Array<{ date: string; time: string }> = [];
            const nowInProviderTz = DateTime.now().setZone(providerTimezone);
            
            // Sort the availability data by date first
            availabilityData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            for (const dayData of availabilityData) {
                const slotsForDuration = dayData.slots[durationKey] || [];
                
                // Sort time slots to be sure
                const sortedTimeSlots = slotsForDuration.sort();
                
                for (const timeSlot of sortedTimeSlots) {
                    const datePart = dayData.date.substring(0, 10); // Extract YYYY-MM-DD
                    const slotDateTime = DateTime.fromISO(`${datePart}T${timeSlot}`, { zone: providerTimezone });
                    
                    // Only consider slots that are in the future
                    if (slotDateTime.isValid && slotDateTime > nowInProviderTz) {
                        allSlots.push({
                            date: dayData.date,
                            time: timeSlot
                        });
                    }
                }
            }
            
            console.log(`[AvailabilitySlots] Found ${allSlots.length} total future slots`);
            
            // Now the list is already chronologically sorted, so just take the first 3
            const result = allSlots.slice(0, 3);
            console.log(`[AvailabilitySlots] Returning ${result.length} slots:`, result);
            
            return result;
            
        } catch (error) {
            console.error('[AvailabilitySlots] Error getting next 3 available slots:', error);
            return [];
        }
    }

    // Get available hours for a specific provider, date and service duration
    static async getAvailableHoursForDate(
        providerId: string,
        date: string,
        serviceDuration: number
    ): Promise<string[]> {
        try {
            console.log(`[AvailabilitySlots] Getting hours for provider ${providerId}, date ${date}, duration ${serviceDuration}`);
            
            const dayAvailability = await this.getByProviderAndDate(providerId, date);
            
            if (!dayAvailability) {
                console.log(`[AvailabilitySlots] No availability data found for date ${date}`);
                return [];
            }
            
            // Find the smallest duration that can accommodate the service
            const availableDurations = [60, 90, 120, 150, 180, 240, 300, 360]; // Standard intervals
            const suitableDuration = availableDurations.find(duration => duration >= serviceDuration);
            
            if (!suitableDuration) {
                console.log(`[AvailabilitySlots] No suitable duration found for ${serviceDuration} minutes`);
                return [];
            }
            
            const durationKey = suitableDuration.toString();
            console.log(`[AvailabilitySlots] Using duration ${durationKey} for service duration ${serviceDuration}`);
            
            const slots = dayAvailability.slots[durationKey] || [];
            console.log(`[AvailabilitySlots] Found ${slots.length} slots for date ${date}`);
            
            return slots;
            
        } catch (error) {
            console.error('[AvailabilitySlots] Error getting available hours for date:', error);
            return [];
        }
    }

    // Update availability slots
    static async update(providerId: string, date: string, slotsData: AvailabilitySlotsData): Promise<AvailabilitySlots> {
        const supa = await getEnvironmentServerClient();
        
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
        const supa = await getEnvironmentServerClient();
        
        const { error } = await supa
            .from("availabilitySlots")
            .delete()
            .eq("providerId", providerId)
            .eq("date", date);

        if (error) {
            handleModelError("Failed to delete availability slots", error);
        }
    }

    // Delete all availability slots before a specific date
    static async deleteBefore(providerId: string, beforeDate: string, options?: { useServiceRole?: boolean }): Promise<void> {
        const supa = options?.useServiceRole ? getEnvironmentServiceRoleClient() : await getEnvironmentServerClient();
        
        if (options?.useServiceRole) {
            console.log('[AvailabilitySlots.deleteBefore] Using service role client (bypasses RLS for deletion)');
        }
        
        const { error } = await supa
            .from("availabilitySlots")
            .delete()
            .eq("providerId", providerId)
            .lt("date", beforeDate);

        if (error) {
            handleModelError("Failed to delete availability slots before date", error);
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