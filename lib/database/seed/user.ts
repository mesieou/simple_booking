import { faker } from '@faker-js/faker';
import { User, UserRole } from '../models/user';
import { Business } from '../models/business';

export async function createUser(
  role: UserRole,
  business: Business
): Promise<User> {
  if (!business.id) {
    throw new Error('Business ID is required to create a user');
  }

  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  const user = new User(
    firstName,
    lastName,
    role,
    business.id
  );

  try {
    // Skip provider validation for seed scripts to allow multiple providers for testing
    const { data, error } = await user.add({ skipProviderValidation: true });
    if (error) {
      throw error;
    }
    return user;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error; // Propagate the error to stop the seed process
  }
} 