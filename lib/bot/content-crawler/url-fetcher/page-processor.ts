import crypto from 'crypto';
import {
  CrawlConfig,
  CrawlResult,
  defaultConfig,
  ExtractedPatterns,
} from '@/lib/config/config';
import { RobotsRules, isUrlAllowed } from './robotsParser';
import { processSingleUrlAndSaveArtifacts, ProcessedUrlResult } from './SingleUrlProcessor';
import { updateCrawlResults } from './resultManager';
import { logger as globalLoggerInstance } from '../process-content/logger';
import { runConcurrentTasks } from '../utils'; // Assuming runConcurrentTasks is in the parent utils

interface ProcessUrlsConcurrentlyParams {
  urlsToProcess: string[];
  websiteUrl: string;
  robotsRules: RobotsRules | null;
  config: CrawlConfig;
  crawlResults: CrawlResult[]; // Mutable, for updating
  processedUrlTasks: Set<string>; // Mutable, for tracking
  processedContentSignatures: Set<string>; // Mutable, for tracking
  mainLanguage: string;
  domain: string;
}

export async function processUrlsConcurrently({
  urlsToProcess,
  websiteUrl,
  robotsRules,
  config,
  crawlResults,
  processedUrlTasks,
  processedContentSignatures,
  mainLanguage,
  domain,
}: ProcessUrlsConcurrentlyParams): Promise<void> {
  const concurrency = config.concurrency ?? defaultConfig.concurrency;

  async function* urlProcessingTaskGenerator() {
    for (const currentUrlToProcess of urlsToProcess) {
      let fullUrl: string;
      try {
        fullUrl = new URL(currentUrlToProcess, websiteUrl).toString();
      } catch (e) {
        await globalLoggerInstance.logUrlSkipped(
          currentUrlToProcess,
          'Invalid URL structure before processing'
        );
        updateCrawlResults(
          crawlResults,
          domain,
          null,
          'unknown',
          'Invalid URL structure',
          currentUrlToProcess
        );
        continue;
      }

      if (processedUrlTasks.has(fullUrl)) {
        continue;
      }
      processedUrlTasks.add(fullUrl);

      if (!isUrlAllowed(fullUrl, robotsRules, websiteUrl)) {
        await globalLoggerInstance.logUrlSkipped(fullUrl, 'disallowed by robots.txt');
        updateCrawlResults(
          crawlResults,
          domain,
          null,
          'unknown',
          'disallowed by robots.txt',
          fullUrl
        );
        continue;
      }

      yield async () => {
        const result: ProcessedUrlResult = await processSingleUrlAndSaveArtifacts(
          fullUrl,
          config
        );

        if (result.status === 'success' && result.cleanedText && result.finalUrl) {
          const currentContentSignature = crypto
            .createHash('sha256')
            .update(result.cleanedText)
            .digest('hex');

          const pageTitleForSuccessUpdate: string | null =
            result.pageTitle !== undefined ? result.pageTitle : null;
          const cleanedTextForSuccessUpdate: string = result.cleanedText;
          const languageForSuccessUpdate: string = result.language || mainLanguage;
          const finalUrlForSuccessUpdate: string = result.finalUrl;
          const patternsForSuccessUpdate: ExtractedPatterns | null = result.extractedPatterns
            ? (result.extractedPatterns as ExtractedPatterns)
            : null;

          if (processedContentSignatures.has(currentContentSignature)) {
            const reason = `duplicate content (signature: ${currentContentSignature})`;
            await globalLoggerInstance.logUrlSkipped(finalUrlForSuccessUpdate, reason);
            updateCrawlResults(
              crawlResults,
              domain,
              cleanedTextForSuccessUpdate,
              languageForSuccessUpdate,
              reason,
              finalUrlForSuccessUpdate,
              patternsForSuccessUpdate,
              pageTitleForSuccessUpdate
            );
          } else {
            processedContentSignatures.add(currentContentSignature);
            await globalLoggerInstance.logUrlProcessed(finalUrlForSuccessUpdate);
            updateCrawlResults(
              crawlResults,
              domain,
              cleanedTextForSuccessUpdate,
              languageForSuccessUpdate,
              'ok',
              finalUrlForSuccessUpdate,
              patternsForSuccessUpdate,
              pageTitleForSuccessUpdate
            );
          }
        } else {
          const reason = result.errorMessage || 'Unknown processing error';
          const pageTitleForFailureUpdate: string | null =
            result.pageTitle !== undefined ? result.pageTitle : null;
          const cleanedTextForFailureUpdate: string | null =
            result.cleanedText !== undefined ? result.cleanedText : null;
          const languageForFailureUpdate: string = result.language || mainLanguage;
          const finalUrlForFailureUpdate: string = result.finalUrl || fullUrl;
          const patternsForFailureUpdate: ExtractedPatterns | null = result.extractedPatterns
            ? (result.extractedPatterns as ExtractedPatterns)
            : null;

          updateCrawlResults(
            crawlResults,
            domain,
            cleanedTextForFailureUpdate,
            languageForFailureUpdate,
            reason,
            finalUrlForFailureUpdate,
            patternsForFailureUpdate,
            pageTitleForFailureUpdate
          );
        }

        if (config.requestDelay && config.requestDelay > 0) {
          await new Promise(res => setTimeout(res, config.requestDelay!));
        }
      };
    }
  }

  await runConcurrentTasks(() => urlProcessingTaskGenerator(), concurrency);
} 