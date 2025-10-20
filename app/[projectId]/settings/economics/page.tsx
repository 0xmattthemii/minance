"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  getScenariosByProject,
  createScenario,
  updateScenario,
  deleteScenario,
  getProject,
} from "@/lib/db";
import type { Scenario, ScenarioMonthlyData, Project } from "@/lib/types";
import { Plus, Pencil, Trash2, Download, Wand2, LineChart } from "lucide-react";
import { format, addMonths, differenceInMonths, startOfMonth } from "date-fns";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// Halving dates for block reward calculation
const HALVING_DATES = [
  { date: new Date("2009-01-03"), reward: 50 },      // Genesis
  { date: new Date("2012-11-28"), reward: 25 },      // 1st halving
  { date: new Date("2016-07-09"), reward: 12.5 },    // 2nd halving
  { date: new Date("2020-05-11"), reward: 6.25 },    // 3rd halving
  { date: new Date("2024-04-19"), reward: 3.125 },   // 4th halving (current)
  { date: new Date("2028-04-01"), reward: 1.5625 },  // 5th halving (estimated)
  { date: new Date("2032-04-01"), reward: 0.78125 }, // 6th halving (estimated)
];

const BLOCKS_PER_DAY = 144;

/**
 * Calculate the block reward for a given date based on Bitcoin halving schedule
 */
function getBlockReward(date: Date): number {
  let reward = 50;
  for (let i = HALVING_DATES.length - 1; i >= 0; i--) {
    if (date >= HALVING_DATES[i].date) {
      reward = HALVING_DATES[i].reward;
      break;
    }
  }
  return reward;
}

/**
 * Calculate halving-driven price boost for BTC
 * Returns a multiplier (0 to 1) that boosts BTC drift around halvings
 * Anticipation builds BEFORE halving, then returns to normal
 */
function getHalvingBoost(date: Date): number {
  // Find the next upcoming halving
  let nextHalving: Date | null = null;
  
  for (const halving of HALVING_DATES) {
    const monthsUntilHalving = differenceInMonths(halving.date, date);
    // If halving is in the future and within 18 months
    if (monthsUntilHalving > 0 && monthsUntilHalving <= 18) {
      nextHalving = halving.date;
      break;
    }
  }
  
  if (!nextHalving) return 0;
  
  const monthsUntilHalving = differenceInMonths(nextHalving, date);
  
  // Boost pattern - peaks right before halving, then drops off:
  // - 18-12 months before: slow anticipation build (0 → 0.3)
  // - 12-6 months before: accelerating excitement (0.3 → 0.7)
  // - 6-0 months before: peak anticipation (0.7 → 1.0)
  // - After halving: back to 0 (normal drift)
  
  if (monthsUntilHalving > 18) {
    return 0;
  } else if (monthsUntilHalving > 12) {
    // 18-12 months: slow build
    const progress = (18 - monthsUntilHalving) / 6; // 0 to 1
    return progress * 0.3; // 0 to 0.3
  } else if (monthsUntilHalving > 6) {
    // 12-6 months: accelerating
    const progress = (12 - monthsUntilHalving) / 6; // 0 to 1
    return 0.3 + progress * 0.4; // 0.3 to 0.7
  } else {
    // 6-0 months: peak anticipation
    const progress = (6 - monthsUntilHalving) / 6; // 0 to 1
    return 0.7 + progress * 0.3; // 0.7 to 1.0
  }
}

/**
 * Calculate hashprice in $/PH/s per day
 * Formula: (Daily BTC Revenue × BTC Price) / Global Hashrate in PH/s
 * Where Daily BTC Revenue = (Block Reward + TX Fees) × Blocks per Day
 */
function calculateHashprice(
  btcPriceUSD: number,
  globalHashrateEH: number,
  txFeesPerBlock: number,
  date: Date
): number {
  const blockReward = getBlockReward(date);
  const dailyBTC = (blockReward + txFeesPerBlock) * BLOCKS_PER_DAY;
  const dailyRevenue = dailyBTC * btcPriceUSD;
  // Industry standard hashprice uses EH/s × 1000 as denominator
  // This gives $/PH/s per day in the 25-100 range
  const hashprice = dailyRevenue / (globalHashrateEH * 1000);
  return hashprice;
}

export default function EconomicsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDataDialogOpen, setIsEditDataDialogOpen] = useState(false);
  const [isVisualizingScenario, setIsVisualizingScenario] = useState<string | null>(null);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    trend: "normal" as "conservative" | "normal" | "optimistic",
  });
  const [editingScenarioName, setEditingScenarioName] = useState<string | null>(null);
  const [editNameFormData, setEditNameFormData] = useState({ name: "" });
  const [monthlyData, setMonthlyData] = useState<ScenarioMonthlyData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadData = async () => {
    const proj = await getProject(projectId);
    setProject(proj || null);
    const data = await getScenariosByProject(projectId);
    setScenarios(data);
  };

  const fetchCurrentData = async (): Promise<{
    btcPrice: number;
    hashrate: number; // in EH/s
    avgTxFees: number; // BTC per block
  }> => {
    try {
      // Fetch all data in parallel from mempool.space
      const [pricesRes, hashrateRes, feesRes] = await Promise.all([
        fetch("https://mempool.space/api/v1/prices"),
        fetch("https://mempool.space/api/v1/mining/hashrate/1y"),
        fetch("https://mempool.space/api/v1/mining/blocks/fees/1y"),
      ]);

      const prices = await pricesRes.json();
      const hashrateData = await hashrateRes.json();
      const feesData = await feesRes.json();

      // Current BTC price in USD
      const btcPrice = prices.USD || 108000;

      // Current hashrate in H/s, convert to EH/s
      const currentHashrate = hashrateData.currentHashrate || 1.15e21;
      const hashrate = currentHashrate / 1e18; // Convert to EH/s

      // Calculate average tx fees from recent data (last 30 days)
      const recentFees = feesData.slice(-30);
      const avgFeesPerBlock = recentFees.length > 0
        ? recentFees.reduce((sum: number, item: any) => {
            // avgFee_0 is total fees for the block in satoshis
            // Convert to BTC: divide by 100,000,000
            return sum + (item.avgFee_0 || 0) / 100000000;
          }, 0) / recentFees.length
        : 0.05;

      return { btcPrice, hashrate, avgTxFees: avgFeesPerBlock };
    } catch (error) {
      console.error("Failed to fetch current data:", error);
      // Fallback values
      return {
        btcPrice: 108000,
        hashrate: 1150, // 1,150 EH/s
        avgTxFees: 0.05,
      };
    }
  };

  const generateRandomWalkScenario = (
    startDate: Date,
    months: number,
    currentData: { btcPrice: number; hashrate: number; avgTxFees: number },
    trend: "conservative" | "normal" | "optimistic"
  ): ScenarioMonthlyData[] => {
    const data: ScenarioMonthlyData[] = [];
    const now = new Date();
    
    // Calculate if we're starting in the past, present, or future
    const monthsFromNow = differenceInMonths(startDate, startOfMonth(now));
    
    // Determine starting values based on project start date vs current date
    let btcPrice: number;
    let hashrate: number;
    let txFee: number;
    
    if (monthsFromNow <= 0) {
      // Project starts in the past or now - use current data
      btcPrice = currentData.btcPrice;
      hashrate = currentData.hashrate;
      txFee = 0.025; // Start at realistic level, not current spikes
    } else {
      // Project starts in the future - extrapolate based on trend
      const futureMonths = Math.abs(monthsFromNow);
      const monthlyBtcGrowthMap = {
        conservative: 1.005,
        normal: 1.02,
        optimistic: 1.05,
      };
      btcPrice = currentData.btcPrice * Math.pow(monthlyBtcGrowthMap[trend], futureMonths);
      hashrate = currentData.hashrate * Math.pow(1.0225, futureMonths);
      txFee = 0.025;
    }
    
    // BTC price parameters - THE MAIN DRIVER with big cycles
    const btcDriftMap = {
      conservative: 0.005,
      normal: 0.02,
      optimistic: 0.05,
    };
    const btcDrift = btcDriftMap[trend];
    const btcVolatility = 0.18;
    
    // Hashrate - steady ~30% annual growth with strong BTC correlation
    const hashrateBaseDrift = 0.01;
    const hashrateVolatility = 0.03;
    const hashrateBtcCorrelation = 0.35;
    
    // Transaction fees - very stable, just oscillate around 0.025
    const txFeeTarget = 0.025;
    const txFeeVolatility = 0.08; // 8% volatility - small variations
    const txFeeMeanReversion = 0.3; // Strong pull back towards target
    
    for (let i = 0; i < months; i++) {
      const month = addMonths(startDate, i);
      
      // BTC price - Geometric Brownian Motion with halving-driven cycles (MAIN DRIVER)
      const halvingBoost = getHalvingBoost(month); // 0 to 1 based on proximity to halving
      let adjustedDrift = btcDrift + (halvingBoost * 0.04); // Add up to 4% monthly during peak
      
      // Soft constraints: apply gentle pressure when approaching boundaries
      if (btcPrice < 50_000) {
        // Below 50k: gentle upward pressure (increases as we get closer to 30k)
        const pressureFactor = Math.max(0, (50_000 - btcPrice) / 20_000); // 0 to 1
        adjustedDrift += pressureFactor * 0.02; // Add up to 2% upward drift
      } else if (btcPrice > 800_000) {
        // Above 800k: gentle downward pressure (increases as we approach/exceed 1M)
        const pressureFactor = Math.max(0, (btcPrice - 800_000) / 200_000); // 0 to 1+
        adjustedDrift -= pressureFactor * 0.03; // Subtract up to 3% drift
      }
      
      const btcRandomShock = (Math.random() - 0.5) * 2; // -1 to 1
      const btcChange = adjustedDrift + btcVolatility * btcRandomShock;
      const oldBtcPrice = btcPrice;
      btcPrice = btcPrice * (1 + btcChange);
      
      // Hashrate - steady ~30% annual growth with strong BTC correlation
      const btcPriceChange = (btcPrice - oldBtcPrice) / oldBtcPrice;
      // Hashrate follows BTC with 50% correlation (miners respond to profitability)
      const correlatedComponent = btcPriceChange * hashrateBtcCorrelation;
      const independentShock = (Math.random() - 0.5) * 2 * hashrateVolatility; // Symmetric random walk
      let hashrateChange = hashrateBaseDrift + correlatedComponent + independentShock;
      
      // Clamp to reasonable range to maintain ~30% annual average
      hashrateChange = Math.max(Math.min(hashrateChange, 0.06), -0.02); // +6% to -2% per month
      
      hashrate = hashrate * (1 + hashrateChange);
      hashrate = Math.max(hashrate, 100); // Minimum 100 EH/s
      
      // Transaction fees - random walk with mean reversion to 0.025
      const txFeeDeviation = txFee - txFeeTarget;
      const meanReversionForce = -txFeeMeanReversion * txFeeDeviation;
      const txFeeShock = (Math.random() - 0.5) * 2 * txFeeVolatility;
      const txFeeChange = meanReversionForce + txFeeShock;
      txFee = txFee * (1 + txFeeChange);
      txFee = Math.max(Math.min(txFee, 0.15), 0.005); // Keep between 0.005 and 0.15 BTC
      
      data.push({
        month: format(month, "yyyy-MM-01"),
        btcPriceUSD: Math.round(btcPrice),
        globalHashrateEH: Math.round(hashrate * 10) / 10,
        txFeesPerBlock: Math.round(txFee * 1000) / 1000,
      });
    }
    
    return data;
  };

  const handleCreateScenario = async (isGenerated: boolean) => {
    if (!formData.name) {
      toast.error("Error", {
        description: "Please enter a scenario name",
      });
      return;
    }

    if (!project) {
      toast.error("Error", {
        description: "Project not loaded",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const projectStart = startOfMonth(new Date(project.startDate));
      const projectEnd = startOfMonth(new Date(project.endDate));
      const totalMonths = differenceInMonths(projectEnd, projectStart) + 1;

      let data: ScenarioMonthlyData[];

      if (isGenerated) {
        // Fetch current market data from mempool.space
        const currentData = await fetchCurrentData();
        
        const trendLabel = formData.trend.charAt(0).toUpperCase() + formData.trend.slice(1);
        toast.info("Generating scenario...", {
          description: `${trendLabel} trend • BTC: $${currentData.btcPrice.toLocaleString()} • Hashrate: ${currentData.hashrate.toFixed(0)} EH/s`,
        });

        // Generate using random walk with selected trend and real current data
        data = generateRandomWalkScenario(projectStart, totalMonths, currentData, formData.trend);
      } else {
        // Create single month with current data
        const currentData = await fetchCurrentData();
        data = [
          {
            month: format(projectStart, "yyyy-MM-01"),
            btcPriceUSD: Math.round(currentData.btcPrice),
            globalHashrateEH: Math.round(currentData.hashrate * 10) / 10,
            txFeesPerBlock: Math.round(currentData.avgTxFees * 1000) / 1000,
          },
        ];
      }

      await createScenario({
        id: crypto.randomUUID(),
        projectId: projectId,
        name: formData.name,
        isGenerated,
        monthlyData: data,
      });

      toast.success("Success", {
        description: `Scenario created with ${totalMonths} months of data`,
      });

      setIsDialogOpen(false);
      setFormData({ name: "", trend: "normal" });
      loadData();
    } catch (error) {
      toast.error("Error", {
        description: "Failed to create scenario",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditScenarioData = (scenario: Scenario) => {
    setEditingScenario(scenario);
    setMonthlyData(scenario.monthlyData);
    setIsEditDataDialogOpen(true);
  };

  const handleEditName = (scenario: Scenario) => {
    setEditingScenarioName(scenario.id);
    setEditNameFormData({ name: scenario.name });
  };

  const handleSaveName = async () => {
    if (!editingScenarioName || !editNameFormData.name.trim()) return;

    const scenario = scenarios.find((s) => s.id === editingScenarioName);
    if (!scenario) return;

    const updated = {
      ...scenario,
      name: editNameFormData.name.trim(),
    };

    await updateScenario(updated);
    setScenarios(scenarios.map((s) => (s.id === editingScenarioName ? updated : s)));
    setEditingScenarioName(null);
    setEditNameFormData({ name: "" });
  };

  const handlePaste = (e: React.ClipboardEvent, startIndex: number, columnIndex: number) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const rows = pastedText.split('\n').filter(row => row.trim());
    
    if (rows.length === 0) return;
    
    const updated = [...monthlyData];
    
    rows.forEach((row, rowOffset) => {
      const targetIndex = startIndex + rowOffset;
      if (targetIndex >= updated.length) return;
      
      // Split by tab (Excel/Sheets) or comma (CSV)
      const values = row.split('\t').length > 1 ? row.split('\t') : row.split(',');
      
      values.forEach((value, colOffset) => {
        const targetColumn = columnIndex + colOffset;
        const numValue = parseFloat(value.trim().replace(/[,$]/g, '')); // Remove commas and $
        
        if (isNaN(numValue)) return;
        
        // Map column index to field
        switch(targetColumn) {
          case 0: // BTC Price
            updated[targetIndex].btcPriceUSD = numValue;
            break;
          case 1: // Hashrate
            updated[targetIndex].globalHashrateEH = numValue;
            break;
          case 2: // TX Fees
            updated[targetIndex].txFeesPerBlock = numValue;
            break;
        }
      });
    });
    
    setMonthlyData(updated);
  };

  const handleUpdateScenarioData = async () => {
    if (!editingScenario) return;

    try {
      await updateScenario({
        ...editingScenario,
        monthlyData,
      });

      toast.success("Success", {
        description: "Scenario data updated successfully",
      });

      setIsEditDataDialogOpen(false);
      setEditingScenario(null);
      setMonthlyData([]);
      loadData();
    } catch (error) {
      toast.error("Error", {
        description: "Failed to update scenario data",
      });
    }
  };

  const handleDelete = (id: string) => {
    setScenarioToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!scenarioToDelete) return;

    try {
      await deleteScenario(scenarioToDelete);
      toast.success("Success", {
        description: "Scenario deleted successfully",
      });
      loadData();
    } catch (error) {
      toast.error("Error", {
        description: "Failed to delete scenario",
      });
    } finally {
      setDeleteDialogOpen(false);
      setScenarioToDelete(null);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setFormData({ name: "", trend: "normal" });
    }
  };

  const handleExport = (scenario: Scenario) => {
    const csvHeader = "Month,BTC Price (USD),Global Hashrate (EH/s),TX Fees (BTC/block)\n";
    const csvData = scenario.monthlyData
      .map(
        (d) =>
          `${d.month},${d.btcPriceUSD},${d.globalHashrateEH},${d.txFeesPerBlock}`
      )
      .join("\n");

    const blob = new Blob([csvHeader + csvData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scenario-${scenario.name}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visualizingScenario = scenarios.find((s) => s.id === isVisualizingScenario);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Economic Scenarios</h1>
          <p className="text-muted-foreground mt-1">
            Define economic assumptions for financial projections
          </p>
          {project && (
            <p className="text-sm text-muted-foreground mt-1">
              Project duration: {format(new Date(project.startDate), "MMM yyyy")} - {format(new Date(project.endDate), "MMM yyyy")}
              {" "}({differenceInMonths(startOfMonth(new Date(project.endDate)), startOfMonth(new Date(project.startDate))) + 1} months)
            </p>
          )}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Scenario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Scenario</DialogTitle>
              <DialogDescription>
                Generate economic data for the entire project duration
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Scenario Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Conservative, Optimistic, Base Case"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              
              <div className="space-y-3">
                <Label>BTC Price Trend</Label>
                <RadioGroup
                  value={formData.trend}
                  onValueChange={(value) =>
                    setFormData({ ...formData, trend: value as "conservative" | "normal" | "optimistic" })
                  }
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="conservative" id="conservative" />
                    <Label htmlFor="conservative" className="flex-1 cursor-pointer">
                      <div className="font-medium">Conservative</div>
                      <div className="text-xs text-muted-foreground">Bear market conditions</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="normal" id="normal" />
                    <Label htmlFor="normal" className="flex-1 cursor-pointer">
                      <div className="font-medium">Normal</div>
                      <div className="text-xs text-muted-foreground">Steady market conditions</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="optimistic" id="optimistic" />
                    <Label htmlFor="optimistic" className="flex-1 cursor-pointer">
                      <div className="font-medium">Optimistic</div>
                      <div className="text-xs text-muted-foreground">Bull market conditions</div>
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  ℹ️ Hashrate and transaction fees will always trend upward with randomness
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCreateScenario(false)}
                disabled={isGenerating}
              >
                Create Empty
              </Button>
              <Button
                onClick={() => handleCreateScenario(true)}
                disabled={isGenerating}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                {isGenerating ? "Generating..." : "Auto-Generate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {scenarios.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              No scenarios created yet. Create one to define economic assumptions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {scenarios.map((scenario) => (
            <Card key={scenario.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {editingScenarioName === scenario.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editNameFormData.name}
                          onChange={(e) => setEditNameFormData({ name: e.target.value })}
                          className="max-w-xs"
                          autoFocus
                        />
                        <Button size="sm" onClick={handleSaveName}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingScenarioName(null);
                            setEditNameFormData({ name: "" });
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <CardTitle className="flex items-center gap-2">
                        {scenario.name}
                        {scenario.isGenerated && (
                          <Badge variant="secondary">Auto-generated</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditName(scenario)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </CardTitle>
                    )}
                    <CardDescription>
                      {scenario.monthlyData.length} months of data
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setIsVisualizingScenario(
                          isVisualizingScenario === scenario.id ? null : scenario.id
                        )
                      }
                    >
                      <LineChart className="h-4 w-4 mr-2" />
                      {isVisualizingScenario === scenario.id ? "Hide" : "Visualize"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditScenarioData(scenario)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(scenario)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(scenario.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {isVisualizingScenario === scenario.id && (
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    {/* BTC Price Chart */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">BTC Price (USD) - Halving Events Marked</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <RechartsLineChart data={scenario.monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="month"
                            tickFormatter={(value) => format(new Date(value), "MMM yy")}
                          />
                          <YAxis />
                          <Tooltip
                            labelFormatter={(value) => format(new Date(value), "MMM yyyy")}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, "BTC Price"]}
                          />
                          {/* Mark halving events */}
                          {HALVING_DATES.map((halving, idx) => {
                            const halvingTime = halving.date.getTime();
                            const firstDataPoint = new Date(scenario.monthlyData[0].month).getTime();
                            const lastDataPoint = new Date(scenario.monthlyData[scenario.monthlyData.length - 1].month).getTime();
                            // Only show if halving is within scenario range
                            if (halvingTime >= firstDataPoint && halvingTime <= lastDataPoint) {
                              return (
                                <ReferenceLine
                                  key={idx}
                                  x={halving.date.toISOString()}
                                  stroke="#ef4444"
                                  strokeDasharray="5 5"
                                  strokeWidth={2}
                                  label={{
                                    value: "Halving",
                                    position: "top",
                                    fill: "#ef4444",
                                    fontSize: 10,
                                  }}
                                />
                              );
                            }
                            return null;
                          })}
                          <Line
                            type="monotone"
                            dataKey="btcPriceUSD"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={false}
                          />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Hashrate Chart */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Global Hashrate (EH/s)</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <RechartsLineChart data={scenario.monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="month"
                            tickFormatter={(value) => format(new Date(value), "MMM yy")}
                          />
                          <YAxis />
                          <Tooltip
                            labelFormatter={(value) => format(new Date(value), "MMM yyyy")}
                            formatter={(value: number) => [`${value} EH/s`, "Hashrate"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="globalHashrateEH"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                          />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* TX Fees Chart */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Transaction Fees (BTC/block)</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <RechartsLineChart data={scenario.monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="month"
                            tickFormatter={(value) => format(new Date(value), "MMM yy")}
                          />
                          <YAxis />
                          <Tooltip
                            labelFormatter={(value) => format(new Date(value), "MMM yyyy")}
                            formatter={(value: number) => [`${value} BTC`, "TX Fees"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="txFeesPerBlock"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={false}
                          />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Hashprice Chart */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        Hashprice ($/PH/s per day) - Miner Profitability Metric
                      </h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <RechartsLineChart 
                          data={scenario.monthlyData.map(d => ({
                            ...d,
                            hashprice: calculateHashprice(
                              d.btcPriceUSD,
                              d.globalHashrateEH,
                              d.txFeesPerBlock,
                              new Date(d.month)
                            )
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="month"
                            tickFormatter={(value) => format(new Date(value), "MMM yy")}
                          />
                          <YAxis />
                          <Tooltip
                            labelFormatter={(value) => format(new Date(value), "MMM yyyy")}
                            formatter={(value: number) => [`$${value.toFixed(2)}/PH/day`, "Hashprice"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="hashprice"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            dot={false}
                          />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                      <p className="text-xs text-muted-foreground mt-1">
                        Revenue per petahash per day. Accounts for block rewards (including halvings), transaction fees, and BTC price.
                      </p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Edit Scenario Data Dialog */}
      <Dialog open={isEditDataDialogOpen} onOpenChange={setIsEditDataDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Scenario Data: {editingScenario?.name}</DialogTitle>
            <DialogDescription>
              Modify economic assumptions for each month. Tip: You can paste values from Excel/Google Sheets!
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">BTC Price (USD)</TableHead>
                  <TableHead className="text-right">Hashrate (EH/s)</TableHead>
                  <TableHead className="text-right">TX Fees (BTC/block)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.map((data, index) => (
                  <TableRow key={data.month}>
                    <TableCell className="font-medium">
                      {format(new Date(data.month), "MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="1000"
                        value={data.btcPriceUSD}
                        onChange={(e) => {
                          const updated = [...monthlyData];
                          updated[index].btcPriceUSD = parseFloat(e.target.value);
                          setMonthlyData(updated);
                        }}
                        onPaste={(e) => handlePaste(e, index, 0)}
                        className="text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="10"
                        value={data.globalHashrateEH}
                        onChange={(e) => {
                          const updated = [...monthlyData];
                          updated[index].globalHashrateEH = parseFloat(e.target.value);
                          setMonthlyData(updated);
                        }}
                        onPaste={(e) => handlePaste(e, index, 1)}
                        className="text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={data.txFeesPerBlock}
                        onChange={(e) => {
                          const updated = [...monthlyData];
                          updated[index].txFeesPerBlock = parseFloat(e.target.value);
                          setMonthlyData(updated);
                        }}
                        onPaste={(e) => handlePaste(e, index, 2)}
                        className="text-right"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditDataDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateScenarioData}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this scenario. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
