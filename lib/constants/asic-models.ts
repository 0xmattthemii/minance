import type { ASICModel } from "@/lib/types";

export const PREDEFINED_ASIC_MODELS: ASICModel[] = [
  {
    id: "antminer-s19-hyd",
    name: "Antminer S19 Hydro",
    powerW: 5346,
    hashrateThS: 257,
    pricePerTh: 6.0,
  },
  {
    id: "antminer-s19-xp-plus-hyd",
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
    pricePerTh: 10,
  },
  {
    id: "antminer-s23-hydro",
    name: "Antminer S23 Hydro",
    powerW: 5510,
    hashrateThS: 580,
    pricePerTh: 25.0,
  },
];

