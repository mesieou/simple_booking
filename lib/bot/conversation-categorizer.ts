import { createClient } from "@/lib/supabase/server";
import { detectConversationCategory } from "@/lib/helpers/openai/openai-helpers";

/**
 * Gets unique categories from the documents table in Supabase
 */
async function getUniqueCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data: uniqueCategories } = await supabase
    .from("documents")
    .select("category")
    .neq("category", null);

  if (!uniqueCategories) {
    console.warn("No categories found in documents table");
    return [];
  }

  // Get unique categories and clean them
  return Array.from(new Set(uniqueCategories.map(c => c.category.trim().toLowerCase())));
}

/**
 * Categorizes a conversation using OpenAI and matches against categories from the database
 */
export async function categorizeConversation(
  conversation: { role: 'user' | 'assistant', content: string }[]
): Promise<string | undefined> {
  try {
    // Get categories from database
    const categories = await getUniqueCategories();
    
    // Use OpenAI to detect the category
    return await detectConversationCategory(conversation, categories);
  } catch (error) {
    console.error("Error categorizing conversation:", error);
    return undefined;
  }
} 