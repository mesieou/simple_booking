import { simulateWebhookPost } from "./utils";
import { ChatSession } from "@/lib/database/models/chat-session";
import { UserContext } from "@/lib/database/models/user-context";
import { Service } from "@/lib/database/models/service";
import { BOT_CONFIG } from "@/lib/bot-engine/types";
import { deleteChatSessionsForUser } from "./dbUtils";
import { ESCALATION_TEST_CONFIG, getNormalizedPhone } from '../config/escalation-test-config';

const TEST_PHONE = ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE.replace(/^\+/, ''); // Remove + for webhook simulation
const BUSINESS_ID = ESCALATION_TEST_CONFIG.LUISA_BUSINESS.ID;
const TEST_USER_NAME = ESCALATION_TEST_CONFIG.CUSTOMER_USER.WHATSAPP_NAME.split(' ')[0]; // Use first name

/**
 * Helper function to get normalized phone number
 */
function getNormalizedTestPhone(): string {
  return getNormalizedPhone(ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE);
}

const WEBHOOK_URL = `${process.env.WEBHOOK_BASE_URL || 'http://localhost:3000'}/api/webhook2`;

async function expectBotResponse(
  userMessage: string,
  expectedIncludes?: string | string[],
  expectedExcludes?: string | string[]
): Promise<any> {
  // Webhook simulation and response checking logic
  const response = await simulateWebhookPost({ phone: TEST_PHONE, message: userMessage });
  expect(response.status).toBe(200);
  
  if (expectedIncludes) {
    const includes = Array.isArray(expectedIncludes) ? expectedIncludes : [expectedIncludes];
    for (const include of includes) {
      expect(response.body).toContain(include);
    }
  }
  
  if (expectedExcludes) {
    const excludes = Array.isArray(expectedExcludes) ? expectedExcludes : [expectedExcludes];
    for (const exclude of excludes) {
      expect(response.body).not.toContain(exclude);
    }
  }
  
  return response;
}

/**
 * Clean up test data - only removes temporary sessions and contexts, never users
 */
async function cleanupAll() {
  await deleteChatSessionsForUser(TEST_PHONE);
  
  const ctx = await UserContext.getByChannelUserIdAndBusinessId(
    getNormalizedTestPhone(),
    BUSINESS_ID,
  );
  if (ctx) await UserContext.delete(ctx.id);
}

async function setupUser() {
  // User setup logic would go here if needed
  // For now, the user should already exist in the database
  console.log('Setting up test user...');
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
      ESCALATION_TEST_CONFIG.TIMEOUT_SECONDS * 1000 * 8,
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
      ESCALATION_TEST_CONFIG.TIMEOUT_SECONDS * 1000 * 12,
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
      ESCALATION_TEST_CONFIG.TIMEOUT_SECONDS * 1000 * 10,
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
      ESCALATION_TEST_CONFIG.TIMEOUT_SECONDS * 1000 * 8,
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
      ESCALATION_TEST_CONFIG.TIMEOUT_SECONDS * 1000 * 11,
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
      ESCALATION_TEST_CONFIG.TIMEOUT_SECONDS * 1000 * 10,
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
      ESCALATION_TEST_CONFIG.TIMEOUT_SECONDS * 1000 * 7,
    );
  });
});
