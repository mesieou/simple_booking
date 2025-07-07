import { fetchServices } from '../integration/booking/shared/booking-test-utils';
import { Service } from '@/lib/database/models/service';

// Mock the Service model
jest.mock('@/lib/database/models/service');
const mockedService = Service as jest.Mocked<typeof Service>;

describe('fetchServices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return services when services exist', async () => {
    // Arrange
    const mockServices = [
      { id: '1', name: 'Service 1', businessId: 'business-123' },
      { id: '2', name: 'Service 2', businessId: 'business-123' }
    ];
    mockedService.getByBusiness.mockResolvedValue(mockServices);

    // Act
    const result = await fetchServices();

    // Assert
    expect(mockedService.getByBusiness).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockServices);
    expect(result.length).toBe(2);
  });

  it('should throw error when no services exist (length is 0)', async () => {
    // Arrange
    const mockServices: any[] = [];
    mockedService.getByBusiness.mockResolvedValue(mockServices);

    // Act & Assert
    await expect(fetchServices()).rejects.toThrow();
    expect(mockedService.getByBusiness).toHaveBeenCalledTimes(1);
  });

  it('should throw error when Service.getByBusiness fails', async () => {
    // Arrange
    const mockError = new Error('Database connection failed');
    mockedService.getByBusiness.mockRejectedValue(mockError);

    // Act & Assert
    await expect(fetchServices()).rejects.toThrow('Database connection failed');
    expect(mockedService.getByBusiness).toHaveBeenCalledTimes(1);
  });

  it('should return single service when only one exists', async () => {
    // Arrange
    const mockServices = [
      { id: '1', name: 'Single Service', businessId: 'business-123' }
    ];
    mockedService.getByBusiness.mockResolvedValue(mockServices);

    // Act
    const result = await fetchServices();

    // Assert
    expect(mockedService.getByBusiness).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockServices);
    expect(result.length).toBe(1);
  });

  it('should return multiple services when many exist', async () => {
    // Arrange
    const mockServices = Array.from({ length: 5 }, (_, i) => ({
      id: `${i + 1}`,
      name: `Service ${i + 1}`,
      businessId: 'business-123'
    }));
    mockedService.getByBusiness.mockResolvedValue(mockServices);

    // Act
    const result = await fetchServices();

    // Assert
    expect(mockedService.getByBusiness).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockServices);
    expect(result.length).toBe(5);
  });
}); 