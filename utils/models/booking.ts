import { Business } from "./business";
import { User } from "./user";
import { Quote} from "./quote";
import { createClient } from "@/utils/supabase/client"
 
 //creates the connection with supabase
const supa = createClient();        

class Booking {
    timestampTz: string;
    status: string; 
    userId: string;
    providerId: string;
    quoteId: string;
    businessId: string;

    constructor( 
        timestampTz: string, 
        status: string, 
        userId: string, 
        providerId: string, 
        quoteId: string,
        businessId: string
    ) {
         this.timestampTz = timestampTz;
         this.status = status;
         this.userId = userId;
         this.providerId = providerId;
         this.quoteId = quoteId;
         this.businessId = businessId;
    }

    //creates a booking in supa
    async add() {

        const booking = {
            "timestampTz": this.timestampTz,
            "status": this.status,
            "userId": this.userId,
            "providerId": this.providerId,
            "quoteId": this.quoteId,
            "businessId": this.businessId
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

export { Booking };

