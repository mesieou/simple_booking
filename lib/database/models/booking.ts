import { createClient } from "../supabase/server";
import { handleModelError } from '@/lib/general-helpers/error';

export type BookingStatus = "Not Completed" | "In Progress" | "Completed";

export interface BookingData {
    status: BookingStatus;
    userId: string;
    providerId: string;
    quoteId: string;
    businessId: string;
    dateTime: string; // ISO string format for timestamp
}

export class Booking {
    private data: BookingData & { id: string };

    constructor(data: BookingData) {
        if (!data.status) handleModelError("Status is required", new Error("Missing status"));
        if (!data.userId) handleModelError("User ID is required", new Error("Missing userId"));
        if (!data.providerId) handleModelError("Provider ID is required", new Error("Missing providerId"));
        if (!data.quoteId) handleModelError("Quote ID is required", new Error("Missing quoteId"));
        if (!data.businessId) handleModelError("Business ID is required", new Error("Missing businessId"));
        if (!data.dateTime) handleModelError("DateTime is required", new Error("Missing dateTime"));
        
        this.data = { ...data, id: '' };
    }

    //creates a Booking in supa
    async add(): Promise<BookingData> {
        const supa = await createClient();

        const booking = {
            "status": this.data.status,
            "userId": this.data.userId,
            "providerId": this.data.providerId,
            "quoteId": this.data.quoteId,
            "businessId": this.data.businessId,
            "dateTime": this.data.dateTime,
        }
        const { data, error } = await supa.from("bookings").insert(booking).select().single();

        if(error) {
            handleModelError("Failed to create booking", error);
        }

        if (!data) {
            handleModelError("Failed to create booking: No data returned", new Error("No data returned from insert"));
        }
        return data;
    }

    // Get booking by ID
    static async getById(id: string): Promise<Booking> {
        if (!Booking.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await createClient();
        const { data, error } = await supa.from("bookings").select("*").eq("id", id).single();
        
        if (error) {
            handleModelError("Failed to fetch booking", error);
        }
        
        if (!data) {
            handleModelError(`Booking with id ${id} not found`, new Error("Booking not found"));
        }
        
        return new Booking(data);
    }

    private static async queryBookings(
        column: string,
        value: string,
        errorMessage: string
    ): Promise<Booking[]> {
        if (!Booking.isValidUUID(value)) {
            handleModelError(`Invalid UUID format for ${column}`, new Error("Invalid UUID"));
        }

        const supa = await createClient();
        const { data, error } = await supa.from("bookings").select("*").eq(column, value);
        
        if (error) {
            handleModelError(errorMessage, error);
        }
        
        return data.map(bookingData => new Booking(bookingData));
    }

    static async getByUser(userId: string): Promise<Booking[]> {
        return this.queryBookings("userId", userId, "Failed to fetch bookings by user");
    }

    static async getByProvider(providerId: string): Promise<Booking[]> {
        return this.queryBookings("providerId", providerId, "Failed to fetch bookings by provider");
    }

    static async getByBusiness(businessId: string): Promise<Booking[]> {
        return this.queryBookings("businessId", businessId, "Failed to fetch bookings by business");
    }

    static async getByQuote(quoteId: string): Promise<Booking[]> {
        return this.queryBookings("quoteId", quoteId, "Failed to fetch bookings by quote");
    }

    static async getByProviderAndDateRange(
        providerId: string,
        startDate: Date,
        endDate: Date
    ): Promise<Booking[]> {
        if (!Booking.isValidUUID(providerId)) {
            handleModelError("Invalid UUID format for providerId", new Error("Invalid UUID"));
        }

        const supa = await createClient();
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

    // Update booking
    static async update(id: string, bookingData: BookingData): Promise<Booking> {
        if (!Booking.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await createClient();
        const booking = {
            "status": bookingData.status,
            "userId": bookingData.userId,
            "providerId": bookingData.providerId,
            "quoteId": bookingData.quoteId,
            "businessId": bookingData.businessId,
            "dateTime": bookingData.dateTime,
        }
        
        const { data, error } = await supa
            .from("bookings")
            .update(booking)
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

    // Delete booking
    static async delete(id: string): Promise<void> {
        if (!Booking.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await createClient();
        const { error } = await supa.from("bookings").delete().eq("id", id);

        if (error) {
            handleModelError("Failed to delete booking", error);
        }
    }

    private static isValidUUID(id: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    }

    // Getters for the booking data
    get status(): BookingStatus { return this.data.status; }
    get userId(): string { return this.data.userId; }
    get providerId(): string { return this.data.providerId; }
    get quoteId(): string { return this.data.quoteId; }
    get businessId(): string { return this.data.businessId; }
    get dateTime(): string { return this.data.dateTime; }
    get id(): string { return this.data.id; }
}

