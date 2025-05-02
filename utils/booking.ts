import { Business } from "./business";
import { User } from "./User";
import { Quote} from "./Quote";
import { createClient } from "@/utils/supabase/client"
 
 //creates the connection with supabase
const supa = createClient();        

class Booking {
    timestampTz: string;
    status: string; 
    user: User;
    provider: User;
    quote: Quote;
    business: Business;

    constructor( 
        timestampTz: string, 
        status: string, 
        user: User, 
        provider: User, 
        quote: Quote,
        business: Business
    ) {
         this.timestampTz = timestampTz;
         this.status = status;
         this.user = user;
         this.provider = provider;
         this.quote = quote;
         this.business = business;
    }

    //creates a booking in supa
    async add() {
        //ckecks if the user, providaer or quote do not have idd
        if (!this.user?.id || !this.provider?.id || !this.quote?.id) {
            throw new Error("Missing required IDs");
        } 
        
        const booking = {
            "timestampTz": this.timestampTz,
            "status": this.status,
            "userId": this.user.id,
            "providerId": this.provider.id,
            "quoteId": this.quote.id,
        }
        const { data, error } = await supa.from("bookings").insert(booking).select().single();

        //displays the error if the data fails to upload in supa or displays the succesful data
        if(error) {
            console.log("Error:", error);
        } else {
            console.log("Data succesfully loaded:", data);
        }
        return {data, error};
    }

}

