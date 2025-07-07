// fetchServices.test.ts
// Input: none
// Output: array of services

import { Service } from '@/lib/database/models/service';

describe('Fetch services', () => {
    it('should fetch all services in database', async () => {
        const businessId = '7c98818f-2b01-4fa4-bbca-0d59922a50f7';
        const services = await Service.getByBusiness(businessId);
        console.log(services);
        expect(services[0].businessId).toBeDefined();
    });
});
