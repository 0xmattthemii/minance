"use client";

import { useEffect, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getFleetsByProject,
  createFleet,
  updateFleet,
  deleteFleet,
  getAllASICModels,
  getSitesByProject,
  getFleetAssignmentsByFleet,
  createFleetAssignment,
  deleteFleetAssignment,
  getFleetAssignmentsBySite,
} from "@/lib/db";
import type { ASICFleet, ASICModel, Site, FleetAssignment } from "@/lib/types";
import { Plus, Pencil, Trash2, Link2, Unlink } from "lucide-react";
import { format } from "date-fns";
import { useParams } from "next/navigation";

export default function FleetsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [fleets, setFleets] = useState<ASICFleet[]>([]);
  const [models, setModels] = useState<ASICModel[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [assignments, setAssignments] = useState<FleetAssignment[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingFleet, setEditingFleet] = useState<ASICFleet | null>(null);
  const [assigningFleet, setAssigningFleet] = useState<ASICFleet | null>(null);
  const [formData, setFormData] = useState({
    modelId: "",
    quantityMode: "miners" as "miners" | "mw",
    quantityMiners: "",
    quantityMW: "",
    originationDate: "",
    lifespanYears: "",
  });
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fleetToDelete, setFleetToDelete] = useState<string | null>(null);
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);
  const [unassignData, setUnassignData] = useState<{ fleetId: string; siteId: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    if (!projectId) return;

    const modelsList = await getAllASICModels();
    setModels(modelsList);

    const fleetsData = await getFleetsByProject(projectId);
    setFleets(fleetsData);

    const sitesData = await getSitesByProject(projectId);
    setSites(sitesData);

    // Load all assignments
    const allAssignments: FleetAssignment[] = [];
    for (const fleet of fleetsData) {
      const fleetAssignments = await getFleetAssignmentsByFleet(fleet.id);
      allAssignments.push(...fleetAssignments);
    }
    setAssignments(allAssignments);
  };

  const getModelById = (modelId: string): ASICModel | undefined => {
    return models.find((m) => m.id === modelId);
  };

  const calculateMinersFromMW = (mw: number, powerW: number): number => {
    if (!powerW) return 0;
    return Math.floor((mw * 1000000) / powerW);
  };

  const calculateMWFromMiners = (miners: number, powerW: number): number => {
    if (!miners) return 0;
    return (miners * powerW) / 1000000;
  };

  const handleQuantityModeChange = (mode: "miners" | "mw") => {
    const model = getModelById(formData.modelId);
    if (!model) {
      setFormData({ ...formData, quantityMode: mode });
      return;
    }

    if (mode === "mw" && formData.quantityMiners) {
      const mw = calculateMWFromMiners(
        parseFloat(formData.quantityMiners),
        model.powerW
      );
      setFormData({
        ...formData,
        quantityMode: mode,
        quantityMW: mw.toFixed(2),
      });
    } else if (mode === "miners" && formData.quantityMW) {
      const miners = calculateMinersFromMW(
        parseFloat(formData.quantityMW),
        model.powerW
      );
      setFormData({
        ...formData,
        quantityMode: mode,
        quantityMiners: miners.toString(),
      });
    } else {
      setFormData({ ...formData, quantityMode: mode });
    }
  };

  const handleQuantityChange = (value: string, mode: "miners" | "mw") => {
    const model = getModelById(formData.modelId);
    if (!model) {
      if (mode === "miners") {
        setFormData({ ...formData, quantityMiners: value });
      } else {
        setFormData({ ...formData, quantityMW: value });
      }
      return;
    }

    if (mode === "miners") {
      const mw = calculateMWFromMiners(parseFloat(value), model.powerW);
      setFormData({
        ...formData,
        quantityMiners: value,
        quantityMW: mw.toFixed(2),
      });
    } else {
      const miners = calculateMinersFromMW(parseFloat(value), model.powerW);
      setFormData({
        ...formData,
        quantityMW: value,
        quantityMiners: miners.toString(),
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      toast({
        title: "Error",
        description: "Please select a project first",
        variant: "destructive",
      });
      return;
    }

    if (
      !formData.modelId ||
      !formData.originationDate ||
      !formData.lifespanYears
    ) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (
      formData.quantityMode === "miners" &&
      !formData.quantityMiners
    ) {
      toast({
        title: "Error",
        description: "Please specify the number of miners",
        variant: "destructive",
      });
      return;
    }

    if (formData.quantityMode === "mw" && !formData.quantityMW) {
      toast({
        title: "Error",
        description: "Please specify the MW capacity",
        variant: "destructive",
      });
      return;
    }

    try {
      const fleetData: ASICFleet = {
        id: editingFleet?.id || crypto.randomUUID(),
        projectId: projectId,
        modelId: formData.modelId,
        quantityMode: formData.quantityMode,
        quantityMiners:
          formData.quantityMode === "miners"
            ? parseInt(formData.quantityMiners)
            : undefined,
        quantityMW:
          formData.quantityMode === "mw"
            ? parseFloat(formData.quantityMW)
            : undefined,
        originationDate: formData.originationDate,
        lifespanYears: parseFloat(formData.lifespanYears),
      };

      if (editingFleet) {
        await updateFleet(fleetData);
        toast({
          title: "Success",
          description: "Fleet updated successfully",
        });
      } else {
        await createFleet(fleetData);
        toast({
          title: "Success",
          description: "Fleet created successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingFleet(null);
      resetForm();
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save fleet",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (fleet: ASICFleet) => {
    setEditingFleet(fleet);
    setFormData({
      modelId: fleet.modelId,
      quantityMode: fleet.quantityMode,
      quantityMiners: fleet.quantityMiners?.toString() || "",
      quantityMW: fleet.quantityMW?.toString() || "",
      originationDate: fleet.originationDate,
      lifespanYears: fleet.lifespanYears.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setFleetToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!fleetToDelete) return;

    try {
      await deleteFleet(fleetToDelete);
      toast({
        title: "Success",
        description: "Fleet deleted successfully",
      });
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete fleet",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setFleetToDelete(null);
    }
  };

  const handleAssignToSite = (fleet: ASICFleet) => {
    setAssigningFleet(fleet);
    setSelectedSiteId("");
    setIsAssignDialogOpen(true);
  };

  const handleAssignSubmit = async () => {
    if (!assigningFleet || !selectedSiteId) {
      toast({
        title: "Error",
        description: "Please select a site",
        variant: "destructive",
      });
      return;
    }

    // Check if already assigned
    const existing = assignments.find(
      (a) => a.fleetId === assigningFleet.id && a.siteId === selectedSiteId
    );
    if (existing) {
      toast({
        title: "Error",
        description: "Fleet is already assigned to this site",
        variant: "destructive",
      });
      return;
    }

    try {
      // Calculate priority based on existing assignments to this site
      const siteAssignments = assignments.filter(a => a.siteId === selectedSiteId);
      const maxPriority = siteAssignments.length > 0
        ? Math.max(...siteAssignments.map(a => a.priority || 0))
        : -1;
      
      await createFleetAssignment({
        id: crypto.randomUUID(),
        fleetId: assigningFleet.id,
        siteId: selectedSiteId,
        priority: maxPriority + 1,
      });

      toast({
        title: "Success",
        description: "Fleet assigned to site successfully",
      });

      setIsAssignDialogOpen(false);
      setAssigningFleet(null);
      setSelectedSiteId("");
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign fleet",
        variant: "destructive",
      });
    }
  };

  const handleUnassign = (fleetId: string, siteId: string) => {
    setUnassignData({ fleetId, siteId });
    setUnassignDialogOpen(true);
  };

  const confirmUnassign = async () => {
    if (!unassignData) return;

    try {
      const assignment = assignments.find(
        (a) => a.fleetId === unassignData.fleetId && a.siteId === unassignData.siteId
      );
      if (assignment) {
        await deleteFleetAssignment(assignment.id);
        toast({
          title: "Success",
          description: "Fleet unassigned successfully",
        });
        loadData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unassign fleet",
        variant: "destructive",
      });
    } finally {
      setUnassignDialogOpen(false);
      setUnassignData(null);
    }
  };

  const resetForm = () => {
    setFormData({
      modelId: "",
      quantityMode: "miners",
      quantityMiners: "",
      quantityMW: "",
      originationDate: "",
      lifespanYears: "5",
    });
  };

  const getFleetMiners = (fleet: ASICFleet): number => {
    if (fleet.quantityMode === "miners") {
      return fleet.quantityMiners || 0;
    } else {
      const model = getModelById(fleet.modelId);
      if (!model) return 0;
      return calculateMinersFromMW(fleet.quantityMW || 0, model.powerW);
    }
  };

  const getFleetMW = (fleet: ASICFleet): number => {
    if (fleet.quantityMode === "mw") {
      return fleet.quantityMW || 0;
    } else {
      const model = getModelById(fleet.modelId);
      if (!model) return 0;
      return calculateMWFromMiners(fleet.quantityMiners || 0, model.powerW);
    }
  };

  const getAssignedSites = (fleetId: string): Site[] => {
    const fleetAssignments = assignments.filter((a) => a.fleetId === fleetId);
    return sites.filter((s) => fleetAssignments.some((a) => a.siteId === s.id));
  };

  if (!projectId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ASIC Fleets</h1>
          <p className="text-muted-foreground mt-1">
            Manage mining hardware fleets and site assignments
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
          <h1 className="text-3xl font-bold">ASIC Fleets</h1>
          <p className="text-muted-foreground mt-1">
            Configure hardware fleets and assign them to sites
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Fleet
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingFleet ? "Edit" : "Create"} ASIC Fleet
                </DialogTitle>
                <DialogDescription>
                  Define a fleet of mining hardware
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="model">ASIC Model *</Label>
                  <Select
                    value={formData.modelId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, modelId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select ASIC model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name} - {model.hashrateThS} TH/s @{" "}
                          {model.powerW}W
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quantity Input Mode *</Label>
                  <RadioGroup
                    value={formData.quantityMode}
                    onValueChange={(value) =>
                      handleQuantityModeChange(value as "miners" | "mw")
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="miners" id="mode-miners" />
                      <Label htmlFor="mode-miners" className="font-normal">
                        Number of Miners
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="mw" id="mode-mw" />
                      <Label htmlFor="mode-mw" className="font-normal">
                        MW Capacity
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantityMiners">
                      Number of Miners {formData.quantityMode === "miners" && "*"}
                    </Label>
                    <Input
                      id="quantityMiners"
                      type="number"
                      step="1"
                      value={formData.quantityMiners}
                      onChange={(e) =>
                        handleQuantityChange(e.target.value, "miners")
                      }
                      disabled={formData.quantityMode !== "miners"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantityMW">
                      MW Capacity {formData.quantityMode === "mw" && "*"}
                    </Label>
                    <Input
                      id="quantityMW"
                      type="number"
                      step="0.01"
                      value={formData.quantityMW}
                      onChange={(e) => handleQuantityChange(e.target.value, "mw")}
                      disabled={formData.quantityMode !== "mw"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="originationDate">Origination Date *</Label>
                    <Input
                      id="originationDate"
                      type="date"
                      value={formData.originationDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          originationDate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lifespan">Lifespan (years) *</Label>
                    <Input
                      id="lifespan"
                      type="number"
                      step="0.5"
                      value={formData.lifespanYears}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lifespanYears: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="rounded-md bg-muted/50 p-3 border">
                  <p className="text-sm font-medium mb-1">Automatic Failure Modeling</p>
                  <p className="text-xs text-muted-foreground">
                    Miners follow a realistic steep Weibull failure curve: minimal failures for most of their life (&lt;5% until 80% of lifespan), 
                    then rapid acceleration in the final period (5-95% in last 20% of lifespan). 
                    This simulates components running well within spec until sudden end-of-life degradation.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingFleet ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ASIC Model</TableHead>
              <TableHead className="text-right">Miners</TableHead>
              <TableHead className="text-right">MW</TableHead>
              <TableHead>Origination</TableHead>
              <TableHead>Lifespan</TableHead>
              <TableHead>Assigned Sites</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fleets.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  No fleets yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              fleets.map((fleet) => {
                const model = getModelById(fleet.modelId);
                const assignedSites = getAssignedSites(fleet.id);
                return (
                  <TableRow key={fleet.id}>
                    <TableCell className="font-medium">
                      {model?.name || "Unknown"}
                    </TableCell>
                    <TableCell className="text-right">
                      {getFleetMiners(fleet).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {getFleetMW(fleet).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(fleet.originationDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{fleet.lifespanYears} years</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {assignedSites.length === 0 ? (
                          <Badge variant="outline">Unassigned</Badge>
                        ) : (
                          assignedSites.map((site) => (
                            <Badge
                              key={site.id}
                              variant="secondary"
                              className="cursor-pointer"
                              onClick={() => handleUnassign(fleet.id, site.id)}
                            >
                              {site.name}
                              <Unlink className="h-3 w-3 ml-1" />
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleAssignToSite(fleet)}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(fleet)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(fleet.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Assign to Site Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Fleet to Site</DialogTitle>
            <DialogDescription>
              Select a site to assign this fleet to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Site</Label>
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => {
                    const totalPower = site.tranches.reduce(
                      (sum, t) => sum + t.powerMW,
                      0
                    );
                    return (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name} ({totalPower.toFixed(1)} MW)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAssignDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAssignSubmit}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this fleet. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unassignDialogOpen} onOpenChange={setUnassignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unassign the fleet from the site. You can reassign it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnassign}>Unassign</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

