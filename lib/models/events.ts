// lib/models/events.ts

import { createClient } from "@/lib/supabase/server";

export interface EventData {
    summary: string;
    description?: string;
    location?: string;
    startTime: string;
    endTime: string;
    status: string;
    userId: string;

}

export class EventError extends Error {
    constructor(message: string, public originalError?: any) {
        super(message);
        this.name = 'EventError';
    }
}

export class Event {
    private data: EventData;

    constructor(data: EventData) {
        if (!data.startTime) throw new EventError("Start time is required");
        if (!data.endTime) throw new EventError("End time is required");
        if (!data.status) throw new EventError("Status is required");
        if (!data.userId) throw new EventError("User ID is required");
        
        this.data = data;
    }

    //creates an Event in supa
    async add(): Promise<EventData> {
        const supa = createClient();

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
            throw new EventError("Failed to create event", error);
        }

        if (!data) {
            throw new EventError("Failed to create event: No data returned");
        }

        this.data = data;
        return data;
    }

    // Get event by ID
    static async getById(id: string): Promise<Event> {
        if (!Event.isValidUUID(id)) {
            throw new EventError("Invalid UUID format");
        }

        const supa = createClient();
        const { data, error } = await supa.from("events").select("*").eq("id", id).single();
        
        if (error) {
            throw new EventError("Failed to fetch event", error);
        }
        
        if (!data) {
            throw new EventError(`Event with id ${id} not found`);
        }
        
        return new Event(data);
    }

    // Get events by user
    static async getByUser(userId: string): Promise<Event[]> {
        if (!Event.isValidUUID(userId)) {
            throw new EventError("Invalid UUID format");
        }

        const supa = createClient();
        const { data, error } = await supa.from("events").select("*").eq("userId", userId);
        
        if (error) {
            throw new EventError("Failed to fetch events by user", error);
        }
        
        return data.map(eventData => new Event(eventData));
    }

    // Get events by calendar
    static async getByCalendar(calendarId: string): Promise<Event[]> {
        if (!Event.isValidUUID(calendarId)) {
            throw new EventError("Invalid UUID format");
        }

        const supa = createClient();
        const { data, error } = await supa.from("events").select("*").eq("calendarId", calendarId);
        
        if (error) {
            throw new EventError("Failed to fetch events by calendar", error);
        }
        
        return data.map(eventData => new Event(eventData));
    }

    // Get events by date range
    static async getByDateRange(start: string, end: string): Promise<Event[]> {
        const supa = createClient();
        const { data, error } = await supa
            .from("events")
            .select("*")
            .gte("startTime", start)
            .lte("endTime", end);
        
        if (error) {
            throw new EventError("Failed to fetch events by date range", error);
        }
        
        return data.map(eventData => new Event(eventData));
    }

    // Update event
    static async update(id: string, eventData: EventData): Promise<Event> {
        if (!Event.isValidUUID(id)) {
            throw new EventError("Invalid UUID format");
        }

        const supa = createClient();
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
            throw new EventError("Failed to update event", error);
        }

        if (!data) {
            throw new EventError("Failed to update event: No data returned");
        }

        return new Event(data);
    }

    // Delete event
    static async delete(id: string): Promise<void> {
        if (!Event.isValidUUID(id)) {
            throw new EventError("Invalid UUID format");
        }

        const supa = createClient();
        const { error } = await supa.from("events").delete().eq("id", id);

        if (error) {
            throw new EventError("Failed to delete event", error);
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