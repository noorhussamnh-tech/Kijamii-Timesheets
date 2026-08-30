/**
 * Reference / placeholder data. Configuration is kept separate from
 * presentation: nothing in here imports React.
 *
 * "Verticals" replaced the old region/market concept: three geographic
 * verticals plus four capability verticals. Each vertical owns its own
 * client list, so picking a vertical narrows the Client dropdown.
 */

export type VerticalId = "EG" | "UAE" | "KSA" | "ENT" | "MEDIA" | "INSIGHTS" | "PROD";
/** Legacy alias kept so existing modules keep compiling. */
export type MarketId = VerticalId;

export interface Vertical {
  id: VerticalId;
  name: string;
  config: "EG_UAE" | "KSA";
  workDays: number[]; // 0 = Sunday
  expectedDailyHours: number;
  currency: string;
}

const base = { workDays: [0, 1, 2, 3, 4], expectedDailyHours: 8, currency: "EGP" };

export const verticals: Vertical[] = [
  { id: "EG", name: "Egypt", config: "EG_UAE", ...base },
  { id: "UAE", name: "UAE", config: "EG_UAE", ...base, workDays: [1, 2, 3, 4, 5], currency: "AED" },
  { id: "KSA", name: "Saudi", config: "KSA", ...base, currency: "SAR" },
  { id: "ENT", name: "Entertainment", config: "EG_UAE", ...base },
  { id: "MEDIA", name: "Media Buying", config: "EG_UAE", ...base },
  { id: "INSIGHTS", name: "Consumer Insights", config: "EG_UAE", ...base },
  { id: "PROD", name: "Production", config: "EG_UAE", ...base },
];

/** Legacy alias. */
export const markets = verticals;
export type Market = Vertical;

export const getVertical = (id: VerticalId): Vertical =>
  verticals.find((v) => v.id === id) ?? (verticals[0] as Vertical);
export const getMarket = getVertical;

export interface Department {
  id: string;
  name: string;
}

export const departments: Department[] = [
  { id: "creative", name: "Creative" },
  { id: "strategy", name: "Strategy" },
  { id: "accounts", name: "Account Management" },
  { id: "media", name: "Media & Performance" },
  { id: "production", name: "Production" },
  { id: "tech", name: "Technology" },
  { id: "ops", name: "Operations" },
];

export interface Client {
  id: string;
  name: string;
  verticals: VerticalId[];
  /** When true the user types the client name in a free-text cell. */
  other?: boolean;
}

/** One list per vertical — edit a vertical's clients in isolation. */
export const clients: Client[] = [
  // Saudi
  { id: "c-ksa-changan", name: "Changan", verticals: ["KSA"] },
  { id: "c-ksa-deepal", name: "Deepal", verticals: ["KSA"] },
  { id: "c-ksa-keeta", name: "Keeta", verticals: ["KSA"] },
  { id: "c-ksa-costa", name: "Costa KSA", verticals: ["KSA"] },
  { id: "c-ksa-popeyes", name: "Popeyes", verticals: ["KSA"] },
  { id: "c-ksa-lendo", name: "Lendo", verticals: ["KSA"] },
  { id: "c-ksa-tim-hortons", name: "Tim Hortons", verticals: ["KSA"] },
  { id: "c-ksa-gac-al-jomaih", name: "GAC Al Jomaih", verticals: ["KSA"] },
  { id: "c-ksa-burger-king", name: "Burger King KSA", verticals: ["KSA"] },

  // UAE
  { id: "c-uae-shoe-mart", name: "Shoe Mart", verticals: ["UAE"] },
  { id: "c-uae-baskin-robbins", name: "Baskin Robbins", verticals: ["UAE"] },
  { id: "c-uae-amana-foods", name: "Amana Foods", verticals: ["UAE"] },

  // Egypt
  { id: "c-eg-myf", name: "MYF", verticals: ["EG"] },
  { id: "c-eg-castrol", name: "Castrol", verticals: ["EG"] },
  { id: "c-eg-kfh", name: "KFH", verticals: ["EG"] },
  { id: "c-eg-btc", name: "BTC", verticals: ["EG"] },
  { id: "c-eg-allianz", name: "Allianz", verticals: ["EG"] },

  // Entertainment
  { id: "c-ent-yango-play", name: "Yango Play", verticals: ["ENT"] },
  { id: "c-ent-netflix", name: "Netflix", verticals: ["ENT"] },
  { id: "c-ent-spotify", name: "Spotify", verticals: ["ENT"] },

  // Media Buying
  { id: "c-mb-tadum", name: "Tadum", verticals: ["MEDIA"] },
  { id: "c-mb-fawry", name: "Fawry", verticals: ["MEDIA"] },
  { id: "c-mb-asfour-crystal", name: "Asfour Crystal", verticals: ["MEDIA"] },
  { id: "c-mb-kabany", name: "Kabany", verticals: ["MEDIA"] },
  { id: "c-mb-la-poire", name: "La Poire", verticals: ["MEDIA"] },
  { id: "c-mb-eui", name: "EUI", verticals: ["MEDIA"] },
  { id: "c-mb-myf", name: "MYF", verticals: ["MEDIA"] },
  { id: "c-mb-gac", name: "GAC", verticals: ["MEDIA"] },

  // Production
  { id: "c-prod-btc", name: "BTC", verticals: ["PROD"] },
  { id: "c-prod-shoemart", name: "Shoemart", verticals: ["PROD"] },
  { id: "c-prod-baskin-robbins", name: "Baskin Robbins", verticals: ["PROD"] },
  { id: "c-prod-amana-foods", name: "Amana Foods", verticals: ["PROD"] },

  // Available everywhere — free-text client name.
  {
    id: "c-other",
    name: "Other (please fill in)",
    verticals: ["EG", "UAE", "KSA", "ENT", "MEDIA", "INSIGHTS", "PROD"],
    other: true,
  },
];

export const clientsForVertical = (verticalId: VerticalId) =>
  clients.filter((c) => c.verticals.includes(verticalId));

export interface Service {
  id: string;
  name: string;
}

export const services: Service[] = [
  { id: "s-social", name: "Social Media Management" },
  { id: "s-content", name: "Content Production" },
  { id: "s-design", name: "Art & Design" },
  { id: "s-copy", name: "Copywriting" },
  { id: "s-strategy", name: "Brand Strategy" },
  { id: "s-media", name: "Media Buying" },
  { id: "s-analytics", name: "Analytics & Reporting" },
  { id: "s-web", name: "Web & Product" },
  { id: "s-internal", name: "Internal / Admin" },
];

export const getClient = (id: string) => clients.find((c) => c.id === id);
export const getService = (id: string) => services.find((s) => s.id === id);

export interface Employee {
  id: string;
  name: string;
  email: string;
  initials: string;
  marketId: VerticalId;
  departmentId: string;
  title: string;
  managerName: string;
}

export const currentEmployee: Employee = {
  id: "e-001",
  name: "Noor Hussam",
  email: "noor.hussam@kijamii.com",
  initials: "NH",
  marketId: "EG",
  departmentId: "accounts",
  title: "Senior Account Manager",
  managerName: "Dina Fawzy",
};
