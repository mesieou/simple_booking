import { faker } from '@faker-js/faker';
import { Business } from '../models/business';

export async function createBusinesses(count: number = 5): Promise<Business[]> {
  const businesses = Array.from({ length: count }, () => {
    const businessName = faker.company.name();
    return new Business({
      name: businessName,
      email: faker.internet.email({ provider: businessName.toLowerCase().replace(/\s+/g, '') }),
      phone: `+61${faker.string.numeric(9)}`,
      timeZone: faker.helpers.arrayElement([
        "Australia/Melbourne",
        "America/New_York",
        "Europe/London",
        "Asia/Tokyo",
        "America/Los_Angeles"
      ]),
      serviceRatePerMinute: faker.number.float({ min: 1.5, max: 3, fractionDigits: 2 })
    });
  });

  const createdBusinesses: Business[] = [];
  for (const business of businesses) {
    try {
      const createdBusiness = await business.add();
      createdBusinesses.push(business);
    } catch (error) {
      console.error('Error creating business:', error);
      throw error; // Propagate the error to stop the seed process
    }
  }

  if (createdBusinesses.length === 0) {
    throw new Error('No businesses were created successfully');
  }

  return createdBusinesses;
} 