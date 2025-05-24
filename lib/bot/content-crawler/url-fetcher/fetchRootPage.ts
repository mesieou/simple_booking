import fetch from 'node-fetch';

export async function fetchRootPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch root page: ${response.statusText}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.error(`Error fetching root page: ${error}`);
    return null;
  }
} 