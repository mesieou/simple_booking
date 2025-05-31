import { DEFAULT_HEADERS, USER_AGENT } from '@/lib/general-config/general-config';

export interface RobotsRules {
  disallowedPaths: string[];
  // We can extend this to support specific user-agents if needed, 
  // but for now, we'll assume rules apply to our USER_AGENT or all ('*').
}

async function fetchRobotsTxtContent(robotsUrl: string): Promise<string | null> {
  try {
    const response = await fetch(robotsUrl, { headers: DEFAULT_HEADERS });
    if (!response.ok) {
      console.warn(`[RobotsParser] Failed to fetch ${robotsUrl}: ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.warn(`[RobotsParser] Error fetching ${robotsUrl}:`, error);
    return null;
  }
}

function parseRules(robotsTxtContent: string, targetUserAgent: string): RobotsRules {
  const rules: RobotsRules = { disallowedPaths: [] };
  let currentUserAgentMatches = false;
  let generalUserAgentMatches = false;

  robotsTxtContent.split('\n').forEach(line => {
    const cleanedLine = line.split('#')[0].trim(); // Remove comments and trim

    if (cleanedLine.toLowerCase().startsWith('user-agent:')) {
      const agent = cleanedLine.substring('user-agent:'.length).trim();
      currentUserAgentMatches = agent === targetUserAgent;
      generalUserAgentMatches = agent === '*';
    }

    if (currentUserAgentMatches || generalUserAgentMatches) {
      if (cleanedLine.toLowerCase().startsWith('disallow:')) {
        const path = cleanedLine.substring('disallow:'.length).trim();
        if (path) { // Only add if path is not empty
          rules.disallowedPaths.push(path);
        }
      }
      // We could also handle 'Allow:' directives here for more complex logic
    }
  });
  return rules;
}

export async function fetchAndParseRobotsTxt(baseUrlString: string): Promise<RobotsRules | null> {
  const baseUrl = new URL(baseUrlString);
  const robotsUrl = new URL('/robots.txt', baseUrl).href;
  console.log(`[RobotsParser] Attempting to fetch and parse robots.txt from: ${robotsUrl}`);

  const robotsTxtContent = await fetchRobotsTxtContent(robotsUrl);
  if (!robotsTxtContent) {
    console.log(`[RobotsParser] No robots.txt content found or fetched for ${baseUrlString}`);
    return null; // No rules found or fetch failed
  }

  const parsedRules = parseRules(robotsTxtContent, USER_AGENT);
  console.log(`[RobotsParser] Parsed ${parsedRules.disallowedPaths.length} disallow rules for ${USER_AGENT} (or *).`);
  return parsedRules;
}

export function isUrlAllowed(urlToTest: string, robotsRules: RobotsRules | null, baseUrlString: string): boolean {
  if (!robotsRules) {
    return true; // If no robots.txt or failed to parse, assume allowed
  }

  let path;
  try {
    // Ensure urlToTest is absolute for correct path extraction
    const absoluteUrl = new URL(urlToTest, baseUrlString).href;
    path = new URL(absoluteUrl).pathname;
  } catch (e) {
    console.warn(`[RobotsParser] Could not parse URL for robots.txt check: ${urlToTest}`);
    return true; // Fail open if URL is malformed for path extraction
  }
  

  for (const disallowedPath of robotsRules.disallowedPaths) {
    if (disallowedPath === '/' && path.startsWith('/')) {
      // console.log(`[RobotsParser] URL ${path} disallowed by rule: /`);
      return false; // Disallow all if '/' is specified
    }
    if (disallowedPath && path.startsWith(disallowedPath)) {
      // console.log(`[RobotsParser] URL ${path} disallowed by rule: ${disallowedPath}`);
      return false;
    }
  }
  return true;
} 