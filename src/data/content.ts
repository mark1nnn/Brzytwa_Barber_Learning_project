import type { ImageMetadata } from "astro";

import barberAdrianImage from "@assets/images/barber-adrian.png";
import barberKamilImage from "@assets/images/barber-kamil.png";
import barberMichalImage from "@assets/images/barber-michal.png";
import beardTrimImage from "@assets/images/gallery-beard-trim.png";
import interiorImage from "@assets/images/gallery-interior.png";
import workstationImage from "@assets/images/gallery-workstation.png";
import heroImage from "@assets/images/hero-barbershop.png";

export interface ServicePreview {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  durationMinutes: number;
  priceGrosze: number;
}

export interface BarberPreview {
  slug: string;
  name: string;
  role: string;
  bio: string;
  specialties: readonly string[];
  image: ImageMetadata;
  imageAlt: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  alt: string;
  image: ImageMetadata;
  orientation: "landscape" | "portrait";
}

export const services: readonly ServicePreview[] = [
  {
    slug: "strzyzenie-meskie",
    name: "Strzyżenie męskie",
    shortDescription: "Konsultacja, precyzyjne cięcie i wykończenie dopasowane do Ciebie.",
    description:
      "Zaczynamy od krótkiej konsultacji, oceny kierunku wzrostu włosów i ustalenia formy. Fryzurę kończymy stylizacją oraz prostymi wskazówkami do codziennej pielęgnacji.",
    durationMinutes: 45,
    priceGrosze: 7000,
  },
  {
    slug: "strzyzenie-brody",
    name: "Strzyżenie brody",
    shortDescription: "Czysta linia, odpowiednie proporcje i komfortowe wykończenie.",
    description:
      "Kształt brody dobieramy do rysów twarzy i sposobu, w jaki naturalnie układa się zarost. Usługa obejmuje konturowanie, skrócenie i pielęgnację.",
    durationMinutes: 30,
    priceGrosze: 5000,
  },
  {
    slug: "combo",
    name: "Combo: włosy + broda",
    shortDescription: "Pełna usługa dla spójnego, dopracowanego efektu.",
    description:
      "Strzyżenie włosów i brody podczas jednej wizyty. Pracujemy nad całością w taki sposób, by fryzura, zarost i proporcje twarzy tworzyły konsekwentny efekt.",
    durationMinutes: 75,
    priceGrosze: 11000,
  },
  {
    slug: "strzyzenie-dzieciece",
    name: "Strzyżenie dziecięce",
    shortDescription: "Spokojna wizyta i wygodna fryzura dla młodszego klienta.",
    description:
      "Usługa dla dzieci wykonywana bez pośpiechu, w spokojnej atmosferze. Formę dopasowujemy do wieku, wygody i codziennej pielęgnacji.",
    durationMinutes: 45,
    priceGrosze: 6000,
  },
  {
    slug: "golenie-brzytwa",
    name: "Golenie brzytwą",
    shortDescription: "Klasyczny rytuał z przygotowaniem skóry i precyzyjnym goleniem.",
    description:
      "Tradycyjne golenie obejmujące przygotowanie skóry, ciepły ręcznik, precyzyjną pracę brzytwą oraz łagodzące wykończenie.",
    durationMinutes: 45,
    priceGrosze: 6500,
  },
];

export const barbers: readonly BarberPreview[] = [
  {
    slug: "michal",
    name: "Michał",
    role: "Barber",
    bio: "Ceni klasyczne formy, czyste przejścia i fryzury, które dobrze pracują także między wizytami.",
    specialties: ["Klasyczne cięcia", "Fade", "Stylizacja"],
    image: barberMichalImage,
    imageAlt: "Portret Michała, barbera w Brzytwa Barber",
  },
  {
    slug: "kamil",
    name: "Kamil",
    role: "Barber",
    bio: "Łączy współczesne tekstury z prostą pielęgnacją. Lubi szukać formy dopasowanej do naturalnego układu włosów.",
    specialties: ["Tekstury", "Dłuższe formy", "Konsultacja"],
    image: barberKamilImage,
    imageAlt: "Portret Kamila, barbera w Brzytwa Barber",
  },
  {
    slug: "adrian",
    name: "Adrian",
    role: "Barber",
    bio: "Specjalizuje się w pracy z brodą i kompletnych metamorfozach, w których każdy detal ma swoje uzasadnienie.",
    specialties: ["Broda", "Combo", "Golenie"],
    image: barberAdrianImage,
    imageAlt: "Portret Adriana, barbera w Brzytwa Barber",
  },
];

export const galleryItems: readonly GalleryItem[] = [
  {
    id: "wnetrze",
    title: "Wnętrze",
    alt: "Trzy stanowiska barberskie w grafitowo-miedzianym wnętrzu",
    image: interiorImage,
    orientation: "landscape",
  },
  {
    id: "stanowisko",
    title: "Stanowisko",
    alt: "Przygotowane narzędzia i kosmetyki na drewnianym stanowisku",
    image: workstationImage,
    orientation: "landscape",
  },
  {
    id: "broda",
    title: "Pielęgnacja brody",
    alt: "Barber precyzyjnie modelujący brodę klienta",
    image: beardTrimImage,
    orientation: "landscape",
  },
  {
    id: "rzemioslo",
    title: "Rzemiosło",
    alt: "Barber wykonujący precyzyjne strzyżenie w nowoczesnym salonie",
    image: heroImage,
    orientation: "landscape",
  },
];

export { heroImage };

export function formatPrice(priceGrosze: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(priceGrosze / 100);
}
