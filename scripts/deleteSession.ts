import { CrawlSession } from '@/lib/models/crawl-session';

async function run() {
  // TODO: Replace with the actual session ID you want to delete
  const sessionId = '6fcc6d9e-d420-41ad-a174-8e51b400b3e4';
  await CrawlSession.deleteSessionCascade(sessionId);
  console.log('Session and related documents/embeddings deleted.');
}

run().catch(console.error); 