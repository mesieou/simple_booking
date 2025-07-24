import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "../supabase/environment";
import { handleModelError } from '@/lib/general-helpers/error';
import { updateDayAggregatedAvailability } from "@/lib/general-helpers/availability";
import { User } from "./user";
import { Business } from "./business";
import { Quote } from "./quote";
import { DateTime } from "luxon";

export type BookingStatus = "Not Completed" | "In Progress" | "Completed";

export interface BookingData {
    status: BookingStatus;
    userId: string;
    providerId: string;
    quoteId: string;
    businessId: string;
    dateTime: string; // ISO string format for timestamp
}

export interface BookingDataWithId extends BookingData {
    id: string;
}

export class Booking {
    private data: BookingDataWithId;

    constructor(data: BookingData & { id?: string }) {
        this.validateBookingData(data);
        this.data = { ...data, id: data.id || '' };
    }

    // ===== PRIVATE VALIDATION HELPERS =====

    private validateBookingData(data: BookingData & { id?: string }): void {
        const requiredFields = [
            { field: 'status', value: data.status, message: 'Status is required' },
            { field: 'userId', value: data.userId, message: 'User ID is required' },
            { field: 'providerId', value: data.providerId, message: 'Provider ID is required' },
            { field: 'quoteId', value: data.quoteId, message: 'Quote ID is required' },
            { field: 'businessId', value: data.businessId, message: 'Business ID is required' },
            { field: 'dateTime', value: data.dateTime, message: 'DateTime is required' }
        ];

        for (const { field, value, message } of requiredFields) {
            if (!value) {
                handleModelError(message, new Error(`Missing ${field}`));
            }
        }
    }

    private static validateUUID(id: string, context = 'UUID'): void {
        if (!Booking.isValidUUID(id)) {
            handleModelError(`Invalid UUID format for ${context}`, new Error("Invalid UUID"));
        }
    }

    private static isValidUUID(id: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    }

    // ===== CORE CRUD OPERATIONS =====

    /**
     * Creates a new booking in the database and automatically updates business availability
     */
    async add(): Promise<BookingDataWithId> {
        const supa = await getEnvironmentServerClient();

        const bookingToInsert = {
            status: this.data.status,
            userId: this.data.userId,
            providerId: this.data.providerId,
            quoteId: this.data.quoteId,
            businessId: this.data.businessId,
            dateTime: this.data.dateTime,
        };

        const { data, error } = await supa
            .from("bookings")
            .insert(bookingToInsert)
            .select()
            .single();

        if (error) {
            handleModelError("Failed to create booking", error);
        }

        if (!data) {
            handleModelError("Failed to create booking: No data returned", new Error("No data returned from insert"));
        }

        // Update internal data with the returned ID
        this.data = data;

        // Non-blocking call to update business availability
        this.updateBusinessAvailability(data).catch(error => {
            console.error(`[Booking.add] Availability update failed for booking ${data.id}:`, error);
        });

        return data;
    }

    /**
     * Updates business aggregated availability after booking is created
     */
    private async updateBusinessAvailability(bookingData: BookingDataWithId): Promise<void> {
        try {
            const [business, quote] = await Promise.all([
                Business.getById(bookingData.businessId),
                Quote.getById(bookingData.quoteId)
            ]);

            const bookingDate = DateTime.fromISO(bookingData.dateTime, { zone: business.timeZone });

            console.log(`[Booking.updateBusinessAvailability] Updating availability for booking on ${bookingDate.toISODate()}`);

            await updateDayAggregatedAvailability(
                bookingData.businessId,
                bookingDate.toJSDate(),
                bookingData.dateTime,
                quote.totalJobDurationEstimation,
                { useServiceRole: true }
            );

            console.log(`[Booking.updateBusinessAvailability] Successfully updated availability for business ${bookingData.businessId}`);
        } catch (error) {
            console.error(`[Booking.updateBusinessAvailability] Error:`, error);
            throw error;
        }
    }

