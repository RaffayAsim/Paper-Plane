export const INDUSTRIES = [
  "Accountants",
  "Advertising Agencies",
  "Auto Body Shops",
  "Auto Dealers",
  "Auto Repair",
  "Bakeries",
  "Banks & Credit Unions",
  "Barbers",
  "Bars & Nightlife",
  "Beauty Salons",
  "Cafes & Coffee Shops",
  "Car Washes",
  "Chiropractors",
  "Cleaning Services",
  "Construction Companies",
  "Consultants",
  "Contractors",
  "Day Care Centers",
  "Dentists",
  "Digital Marketing Agencies",
  "Doctors & Medical Clinics",
  "Dry Cleaners",
  "Electricians",
  "Event Planners",
  "Financial Advisors",
  "Fitness Centers & Gyms",
  "Florists",
  "Funeral Homes",
  "Furniture Stores",
  "General Contractors",
  "Grocery Stores",
  "Hair Salons",
  "Home Improvement",
  "Home Inspectors",
  "Hotels",
  "HVAC Services",
  "Insurance Agencies",
  "Interior Designers",
  "IT Services",
  "Landscaping Services",
  "Law Firms & Attorneys",
  "Locksmiths",
  "Manufacturers",
  "Mortgage Brokers",
  "Moving Companies",
  "Nail Salons",
  "Optometrists",
  "Pest Control",
  "Pet Groomers",
  "Photographers",
  "Physical Therapists",
  "Plumbers",
  "Property Management",
  "Real Estate",
  "Remodeling Contractors",
  "Restaurants",
  "Roofing Contractors",
  "Retail",
  "Schools & Tutoring",
  "Security Services",
  "Solar Installers",
  "Spas",
  "Storage Facilities",
  "Tax Services",
  "Travel Agencies",
  "Tree Services",
  "Veterinarians",
  "Web Design Agencies",
  "Wedding Services",
  "Other",
] as const;

export const COMPANY_SIZES = [
  "1-10 employees",
  "11-50 employees",
  "51-200 employees",
  "201-500 employees",
  "501-1,000 employees",
  "1,001-5,000 employees",
  "5,001+ employees",
] as const;

export type PricingTier = {
  id: number;
  name: string;
  price: string;
  billingPeriod: string;
  includes: string;
};

export const createPricingTier = (id: number, name = ""): PricingTier => ({
  id,
  name,
  price: "",
  billingPeriod: "month",
  includes: "",
});

export const defaultPricingTiers = () => [
  createPricingTier(1, "Starter"),
  createPricingTier(2, "Growth"),
  createPricingTier(3, "Premium"),
];

export const serializePricingTiers = (tiers: PricingTier[]) =>
  tiers
    .map(
      (tier, index) =>
        `Tier ${index + 1}: ${tier.name.trim()}\nPrice: ${tier.price.trim()} per ${tier.billingPeriod}\nIncludes: ${tier.includes.trim()}`,
    )
    .join("\n\n");

export const parsePricingTiers = (pricing: string): PricingTier[] => {
  if (!pricing.trim()) return defaultPricingTiers();

  const blocks = pricing.trim().split(/\n\s*\n/);
  const parsed = blocks.map((block, index) => {
    const lines = block.split("\n");
    const name = lines[0]?.replace(/^Tier \d+:\s*/, "").trim() || `Tier ${index + 1}`;
    const priceMatch = lines[1]?.match(/^Price:\s*(.+?)\s+per\s+(.+)$/);
    const includes = lines.slice(2).join("\n").replace(/^Includes:\s*/, "").trim();

    return {
      id: index + 1,
      name,
      price: priceMatch?.[1]?.trim() || "",
      billingPeriod: priceMatch?.[2]?.trim() || "month",
      includes,
    };
  });

  return parsed.some((tier) => tier.price || tier.includes)
    ? parsed
    : [{ id: 1, name: "Custom", price: "", billingPeriod: "project", includes: pricing.trim() }];
};
