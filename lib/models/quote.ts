import { Business } from "./business";
import { User } from "./user";
import { createClient } from "@/lib/supabase/client"
 
 //creates the connection with supabase
const supa = createClient();        

class Quote {
    id?: string;
    pickUp: string;
    dropOff: string; 
    baseFare: number;
    travelFare: number;
    userId: string;
    businessId: string;
    jobType: "one item" | "few items" | "house/apartment move";
    status: "pending" | "accepted" | "rejected";
    labourFare: number;
    total: number;

    constructor( 
        pickUp: string, 
        dropOff: string, 
        baseFare: number,
        travelFare: number,
        userId: string, 
        businessId: string,
        jobType: "one item" | "few items" | "house/apartment move",
        status: "pending" | "accepted" | "rejected",
        labourFare: number,
        total: number
    ) {
         this.pickUp = pickUp;
         this.dropOff = dropOff;
         this.baseFare = baseFare;
         this.travelFare = travelFare;
         this.userId = userId;
         this.businessId = businessId;
         this.jobType = jobType;
         this.status = status;
         this.labourFare = labourFare;
         this.total = total;
    }

    //creates a Quote in supa
    async add() {
        //ckecks if the user, providaer or quote do not have idd
        const quote = {
            "pickUp": this.pickUp,
            "dropOff": this.dropOff,
            "baseFare": this.baseFare,
            "travelFare": this.travelFare,
            "userId": this.userId,
            "businessId": this.businessId,
            "jobType": this.jobType,
            "status": this.status,
            "labourFare": this.labourFare,
            "total": this.total
        }
        const { data, error } = await supa.from("quotes").insert(quote).select().single();

        //displays the error if the data fails to upload in supa or displays the succesful data
        if(error) {
            console.log("Error:", error);
        } else {
            console.log("Data succesfully loaded:", data);
            this.id = data.id;
        }
        return {data, error};
    }

}

export { Quote };
