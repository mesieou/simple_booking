import { createClient } from "@/lib/supabase/client"

class Business {
    name: string;
    email: string; 
    phone: string;
    timeZone: string;
    serviceRatePerMinute: number;

    constructor(
        name: string, 
        email: string, 
        phone: string, 
        timeZone: string, 
        serviceRatePerMinute: number
    ) {
         this.name = name;
         this.email = email;
         this.phone = phone;
         this.timeZone = timeZone;
         this.serviceRatePerMinute = serviceRatePerMinute;
    }

    //creates a business in supa
    async add() {
        //creates the connection with supabase
        const supa = createClient();   

        const business = {
            "name": this.name,
            "email": this.email,
            "phone": this.phone,
            "timeZone": this.timeZone,
            "serviceRatePerMinute": this.serviceRatePerMinute
        }
        
        const { data, error } = await supa.from("businesses").insert(business).select().single();

        //displays the error if the data fails to upload in supa or displays the succesful data
        if(error) {
            console.log("Error:", error);
        } else {
            console.log("Data succesfully loaded:", data);
        }
        return {data, error};
    }

}
export { Business };
