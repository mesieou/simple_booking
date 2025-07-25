// lib/models/events.ts

import { handleModelError } from '@/lib/general-helpers/error-handling/model-error-handler';
import { getEnvironmentServerClient } from "../supabase/environment";

export interface EventData {
    summary: string;
    description?: string;
    location?: string;
    startTime: string;
    endTime: string;
    status: string;
    userId: string;
}

export class Event {
    private data: EventData;

    constructor(data: EventData) {
        if (!data.startTime) handleModelError("Start time is required", new Error("Missing startTime"));
        if (!data.endTime) handleModelError("End time is required", new Error("Missing endTime"));
        if (!data.status) handleModelError("Status is required", new Error("Missing status"));
        if (!data.userId) handleModelError("User ID is required", new Error("Missing userId"));
        
        this.data = data;
    }

    //creates an Event in supa
    async add(): Promise<EventData> {
        const supa = await getEnvironmentServerClient();

        const event = {
            "summary": this.data.summary,
            "description": this.data.description,
            "location": this.data.location,
            "startTime": this.data.startTime,
            "endTime": this.data.endTime,
            "status": this.data.status,
            "userId": this.data.userId,
        }
        const { data, error } = await supa.from("events").insert(event).select().single();

        if(error) {
            handleModelError("Failed to create event", error);
        }

        if (!data) {
            handleModelError("Failed to create event: No data returned", new Error("No data returned from insert"));
        }

        this.data = data;
        return data;
    }

    // Get event by ID
    static async getById(id: string): Promise<Event> {
        if (!Event.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await getEnvironmentServerClient();
        const { data, error } = await supa.from("events").select("*").eq("id", id).single();
        
        if (error) {
            handleModelError("Failed to fetch event", error);
        }
        
        if (!data) {
            handleModelError(`Event with id ${id} not found`, new Error("Event not found"));
        }
        
        return new Event(data);
    }

    // Get events by user
    static async getByUser(userId: string): Promise<Event[]> {
        if (!Event.isValidUUID(userId)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await getEnvironmentServerClient();
        const { data, error } = await supa.from("events").select("*").eq("userId", userId);
        
        if (error) {
            handleModelError("Failed to fetch events by user", error);
        }
        
        return data.map(eventData => new Event(eventData));
    }

    // Get events by calendar
    static async getByCalendar(calendarId: string): Promise<Event[]> {
        if (!Event.isValidUUID(calendarId)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await getEnvironmentServerClient();
        const { data, error } = await supa.from("events").select("*").eq("calendarId", calendarId);
        
        if (error) {
            handleModelError("Failed to fetch events by calendar", error);
        }
        
        return data.map(eventData => new Event(eventData));
    }

    // Get events by date range
    static async getByDateRange(start: string, end: string): Promise<Event[]> {
        const supa = await getEnvironmentServerClient();
        const { data, error } = await supa
            .from("events")
            .select("*")
            .gte("startTime", start)
            .lte("endTime", end);
        
        if (error) {
            handleModelError("Failed to fetch events by date range", error);
        }
        
        return data.map(eventData => new Event(eventData));
    }

    // Update event
    static async update(id: string, eventData: EventData): Promise<Event> {
        if (!Event.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await getEnvironmentServerClient();
        const event = {
            "summary": eventData.summary,
            "description": eventData.description,
            "location": eventData.location,
            "startTime": eventData.startTime,
            "endTime": eventData.endTime,
            "status": eventData.status,
            "userId": eventData.userId,
        }
        
        const { data, error } = await supa
            .from("events")
            .update(event)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            handleModelError("Failed to update event", error);
        }

        if (!data) {
            handleModelError("Failed to update event: No data returned", new Error("No data returned from update"));
        }

        return new Event(data);
    }

    // Delete event
    static async delete(id: string): Promise<void> {
        if (!Event.isValidUUID(id)) {
            handleModelError("Invalid UUID format", new Error("Invalid UUID"));
        }

        const supa = await getEnvironmentServerClient();
        const { error } = await supa.from("events").delete().eq("id", id);

        if (error) {
            handleModelError("Failed to delete event", error);
        }
    }

    private static isValidUUID(id: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    }

    // Getters for the event data
    get summary(): string { return this.data.summary; }
    get description(): string | undefined { return this.data.description; }
    get location(): string | undefined { return this.data.location; }
    get startTime(): string { return this.data.startTime; }
    get endTime(): string { return this.data.endTime; }
    get status(): string { return this.data.status; }
    get userId(): string { return this.data.userId; }
}