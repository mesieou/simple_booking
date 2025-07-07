import { simulateWebhookPost } from "./utils";
import { ChatSession } from "@/lib/database/models/chat-session";
import { UserContext } from "@/lib/database/models/user-context";
import { BOT_CONFIG } from "@/lib/bot-engine/types";
import { deleteUserByWhatsapp, deleteChatSessionsForUser } from "./dbUtils";
import { TEST_CONFIG, getNormalizedTestPhone } from "../config/test-config";
import { Service } from "@/lib/database/models/service";

const TEST_PHONE = TEST_CONFIG.TEST_PHONE_NUMBER;
const BUSINESS_ID = TEST_CONFIG.BUSINESS_ID;
const TEST_USER_NAME = TEST_CONFIG.TEST_USER_NAME;

async function setupUser() {
  await deleteChatSessionsForUser(TEST_PHONE);
  await deleteUserByWhatsapp(TEST_PHONE);
  const first = await simulateWebhookPost({
    phone: TEST_PHONE,
    message: "Hola",
  });
  expect(JSON.stringify(first)).toMatch(/success/i);
  const second = await simulateWebhookPost({
    phone: TEST_PHONE,
    message: TEST_USER_NAME,
  });
  expect(JSON.stringify(second)).toMatch(/success/i);
}

async function cleanupAll() {
  await deleteChatSessionsForUser(TEST_PHONE);
  await deleteUserByWhatsapp(TEST_PHONE);
  const ctx = await UserContext.getByChannelUserIdAndBusinessId(
    getNormalizedTestPhone(),
    BUSINESS_ID,
  );
  if (ctx) await UserContext.delete(ctx.id);
}

async function sendAndGetResponse(message: string): Promise<string> {
  const resp = await simulateWebhookPost({ phone: TEST_PHONE, message });
  expect(JSON.stringify(resp)).toMatch(/success/i);
  const session = await ChatSession.getActiveByChannelUserId(
    "whatsapp",
    getNormalizedTestPhone(),
    BOT_CONFIG.SESSION_TIMEOUT_HOURS,
  );
  expect(session).not.toBeNull();
  const last = session!.allMessages[session!.allMessages.length - 1];
  const botContent =
    typeof last.content === "string"
      ? last.content
      : (last.content as any)?.text || "";
  return botContent;
}

describe("FAQ System Integration Tests - Beauty Asiul", () => {
  beforeAll(async () => {
    await cleanupAll();
    await setupUser();
  });

  afterAll(async () => {
    await cleanupAll();
  });

  beforeEach(async () => {
    await deleteChatSessionsForUser(TEST_PHONE);
  });

  describe("Service Availability - Multiple Variations", () => {
    it(
      "gel manicure inquiries - multiple variations",
      async () => {
        const variations = [
          "Do you do gel manicures?",
          "gel nails?",
          "shellac manicure available?",
          "how much for gel polish?",
          "gel manicure price?",
          "do u do gel stuff?",
          "gel mani cost?",
        ];
        for (const q of variations) {
          const text = await sendAndGetResponse(q);
          expect(text.toLowerCase()).toMatch(/gel/);
          expect(text).toMatch(/40/);
          expect(text).toMatch(/60/);
        }
      },
      TEST_CONFIG.TIMEOUT_SECONDS * 1000 * 8,
    );

    let services: { name: string; price: number; duration: number }[] = [];

    beforeAll(async () => {
      const all = await Service.getByBusiness(BUSINESS_ID);
      services = all.map((s) => ({
        name: s.name,
        price: s.fixedPrice ?? 0,
        duration: s.durationEstimate,
      }));
    });

    it(
      "responds with correct info for each service",
      async () => {
        for (const service of services) {
          const text = await sendAndGetResponse(
            `Do you offer ${service.name}?`,
          );
          expect(text).toMatch(new RegExp(String(service.price)));
          expect(text).toMatch(new RegExp(String(service.duration)));
        }
      },
      TEST_CONFIG.TIMEOUT_SECONDS * 1000 * 12,
    );
  });

  describe("Service Unavailability - Clear Rejections", () => {
    it(
      "states unavailable services politely",
      async () => {
        const unavailable = [
          "do you do massages?",
          "facial treatments?",
          "eyebrow threading?",
          "mens haircuts?",
          "acrylic nails?",
          "waxing services?",
          "makeup application?",
          "eyelash extensions?",
          "tattoo removal?",
          "piercing?",
        ];
        for (const q of unavailable) {
          const text = await sendAndGetResponse(q);
          expect(text.toLowerCase()).toMatch(/don\'t|not.*offer/);
        }
      },
      TEST_CONFIG.TIMEOUT_SECONDS * 1000 * 10,
    );
  });

  describe("Mobile Service Confusion", () => {
    it(
      "clearly explains no mobile services",
      async () => {
        const mobileQs = [
          "can you come to my house?",
          "do you do mobile?",
          "home visit available?",
          "can you travel to me?",
          "mobile service?",
          "do you come to hotels?",
          "outcall service?",
          "can you do it at my place?",
        ];
        for (const q of mobileQs) {
          const text = await sendAndGetResponse(q);
          expect(text.toLowerCase()).toMatch(/no|not/);
          expect(text.toLowerCase()).toMatch(/mobile|travel|house|hotel|place/);
          expect(text).toMatch(/West Melbourne|Dryburgh/i);
        }
      },
      TEST_CONFIG.TIMEOUT_SECONDS * 1000 * 8,
    );
  });

  describe("Business Policies", () => {
    it(
      "explains policies accurately",
      async () => {
        const policyQs = [
          "what if i cancel?",
          "deposit required?",
          "do you take card?",
          "cash only?",
          "can i reschedule?",
          "what if im late?",
          "do you do walk ins?",
          "same day booking?",
          "how far in advance?",
          "what if you cancel?",
          "deposit refundable?",
        ];
        for (const q of policyQs) {
          const text = await sendAndGetResponse(q);
          expect(text).toMatch(/50|cash|24/i);
        }
      },
      TEST_CONFIG.TIMEOUT_SECONDS * 1000 * 11,
    );
  });

  describe("Location and Contact", () => {
    it(
      "provides clear location and contact info",
      async () => {
        const locationQs = [
          "where are you located?",
          "whats your address?",
          "how do i find you?",
          "what apartment?",
          "parking available?",
          "public transport?",
          "exact address?",
          "phone number?",
          "how to contact?",
          "whatsapp number?",
        ];
        for (const q of locationQs) {
          const text = await sendAndGetResponse(q);
          expect(text).toMatch(
            /Dryburgh|West Melbourne|\+?61473164581|\+?15551890570/i,
          );
        }
      },
      TEST_CONFIG.TIMEOUT_SECONDS * 1000 * 10,
    );
  });

  describe("Handles Typos and Mixed Language", () => {
    it(
      "responds appropriately to messy input",
      async () => {
        const messy = [
          "manicre price?",
          "gel mani cuanto cuesta?",
          "haicut tomorrow?",
          "braids availble?",
          "how much for nales?",
          "tratamientos de cabello?",
          "precio manicure?",
        ];
        for (const q of messy) {
          const text = await sendAndGetResponse(q);
          expect(text.length).toBeGreaterThan(0);
          expect(text.toLowerCase()).toMatch(
            /manicure|pedicure|hair|braid|treatment/,
          );
        }
      },
      TEST_CONFIG.TIMEOUT_SECONDS * 1000 * 7,
    );
  });
});
