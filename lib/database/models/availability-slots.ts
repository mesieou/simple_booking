import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "../supabase/environment";
import { handleModelError } from '@/lib/general-helpers/error';
import { DateTime } from 'luxon';
import { DURATION_INTERVALS } from '../../general-helpers/availability/helpers';

/**
 * AvailabilitySlots Model - Business-Aggregated Availability System
 * 
 * This model manages aggregated availability for businesses with multiple providers.
 * Key Architecture:
 * - Stores availability by businessId (not providerId)  
 * - Aggregates all providers' schedules into provider counts per time slot
 * - Uses DURATION_INTERVALS: [60, 90, 120, 150, 180, 240, 300, 360] minutes
 * - Format: { "60": [["09:00", 2], ["10:00", 1]], "90": [...] }
 *   where the number represents how many providers are available at that time
 * 
 * Usage:
 * - Use getByBusinessAndDateRange() for date range queries
 * - Use getByBusinessAndDate() for single day queries
 * - Calendar changes automatically update via recalculateProviderContribution()
 */

export interface AvailabilitySlotsData {
    businessId: string;
    date: string; // YYYY-MM-DD format
    slots: {
        [key: string]: Array<[string, number]>; // e.g., "60": [["08:00", 2], ["09:00", 1], ...]
    };
    createdAt?: string;
}

export class AvailabilitySlots {
    private data: AvailabilitySlotsData;

    constructor(data: AvailabilitySlotsData) {
        if (!data.businessId) handleModelError("Business ID is required", new Error("Missing businessId"));
        if (!data.date) handleModelError("Date is required", new Error("Missing date"));
        if (!data.slots) handleModelError("Slots are required", new Error("Missing slots"));
        
        this.data = data;
    }

    // === PRIVATE HELPER METHODS ===

    /**
     * Find the smallest duration that can accommodate the service duration
     */
    private static findSuitableDuration(serviceDuration: number): number | null {
        return DURATION_INTERVALS.find(duration => duration >= serviceDuration) || null;
    }

    /**
     * Filter slots that have available providers (count > 0)
     */
    private static filterAvailableSlots(slots: Array<[string, number]>): Array<[string, number]> {
        return slots.filter(([, count]) => count > 0);
    }

    /**
     * Get slots for a specific duration from availability data
     */
    private static getSlotsForDuration(
        availabilityData: AvailabilitySlotsData, 
        duration: number
    ): Array<[string, number]> {
        return availabilityData.slots[duration.toString()] || [];
    }

    /**
     * Check if a slot time is in the future relative to current time in timezone
     */
    private static isSlotInFuture(
        date: string, 
        time: string, 
        timezone: string
    ): boolean {
        const slotDateTime = DateTime.fromISO(`${date}T${time}`, { zone: timezone });
        const nowInTz = DateTime.now().setZone(timezone);
        return slotDateTime.isValid && slotDateTime > nowInTz;
    }

    // === CORE CRUD METHODS ===

    // Add new availability slots
    async add(options?: { useServiceRole?: boolean; supabaseClient?: any }): Promise<AvailabilitySlotsData> {
        const supa = options?.supabaseClient || (options?.useServiceRole ? getEnvironmentServiceRoleClient() : await getEnvironmentServerClient());

        const availabilitySlots = {
            "businessId": this.data.businessId,
            "date": this.data.date,
            "slots": this.data.slots,
            "createdAt": new Date().toISOString()
        };
        
        if (options?.useServiceRole) {
            console.log('[AvailabilitySlots.add] Using service role client (bypasses RLS for business availability creation)');
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
            businessId: slot.data.businessId,
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

    // Get availability slots for a business and date range
    static async getByBusinessAndDateRange(
        businessId: string,
        startDate: string,
        endDate: string
    ): Promise<AvailabilitySlotsData[]> {
        const supa = await getEnvironmentServerClient();

        const { data, error } = await supa
            .from("availabilitySlots")
            .select("*")
            .eq("businessId", businessId)
            .gte("date", startDate)
            .lte("date", endDate);

        if (error) {
            handleModelError("Failed to fetch availability slots", error);
        }

        return data;
    }

    // Get availability slots for a business and specific date
    static async getByBusinessAndDate(
        businessId: string,
        date: string,
        options?: { useServiceRole?: boolean; supabaseClient?: any }
    ): Promise<AvailabilitySlotsData | null> {
        const supa = options?.supabaseClient || 
            (options?.useServiceRole ? getEnvironmentServiceRoleClient() : await getEnvironmentServerClient());
        
        if (options?.useServiceRole) {
            console.log('[AvailabilitySlots.getByBusinessAndDate] Using service role client (bypasses RLS for business availability retrieval)');
        }

        const { data, error } = await supa
            .from("availabilitySlots")
            .select("*")
            .eq("businessId", businessId)
            .eq("date", date)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // No data found
            }
            handleModelError("Failed to fetch business availability slots", error);
        }

        return data;
    }

