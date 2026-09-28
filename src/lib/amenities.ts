import {
  Car,
  ShowerHead,
  Lock,
  Coffee,
  Lightbulb,
  Wifi,
  Volleyball,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

export const AMENITIES: Record<string, { label: string; icon: LucideIcon }> = {
  parking: { label: "Πάρκινγκ", icon: Car },
  showers: { label: "Ντουζ", icon: ShowerHead },
  lockers: { label: "Lockers", icon: Lock },
  cafe: { label: "Καφέ / Bar", icon: Coffee },
  lighting: { label: "Φωτισμός", icon: Lightbulb },
  wifi: { label: "Wi-Fi", icon: Wifi },
  equipment_rental: { label: "Ενοικίαση εξοπλισμού", icon: Volleyball },
  coaching: { label: "Προπονητές", icon: GraduationCap },
};

export function amenityMeta(slug: string) {
  return AMENITIES[slug] ?? { label: slug, icon: Volleyball };
}
