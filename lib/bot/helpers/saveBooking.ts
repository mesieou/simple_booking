import { createClient } from "@/lib/supabase/client"; 

const supabase = createClient();   

export type SaveBookingArgs = {
  userId: string | null;
  email: string;
  chatHistory: unknown;          // JSON history array
  pickupAddress: string;
  dropoffAddress: string;
  serviceDate: string;           // yyyy-mm-dd
  slotId: number;
};

export const saveBooking = async (args: SaveBookingArgs) => {
  const { error } = await supabase.from("user_bookings").insert({
    user_id: args.userId,
    email: args.email,
    chat_history: args.chatHistory,
    pickup_address: args.pickupAddress,
    dropoff_address: args.dropoffAddress,
    service_date: args.serviceDate,
    slot_id: args.slotId
  });

  if (error) throw new Error(error.message);
};
