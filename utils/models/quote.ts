import { Business } from "./business";
import { User } from "./user";
import { createClient } from "@/utils/supabase/client"
 
 //creates the connection with supabase
const supa = createClient();        

class Quote {
    pickUp: string;
    dropOff: string; 
    baseFare: number;
    userId: string;
    businessId: string;

    constructor( 
        pickUp: string, 
        dropOff: string, 
        baseFare: number,
        userId: string, 
        businessId: string
    ) {
         this.pickUp = pickUp;
         this.dropOff = dropOff;
         this.baseFare = baseFare;
         this.userId = userId;
         this.businessId = businessId;
    }

    //creates a Quote in supa
    async add() {
        //ckecks if the user, providaer or quote do not have idd
        const quote = {
            "pickUp": this.pickUp,
            "dropOff": this.dropOff,
            "baseFare": this.baseFare,
            "userId": this.userId,
            "businessId": this.businessId
        }
        const { data, error } = await supa.from("quotes").insert(quote).select().single();

        //displays the error if the data fails to upload in supa or displays the succesful data
        if(error) {
            console.log("Error:", error);
        } else {
            console.log("Data succesfully loaded:", data);
        }
        return {data, error};
    }

}

export { Quote };
