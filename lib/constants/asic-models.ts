import type { ASICModel } from "@/lib/types";

export const PREDEFINED_ASIC_MODELS: ASICModel[] = [
  {
    id: "antminer-s19-xp-hyd",
    name: "Antminer S19 XP+ Hyd",
    powerW: 5301,
    hashrateThS: 279,
    pricePerTh: 8.0,
  },
  {
    id: "antminer-s21e-hydro",
    name: "Antminer S21e Hydro",
    powerW: 4896,
    hashrateThS: 288,
    pricePerTh: 9.5,
  },
  {
    id: "antminer-s23-hydro",
    name: "Antminer S23 Hydro",
    powerW: 5510,
    hashrateThS: 580,
    pricePerTh: 25.0,
  },
];

