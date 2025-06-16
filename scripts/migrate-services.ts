// scripts/migrate-services.ts
import 'dotenv/config'; // Ensures environment variables are loaded
import { Service } from '../lib/database/models/service';
import { Document } from '../lib/database/models/documents';
import { syncServiceOnCreate } from '../lib/services/service-document-synchronizer';

async function migrateExistingServices() {
  console.log("--- Starting Migration: Sync Existing Services to Documents ---");

  const allServices = await Service.getAllServices();
  console.log(`Found ${allServices.length} total services in the database.`);

  if (allServices.length === 0) {
    console.log("No services to migrate. Exiting.");
    return;
  }

  let migratedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  // Using a for...of loop to handle async operations correctly inside the loop
  for (const service of allServices) {
    const serviceData = service.getData();
    if (!serviceData.id) {
      console.warn(`[SKIP] Service with name '${serviceData.name}' is missing an ID.`);
      skippedCount++;
      continue;
    }

    try {
      // Check if a document already exists for this service to make the script idempotent
      const existingDoc = await Document.findByServiceId(serviceData.id);
      
      if (existingDoc) {
        console.log(`[SKIP] Document for service '${serviceData.name}' (${serviceData.id}) already exists.`);
        skippedCount++;
        continue;
      }

      // If no document exists, call the creation function
      console.log(`[MIGRATE] Creating document for service: '${serviceData.name}' (${serviceData.id})`);
      await syncServiceOnCreate(serviceData);
      migratedCount++;

    } catch (error) {
      console.error(`[FAIL] Failed to migrate service '${serviceData.name}' (${serviceData.id}):`, error);
      failedCount++;
    }
  }

  console.log("\n--- Migration Summary ---");
  console.log(`✅ Successfully migrated: ${migratedCount}`);
  console.log(`⏩ Skipped (already exist or no ID): ${skippedCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log("-------------------------\n");
  console.log("Migration script finished.");
}

migrateExistingServices()
  .catch(error => {
    console.error("\nAn unexpected fatal error occurred during the migration script:", error);
    process.exit(1);
  }); 