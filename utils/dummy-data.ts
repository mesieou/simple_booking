import { DateTime } from "luxon";

const numberUsers = 5;
const availableHours = 24;
const timezones =  [
  "Australia/Melbourne",
  "America/New_York",
  "Europe/London",
  "Asia/Tokyo",
  "America/Los Angeles"
];
const weekDays: string[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

let firstNames = [ "Paula", "Juan","Oscar", "Alberto", "Sam", "Daniel"];
let lastNames = ["Bernal", "Arroa", "Diaz", "Alvarez", "Smith", "Hanz"];
let roles = [ "business_owner", "client", "provider"];
let emails = [
    "bernal1@example.com",
    "arroa2@example.com",
    "diaz3@example.com",
    "alvarez4@example.com",
    "smith5@example.com",
    "hanz6@example.com"
];
let pickUps = [
  "12 Lygon Street, Carlton VIC 3053",
  "87 Chapel Street, South Yarra VIC 3141",
  "45 Bourke Street, Melbourne VIC 3000",
  "231 Swanston Street, Melbourne VIC 3000",
  "19 Kingsford Parade, Point Cook VIC 3030"
];
let dropOffs  = [
  "310 Clarendon Street, South Melbourne VIC 3205",
  "150 Bridge Road, Richmond VIC 3121",
  "68 Union Road, Ascot Vale VIC 3032",
  "9 Glenferrie Road, Malvern VIC 3144",
  "202 High Street, Preston VIC 3072"
];

let serviceRatePerMinutesSample = [1.5, 2.0];
let bookingsStatuses = ["Not completed", "Completed"];
let quoteStatuses = ["Not accepted", "Accepted"];

//generate a number of timestamps depenfing on the argument for a x number of days
function generateTimestampsTZ(
    daysOffSet: number = 0,
    count: number = 5,
    tz: string = "UTC"
): string[] {
    const timestamps: string[] = [];

    //loops count number of times and set the timezone given in the argument and add numers of days
    for(let i = 0; i < count; i++) {
        const dt = DateTime.now()
        .setZone(tz)
        .plus({days: daysOffSet + i});
        timestamps.push(dt.toISO() ?? "Invalid date");
    }

    return timestamps;
}

const getRandomTimeSlot = (): { start: string; end: string } => {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  
  // Generate a random start hour between 0 and 23
  const startHour = Math.floor(Math.random() * availableHours);
  
  // Generate a random end hour that is greater than startHour
  const endHour = Math.floor(Math.random() * (availableHours - startHour - 1)) + startHour + 1;

  return {
    start: `${pad(startHour)}:00`,
    end: `${pad(endHour)}:00`,
  };
};

//array holding n number of availabilities
let allAvailabilities: Array<Record<string, { start: string; end: string }>> = [];
 
// Loop to create 5 random availabilities for users
for (let i = 0; i < numberUsers; i++) {
  let availability: Record<string, { start: string; end: string }> = {}; // Store availability for each day

  // Loop through each day of the week (7 days)
  for (let j = 0; j < 7; j++) {
    let day = weekDays[j];
    let timeSlot = getRandomTimeSlot();
    
    // Store the time slot for the current day
    availability[day] = timeSlot;
  }

   // Push the user's availability into the array
   allAvailabilities.push(availability);

  // Output or use the availability data for each user
  console.log(`User ${i + 1} Availability:`);
  console.log(availability);
}