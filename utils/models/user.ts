import { createClient } from "../supabase/client" 
import { Business } from "./business";

class User {
    firstName: string;
    lastName: string; 
    role: string;
    businessId: string;

    constructor( 
        firstName: string, 
        lastName: string, 
        role: string, 
        businessId: string, 
    ) {
         this.firstName = firstName;
         this.lastName = lastName;
         this.role = role;
         this.businessId = businessId;
    }

    //creates a user in supa
    async add() {
        //creates the connection with supabase
        const supa = createClient();   

        const user = {
            "firstName": this.firstName,
            "lastName": this.lastName,
            "role": this.role,
            "businessId": this.businessId,
        }
        const { data, error } = await supa.from("users").insert(user).select().single();

        //displays the error if the data fails to upload in supa or displays the succesful data
        if(error) {
            console.log("Error:", error);
        } else {
            console.log("Data succesfully loaded:", data);
        }
        return {data, error};
    }

}
export { User };
