import { simulateWebhookPost } from "../../utils";
import {
  cleanup,
  startBookingFlow,
  getActiveSession,
  fetchServices,
  getGoalData,
  getLastBotMessage,
  verifyBookingFlowActive,
  verifyServiceSelected,
  verifyNoServiceSelected,
  TEST_PHONE,
  BUSINESS_ID,
} from "../shared/booking-test-utils";

describe("Additional Services Selection Step - Real Bot Behavior", () => {
  beforeEach(async () => {
    await cleanup();
  });

  beforeAll(async () => {
    const services = await fetchServices();
    console.log(`✅ Found ${services.length} services for testing`);
    expect(services.length).toBeGreaterThan(2);
  });

  test("enters additional services step after service selection", async () => {
    await startBookingFlow();
    const services = await fetchServices();
    const first = services[0];
    await simulateWebhookPost({ phone: TEST_PHONE, message: first.id! });

    const session = await getActiveSession();
    const goalData = await getGoalData();

    expect(goalData.selectedServices.length).toBe(1);
    expect(goalData.selectedServices[0].id).toBe(first.id);
    expect(goalData.addServicesState).toBe("confirming");

    const botResponse = await getLastBotMessage();
    expect(botResponse).toMatch(/add.*more.*service|continue.*service/i);
    expect(session).not.toBeNull();
  }, 30000);

  test("adds another service via button click", async () => {
    await startBookingFlow();
    const services = await fetchServices();
    const first = services[0];
    await simulateWebhookPost({ phone: TEST_PHONE, message: first.id! });

    await simulateWebhookPost({
      phone: TEST_PHONE,
      message: "add_another_service",
    });

    const goalData = await getGoalData();
    expect(goalData.addServicesState).toBe("selecting");

    const botResponse = await getLastBotMessage();
    expect(botResponse).toMatch(/select.*service/i);
    expect(botResponse).not.toMatch(new RegExp(first.name, "i"));
  }, 30000);

  test("continues with services via button click", async () => {
    await startBookingFlow();
    const services = await fetchServices();
    const first = services[0];
    await simulateWebhookPost({ phone: TEST_PHONE, message: first.id! });

    await simulateWebhookPost({
      phone: TEST_PHONE,
      message: "continue_with_services",
    });

    const goalData = await getGoalData();
    expect(goalData.addServicesState).toBe("completed");
    expect(goalData.selectedServices.length).toBe(1);

    const botResponse = await getLastBotMessage();
    expect(botResponse).toMatch(/confirm|continue|next/i);
  }, 30000);

  test("handles text variations for adding another service", async () => {
    const variations = [
      "agregar otro",
      "añadir otro servicio",
      "quiero agregar más",
      "add another",
      "más servicios",
    ];

    const services = await fetchServices();
    const firstService = services[0];

    for (const v of variations) {
      await cleanup();
      await startBookingFlow();
      await simulateWebhookPost({
        phone: TEST_PHONE,
        message: firstService.id!,
      });

      await simulateWebhookPost({ phone: TEST_PHONE, message: v });

      const goalData = await getGoalData();
      const botResponse = await getLastBotMessage();

      if (goalData.addServicesState === "selecting") {
        console.log(`✅ "${v}" → Triggered service selection`);
        expect(botResponse).toMatch(/select.*service/i);
      } else {
        console.log(`📝 "${v}" → Interpreted as conversation`);
        expect(botResponse).toMatch(/help|service|available/i);
      }
    }
  }, 60000);

  test("handles text variations for continuing", async () => {
    const variations = [
      "continuar",
      "seguir",
      "continúe",
      "continue",
      "next",
      "siguiente paso",
    ];

    const services = await fetchServices();
    const first = services[0];

    for (const v of variations) {
      await cleanup();
      await startBookingFlow();
      await simulateWebhookPost({ phone: TEST_PHONE, message: first.id! });

      await simulateWebhookPost({ phone: TEST_PHONE, message: v });

      const goalData = await getGoalData();
      const botResponse = await getLastBotMessage();

      if (goalData.addServicesState === "completed") {
        console.log(`✅ "${v}" → Triggered continuation`);
        expect(botResponse).toMatch(/confirm|continue|next/i);
      } else {
        console.log(`📝 "${v}" → Interpreted as conversation`);
        expect(botResponse).toMatch(/help|continue|service/i);
      }
    }
  }, 60000);

  test("selects multiple services in sequence", async () => {
    await startBookingFlow();
    const services = await fetchServices();
    expect(services.length).toBeGreaterThan(2);

    await simulateWebhookPost({ phone: TEST_PHONE, message: services[0].id! });

    await simulateWebhookPost({
      phone: TEST_PHONE,
      message: "add_another_service",
    });
    await simulateWebhookPost({ phone: TEST_PHONE, message: services[1].id! });

    await simulateWebhookPost({
      phone: TEST_PHONE,
      message: "add_another_service",
    });
    await simulateWebhookPost({ phone: TEST_PHONE, message: services[2].id! });

    const goalData = await getGoalData();
    expect(goalData.selectedServices.length).toBe(3);
    expect(goalData.selectedServices.map((s: any) => s.id)).toContain(
      services[0].id,
    );
    expect(goalData.selectedServices.map((s: any) => s.id)).toContain(
      services[1].id,
    );
    expect(goalData.selectedServices.map((s: any) => s.id)).toContain(
      services[2].id,
    );

    const botResponse = await getLastBotMessage();
    expect(botResponse).toMatch(new RegExp(services[0].name, "i"));
    expect(botResponse).toMatch(new RegExp(services[1].name, "i"));
    expect(botResponse).toMatch(new RegExp(services[2].name, "i"));
  }, 60000);

  test("correctly filters out already selected services", async () => {
    await startBookingFlow();
    const services = await fetchServices();
    const first = services[0];
    const second = services[1];

    await simulateWebhookPost({ phone: TEST_PHONE, message: first.id! });

    await simulateWebhookPost({
      phone: TEST_PHONE,
      message: "add_another_service",
    });

    const botResponse = await getLastBotMessage();
    expect(botResponse).not.toMatch(new RegExp(first.name, "i"));
    expect(botResponse).toMatch(new RegExp(second.name, "i"));

    await simulateWebhookPost({ phone: TEST_PHONE, message: first.id! });

    const goalData = await getGoalData();
    const count = goalData.selectedServices.filter(
      (s: any) => s.id === first.id,
    ).length;
    expect(count).toBe(1);
  }, 30000);

  test("handles when all services are selected", async () => {
    await startBookingFlow();
    const services = await fetchServices();

    for (let i = 0; i < services.length; i++) {
      if (i === 0) {
        await simulateWebhookPost({
          phone: TEST_PHONE,
          message: services[i].id!,
        });
      } else {
        await simulateWebhookPost({
          phone: TEST_PHONE,
          message: "add_another_service",
        });
        await simulateWebhookPost({
          phone: TEST_PHONE,
          message: services[i].id!,
        });
      }
    }

    await simulateWebhookPost({
      phone: TEST_PHONE,
      message: "add_another_service",
    });

    const goalData = await getGoalData();
    expect(goalData.selectedServices.length).toBe(services.length);
    expect(goalData.addServicesState).toBe("confirming");

    const botResponse = await getLastBotMessage();
    expect(botResponse).toMatch(/all.*service|no.*more.*service|continue/i);
  }, 60000);

  test("handles FAQ interruption during service confirmation", async () => {
    await startBookingFlow();
    const services = await fetchServices();
    await simulateWebhookPost({ phone: TEST_PHONE, message: services[0].id! });

    await simulateWebhookPost({
      phone: TEST_PHONE,
      message: "cuánto cuesta el gel manicure?",
    });

    const goalData = await getGoalData();
    expect(goalData.addServicesState).toBe("confirming");
    expect(goalData.selectedServices.length).toBe(1);

    const botResponse = await getLastBotMessage();
    expect(botResponse).toMatch(/gel.*manicure.*\$40|\$40.*gel.*manicure/i);
  }, 30000);

  test("handles FAQ interruption during service selection", async () => {
    await startBookingFlow();
    const services = await fetchServices();
    await simulateWebhookPost({ phone: TEST_PHONE, message: services[0].id! });
    await simulateWebhookPost({
      phone: TEST_PHONE,
      message: "add_another_service",
    });

    await simulateWebhookPost({
      phone: TEST_PHONE,
      message: "do you do hair and nails together?",
    });

    const goalData = await getGoalData();
    expect(goalData.addServicesState).toBe("selecting");
    expect(goalData.selectedServices.length).toBe(1);

    const botResponse = await getLastBotMessage();
    expect(botResponse).toMatch(/hair.*nail|combination|together|separate/i);
  }, 30000);

  test("handles invalid continuation choices", async () => {
    await startBookingFlow();
    const services = await fetchServices();
    await simulateWebhookPost({ phone: TEST_PHONE, message: services[0].id! });

    await simulateWebhookPost({ phone: TEST_PHONE, message: "maybe tomorrow" });

    const goalData = await getGoalData();
    expect(goalData.addServicesState).toBe("confirming");

    const botResponse = await getLastBotMessage();
    expect(botResponse).toMatch(/add.*more.*service|continue.*service|help/i);
  }, 30000);

  test("handles invalid service selection in selecting state", async () => {
    await startBookingFlow();
    const services = await fetchServices();
    await simulateWebhookPost({ phone: TEST_PHONE, message: services[0].id! });
    await simulateWebhookPost({
      phone: TEST_PHONE,
      message: "add_another_service",
    });

    await simulateWebhookPost({ phone: TEST_PHONE, message: "car wash" });

    const goalData = await getGoalData();
    expect(goalData.addServicesState).toBe("selecting");
    expect(goalData.selectedServices.length).toBe(1);

    const botResponse = await getLastBotMessage();
    expect(botResponse).toMatch(/couldn't find|not available|select.*option/i);
  }, 30000);

  test("verifies correct state transitions", async () => {
    await startBookingFlow();
    const services = await fetchServices();
    await simulateWebhookPost({ phone: TEST_PHONE, message: services[0].id! });
    let goalData = await getGoalData();
    expect(goalData.addServicesState).toBe("confirming");

    await simulateWebhookPost({
      phone: TEST_PHONE,
      message: "add_another_service",
    });
    goalData = await getGoalData();
    expect(goalData.addServicesState).toBe("selecting");

    await simulateWebhookPost({ phone: TEST_PHONE, message: services[1].id! });
    goalData = await getGoalData();
    expect(goalData.addServicesState).toBe("confirming");
    expect(goalData.selectedServices.length).toBe(2);

    await simulateWebhookPost({
      phone: TEST_PHONE,
      message: "continue_with_services",
    });
    goalData = await getGoalData();
    expect(goalData.addServicesState).toBe("completed");
  }, 60000);

  test("maintains service data integrity across selections", async () => {
    await startBookingFlow();
    const services = await fetchServices();
    const withPrice = services.find((s) => s.fixedPrice && s.durationEstimate);
    const mobile = services.find((s) => s.mobile);
    expect(withPrice).toBeDefined();

    await simulateWebhookPost({ phone: TEST_PHONE, message: withPrice!.id! });

    if (mobile) {
      await simulateWebhookPost({
        phone: TEST_PHONE,
        message: "add_another_service",
      });
      await simulateWebhookPost({ phone: TEST_PHONE, message: mobile.id! });
    }

    const goalData = await getGoalData();
    const selected = goalData.selectedServices.find(
      (s: any) => s.id === withPrice!.id,
    );
    expect(selected).toBeDefined();
    expect(selected.name).toBe(withPrice!.name);
    expect(selected.fixedPrice).toBe(withPrice!.fixedPrice);
    expect(selected.durationEstimate).toBe(withPrice!.durationEstimate);
    expect(selected.mobile).toBe(withPrice!.mobile);

    if (mobile) {
      const selectedMobile = goalData.selectedServices.find(
        (s: any) => s.id === mobile!.id,
      );
      expect(selectedMobile.mobile).toBe(true);
    }
  }, 30000);
});