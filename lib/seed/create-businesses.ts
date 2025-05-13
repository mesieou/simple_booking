import { faker } from '@faker-js/faker';
import { Business, InterfaceType } from '../models/business';

export async function createBusinesses(count: number = 5): Promise<Business[]> {
  const businesses = Array.from({ length: count }, () => {
    const businessName = faker.company.name();
    const interfaceType = faker.helpers.arrayElement(['whatsapp', 'website']) as InterfaceType;
    const mobile = faker.datatype.boolean();
    
    const businessData = {
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
      mobile,
      interfaceType,
      ...(interfaceType === 'website' 
        ? { websiteUrl: faker.internet.url() }
        : { whatsappNumber: `+61${faker.string.numeric(9)}` }
      )
    };

    return new Business(businessData);
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