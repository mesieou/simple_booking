import { createClient } from "@/lib/supabase/client";
import { FormDataType } from "@/utils/FormContext";
import { v4 as uuidv4 } from "uuid";

export type SaveQuoteResult = {
  success: boolean;
  error?: string;
};

export const saveQuoteToSupabase = async (formData: FormDataType): Promise<SaveQuoteResult> => {
  const supabase = createClient();

  // Mapeo de campos
  const quote = {
    id: formData.id || uuidv4(),
    createdAt: formData.createdAt || new Date().toISOString(),
    userId: formData.userid || null,
    pickUp: formData.pickup || null,
    dropOff: formData.dropoff || null,
    businessId: formData.businessid || null,
    travelCostEstimate: formData.travelcostestimate || null,
    status: formData.status || "pending",
    totalJobCostEstimation: formData.totalJobCostEstimation || null,
    updatedAt: new Date().toISOString(),
    travelTimeEstimate: formData.traveltimeestimatenumber || null,
    totalJobDurationEstimation: formData.traveltimeestimatenumber || null,
    serviceId: formData.serviceid || null,
    serviceCost: null,
  };

  const { error } = await supabase.from("quotes").insert([quote]);
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}; 