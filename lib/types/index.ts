// Core data types for the Bitcoin Mining Financial Model application

export interface Project {
  id: string;
  name: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  createdAt: string; // ISO date string
}

export interface Site {
  id: string;
  projectId: string;
  name: string;
  startDate: string; // ISO date string
  tranches: Tranche[];
}

export interface Tranche {
  id: string;
  name: string;
  powerMW: number;
  startDate: string; // ISO date string
  rampUpMonths: number;
  uptime: number; // 0-1 (e.g., 0.95 for 95%)
  capex: CapexBreakdown;
  electricityPricePerKWh: number; // $/kWh
  opex: OpexBreakdown;
  poolFee: number; // 0-1 (e.g., 0.02 for 2%)
}

export interface CapexBreakdown {
  electrical: number;
  civil: number;
  warehouse: number;
  containers: number;
  office: number;
  itNetworking: number;
}

export interface OpexBreakdown {
  insurance: number; // yearly
  maintenance: number; // yearly
  security: number; // yearly
  monitoring: number; // yearly
}

export interface TeamProfile {
  id: string;
  name: string;
  annualSalary: number;
}

export type ScopeType = "company" | "site" | "tranche";

export interface TeamMemberScope {
  type: ScopeType;
  targetId?: string; // siteId or trancheId (undefined for company)
}

export interface TeamMember {
  id: string;
  projectId: string;
  profileId: string;
  scope: TeamMemberScope;
  startDate: string; // ISO date string
  employmentRate: number; // 0-1 (e.g., 1 for 100%, 0.5 for 50%)
}

export interface ASICModel {
  id: string;
  name: string;
  powerW: number; // watts
  hashrateThS: number; // TH/s
  pricePerTh: number; // $/(TH/s)
}

export type QuantityMode = "miners" | "mw";

export interface ASICFleet {
  id: string;
  projectId: string;
  modelId: string;
  quantityMode: QuantityMode;
  quantityMiners?: number;
  quantityMW?: number;
  originationDate: string; // ISO date string (when fleet is acquired/delivered)
  lifespanYears: number;
  // Note: Failure rate is calculated dynamically using Weibull-like curve
  // Early life: low failures, end of life: accelerating failures
}

export interface FleetAssignment {
  id: string;
  fleetId: string;
  siteId: string;
  priority: number; // Lower number = higher priority (deployed first)
}

export interface ScenarioMonthlyData {
  month: string; // ISO date string (first day of month)
  btcPriceUSD: number;
  globalHashrateEH: number; // EH/s
  txFeesPerBlock: number; // BTC per block
}

export interface Scenario {
  id: string;
  projectId: string;
  name: string;
  isGenerated: boolean;
  monthlyData: ScenarioMonthlyData[];
}

// Export/Import data structure
export interface ExportData {
  version: string;
  exportDate: string;
  project: Project;
  sites: Site[];
  teamProfiles: TeamProfile[];
  teamMembers: TeamMember[];
  asicModels: ASICModel[];
  fleets: ASICFleet[];
  fleetAssignments: FleetAssignment[];
  scenarios: Scenario[];
}

// Calculation results
export interface MonthlyFinancialMetrics {
  month: string; // ISO date string
  // Mining metrics
  activeMiners: number;
  failedMiners: number;
  spareMiners: number;
  totalHashrateThs: number;
  
  // Revenue
  btcMined: number;
  btcAfterPoolFee: number;
  txFeeRevenueBTC: number;
  totalBTC: number;
  revenueUSD: number;
  
  // Expenses
  electricityCost: number;
  opexCost: number;
  capexDepreciation: number;
  minerDepreciation: number;
  teamCost: number;
  totalExpenses: number;
  
  // Metrics
  ebitda: number;
  costPerBTC: number;
  
  // Site breakdown
  siteMetrics: SiteMonthlyMetrics[];
  
  // Fleet breakdown (for deployment visualization)
  fleetMetrics: FleetMonthlyMetrics[];
}

export interface FleetMonthlyMetrics {
  fleetId: string;
  modelId: string;
  activeMiners: number;
  failedMiners: number;
}

export interface SiteMonthlyMetrics {
  siteId: string;
  siteName: string;
  activeMiners: number;
  powerUsedMW: number;
  hashrateThs: number;
  btcMined: number;
  revenue: number;
  electricityCost: number;
  opexCost: number;
  capexDepreciation: number;
  minerDepreciation: number;
  teamCost: number;
  totalExpenses: number;
  ebitda: number;
}

export interface ScenarioResults {
  scenarioId: string;
  scenarioName: string;
  monthlyMetrics: MonthlyFinancialMetrics[];
}

