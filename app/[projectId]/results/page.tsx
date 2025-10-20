"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  getProject,
  getScenariosByProject,
  getSitesByProject,
  getFleetsByProject,
  getAllFleetAssignments,
  getTeamMembersByProject,
  getAllASICModels,
  getAllTeamProfiles,
} from "@/lib/db";
import { calculateScenarioMetrics } from "@/lib/calculations";
import type {
  Scenario,
  ScenarioResults,
  MonthlyFinancialMetrics,
} from "@/lib/types";
import { Download, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useParams } from "next/navigation";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function ResultsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [results, setResults] = useState<Map<string, ScenarioResults>>(new Map());
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [isCalculating, setIsCalculating] = useState(false);
  const [fleets, setFleets] = useState<any[]>([]);
  const [asicModels, setAsicModels] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    if (!projectId) return;

    const scenariosData = await getScenariosByProject(projectId);
    setScenarios(scenariosData);

    const fleetsData = await getFleetsByProject(projectId);
    setFleets(fleetsData);

    const modelsData = await getAllASICModels();
    setAsicModels(modelsData);

    if (scenariosData.length > 0 && !selectedScenario) {
      setSelectedScenario(scenariosData[0].id);
    }
  };

  const calculateResults = async () => {
    if (!projectId) return;

    setIsCalculating(true);
    try {
      const project = await getProject(projectId);
      if (!project) {
        throw new Error("Project not found");
      }

      const sites = await getSitesByProject(projectId);
      const fleets = await getFleetsByProject(projectId);
      const fleetAssignments = await getAllFleetAssignments();
      const teamMembers = await getTeamMembersByProject(projectId);
      const asicModels = await getAllASICModels();
      const teamProfiles = await getAllTeamProfiles();

      const newResults = new Map<string, ScenarioResults>();

      for (const scenario of scenarios) {
        const result = await calculateScenarioMetrics({
          project,
          scenario,
          sites,
          fleets,
          fleetAssignments: fleetAssignments.filter((a) =>
            fleets.some((f) => f.id === a.fleetId)
          ),
          teamMembers,
          asicModels,
          teamProfiles,
        });
        newResults.set(scenario.id, result);
      }

      setResults(newResults);
      toast({
        title: "Success",
        description: "Financial projections calculated successfully",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to calculate projections",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const exportToCSV = () => {
    if (!selectedScenario) return;

    const result = results.get(selectedScenario);
    if (!result) return;

    const headers = [
      "Month",
      "Active Miners",
      "Hashrate (TH/s)",
      "BTC Mined",
      "Revenue (USD)",
      "Electricity Cost",
      "OPEX",
      "Team Cost",
      "Operating Expenses",
      "Site Depreciation",
      "Miner Depreciation",
      "Total Depreciation",
      "EBITDA",
      "Operating Cost per BTC",
    ];

    const rows = result.monthlyMetrics.map((m) => [
      format(new Date(m.month), "MMM yyyy"),
      m.activeMiners,
      m.totalHashrateThs.toFixed(2),
      m.totalBTC.toFixed(4),
      m.revenueUSD.toFixed(2),
      m.electricityCost.toFixed(2),
      m.opexCost.toFixed(2),
      m.teamCost.toFixed(2),
      (m.electricityCost + m.opexCost + m.teamCost).toFixed(2),
      m.capexDepreciation.toFixed(2),
      m.minerDepreciation.toFixed(2),
      (m.capexDepreciation + m.minerDepreciation).toFixed(2),
      m.ebitda.toFixed(2),
      (m.totalBTC > 0 ? (m.electricityCost + m.opexCost + m.teamCost) / m.totalBTC : 0).toFixed(2),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.scenarioName}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleMonth = (month: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(month)) {
      newExpanded.delete(month);
    } else {
      newExpanded.add(month);
    }
    setExpandedMonths(newExpanded);
  };

  const currentResult = selectedScenario
    ? results.get(selectedScenario)
    : undefined;

  // Prepare chart data
  const chartData = currentResult?.monthlyMetrics.map((m) => ({
    month: format(new Date(m.month), "MMM yy"),
    revenue: m.revenueUSD / 1000,
    expenses: m.totalExpenses / 1000,
    opex: m.opexCost / 1000,
    // Operating expenses (excluding depreciation)
    operatingExpenses: (m.electricityCost + m.opexCost + m.teamCost) / 1000,
    electricity: m.electricityCost / 1000,
    capex: m.capexDepreciation / 1000,
    miners: m.minerDepreciation / 1000,
    team: m.teamCost / 1000,
    ebitda: m.ebitda / 1000,
    // Cost per BTC without depreciation
    costPerBTC: m.totalBTC > 0 ? (m.electricityCost + m.opexCost + m.teamCost) / m.totalBTC : 0,
    // Cost per BTC with depreciation
    costPerBTCWithDepreciation: m.totalBTC > 0 ? m.totalExpenses / m.totalBTC : 0,
    btc: m.totalBTC,
    hashrate: m.totalHashrateThs / 1000,
    activeMiners: m.activeMiners,
  }));

  // Prepare fleet colors for consistent visualization
  const fleetColors = [
    "#3b82f6", // blue
    "#10b981", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#14b8a6", // teal
    "#f97316", // orange
  ];

  // Prepare fleet deployment chart data - showing active miners by fleet/model over time
  const fleetDeploymentData = currentResult?.monthlyMetrics.map((m) => {
    const monthData: any = { month: format(new Date(m.month), "MMM yy") };
    
    // Add active miner count for each fleet
    m.fleetMetrics.forEach((fm) => {
      const fleet = fleets.find((f) => f.id === fm.fleetId);
      const model = fleet ? asicModels.find((m) => m.id === fleet.modelId) : null;
      if (model && fm.activeMiners > 0) {
        // Use model name as key for stacking
        const key = `${model.name}`;
        monthData[key] = (monthData[key] || 0) + fm.activeMiners;
      }
    });
    
    return monthData;
  });

  // Get unique model names for the legend
  const uniqueModels = Array.from(
    new Set(
      fleets
        .map((f) => {
          const model = asicModels.find((m) => m.id === f.modelId);
          return model?.name;
        })
        .filter(Boolean)
    )
  ) as string[];

  // Calculate summary stats
  const summaryStats = currentResult
    ? {
        totalBTC: currentResult.monthlyMetrics.reduce(
          (sum, m) => sum + m.totalBTC,
          0
        ),
        totalRevenue: currentResult.monthlyMetrics.reduce(
          (sum, m) => sum + m.revenueUSD,
          0
        ),
        // Total operating expenses (excluding depreciation)
        totalExpenses: currentResult.monthlyMetrics.reduce(
          (sum, m) => sum + m.electricityCost + m.opexCost + m.teamCost,
          0
        ),
        totalElectricity: currentResult.monthlyMetrics.reduce(
          (sum, m) => sum + m.electricityCost,
          0
        ),
        totalOPEX: currentResult.monthlyMetrics.reduce(
          (sum, m) => sum + m.opexCost,
          0
        ),
        totalCAPEX: currentResult.monthlyMetrics.reduce(
          (sum, m) => sum + m.capexDepreciation,
          0
        ),
        totalMinerDepreciation: currentResult.monthlyMetrics.reduce(
          (sum, m) => sum + m.minerDepreciation,
          0
        ),
        totalTeamCost: currentResult.monthlyMetrics.reduce(
          (sum, m) => sum + m.teamCost,
          0
        ),
        totalEBITDA: currentResult.monthlyMetrics.reduce(
          (sum, m) => sum + m.ebitda,
          0
        ),
        // Average cost per BTC (excluding depreciation)
        avgCostPerBTC:
          currentResult.monthlyMetrics.reduce(
            (sum, m) => sum + (m.electricityCost + m.opexCost + m.teamCost),
            0
          ) / currentResult.monthlyMetrics.reduce((sum, m) => sum + m.totalBTC, 0),
      }
    : null;

  if (!projectId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Financial Projections</h1>
          <p className="text-muted-foreground mt-1">
            View detailed monthly financial metrics and forecasts
          </p>
        </div>
        <div className="border rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">
            No active project selected. Please create or select a project first.
          </p>
          <Button onClick={() => window.location.href = '/'}>
            Go to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Financial Projections</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive monthly financial analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={!currentResult}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={calculateResults} disabled={isCalculating}>
            {isCalculating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Calculating...
              </>
            ) : (
              "Calculate Projections"
            )}
          </Button>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          No scenarios yet. Create one in Settings → Economics.
        </div>
      ) : (
        <Tabs value={selectedScenario} onValueChange={setSelectedScenario}>
          <TabsList>
            {scenarios.map((scenario) => (
              <TabsTrigger key={scenario.id} value={scenario.id}>
                {scenario.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {scenarios.map((scenario) => (
            <TabsContent key={scenario.id} value={scenario.id}>
              {!currentResult ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground mb-4">
                      Click &quot;Calculate Projections&quot; to generate financial metrics
                      for this scenario.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  {summaryStats && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardDescription>Total BTC Mined</CardDescription>
                            <CardTitle className="text-2xl">
                              {summaryStats.totalBTC.toFixed(2)}
                            </CardTitle>
                          </CardHeader>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardDescription>Total Revenue</CardDescription>
                            <CardTitle className="text-2xl">
                              ${(summaryStats.totalRevenue / 1_000_000).toFixed(1)}M
                            </CardTitle>
                          </CardHeader>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardDescription>Total Expenses</CardDescription>
                            <CardTitle className="text-2xl">
                              ${(summaryStats.totalExpenses / 1_000_000).toFixed(1)}M
                            </CardTitle>
                          </CardHeader>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardDescription>Total EBITDA</CardDescription>
                            <CardTitle
                              className={`text-2xl ${
                                summaryStats.totalEBITDA >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              ${(summaryStats.totalEBITDA / 1_000_000).toFixed(1)}M
                            </CardTitle>
                          </CardHeader>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardDescription>Avg Cost/BTC</CardDescription>
                            <CardTitle className="text-2xl">
                              ${summaryStats.avgCostPerBTC.toLocaleString(undefined, {
                                maximumFractionDigits: 0,
                              })}
                            </CardTitle>
                          </CardHeader>
                        </Card>
                      </div>

                      {/* CAPEX Breakdown Card */}
                      <Card>
                        <CardHeader>
                          <CardTitle>
                            CAPEX Breakdown (Total: ${((summaryStats.totalCAPEX + summaryStats.totalMinerDepreciation) / 1_000_000).toFixed(1)}M)
                          </CardTitle>
                          <CardDescription>Total capital expenditures (depreciated over project lifetime)</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">Site Infrastructure</p>
                              <p className="text-3xl font-bold text-purple-600">
                                ${(summaryStats.totalCAPEX / 1_000_000).toFixed(1)}M
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Depreciated over 10 years
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">Mining Equipment</p>
                              <p className="text-3xl font-bold text-pink-600">
                                ${(summaryStats.totalMinerDepreciation / 1_000_000).toFixed(1)}M
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Depreciated over fleet lifespan
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Revenue vs Operating Expenses</CardTitle>
                        <CardDescription>Monthly comparison (in $1000s, excluding depreciation)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => `$${value.toFixed(1)}k`} />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="revenue"
                              stroke="#2563eb"
                              name="Revenue"
                              dot={false}
                              strokeWidth={2}
                            />
                            <Line
                              type="monotone"
                              dataKey="operatingExpenses"
                              stroke="#dc2626"
                              name="Operating Expenses"
                              dot={false}
                              strokeWidth={2}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>EBITDA Trend</CardTitle>
                        <CardDescription>Earnings before depreciation (in $1000s)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => `$${value.toFixed(1)}k`} />
                            <Legend />
                            <Bar dataKey="ebitda" fill="#10b981" name="EBITDA" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Expense Breakdown Over Time</CardTitle>
                        <CardDescription>Stacked expenses by category (in $1000s)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => `$${value.toFixed(1)}k`} />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey="electricity"
                              stackId="1"
                              stroke="#f97316"
                              fill="#fdba74"
                              name="Electricity"
                              dot={false}
                            />
                            <Area
                              type="monotone"
                              dataKey="opex"
                              stackId="1"
                              stroke="#3b82f6"
                              fill="#93c5fd"
                              name="OPEX"
                              dot={false}
                            />
                            <Area
                              type="monotone"
                              dataKey="capex"
                              stackId="1"
                              stroke="#a855f7"
                              fill="#d8b4fe"
                              name="Site Depreciation"
                              dot={false}
                            />
                            <Area
                              type="monotone"
                              dataKey="miners"
                              stackId="1"
                              stroke="#ec4899"
                              fill="#fbcfe8"
                              name="Miners Depreciation"
                              dot={false}
                            />
                            <Area
                              type="monotone"
                              dataKey="team"
                              stackId="1"
                              stroke="#22c55e"
                              fill="#86efac"
                              name="Team"
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Cost per BTC</CardTitle>
                        <CardDescription>Production cost over time (with and without depreciation)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="costPerBTC"
                              stroke="#10b981"
                              name="Operating Cost/BTC"
                              dot={false}
                              strokeWidth={2}
                            />
                            <Line
                              type="monotone"
                              dataKey="costPerBTCWithDepreciation"
                              stroke="#f59e0b"
                              name="Total Cost/BTC (incl. depreciation)"
                              dot={false}
                              strokeWidth={2}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>BTC Mined</CardTitle>
                        <CardDescription>Bitcoin production over time</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => `${value.toFixed(4)} BTC`} />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey="btc"
                              stroke="#f97316"
                              fill="#fed7aa"
                              name="BTC Mined"
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Hashrate</CardTitle>
                        <CardDescription>Mining power over time (PH/s)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => `${value.toFixed(2)} PH/s`} />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey="hashrate"
                              stroke="#8b5cf6"
                              fill="#ddd6fe"
                              name="Hashrate (PH/s)"
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Active Miners by Fleet</CardTitle>
                        <CardDescription>Deployment by ASIC model over time</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={fleetDeploymentData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => `${value.toLocaleString()} miners`} />
                            <Legend />
                            {uniqueModels.map((modelName, index) => (
                              <Bar
                                key={modelName}
                                dataKey={modelName}
                                stackId="1"
                                fill={fleetColors[index % fleetColors.length]}
                                name={modelName}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Monthly Details Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Monthly Details</CardTitle>
                      <CardDescription>
                        Detailed breakdown of each month (click to expand site details)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead></TableHead>
                              <TableHead>Month</TableHead>
                              <TableHead className="text-right">Miners</TableHead>
                              <TableHead className="text-right">BTC</TableHead>
                              <TableHead className="text-right">Revenue</TableHead>
                              <TableHead className="text-right">Expenses</TableHead>
                              <TableHead className="text-right">EBITDA</TableHead>
                              <TableHead className="text-right">Cost/BTC</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentResult.monthlyMetrics.map((metric) => {
                              const isExpanded = expandedMonths.has(metric.month);
                              return (
                                <React.Fragment key={metric.month}>
                                  <TableRow className="cursor-pointer" onClick={() => toggleMonth(metric.month)}>
                                    <TableCell>
                                      <Button variant="ghost" size="icon" className="h-6 w-6">
                                        {isExpanded ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      {format(new Date(metric.month), "MMM yyyy")}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {metric.activeMiners.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {metric.totalBTC.toFixed(4)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      ${(metric.revenueUSD / 1000).toFixed(1)}k
                                    </TableCell>
                                    <TableCell className="text-right">
                                      ${((metric.electricityCost + metric.opexCost + metric.teamCost) / 1000).toFixed(1)}k
                                    </TableCell>
                                    <TableCell
                                      className={`text-right font-medium ${
                                        metric.ebitda >= 0
                                          ? "text-green-600"
                                          : "text-red-600"
                                      }`}
                                    >
                                      ${(metric.ebitda / 1000).toFixed(1)}k
                                    </TableCell>
                                    <TableCell className="text-right">
                                      ${(metric.totalBTC > 0 ? (metric.electricityCost + metric.opexCost + metric.teamCost) / metric.totalBTC : 0).toLocaleString(undefined, {
                                        maximumFractionDigits: 0,
                                      })}
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow>
                                      <TableCell colSpan={8} className="bg-muted/50 p-4">
                                        <div className="space-y-4">
                                          {/* Operating Expenses */}
                                          <div>
                                            <h4 className="font-medium mb-3">
                                              Operating Expenses: <span className="text-muted-foreground font-normal">(Total: ${((metric.electricityCost + metric.opexCost + metric.teamCost) / 1000).toFixed(1)}k)</span>
                                            </h4>
                                            <div className="grid grid-cols-3 gap-4">
                                              <div className="border rounded-lg p-3 bg-card">
                                                <p className="text-xs text-muted-foreground mb-1">Electricity</p>
                                                <p className="text-lg font-bold text-orange-600">
                                                  ${(metric.electricityCost / 1000).toFixed(1)}k
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                  {((metric.electricityCost / (metric.electricityCost + metric.opexCost + metric.teamCost)) * 100).toFixed(1)}%
                                                </p>
                                              </div>
                                              <div className="border rounded-lg p-3 bg-card">
                                                <p className="text-xs text-muted-foreground mb-1">OPEX</p>
                                                <p className="text-lg font-bold text-blue-600">
                                                  ${(metric.opexCost / 1000).toFixed(1)}k
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                  {((metric.opexCost / (metric.electricityCost + metric.opexCost + metric.teamCost)) * 100).toFixed(1)}%
                                                </p>
                                              </div>
                                              <div className="border rounded-lg p-3 bg-card">
                                                <p className="text-xs text-muted-foreground mb-1">Team Costs</p>
                                                <p className="text-lg font-bold text-green-600">
                                                  ${(metric.teamCost / 1000).toFixed(1)}k
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                  {((metric.teamCost / (metric.electricityCost + metric.opexCost + metric.teamCost)) * 100).toFixed(1)}%
                                                </p>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Depreciation */}
                                          <div>
                                            <h4 className="font-medium mb-3">
                                              Depreciation: <span className="text-muted-foreground font-normal">(Total: ${((metric.capexDepreciation + metric.minerDepreciation) / 1000).toFixed(1)}k)</span>
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                              <div className="border rounded-lg p-3 bg-card">
                                                <p className="text-xs text-muted-foreground mb-1">Site Infrastructure</p>
                                                <p className="text-lg font-bold text-purple-600">
                                                  ${(metric.capexDepreciation / 1000).toFixed(1)}k
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                  {((metric.capexDepreciation / (metric.capexDepreciation + metric.minerDepreciation)) * 100).toFixed(1)}%
                                                </p>
                                              </div>
                                              <div className="border rounded-lg p-3 bg-card">
                                                <p className="text-xs text-muted-foreground mb-1">Mining Equipment</p>
                                                <p className="text-lg font-bold text-pink-600">
                                                  ${(metric.minerDepreciation / 1000).toFixed(1)}k
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                  {((metric.minerDepreciation / (metric.capexDepreciation + metric.minerDepreciation)) * 100).toFixed(1)}%
                                                </p>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Site Breakdown */}
                                          {metric.siteMetrics.length > 0 && (
                                            <div>
                                              <h4 className="font-medium mb-2">Site Breakdown:</h4>
                                              <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Site</TableHead>
                                                <TableHead className="text-right">Miners</TableHead>
                                                <TableHead className="text-right">Power (MW)</TableHead>
                                                <TableHead className="text-right">BTC</TableHead>
                                                <TableHead className="text-right">Revenue</TableHead>
                                                <TableHead className="text-right">Op. Expenses</TableHead>
                                                <TableHead className="text-right">Depreciation</TableHead>
                                                <TableHead className="text-right">EBITDA</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {metric.siteMetrics.map((site) => (
                                                <TableRow key={site.siteId}>
                                                  <TableCell>{site.siteName}</TableCell>
                                                  <TableCell className="text-right">
                                                    {site.activeMiners.toLocaleString()}
                                                  </TableCell>
                                                  <TableCell className="text-right">
                                                    {site.powerUsedMW.toFixed(2)}
                                                  </TableCell>
                                                  <TableCell className="text-right">
                                                    {site.btcMined.toFixed(4)}
                                                  </TableCell>
                                                  <TableCell className="text-right">
                                                    ${(site.revenue / 1000).toFixed(1)}k
                                                  </TableCell>
                                                  <TableCell className="text-right">
                                                    ${((site.electricityCost + site.opexCost + site.teamCost) / 1000).toFixed(1)}k
                                                  </TableCell>
                                                  <TableCell className="text-right text-muted-foreground">
                                                    ${((site.capexDepreciation + site.minerDepreciation) / 1000).toFixed(1)}k
                                                  </TableCell>
                                                  <TableCell
                                                    className={`text-right ${
                                                      site.ebitda >= 0
                                                        ? "text-green-600"
                                                        : "text-red-600"
                                                    }`}
                                                  >
                                                    ${(site.ebitda / 1000).toFixed(1)}k
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                            </div>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