    /**
     * Updates an existing booking
     */
    static async update(id: string, bookingData: BookingData): Promise<Booking> {
        Booking.validateUUID(id, 'booking ID');

        const supa = await getEnvironmentServerClient();
        
        const bookingToUpdate = {
            status: bookingData.status,
            userId: bookingData.userId,
            providerId: bookingData.providerId,
            quoteId: bookingData.quoteId,
            businessId: bookingData.businessId,
            dateTime: bookingData.dateTime,
        };
        
        const { data, error } = await supa
            .from("bookings")
            .update(bookingToUpdate)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            handleModelError("Failed to update booking", error);
        }

        if (!data) {
            handleModelError("Failed to update booking: No data returned", new Error("No data returned from update"));
        }

        return new Booking(data);
    }

    /**
     * Deletes a booking by ID
     */
    static async delete(id: string): Promise<void> {
        Booking.validateUUID(id, 'booking ID');

        const supa = await getEnvironmentServerClient();
        const { error } = await supa.from("bookings").delete().eq("id", id);

        if (error) {
            handleModelError("Failed to delete booking", error);
        }
    }

    // ===== QUERY OPERATIONS =====

    /**
     * Gets a booking by ID
     */
    static async getById(id: string): Promise<Booking> {
        Booking.validateUUID(id, 'booking ID');

        const supa = await getEnvironmentServerClient();
        const { data, error } = await supa
            .from("bookings")
            .select("*")
            .eq("id", id)
            .single();
        
        if (error) {
            handleModelError("Failed to fetch booking", error);
        }
        
        if (!data) {
            handleModelError(`Booking with id ${id} not found`, new Error("Booking not found"));
        }
        
        return new Booking(data);
    }

    /**
     * Generic method for querying bookings by a specific column
     */
    private static async queryBookings(
        column: string,
        value: string,
        errorMessage: string
    ): Promise<Booking[]> {
        Booking.validateUUID(value, column);

        const supa = await getEnvironmentServerClient();
        const { data, error } = await supa
            .from("bookings")
            .select("*")
            .eq(column, value);
        
        if (error) {
            handleModelError(errorMessage, error);
        }
        
        return data.map(bookingData => new Booking(bookingData));
    }

    /**
     * Gets all bookings for a specific user
     */
    static async getByUser(userId: string): Promise<Booking[]> {
        return this.queryBookings("userId", userId, "Failed to fetch bookings by user");
    }

    /**
     * Gets all bookings for a specific provider
     */
    static async getByProvider(providerId: string): Promise<Booking[]> {
        return this.queryBookings("providerId", providerId, "Failed to fetch bookings by provider");
    }

    /**
     * Gets all bookings for a specific business
     */
    static async getByBusiness(businessId: string): Promise<Booking[]> {
        return this.queryBookings("businessId", businessId, "Failed to fetch bookings by business");
    }

    /**
     * Gets all bookings for a specific quote
     */
    static async getByQuote(quoteId: string): Promise<Booking[]> {
        return this.queryBookings("quoteId", quoteId, "Failed to fetch bookings by quote");
    }

    /**
     * Gets bookings for a provider within a date range
     * Note: Used by availability system for calculating booking conflicts
     */
    static async getByProviderAndDateRange(
        providerId: string,
        startDate: Date,
        endDate: Date
    ): Promise<Booking[]> {
        Booking.validateUUID(providerId, 'provider ID');

        const supa = await getEnvironmentServerClient();
        const { data, error } = await supa
            .from("bookings")
            .select("*")
            .eq("providerId", providerId)
            .gte("dateTime", startDate.toISOString())
            .lte("dateTime", endDate.toISOString());
        
        if (error) {
            handleModelError("Failed to fetch bookings by provider and date range", error);
        }
        
        return data.map(bookingData => new Booking(bookingData));
    }

    // ===== GETTERS =====

    get status(): BookingStatus { return this.data.status; }
    get userId(): string { return this.data.userId; }
    get providerId(): string { return this.data.providerId; }
    get quoteId(): string { return this.data.quoteId; }
    get businessId(): string { return this.data.businessId; }
    get dateTime(): string { return this.data.dateTime; }
    get id(): string { return this.data.id; }
}

