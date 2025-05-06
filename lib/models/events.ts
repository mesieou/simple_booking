// lib/models/event.ts

import { createClient } from "@/lib/supabase/client";

class Event {
  Id?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
  Summary: string;
  Description?: string;
  Location?: string;
  StartTime: string;
  EndTime: string;
  Status: string;
  UserId: string;
  CalendarId: string;

  constructor(
    summary: string,
    startTime: string,
    endTime: string,
    status: string,
    userId: string,
    calendarId: string,
    description?: string,
    location?: string,
    id?: string,
    createdAt?: string,
    updatedAt?: string
  ) {
    this.Summary = summary;
    this.StartTime = startTime;
    this.EndTime = endTime;
    this.Status = status;
    this.UserId = userId;
    this.CalendarId = calendarId;
    this.Description = description;
    this.Location = location;
    this.Id = id;
    this.CreatedAt = createdAt;
    this.UpdatedAt = updatedAt;
  }

  // Save (insert) the event in Supabase
  async add() {
    const supa = createClient();
    const event = {
      Summary: this.Summary,
      Description: this.Description,
      Location: this.Location,
      StartTime: this.StartTime,
      EndTime: this.EndTime,
      Status: this.Status,
      UserId: this.UserId,
      CalendarId: this.CalendarId,
      CreatedAt: this.CreatedAt ?? new Date().toISOString(),
      UpdatedAt: this.UpdatedAt ?? new Date().toISOString(),
    };
    const { data, error } = await supa.from("Events").insert(event).select().single();

    if (error) {
      console.log("Error:", error);
    } else {
      console.log("Event successfully loaded:", data);
      this.Id = data.Id;
    }
    return { data, error };
  }

  // Static method to get all events for a user
  static async getByUser(userId: string) {
    const supa = createClient();
    const { data, error } = await supa.from("Events").select("*").eq("UserId", userId);
    if (error) {
      console.log("Error fetching events:", error);
      throw error;
    }
    return data;
  }

  // Static method to get all events for a calendar
  static async getByCalendar(calendarId: string) {
    const supa = createClient();
    const { data, error } = await supa.from("Events").select("*").eq("CalendarId", calendarId);
    if (error) {
      console.log("Error fetching events:", error);
      throw error;
    }
    return data;
  }

  // Static method to get events for a user on a specific day
  static async getByUserAndDate(userId: string, date: string) {
    const supa = createClient();
    const { data, error } = await supa
      .from("Events")
      .select("*")
      .eq("UserId", userId)
      .gte("StartTime", date + "T00:00:00.000Z")
      .lt("StartTime", date + "T23:59:59.999Z");
    if (error) {
      console.log("Error fetching events:", error);
      throw error;
    }
    return data;
  }
}

export { Event };