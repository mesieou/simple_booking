import { faker } from '@faker-js/faker';
import { Service, PricingType } from '../models/service';
import { Business } from '../models/business';

export async function createServices(
  business: Business,
  numServices: number = 3
): Promise<Service[]> {
  const services: Service[] = [];

  for (let i = 0; i < numServices; i++) {
    const pricingType = faker.helpers.arrayElement(['fixed', 'per_minute']) as PricingType;
    
    const serviceData = {
      businessId: business.id!,
      name: faker.commerce.productName(),
      pricingType,
      description: faker.commerce.productDescription(),
      durationEstimate: faker.number.int({ min: 30, max: 180 }),
      ...(pricingType === 'fixed' 
        ? { fixedPrice: faker.number.int({ min: 50, max: 500 }) }
        : { 
            ratePerMinute: faker.number.int({ min: 1, max: 5 }),
            baseCharge: faker.number.int({ min: 20, max: 100 }),
            includedMinutes: faker.number.int({ min: 15, max: 60 })
          }
      )
    };

    const service = new Service(serviceData);
    try {
      await service.add();
      services.push(service);
    } catch (error) {
      console.error('Error creating service:', error);
    }
  }

  return services;
} 