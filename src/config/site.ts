export interface ContactConfig {
  phone: string;
  email: string;
  address: string;
  taxId: string;
  domain: string;
  instagramUrl: string;
  facebookUrl: string;
  googleMapsUrl: string;
}

export interface NavigationItem {
  label: string;
  href: string;
}

export interface BusinessHours {
  days: string;
  hours: string;
  closed?: boolean;
}

export interface SiteConfig {
  name: string;
  shortName: string;
  city: string;
  locale: string;
  language: string;
  timeZone: string;
  currency: string;
  description: string;
  siteUrl: string;
  contact: ContactConfig;
  navigation: readonly NavigationItem[];
  legalNavigation: readonly NavigationItem[];
  businessHours: readonly BusinessHours[];
}

const fallbackSiteUrl = "https://example.invalid";

export const siteConfig: SiteConfig = {
  name: "Brzytwa Barber",
  shortName: "Brzytwa",
  city: "Katowice",
  locale: "pl-PL",
  language: "pl",
  timeZone: "Europe/Warsaw",
  currency: "PLN",
  description:
    "Nowoczesny barbershop w Katowicach: strzyżenie męskie, pielęgnacja brody i świadome rzemiosło bez zbędnego pośpiechu.",
  siteUrl: import.meta.env.PUBLIC_SITE_URL || fallbackSiteUrl,
  contact: {
    phone: "[NUMER_TELEFONU]",
    email: "[EMAIL]",
    address: "[ADRES]",
    taxId: "[NIP]",
    domain: "[DOMENA]",
    instagramUrl: "[INSTAGRAM_URL]",
    facebookUrl: "[FACEBOOK_URL]",
    googleMapsUrl: "[GOOGLE_MAPS_URL]",
  },
  navigation: [
    { label: "Start", href: "/" },
    { label: "Usługi", href: "/uslugi" },
    { label: "Zespół", href: "/zespol" },
    { label: "Galeria", href: "/galeria" },
    { label: "Kontakt", href: "/kontakt" },
  ],
  legalNavigation: [
    { label: "Polityka prywatności", href: "/polityka-prywatnosci" },
    { label: "Regulamin rezerwacji", href: "/regulamin-rezerwacji" },
  ],
  businessHours: [
    { days: "Poniedziałek–Piątek", hours: "09:00–20:00" },
    { days: "Sobota", hours: "09:00–16:00" },
    { days: "Niedziela", hours: "Zamknięte", closed: true },
  ],
};

export function isPlaceholder(value: string): boolean {
  return /^\[[A-Z0-9_]+\]$/.test(value);
}
