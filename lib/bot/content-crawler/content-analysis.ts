import { CategorizedContent } from './types';
import { analyzeCategoryQualityWithGPT } from '@/lib/helpers/openai';
import { VALID_CATEGORIES } from './types';

export interface ContentAnalysisResult {
  missingCategories: string[];
  incompleteCategories: {
    category: string;
    issues: string[];
  }[];
  recommendations: string[];
  overallScore: number;
}

// Per-category analysis (for scoring and issues)
export async function analyzeContent(
  categorizedContent: CategorizedContent[],
  websiteUrl: string
): Promise<ContentAnalysisResult> {
  const missingCategories: string[] = [];
  const incompleteCategories: { category: string; issues: string[] }[] = [];
  const recommendations: string[] = [];
  let totalScore = 0;
  let scoredCategories = 0;

  for (const category of VALID_CATEGORIES) {
    const contentObj = categorizedContent.find(c => c.category === category);
    if (!contentObj || !contentObj.content || contentObj.content.trim().length === 0) {
      missingCategories.push(category);
      continue;
    }
    const { issues, recommendations: recs, score } = await analyzeCategoryQualityWithGPT(
      category,
      contentObj.content,
      websiteUrl
    );
    if (issues && issues.length > 0) {
      incompleteCategories.push({ category, issues });
    }
    if (recs && recs.length > 0) {
      recommendations.push(...recs);
    }
    totalScore += score;
    scoredCategories++;
  }

  return {
    missingCategories,
    incompleteCategories,
    recommendations,
    overallScore: scoredCategories > 0 ? Math.round(totalScore / scoredCategories) : 0
  };
}
