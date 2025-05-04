import { Business } from "./models/business";
import { User } from "./models/user"
import { Quote } from "./models/quote"
import { Booking } from "./models/booking"
import { DateTime } from "luxon";

const availableHours = 24;
const weekDays: string[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

//businessNames, emails and phones data stored in an object
const data: { 
    businessNames: string[], 
    emails: string[], 
    phones: string[], 
    timezones: string[],
    firstNames: string[],
    lastNames: string[]
 } = {
    businessNames: [
      "Swift Haul",
      "CleanNest Services",
      "BrightPath Tutoring",
      "FixIt Tradies",
      "GreenThumb Landscaping",
      "MoveMate Removals",
      "CodeNest Solutions",
      "UrbanPet Groomers",
      "PeakFit Trainers",
      "SnapBakery"
    ],
    emails: [
        "info@swifthaul.com",
        "support@cleannestservices.com",
        "hello@brightpathtutoring.com",
        "contact@fixittradies.com",
        "service@greenthumblandscaping.com",
        "bookings@movemateremovals.com",
        "team@codenestsolutions.com",
        "grooming@urbanpet.com",
        "trainers@peakfit.com",
        "orders@snapbakery.com"
      ],
      phones: [
        "+61 400 123 456",
        "+61 400 234 567",
        "+61 400 345 678",
        "+61 400 456 789",
        "+61 400 567 890",
        "+61 400 678 901",
        "+61 400 789 012",
        "+61 400 890 123",
        "+61 400 901 234",
        "+61 400 012 345"
      ],
      timezones:  [
        "Australia/Melbourne",
        "America/New_York",
        "Europe/London",
        "Asia/Tokyo",
        "America/Los Angeles"
      ],
      firstNames: [ 
        "Paula", 
        "Juan",
        "Oscar", 
        "Alberto", 
        "Sam", 
        "Daniel"
      ],
      lastNames: [
        "Bernal", 
        "Arroa", 
        "Diaz", 
        "Alvarez", 
        "Smith", 
        "Hanz"
      ]
  };

function createsRandomData(data: { [key: string]: string[] }, type:string) {
    if (type == "name") {
        return data.businessNames[Math.floor(Math.random() * data.businessNames.length)];
    } else if (type == "email") {
        return data.emails[Math.floor(Math.random() * data.emails.length)];
    } else if(type == "phone") {
        return data.phones[Math.floor(Math.random() * data.phones.length)];
    } else if(type == "timezone") {
        return data.timezones[Math.floor(Math.random() * data.timezones.length)];
    } else if(type == "lastName") {
        return data.timezones[Math.floor(Math.random() * data.lastName.length)];
    } else if(type == "firtName") {
        return data.timezones[Math.floor(Math.random() * data.firstName.length)];
    } else {
        throw new Error(`Invalid type: ${type}`);
    }
}

//creates a random service rate per minute
function getRandomRate(): number {
    const min = 1.50;
    const max = 2.50;
    return Math.random() * (max - min) + min;
}

//create random addresses in Melbourne
function generateRandomMelbourneAddress(): string {
    // Real Melbourne street names (CBD and inner suburbs)
    const streets = [
      "Collins St", "Bourke St", "Swanston St", "Flinders St", 
      "Elizabeth St", "Lonsdale St", "Russell St", "Exhibition St",
      "King St", "William St", "Queen St", "Little Collins St",
      "Spencer St", "La Trobe St", "Spring St", "Market St"
    ];
  
    // Melbourne suburbs with their postcodes
    const suburbs = [
      { name: "Melbourne", postcode: "3000" },  // CBD
      { name: "Southbank", postcode: "3006" },
      { name: "Docklands", postcode: "3008" },
      { name: "Carlton", postcode: "3053" },
      { name: "East Melbourne", postcode: "3002" }
    ];
  
    // Generate random components
    const streetNumber = Math.floor(Math.random() * 300) + 1;
    const street = streets[Math.floor(Math.random() * streets.length)];
    const suburb = suburbs[Math.floor(Math.random() * suburbs.length)];
  
    return `${streetNumber} ${street}, ${suburb.name} VIC ${suburb.postcode}`;
}

//create random base fare 
 function getRandomBaseFare(): number {
    const min = 50;
    const max = 200;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

//generate a number of timestamps depenfing on the argument for a x number of days
function generateRandomTimestampTz(
    daysOffset: number = 0,
    tz: string = "UTC"
  ): string {
    // Generate random time within business hours (9AM-5PM)
    const randomHour = Math.floor(Math.random() * 9) + 9;  // 9-17
    const randomMinute = Math.floor(Math.random() * 4) * 15;  // 0, 15, 30, or 45
    
    const dt = DateTime.now()
      .setZone(tz)
      .plus({ days: daysOffset })
      .set({
        hour: randomHour,
        minute: randomMinute,
        second: 0,
        millisecond: 0
      });
  
    // Return as PostgreSQL-compatible timestampTz format
    return dt.toFormat("yyyy-MM-dd HH:mm:ssZZ");
  }

const getRandomTimeSlot = (): { start: string; end: string } => {
    const pad = (n: number): string => n.toString().padStart(2, '0');
    // enerate a random start hour between 0 and 23
    const startHour = Math.floor(Math.random() * availableHours);

    // Generate a random end hour that is greater than startHour
    const endHour = Math.floor(Math.random() * (availableHours - startHour - 1)) + startHour + 1;

    return {
    start: `${pad(startHour)}:00`,
    end: `${pad(endHour)}:00`,
    };
};

function generateSinglePersonAvailability(): Record<string, { start: string; end: string }> {
    const availability: Record<string, { start: string; end: string }> = {};
    
    // Generate slots for all 7 days
    for (const day of weekDays) {
      availability[day] = getRandomTimeSlot();
    }
    
    return availability;
  }
//push any object into the database
async function addObjectToDataBase(obj:any) {
    try {
        const { data: objData, error: objError } = await obj.add();

        //displays the database message whether it is successful or unsuccessful
        if (objError) {
            throw new Error(`Failed to add business: ${objError.message}`);
          }
          console.log('Business added successfully:', objData);
          return objData;
        } catch (error) {
          console.error('Error adding business:', error);
          throw error; // Re-throw for caller to handle
        }
}

// creates all the dummy data
async function createData(): Promise<void> {
    
    //creates all random data
    let randomName = createsRandomData(data, "name");
    let randomEmail = createsRandomData(data, "email");
    let randomPhone = createsRandomData(data, "phone");
    let randomTimezone = createsRandomData(data, "timezone");
    let randomFirstName = createsRandomData(data, "firtName");
    let randomLastName = createsRandomData(data, "lastName");
    let randomRate = getRandomRate();
    let randomWorkingHours = generateSinglePersonAvailability()
    let randomAddress = generateRandomMelbourneAddress()
    let randomBaseFare = getRandomBaseFare()
    let randomTimeStampTz = generateRandomTimestampTz()
    //create the business business object
    let newBusiness = new Business(
        randomName,
        randomEmail,
        randomPhone,
        randomTimezone,
        randomWorkingHours,
        randomRate
    )
    // adds the business to the database and return the data with the id  
    let businessData = await addObjectToDataBase(newBusiness);
    
    //create a user
    let newUser = new User(
        "Owner",
        randomFirstName,
        randomLastName,
        businessData.id
    )
    
    // adds the user to the database and return the data with the id  
    let userData = await addObjectToDataBase(newUser);
    
    //create a provider
    let newProvider = new User(
        "Provider",
        randomFirstName,
        randomLastName,
        businessData.id
    )
    
    // adds the user to the database and return the data with the id  
    let providerData = await addObjectToDataBase(newProvider);
    
    //creates a random quote object
    let newQuote = new Quote(
        randomAddress,
        randomAddress,
        randomBaseFare,
        userData.id,
        businessData.id,
    )
    
    // adds the quote to the database and return the data with the id  
    let quoteData = await addObjectToDataBase(newQuote);
    
    //creates a new booking
    let newBooking = new Booking(
        randomTimeStampTz,
        "Not Completed",
        userData.id,
        providerData.id,
        quoteData.id,
        businessData.id
    )
    
    // adds the booking to the database and return the data with the id  
    let bookingData = await addObjectToDataBase(newBooking);
}

//initialises the process of creating all the models and sending them to the database
createData()