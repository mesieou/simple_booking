const VALID_CATEGORIES = [
  'about / trust-building',
  'services offered',
  'pricing or quotes',
  'contact',
  'booking or scheduling',
  'faq',
  'terms & conditions / legal policies'
];

function mapToValidCategory(category) {
  // First normalize the input category
  const normalized = category.toLowerCase()
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/[^\w\s\/-]/g, '')  // Remove special characters except / and -
    .replace(/[-/]/g, ' ')  // Replace - and / with spaces
    .trim();

  // Debug logging
  console.log(`[Category Mapping] Input: "${category}"`);
  console.log(`[Category Mapping] Normalized: "${normalized}"`);

  // Find the matching valid category
  const validCategory = VALID_CATEGORIES.find(valid => {
    const normalizedValid = valid.toLowerCase()
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/[^\w\s\/-]/g, '')  // Remove special characters except / and -
      .replace(/[-/]/g, ' ')  // Replace - and / with spaces
      .trim();
    
    // Debug logging
    console.log(`[Category Mapping] Comparing with valid: "${valid}"`);
    console.log(`[Category Mapping] Normalized valid: "${normalizedValid}"`);
    
    return normalized === normalizedValid;
  });

  // Debug logging
  console.log(`[Category Mapping] Result: "${validCategory || category}"`);

  // Return the original valid category if found, otherwise return the input
  return validCategory || category;
}

// Test cases
console.log('\n=== Testing mapToValidCategory ===');
const testCases = [
  'about trustbuilding',
  'about / trust-building',
  'about/trust-building',
  'about-trust-building',
  'about & trust building',
  'about and trust building'
];

testCases.forEach(test => {
  console.log(`\nTesting: "${test}"`);
  const result = mapToValidCategory(test);
  console.log(`Result: "${result}"`);
}); 