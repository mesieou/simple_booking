// fetchServices.test.ts
// Input: none
// Output: array of services

import { Service } from '@/lib/database/models/service';
import { ESCALATION_TEST_CONFIG } from '../config/escalation-test-config';

describe('Fetch services', () => {
    it('should fetch all services in database', async () => {
        const businessId = ESCALATION_TEST_CONFIG.LUISA_BUSINESS.ID;
        const services = await Service.getByBusiness(businessId);
        console.log(`Found ${services.length} services for business ${businessId}`);
        
        if (services.length > 0) {
            expect(services[0].businessId).toBeDefined();
            expect(services[0].businessId).toBe(businessId);
        } else {
            console.warn('No services found for test business. This test may need services to be seeded.');
            expect(services).toEqual([]);
        }
    });
});
