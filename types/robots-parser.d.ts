declare module 'robots-parser' {
  interface RobotsParser {
    isAllowed: (url: string, userAgent: string) => boolean;
    getCrawlDelay: (userAgent: string) => number | null;
    getSitemaps: () => string[];
  }

  function parseRobots(robotsUrl: string, robotsTxt: string): RobotsParser;
  export = parseRobots;
} 