    // Get next 3 chronologically available time slots for a business
    static async getNext3AvailableSlots(
        businessId: string,
        serviceDuration: number,
        daysToLookAhead: number = 14,
        businessTimezone: string = 'UTC'
    ): Promise<Array<{ date: string; time: string }>> {
        try {
            console.log(`[AvailabilitySlots] Getting next 3 slots for business ${businessId}, duration ${serviceDuration}, timezone ${businessTimezone}`);
            
            // Get availability for the specified date range
            const today = new Date();
            const endDate = new Date();
            endDate.setDate(today.getDate() + daysToLookAhead);
            
            const availabilityData = await this.getByBusinessAndDateRange(
                businessId,
                today.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0]
            );
            
            console.log(`[AvailabilitySlots] Found ${availabilityData.length} days of availability data`);
            
            // Find the smallest duration that can accommodate the service
            const suitableDuration = AvailabilitySlots.findSuitableDuration(serviceDuration);
            
            if (!suitableDuration) {
                console.log(`[AvailabilitySlots] No suitable duration found for ${serviceDuration} minutes`);
                return [];
            }
            
            const durationKey = suitableDuration.toString();
            console.log(`[AvailabilitySlots] Using duration ${durationKey} for service duration ${serviceDuration}`);
            
            // Collect all available slots chronologically, starting from the current time
            const allSlots: Array<{ date: string; time: string }> = [];
            const nowInBusinessTz = DateTime.now().setZone(businessTimezone);
            
            // Sort the availability data by date first
            availabilityData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            for (const dayData of availabilityData) {
                const slotsForDuration = AvailabilitySlots.getSlotsForDuration(dayData, suitableDuration);
                
                // Sort time slots to be sure
                const sortedTimeSlots = slotsForDuration.sort();
                
                for (const timeSlot of sortedTimeSlots) {
                    const [timeString, providerCount] = timeSlot; // Destructure the tuple
                    
                    // Only include slots that have available providers
                    if (providerCount > 0) {
                        const datePart = dayData.date.substring(0, 10); // Extract YYYY-MM-DD
                        
                        // Only consider slots that are in the future
                        if (AvailabilitySlots.isSlotInFuture(datePart, timeString, businessTimezone)) {
                            allSlots.push({
                                date: dayData.date,
                                time: timeString
                            });
                        }
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

    // Get available hours for a specific business, date and service duration
    static async getAvailableHoursForBusinessDate(
        businessId: string,
        date: string,
        serviceDuration: number
    ): Promise<string[]> {
        try {
            console.log(`[AvailabilitySlots] Getting hours for business ${businessId}, date ${date}, duration ${serviceDuration}`);
            
            const dayAvailability = await this.getByBusinessAndDate(businessId, date);
            
            if (!dayAvailability) {
                console.log(`[AvailabilitySlots] No availability data found for date ${date}`);
                return [];
            }
            
            // Find the smallest duration that can accommodate the service
            const suitableDuration = AvailabilitySlots.findSuitableDuration(serviceDuration);
            
            if (!suitableDuration) {
                console.log(`[AvailabilitySlots] No suitable duration found for ${serviceDuration} minutes`);
                return [];
            }
            
            const durationKey = suitableDuration.toString();
            console.log(`[AvailabilitySlots] Using duration ${durationKey} for service duration ${serviceDuration}`);
            
            const slots = AvailabilitySlots.getSlotsForDuration(dayAvailability, suitableDuration);
            // Filter slots that have at least 1 available provider
            const availableTimes = AvailabilitySlots.filterAvailableSlots(slots).map(([time]) => time);
            console.log(`[AvailabilitySlots] Found ${availableTimes.length} available times for date ${date}`);
            
            return availableTimes;
            
        } catch (error) {
            console.error('[AvailabilitySlots] Error getting available hours for business date:', error);
            return [];
        }
    }

    // Update availability slots
    static async update(
        businessId: string, 
        date: string, 
        slotsData: AvailabilitySlotsData,
        options?: { useServiceRole?: boolean; supabaseClient?: any }
    ): Promise<AvailabilitySlots> {
        const supa = options?.supabaseClient || 
            (options?.useServiceRole ? getEnvironmentServiceRoleClient() : await getEnvironmentServerClient());
        
        if (options?.useServiceRole) {
            console.log('[AvailabilitySlots.update] Using service role client (bypasses RLS for business availability update)');
        }
        
        const availabilitySlots = {
            "businessId": slotsData.businessId,
            "date": slotsData.date,
            "slots": slotsData.slots
        };
        
        const { data, error } = await supa
            .from("availabilitySlots")
            .update(availabilitySlots)
            .eq("businessId", businessId)
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
    static async delete(
        businessId: string, 
        date: string, 
        options?: { useServiceRole?: boolean; supabaseClient?: any }
    ): Promise<void> {
        const supa = options?.supabaseClient || 
            (options?.useServiceRole ? getEnvironmentServiceRoleClient() : await getEnvironmentServerClient());
        
        if (options?.useServiceRole) {
            console.log('[AvailabilitySlots.delete] Using service role client (bypasses RLS for business availability deletion)');
        }
        
        const { error } = await supa
            .from("availabilitySlots")
            .delete()
            .eq("businessId", businessId)
            .eq("date", date);

        if (error) {
            handleModelError("Failed to delete availability slots", error);
        }
    }

    // Delete all availability slots before a specific date
    static async deleteBefore(
        businessId: string, 
        beforeDate: string, 
        options?: { useServiceRole?: boolean }
    ): Promise<void> {
        const supa = options?.useServiceRole ? getEnvironmentServiceRoleClient() : await getEnvironmentServerClient();
        
        if (options?.useServiceRole) {
            console.log('[AvailabilitySlots.deleteBefore] Using service role client (bypasses RLS for business availability deletion)');
        }
        
        const { error } = await supa
            .from("availabilitySlots")
            .delete()
            .eq("businessId", businessId)
            .lt("date", beforeDate);

        if (error) {
            handleModelError("Failed to delete availability slots before date", error);
        }
    }

    // === INSTANCE HELPER METHODS ===

    // Helper method to get slots for a specific duration
    getSlotsForDuration(duration: string): Array<[string, number]> {
        return this.data.slots[duration] || [];
    }

    // Helper method to check if a specific time slot is available for a duration
    isSlotAvailable(time: string, duration: string): boolean {
        const slots = this.getSlotsForDuration(duration);
        return slots.some(([slotTime]) => slotTime === time);
    }

    // Helper method to get available provider count for a specific time and duration
    getAvailableProviderCount(time: string, duration: string): number {
        const slots = this.getSlotsForDuration(duration);
        const timeSlot = slots.find(([slotTime]) => slotTime === time);
        return timeSlot ? timeSlot[1] : 0;
    }

    // Helper method to get all available times for a duration (with provider count > 0)
    getAvailableTimesForDuration(duration: string): string[] {
        const slots = this.getSlotsForDuration(duration);
        return AvailabilitySlots.filterAvailableSlots(slots).map(([time]) => time);
    }

    // Helper method to decrease provider count for a specific time and duration
    decreaseProviderCount(time: string, duration: string, decreaseBy: number = 1): boolean {
        const slots = this.data.slots[duration] || [];
        const slotIndex = slots.findIndex(([slotTime]) => slotTime === time);
        
        if (slotIndex !== -1 && slots[slotIndex][1] >= decreaseBy) {
            slots[slotIndex][1] -= decreaseBy;
            // Remove the slot if no providers available
            if (slots[slotIndex][1] <= 0) {
                slots.splice(slotIndex, 1);
            }
            return true;
        }
        return false;
    }

    // Getters
    get businessId(): string { return this.data.businessId; }
    get date(): string { return this.data.date; }
    get slots(): { [key: string]: Array<[string, number]> } { return this.data.slots; }
    get createdAt(): string | undefined { return this.data.createdAt; }
} 