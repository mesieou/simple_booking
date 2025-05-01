import { DateTime } from "luxon";

import { createBrowserClient } from "@supabase/ssr";

const numberUsers = 5;
const timezones =  [
  "Australia/Melbourne",
  "America/New_York",
  "Europe/London",
  "Asia/Tokyo",
  "America/Los Angeles"
];

let firstNames = [ "Paula", "Juan","Oscar", "Alberto", "Sam", "Daniel"];
let lastNames = ["Bernal", "Arroa", "Diaz", "Alvarez", "Smith", "Hanz"];
let roles = [ "business_owner", "client", "provider"];
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

let baseFareRange = [1.5, 2.0];
let bookingsStatuses = ["Not completed", "Completed"];
let quoteStatuses = ["Not accepted", "Accepted"];


export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );