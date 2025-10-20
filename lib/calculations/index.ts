import {
  format,
  addMonths,
  startOfMonth,
  differenceInMonths,
  isAfter,
  isBefore,
} from "date-fns";
import type {
  Project,
  Scenario,
  Site,
  ASICFleet,
  FleetAssignment,
  TeamMember,
  ASICModel,
  TeamProfile,
  MonthlyFinancialMetrics,
  SiteMonthlyMetrics,
  ScenarioResults,
} from "@/lib/types";

const SITE_CAPEX_DEPRECIATION_YEARS = 10; // Site infrastructure depreciation period
const BLOCKS_PER_DAY = 144;
const DAYS_PER_MONTH = 30;
const BLOCKS_PER_MONTH = BLOCKS_PER_DAY * DAYS_PER_MONTH; // ~4,320
const HOURS_PER_MONTH = 730; // Average hours in a month

// Realistic miner failure model parameters
// Uses Weibull-like distribution: minimal early failures, very steep acceleration near end of lifespan
const FAILURE_SHAPE = 10; // Shape parameter: >1 means accelerating failure rate (10 = extremely steep wear-out)
const FAILURE_SCALE = 0.98; // Scale parameter: controls when most failures occur (0.98 = 90% of failures in last year)

// Halving dates (approximate)
const HALVING_DATES = [
  { date: new Date("2009-01-03"), reward: 50 },      // Genesis
  { date: new Date("2012-11-28"), reward: 25 },      // 1st halving
  { date: new Date("2016-07-09"), reward: 12.5 },    // 2nd halving
  { date: new Date("2020-05-11"), reward: 6.25 },    // 3rd halving
  { date: new Date("2024-04-19"), reward: 3.125 },   // 4th halving (current)
  { date: new Date("2028-04-01"), reward: 1.5625 },  // 5th halving (estimated)
  { date: new Date("2032-04-01"), reward: 0.78125 }, // 6th halving (estimated)
];

/**
 * Calculate the block reward for a given date based on Bitcoin halving schedule
 */
function getBlockReward(date: Date): number {
  // Find the most recent halving before or on this date
  let reward = 50; // Default to genesis reward
  
  for (let i = HALVING_DATES.length - 1; i >= 0; i--) {
    if (date >= HALVING_DATES[i].date) {
      reward = HALVING_DATES[i].reward;
      break;
    }
  }
  
  return reward;
}

/**
 * Calculate cumulative failure rate using Weibull-like distribution
 * This creates a realistic failure curve with steep acceleration at end of life:
 * - Early life (0-80% of lifespan): <5% failures (minimal wear, well within operating parameters)
 * - Late mid-life (80-90% of lifespan): ~5-20% failures (components starting to degrade)
 * - End of life (90-100% of lifespan): ~20-95% failures (steep accelerating wear-out)
 * 
 * @param ageMonths - Time since fleet origination (includes storage time)
 * @param lifespanMonths - Expected lifespan in months
 * @returns Cumulative failure rate (0 to 1)
 */
function calculateCumulativeFailureRate(
  ageMonths: number,
  lifespanMonths: number
): number {
  if (ageMonths <= 0) return 0;
  if (ageMonths >= lifespanMonths) return 0.95; // 95% failed by end of lifespan
  
  // Normalized age (0 to 1)
  const normalizedAge = ageMonths / lifespanMonths;
  
  // Weibull-like CDF: 1 - exp(-(t/scale)^shape)
  // Adjusted to reach ~95% failure by end of lifespan
  const scaledAge = normalizedAge / FAILURE_SCALE;
  const cumulativeFailure = 1 - Math.exp(-Math.pow(scaledAge, FAILURE_SHAPE));
  
  // Scale to reach 95% by end of lifespan (not 100%)
  return Math.min(cumulativeFailure * 0.95, 0.95);
}

interface CalculationContext {
  project: Project;
  scenario: Scenario;
  sites: Site[];
  fleets: ASICFleet[];
  fleetAssignments: FleetAssignment[];
  teamMembers: TeamMember[];
  asicModels: ASICModel[];
  teamProfiles: TeamProfile[];
}

interface MonthlyFleetStatus {
  fleetId: string;
  totalMiners: number;
  failedMiners: number;
  activeMiners: number;
}

interface MonthlyTrancheStatus {
  siteId: string;
  trancheId: string;
  availablePowerMW: number; // Considering ramp-up
  allocatedMiners: number;
  powerUsedMW: number;
  hashrateThs: number;
}

export async function calculateScenarioMetrics(
  context: CalculationContext
): Promise<ScenarioResults> {
  const months = generateMonthRange(context.project);
  const monthlyMetrics: MonthlyFinancialMetrics[] = [];

  for (const month of months) {
    const metrics = calculateMonthMetrics(month, context);
    monthlyMetrics.push(metrics);
  }

  return {
    scenarioId: context.scenario.id,
    scenarioName: context.scenario.name,
    monthlyMetrics,
  };
}

function generateMonthRange(project: Project): Date[] {
  const months: Date[] = [];
  const start = startOfMonth(new Date(project.startDate));
  const end = startOfMonth(new Date(project.endDate));

  let current = start;
  while (current <= end) {
    months.push(current);
    current = addMonths(current, 1);
  }

  return months;
}

function calculateMonthMetrics(
  month: Date,
  context: CalculationContext
): MonthlyFinancialMetrics {
  const monthStr = format(month, "yyyy-MM-dd");

  // Get economic data for this month
  const economicData = context.scenario.monthlyData.find(
    (d) => d.month === monthStr
  );
  const btcPriceUSD = economicData?.btcPriceUSD || 40000;
  const globalHashrateEH = economicData?.globalHashrateEH || 500;
  const txFeesPerBlock = economicData?.txFeesPerBlock || 0.05;

  // Calculate fleet statuses (failures over time)
  const fleetStatuses = calculateFleetStatuses(month, context);

  // Calculate tranche statuses and allocate fleets
  const trancheStatuses = allocateFleetsToTranches(
    month,
    context,
    fleetStatuses
  );

  // Calculate totals
  const totalActiveMiners = trancheStatuses.reduce(
    (sum, t) => sum + t.allocatedMiners,
    0
  );
  const totalFailedMiners = fleetStatuses.reduce(
    (sum, f) => sum + f.failedMiners,
    0
  );
  const totalMinersInFleets = fleetStatuses.reduce(
    (sum, f) => sum + f.totalMiners,
    0
  );
  const spareMiners = totalMinersInFleets - totalFailedMiners - totalActiveMiners;

  const totalHashrateThs = trancheStatuses.reduce(
    (sum, t) => sum + t.hashrateThs,
    0
  );

  // Calculate revenue with halving-aware block reward
  const blockReward = getBlockReward(month);
  const globalHashrateThS = globalHashrateEH * 1_000_000;
  const hashrateFraction =
    globalHashrateThS > 0 ? totalHashrateThs / globalHashrateThS : 0;

  // Revenue formula: (our_hashrate / global_hashrate) × (block_reward + tx_fees) × blocks_per_month
  const btcMinedGross = hashrateFraction * blockReward * BLOCKS_PER_MONTH;
  const txFeeRevenueBTC = hashrateFraction * txFeesPerBlock * BLOCKS_PER_MONTH;

  // Pool fee is applied per site/tranche
  let btcAfterPoolFee = 0;
  const siteMetrics: SiteMonthlyMetrics[] = [];

  for (const site of context.sites) {
    const siteTranches = trancheStatuses.filter((t) => t.siteId === site.id);
    if (siteTranches.length === 0) continue;

    const siteHashrate = siteTranches.reduce((sum, t) => sum + t.hashrateThs, 0);
    const siteBtcMined =
      (siteHashrate / totalHashrateThs) * btcMinedGross || 0;
    const siteTxFees =
      (siteHashrate / totalHashrateThs) * txFeeRevenueBTC || 0;

    // Apply pool fee (average across tranches weighted by hashrate)
    const avgPoolFee =
      siteTranches.reduce((sum, t) => {
        const tranche = site.tranches.find((tr) => tr.id === t.trancheId);
        return sum + (tranche?.poolFee || 0) * t.hashrateThs;
      }, 0) / siteHashrate || 0;

    const siteBtcAfterFee = (siteBtcMined + siteTxFees) * (1 - avgPoolFee);
    btcAfterPoolFee += siteBtcAfterFee;

    // Calculate site expenses
    const siteMiners = siteTranches.reduce((sum, t) => sum + t.allocatedMiners, 0);
    const sitePowerUsed = siteTranches.reduce((sum, t) => sum + t.powerUsedMW, 0);

    // Electricity cost per tranche
    const siteElectricityCost = siteTranches.reduce((sum, t) => {
      const tranche = site.tranches.find((tr) => tr.id === t.trancheId);
      if (!tranche) return sum;
      return (
        sum +
        t.powerUsedMW * 1000 * HOURS_PER_MONTH * tranche.electricityPricePerKWh
      );
    }, 0);

    // OPEX per tranche (monthly portion)
    const siteOpex = siteTranches.reduce((sum, t) => {
      const tranche = site.tranches.find((tr) => tr.id === t.trancheId);
      if (!tranche) return sum;
      const trancheOpex =
        Object.values(tranche.opex).reduce((s, v) => s + v, 0) / 12;
      return sum + trancheOpex;
    }, 0);

    // CAPEX depreciation per tranche
    // CAPEX includes: electrical infrastructure, civil works, warehouse, containers, office, IT & networking
    // These capital expenditures are amortized (straight-line depreciation) over 10 years
    // Monthly depreciation = Total CAPEX / (10 years × 12 months) = Total CAPEX / 120 months
    const siteCapex = siteTranches.reduce((sum, t) => {
      const tranche = site.tranches.find((tr) => tr.id === t.trancheId);
      if (!tranche) return sum;
      const trancheCapex =
        Object.values(tranche.capex).reduce((s, v) => s + v, 0) /
        (SITE_CAPEX_DEPRECIATION_YEARS * 12);
      return sum + trancheCapex;
    }, 0);

    // Miner depreciation for fleets assigned to this site
    // Each fleet is depreciated over its lifespan (not site CAPEX depreciation period)
    // Monthly depreciation = (Price per TH/s × Total hashrate) / (Lifespan years × 12)
    const siteMinerDepreciation = calculateMinerDepreciation(
      month,
      site.id,
      context
    );

    // Team costs for this site
    const siteTeamCost = calculateTeamCosts(
      month,
      context,
      "site",
      site.id
    );

    // Tranche-level team costs
    const trancheTeamCost = siteTranches.reduce((sum, t) => {
      return sum + calculateTeamCosts(month, context, "tranche", t.trancheId);
    }, 0);

    const siteTotalTeamCost = siteTeamCost + trancheTeamCost;
    const siteTotalExpenses =
      siteElectricityCost + siteOpex + siteCapex + siteMinerDepreciation + siteTotalTeamCost;
    const siteRevenue = siteBtcAfterFee * btcPriceUSD;
    // EBITDA = Earnings Before Interest, Taxes, Depreciation, and Amortization
    // Should exclude depreciation (both site CAPEX and miner depreciation)
    const siteEbitda = siteRevenue - (siteElectricityCost + siteOpex + siteTotalTeamCost);

    siteMetrics.push({
      siteId: site.id,
      siteName: site.name,
      activeMiners: siteMiners,
      powerUsedMW: sitePowerUsed,
      hashrateThs: siteHashrate,
      btcMined: siteBtcAfterFee,
      revenue: siteRevenue,
      electricityCost: siteElectricityCost,
      opexCost: siteOpex,
      capexDepreciation: siteCapex,
      minerDepreciation: siteMinerDepreciation,
      teamCost: siteTotalTeamCost,
      totalExpenses: siteTotalExpenses,
      ebitda: siteEbitda,
    });
  }

  const totalBTC = btcAfterPoolFee;
  const revenueUSD = totalBTC * btcPriceUSD;

  // Calculate total expenses
  const electricityCost = siteMetrics.reduce(
    (sum, s) => sum + s.electricityCost,
    0
  );
  const opexCost = siteMetrics.reduce((sum, s) => sum + s.opexCost, 0);
  const capexDepreciation = siteMetrics.reduce(
    (sum, s) => sum + s.capexDepreciation,
    0
  );
  const minerDepreciation = siteMetrics.reduce(
    (sum, s) => sum + s.minerDepreciation,
    0
  );
  const siteTeamCostTotal = siteMetrics.reduce((sum, s) => sum + s.teamCost, 0);
  const companyTeamCost = calculateTeamCosts(month, context, "company");
  const teamCost = siteTeamCostTotal + companyTeamCost;

  const totalExpenses =
    electricityCost + opexCost + capexDepreciation + minerDepreciation + teamCost;
  // EBITDA = Earnings Before Interest, Taxes, Depreciation, and Amortization
  // Should exclude depreciation (both site CAPEX and miner depreciation)
  const ebitda = revenueUSD - (electricityCost + opexCost + teamCost);
  const costPerBTC = totalBTC > 0 ? totalExpenses / totalBTC : 0;

  // Build fleet metrics for visualization
  const fleetMetrics = fleetStatuses.map((fs) => {
    const fleet = context.fleets.find((f) => f.id === fs.fleetId);
    return {
      fleetId: fs.fleetId,
      modelId: fleet?.modelId || "",
      activeMiners: fs.activeMiners,
      failedMiners: fs.failedMiners,
    };
  });

  return {
    month: monthStr,
    activeMiners: totalActiveMiners,
    failedMiners: totalFailedMiners,
    spareMiners,
    totalHashrateThs,
    btcMined: btcMinedGross,
    btcAfterPoolFee: totalBTC,
    txFeeRevenueBTC,
    totalBTC,
    revenueUSD,
    electricityCost,
    opexCost,
    capexDepreciation,
    minerDepreciation,
    teamCost,
    totalExpenses,
    ebitda,
    costPerBTC,
    siteMetrics,
    fleetMetrics,
  };
}

function calculateFleetStatuses(
  month: Date,
  context: CalculationContext
): MonthlyFleetStatus[] {
  return context.fleets.map((fleet) => {
    const model = context.asicModels.find((m) => m.id === fleet.modelId);
    if (!model) {
      return {
        fleetId: fleet.id,
        totalMiners: 0,
        failedMiners: 0,
        activeMiners: 0,
      };
    }

    // Calculate total miners in fleet
    let totalMiners = 0;
    if (fleet.quantityMode === "miners") {
      totalMiners = fleet.quantityMiners || 0;
    } else {
      totalMiners = Math.floor(((fleet.quantityMW || 0) * 1_000_000) / model.powerW);
    }

    // Calculate failures based on time since origination using realistic Weibull-like curve
    const originDate = new Date(fleet.originationDate);
    if (isAfter(month, originDate)) {
      const monthsSinceOrigination = differenceInMonths(month, originDate);
      const lifespanMonths = fleet.lifespanYears * 12;

      // Calculate cumulative failure rate using Weibull distribution
      // This creates accelerating failure: low early, high at end of life
      const cumulativeFailureRate = calculateCumulativeFailureRate(
        monthsSinceOrigination,
        lifespanMonths
      );
      
      const failedMiners = Math.floor(totalMiners * cumulativeFailureRate);

      // Beyond lifespan, 95% of miners have failed (5% might still work but unreliable)
      if (monthsSinceOrigination >= lifespanMonths) {
        return {
          fleetId: fleet.id,
          totalMiners,
          failedMiners: Math.floor(totalMiners * 0.95),
          activeMiners: Math.ceil(totalMiners * 0.05), // ~5% survivors
        };
      }

      return {
        fleetId: fleet.id,
        totalMiners,
        failedMiners: Math.min(failedMiners, totalMiners),
        activeMiners: totalMiners - Math.min(failedMiners, totalMiners),
      };
    }

    // Fleet not yet originated
    return {
      fleetId: fleet.id,
      totalMiners,
      failedMiners: 0,
      activeMiners: 0,
    };
  });
}

function allocateFleetsToTranches(
  month: Date,
  context: CalculationContext,
  fleetStatuses: MonthlyFleetStatus[]
): MonthlyTrancheStatus[] {
  const trancheStatuses: MonthlyTrancheStatus[] = [];

  // Build list of active tranches with available power
  for (const site of context.sites) {
    for (const tranche of site.tranches) {
      const trancheStartDate = new Date(tranche.startDate);

      // Check if tranche is active this month
      if (isBefore(month, trancheStartDate)) {
        continue; // Not started yet
      }

      // Calculate available power considering ramp-up
      const monthsSinceStart = differenceInMonths(month, trancheStartDate);
      let availablePowerMW = tranche.powerMW;

      if (monthsSinceStart < tranche.rampUpMonths) {
        // Linear ramp-up
        const rampUpFraction =
          tranche.rampUpMonths > 0
            ? (monthsSinceStart + 1) / tranche.rampUpMonths
            : 1;
        availablePowerMW = tranche.powerMW * rampUpFraction;
      }

      trancheStatuses.push({
        siteId: site.id,
        trancheId: tranche.id,
        availablePowerMW,
        allocatedMiners: 0,
        powerUsedMW: 0,
        hashrateThs: 0,
      });
    }
  }

  // Sort tranches by start date (earliest first)
  trancheStatuses.sort((a, b) => {
    const trancheA = context.sites
      .flatMap((s) => s.tranches)
      .find((t) => t.id === a.trancheId);
    const trancheB = context.sites
      .flatMap((s) => s.tranches)
      .find((t) => t.id === b.trancheId);
    if (!trancheA || !trancheB) return 0;
    return new Date(trancheA.startDate).getTime() - new Date(trancheB.startDate).getTime();
  });

  // Allocate fleets to tranches
  const allocatedFleets = new Map<string, number>(); // fleetId -> miners allocated

  for (const tranche of trancheStatuses) {
    // Find fleets assigned to this site
    const siteAssignments = context.fleetAssignments.filter(
      (a) => a.siteId === tranche.siteId
    );

    for (const assignment of siteAssignments) {
      const fleetStatus = fleetStatuses.find(
        (f) => f.fleetId === assignment.fleetId
      );
      if (!fleetStatus || fleetStatus.activeMiners === 0) continue;

      const fleet = context.fleets.find((f) => f.id === assignment.fleetId);
      const model = context.asicModels.find((m) => m.id === fleet?.modelId);
      if (!fleet || !model) continue;

      // Calculate how many miners already allocated from this fleet
      const alreadyAllocated = allocatedFleets.get(fleet.id) || 0;
      const availableMiners = fleetStatus.activeMiners - alreadyAllocated;

      if (availableMiners <= 0) continue;

      // Calculate how many miners can fit in remaining power
      const remainingPowerMW = tranche.availablePowerMW - tranche.powerUsedMW;
      const minersThatFit = Math.floor(
        (remainingPowerMW * 1_000_000) / model.powerW
      );

      // Allocate miners
      const minersToAllocate = Math.min(availableMiners, minersThatFit);
      if (minersToAllocate > 0) {
        tranche.allocatedMiners += minersToAllocate;
        tranche.powerUsedMW += (minersToAllocate * model.powerW) / 1_000_000;

        // Get tranche details for uptime
        const trancheDetails = context.sites
          .flatMap((s) => s.tranches)
          .find((t) => t.id === tranche.trancheId);
        const uptime = trancheDetails?.uptime || 1;

        tranche.hashrateThs += minersToAllocate * model.hashrateThS * uptime;

        allocatedFleets.set(fleet.id, alreadyAllocated + minersToAllocate);
      }
    }
  }

  return trancheStatuses;
}

function calculateTeamCosts(
  month: Date,
  context: CalculationContext,
  scopeType: "company" | "site" | "tranche",
  targetId?: string
): number {
  const relevantMembers = context.teamMembers.filter((member) => {
    if (member.scope.type !== scopeType) return false;
    if (scopeType === "company") return true;
    return member.scope.targetId === targetId;
  });

  let totalCost = 0;
  for (const member of relevantMembers) {
    const startDate = new Date(member.startDate);
    if (isBefore(month, startDate)) continue;

    const profile = context.teamProfiles.find((p) => p.id === member.profileId);
    if (!profile) continue;

    const monthlyCost = (profile.annualSalary * member.employmentRate) / 12;
    totalCost += monthlyCost;
  }

  return totalCost;
}

function calculateMinerDepreciation(
  month: Date,
  siteId: string,
  context: CalculationContext
): number {
  // Get all fleet assignments for this site
  const siteFleetAssignments = context.fleetAssignments.filter(
    (a) => a.siteId === siteId
  );

  let totalDepreciation = 0;

  for (const assignment of siteFleetAssignments) {
    const fleet = context.fleets.find((f) => f.id === assignment.fleetId);
    if (!fleet) continue;

    const model = context.asicModels.find((m) => m.id === fleet.modelId);
    if (!model) continue;

    // Check if fleet is active (within lifespan)
    const originDate = new Date(fleet.originationDate);
    if (isBefore(month, originDate)) continue; // Fleet hasn't started yet

    const monthsSinceOrigination = differenceInMonths(month, originDate);
    const lifespanMonths = fleet.lifespanYears * 12;

    // Fleet has exceeded lifespan, no more depreciation
    if (monthsSinceOrigination >= lifespanMonths) continue;

    // Calculate total fleet cost
    // Total hashrate = number of miners × hashrate per miner
    let totalMiners = 0;
    if (fleet.quantityMode === "miners") {
      totalMiners = fleet.quantityMiners || 0;
    } else {
      // Calculate from MW
      totalMiners = Math.floor(
        ((fleet.quantityMW || 0) * 1_000_000) / model.powerW
      );
    }

    const totalHashrateTh = totalMiners * model.hashrateThS;
    const fleetCost = totalHashrateTh * model.pricePerTh;

    // Monthly depreciation over fleet lifespan
    const monthlyDepreciation = fleetCost / lifespanMonths;
    totalDepreciation += monthlyDepreciation;
  }

  return totalDepreciation;
}

