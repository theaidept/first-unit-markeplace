import {
  Backpack, CarFront, Brush, Building2, HardHat, Radio, Flashlight, Shirt,
  BadgeCheck, Wrench, Camera, Watch, House, Star, Siren,
} from "lucide-react";
import { useEffect, useState } from "react";
import api from "./api";

export const CATEGORY_ICONS = {
  backpack: Backpack,
  car: CarFront,
  brush: Brush,
  building: Building2,
  helmet: HardHat,
  radio: Radio,
  flashlight: Flashlight,
  shirt: Shirt,
  badge: BadgeCheck,
  wrench: Wrench,
  camera: Camera,
  watch: Watch,
  house: House,
  star: Star,
  siren: Siren,
};

const FALLBACK_NAMES = {
  gear: "Gear & Equipment",
  vehicles: "Vehicles",
  art: "Art & Personal Items",
};

let cached = null;
let pending = null;

export function rememberCategories(list) {
  cached = list || [];
}

export function ensureCategories() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = api.get("/categories")
      .then((r) => {
        cached = r.data.categories || [];
        return cached;
      })
      .catch(() => {
        cached = [];
        return cached;
      });
  }
  return pending;
}

export function categoryName(slug) {
  const hit = (cached || []).find((c) => c.slug === slug);
  return hit?.name || FALLBACK_NAMES[slug] || slug || "";
}

export function useCategoryLabel(slug) {
  const [name, setName] = useState(() => categoryName(slug));
  useEffect(() => {
    let live = true;
    ensureCategories().then(() => { if (live) setName(categoryName(slug)); });
    return () => { live = false; };
  }, [slug]);
  return name;
}

export function CategoryGlyph({ name, size = 28 }) {
  const Icon = CATEGORY_ICONS[name] || Backpack;
  return <Icon size={size} strokeWidth={1.75} />;
}
