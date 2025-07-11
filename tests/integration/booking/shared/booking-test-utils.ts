import { Service } from "@/lib/database/models/service";
import { ChatSession } from "@/lib/database/models/chat-session";
import { UserContext } from "@/lib/database/models/user-context";
import { ESCALATION_TEST_CONFIG, getNormalizedPhone } from "../../../config/escalation-test-config";
import { deleteChatSessionsForUser } from "../../dbUtils";
import { simulateWebhookPost } from "../../utils";
import { BOT_CONFIG } from "@/lib/bot-engine/types";

export const TEST_PHONE = ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE.replace(/^\+/, ''); // Remove + for webhook simulation
export const BUSINESS_ID = ESCALATION_TEST_CONFIG.LUISA_BUSINESS.ID;

/**
 * Helper function to get normalized phone number
 */
export function getNormalizedTestPhone(): string {
  return getNormalizedPhone(ESCALATION_TEST_CONFIG.CUSTOMER_USER.PHONE);
}

/**
 * Clean up test data - only removes temporary sessions and contexts, never users
 */
export async function cleanup() {
  await deleteChatSessionsForUser(TEST_PHONE);
  
  // Delete ALL UserContext records for this user and business (handling duplicates)
  try {
    const normalizedPhone = getNormalizedTestPhone();
    console.log(`[Cleanup] Cleaning UserContext for ${normalizedPhone} in business ${BUSINESS_ID}`);
    
    // Get and delete ALL UserContext records for this user/business combination
    // We need to use direct Supabase query since there's no deleteMany method
    const { getEnvironmentServiceRoleClient } = await import('@/lib/database/supabase/environment');
    const supa = getEnvironmentServiceRoleClient();
    
    const { data: contexts, error: fetchError } = await supa
      .from('userContexts')
      .select('id')
      .eq('channelUserId', normalizedPhone)
      .eq('businessId', BUSINESS_ID);
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.log(`[Cleanup] Error fetching UserContext records:`, fetchError);
    } else if (contexts && contexts.length > 0) {
      console.log(`[Cleanup] Found ${contexts.length} UserContext records to delete`);
      
      // Delete each record individually
      for (const ctx of contexts) {
        await UserContext.delete(ctx.id);
      }
      
      console.log(`[Cleanup] Successfully deleted ${contexts.length} UserContext records`);
    } else {
      console.log(`[Cleanup] No UserContext records found to delete`);
    }
  } catch (error) {
    console.log(`[Cleanup] UserContext cleanup error (may be expected):`, error);
  }
}

export async function startBookingFlow() {
  const resp = await simulateWebhookPost({
    phone: TEST_PHONE,
    message: "start_booking_flow",
  });
  expect(JSON.stringify(resp)).toMatch(/success/i);
}

export async function getActiveSession() {
  return await ChatSession.getActiveByChannelUserId(
    "whatsapp",
    getNormalizedTestPhone(),
    BOT_CONFIG.SESSION_TIMEOUT_HOURS,
  );
}

export async function fetchServices() {
  const services = await Service.getByBusiness(BUSINESS_ID);
  expect(services.length).toBeGreaterThan(0);
  return services;
}

export async function getGoalData() {
  const ctx = await UserContext.getByChannelUserIdAndBusinessId(
    getNormalizedTestPhone(),
    BUSINESS_ID
  );
  return ctx?.currentGoal?.collectedData as any;
}

export async function getLastBotMessage() {
  const session = await getActiveSession();
  if (!session || session.allMessages.length === 0) return "";
  const last = session.allMessages[session.allMessages.length - 1];
  return typeof last.content === "string"
    ? last.content
    : (last.content as any)?.text || "";
}

export function verifyServiceSelected(goalData: any, service: any) {
  const arr = goalData.selectedServices || [];
  expect(arr.find((s: any) => s.id === service.id)).toBeDefined();
}

export function verifyNoServiceSelected(goalData: any) {
  const arr = goalData.selectedServices || [];
  expect(arr.length).toBe(0);
  expect(goalData.selectedService).toBeUndefined();
}

export async function verifyBookingFlowActive() {
  const ctx = await UserContext.getByChannelUserIdAndBusinessId(
    getNormalizedTestPhone(),
    BUSINESS_ID
  );
  expect(ctx?.currentGoal?.goalType).toBe("serviceBooking");
}

export async function verifyServicesLoaded() {
  const services = await fetchServices();
  expect(services.length).toBeGreaterThan(0);
  return services;
}

export async function verifyBotMentionsService(serviceName: string) {
  const lastMessage = await getLastBotMessage();
  expect(lastMessage.toLowerCase()).toContain(serviceName.toLowerCase());
}