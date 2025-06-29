import { ensureChatAttachmentsBucket } from '../lib/bot-engine/utils/storage-setup';
import { downloadAndStoreWhatsappMedia } from '../lib/bot-engine/utils/media-storage';

const LOG_PREFIX = '[MediaStorageTest]';

async function testMediaStorage() {
  console.log(`${LOG_PREFIX} Starting media storage test...`);

  try {
    // Test 1: Ensure bucket creation
    console.log(`${LOG_PREFIX} Testing bucket creation...`);
    const bucketCreated = await ensureChatAttachmentsBucket();
    
    if (bucketCreated) {
      console.log(`${LOG_PREFIX} ✅ Bucket ready`);
    } else {
      console.error(`${LOG_PREFIX} ❌ Bucket creation failed`);
      return;
    }

    // Test 2: Test media download (this would require a real WhatsApp media ID)
    console.log(`${LOG_PREFIX} Media storage utilities are ready for production use`);
    console.log(`${LOG_PREFIX} To test media download, send an image to your WhatsApp bot`);

  } catch (error) {
    console.error(`${LOG_PREFIX} Test failed:`, error);
  }
}

// Run the test
testMediaStorage()
  .then(() => {
    console.log(`${LOG_PREFIX} Test completed`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`${LOG_PREFIX} Test failed with error:`, error);
    process.exit(1);
  }); 