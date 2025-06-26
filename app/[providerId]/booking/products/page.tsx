import { Service } from '@/lib/database/models/service';
import { User } from '@/lib/database/models/user';
import ProductsView from './products-view';
import { notFound } from 'next/navigation';

// Define the type for the params Promise
type PageParams = Promise<{ providerId: string }>;

// Update the props interface to use the Promise type
interface PageProps {
  params: PageParams;
}

export default async function BookingSizeStepPage({ params }: PageProps) {
  // Await the params Promise to get the actual values
  const { providerId } = await params;

  // Fetch the provider's user data to get their businessId
  const providerUser = await User.findUserByBusinessId(providerId);
  
  if (!providerUser || !providerUser.businessId) {
    // Handle case where provider or business is not found
    notFound();
  }

  const businessId = providerUser.businessId;

  // Fetch services on the server
  const services = await Service.getByBusiness(businessId);

  // We need to serialize the data because we're passing it from a Server Component to a Client Component.
  // The service instances themselves can't be passed, but their data can.
  const initialServicesData = services.map(s => s.getData());

  return <ProductsView initialServices={initialServicesData} providerId={providerId} />;
} 