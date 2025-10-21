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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  getSitesByProject,
  createSite,
  updateSite,
  deleteSite,
  getFleetAssignmentsBySite,
  getAllFleetAssignments,
  createFleetAssignment,
  updateFleetAssignment,
  deleteFleetAssignment,
  getFleetsByProject,
  getAllASICModels,
  getTeamMembersByProject,
  createTeamMember,
  deleteTeamMember,
  getAllTeamProfiles,
} from "@/lib/db";
import type {
  Site,
  Tranche,
  CapexBreakdown,
  OpexBreakdown,
  FleetAssignment,
  ASICFleet,
  ASICModel,
  TeamMember,
  TeamProfile,
} from "@/lib/types";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, GripVertical, Users, Cpu, Layers } from "lucide-react";
import { format } from "date-fns";
import { useParams } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Sortable Fleet Item Component
function SortableFleetItem({
  fleet,
  assignment,
  model,
  priority,
  onDelete,
}: {
  fleet: ASICFleet;
  assignment: FleetAssignment;
  model: ASICModel | undefined;
  priority: number;
  onDelete: (assignmentId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: assignment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const quantityDisplay = fleet.quantityMode === "miners"
    ? `${fleet.quantityMiners} miners`
    : `${fleet.quantityMW} MW`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <Badge variant="outline" className="font-mono text-xs">
        #{priority + 1}
      </Badge>
      <div className="flex-1">
        <div className="font-medium">{model?.name || "Unknown Model"}</div>
        <div className="text-sm text-muted-foreground">
          {quantityDisplay} • {fleet.lifespanYears}y lifespan
        </div>
      </div>
      {model && (
        <div className="text-sm text-muted-foreground">
          {model.hashrateThS} TH/s • {model.powerW}W
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(assignment.id)}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

export default function SitesPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [sites, setSites] = useState<Site[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTranchDialogOpen, setIsTranchDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [editingTranche, setEditingTranche] = useState<{
    site: Site;
    tranche: Tranche | null;
    trancheIndex: number;
  } | null>(null);
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [siteFormData, setSiteFormData] = useState({
    name: "",
    startDate: "",
  });
  const [trancheFormData, setTrancheFormData] = useState({
    name: "",
    powerMW: "",
    startDate: "",
    rampUpMonths: "",
    uptime: "",
    electricityPricePerKWh: "",
    poolFee: "",
    capex: {
      electrical: "",
      civil: "",
      warehouse: "",
      containers: "",
      office: "",
      itNetworking: "",
    },
    opex: {
      insurance: "",
      maintenance: "",
      security: "",
      monitoring: "",
    },
  });
  const [deleteSiteDialogOpen, setDeleteSiteDialogOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<string | null>(null);
  const [deleteTrancheDialogOpen, setDeleteTrancheDialogOpen] = useState(false);
  const [trancheToDelete, setTrancheToDelete] = useState<{ site: Site; index: number } | null>(null);
  
  // Fleet and team data
  const [fleetAssignments, setFleetAssignments] = useState<FleetAssignment[]>([]);
  const [fleets, setFleets] = useState<ASICFleet[]>([]);
  const [asicModels, setAsicModels] = useState<ASICModel[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamProfiles, setTeamProfiles] = useState<TeamProfile[]>([]);
  
  // Attach dialogs
  const [attachFleetDialogOpen, setAttachFleetDialogOpen] = useState(false);
  const [attachTeamDialogOpen, setAttachTeamDialogOpen] = useState(false);
  const [attachTargetSiteId, setAttachTargetSiteId] = useState<string | null>(null);
  const [attachTargetType, setAttachTargetType] = useState<"site" | "tranche">("site");
  const [attachTargetTrancheId, setAttachTargetTrancheId] = useState<string | null>(null);
  const [selectedFleetId, setSelectedFleetId] = useState<string>("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [teamMemberFormData, setTeamMemberFormData] = useState({
    startDate: "",
    employmentRate: "100",
  });
  
  const { toast } = useToast();
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    if (!projectId) return;

    const [
      sitesData,
      fleetsData,
      assignmentsData,
      asicModelsData,
      teamMembersData,
      teamProfilesData,
    ] = await Promise.all([
      getSitesByProject(projectId),
      getFleetsByProject(projectId),
      getAllFleetAssignments(),
      getAllASICModels(),
      getTeamMembersByProject(projectId),
      getAllTeamProfiles(),
    ]);
    
    setSites(sitesData);
    setFleets(fleetsData);
    setFleetAssignments(assignmentsData);
    setAsicModels(asicModelsData);
    setTeamMembers(teamMembersData);
    setTeamProfiles(teamProfilesData);
  };

  const handleSubmitSite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      toast({
        title: "Error",
        description: "Please select a project first",
        variant: "destructive",
      });
      return;
    }

    if (!siteFormData.name || !siteFormData.startDate) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingSite) {
        await updateSite({
          ...editingSite,
          name: siteFormData.name,
          startDate: siteFormData.startDate,
        });
        toast({
          title: "Success",
          description: "Site updated successfully",
        });
      } else {
        await createSite({
          id: crypto.randomUUID(),
          projectId: projectId,
          name: siteFormData.name,
          startDate: siteFormData.startDate,
          tranches: [],
        });
        toast({
          title: "Success",
          description: "Site created successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingSite(null);
      setSiteFormData({ name: "", startDate: "" });
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save site",
        variant: "destructive",
      });
    }
  };

  const handleSubmitTranche = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingTranche) return;

    // Validate all required fields
    if (
      !trancheFormData.name ||
      !trancheFormData.powerMW ||
      !trancheFormData.startDate ||
      !trancheFormData.rampUpMonths ||
      !trancheFormData.uptime ||
      !trancheFormData.electricityPricePerKWh ||
      !trancheFormData.poolFee
    ) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const newTranche: Tranche = {
        id: editingTranche.tranche?.id || crypto.randomUUID(),
        name: trancheFormData.name,
        powerMW: parseFloat(trancheFormData.powerMW),
        startDate: trancheFormData.startDate,
        rampUpMonths: parseInt(trancheFormData.rampUpMonths),
        uptime: parseFloat(trancheFormData.uptime) / 100,
        electricityPricePerKWh: parseFloat(trancheFormData.electricityPricePerKWh),
        poolFee: parseFloat(trancheFormData.poolFee) / 100,
        capex: {
          electrical: parseFloat(trancheFormData.capex.electrical) || 0,
          civil: parseFloat(trancheFormData.capex.civil) || 0,
          warehouse: parseFloat(trancheFormData.capex.warehouse) || 0,
          containers: parseFloat(trancheFormData.capex.containers) || 0,
          office: parseFloat(trancheFormData.capex.office) || 0,
          itNetworking: parseFloat(trancheFormData.capex.itNetworking) || 0,
        },
        opex: {
          insurance: parseFloat(trancheFormData.opex.insurance) || 0,
          maintenance: parseFloat(trancheFormData.opex.maintenance) || 0,
          security: parseFloat(trancheFormData.opex.security) || 0,
          monitoring: parseFloat(trancheFormData.opex.monitoring) || 0,
        },
      };

      const updatedTranches = [...editingTranche.site.tranches];
      if (editingTranche.tranche) {
        updatedTranches[editingTranche.trancheIndex] = newTranche;
      } else {
        updatedTranches.push(newTranche);
      }

      await updateSite({
        ...editingTranche.site,
        tranches: updatedTranches,
      });

      toast({
        title: "Success",
        description: "Tranche saved successfully",
      });

      setIsTranchDialogOpen(false);
      setEditingTranche(null);
      resetTrancheForm();
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save tranche",
        variant: "destructive",
      });
    }
  };

  const handleEditSite = (site: Site) => {
    setEditingSite(site);
    setSiteFormData({
      name: site.name,
      startDate: site.startDate,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteSite = (id: string) => {
    setSiteToDelete(id);
    setDeleteSiteDialogOpen(true);
  };

  const confirmDeleteSite = async () => {
    if (!siteToDelete) return;

    try {
      await deleteSite(siteToDelete);
      toast({
        title: "Success",
        description: "Site deleted successfully",
      });
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete site",
        variant: "destructive",
      });
    } finally {
      setDeleteSiteDialogOpen(false);
      setSiteToDelete(null);
    }
  };

  const handleAddTranche = (site: Site) => {
    setEditingTranche({
      site,
      tranche: null,
      trancheIndex: -1,
    });
    resetTrancheForm();
    setIsTranchDialogOpen(true);
  };

  const handleEditTranche = (site: Site, tranche: Tranche, index: number) => {
    setEditingTranche({
      site,
      tranche,
      trancheIndex: index,
    });
    setTrancheFormData({
      name: tranche.name || "",
      powerMW: tranche.powerMW.toString(),
      startDate: tranche.startDate,
      rampUpMonths: tranche.rampUpMonths.toString(),
      uptime: (tranche.uptime * 100).toString(),
      electricityPricePerKWh: tranche.electricityPricePerKWh.toString(),
      poolFee: (tranche.poolFee * 100).toString(),
      capex: {
        electrical: tranche.capex.electrical.toString(),
        civil: tranche.capex.civil.toString(),
        warehouse: tranche.capex.warehouse.toString(),
        containers: tranche.capex.containers.toString(),
        office: tranche.capex.office.toString(),
        itNetworking: tranche.capex.itNetworking.toString(),
      },
      opex: {
        insurance: tranche.opex.insurance.toString(),
        maintenance: tranche.opex.maintenance.toString(),
        security: tranche.opex.security.toString(),
        monitoring: tranche.opex.monitoring.toString(),
      },
    });
    setIsTranchDialogOpen(true);
  };

  const handleDeleteTranche = (site: Site, index: number) => {
    setTrancheToDelete({ site, index });
    setDeleteTrancheDialogOpen(true);
  };

  const confirmDeleteTranche = async () => {
    if (!trancheToDelete) return;

    try {
      const updatedTranches = trancheToDelete.site.tranches.filter((_, i) => i !== trancheToDelete.index);
      await updateSite({
        ...trancheToDelete.site,
        tranches: updatedTranches,
      });
      toast({
        title: "Success",
        description: "Tranche deleted successfully",
      });
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete tranche",
        variant: "destructive",
      });
    } finally {
      setDeleteTrancheDialogOpen(false);
      setTrancheToDelete(null);
    }
  };

  // Handle drag and drop for fleet priority
  const handleDragEnd = async (event: DragEndEvent, siteId: string) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const siteAssignments = fleetAssignments
      .filter(a => a.siteId === siteId)
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));

    const oldIndex = siteAssignments.findIndex(a => a.id === active.id);
    const newIndex = siteAssignments.findIndex(a => a.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(siteAssignments, oldIndex, newIndex);

    // Update priorities in database
    try {
      await Promise.all(
        newOrder.map((assignment, index) =>
          updateFleetAssignment({
            ...assignment,
            priority: index,
          })
        )
      );

      // Reload data to reflect changes
      loadData();

      toast({
        title: "Success",
        description: "Fleet priority updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update fleet priority",
        variant: "destructive",
      });
    }
  };

  const resetTrancheForm = () => {
    setTrancheFormData({
      name: "",
      powerMW: "",
      startDate: "",
      rampUpMonths: "",
      uptime: "95",
      electricityPricePerKWh: "",
      poolFee: "2",
      capex: {
        electrical: "",
        civil: "",
        warehouse: "",
        containers: "",
        office: "",
        itNetworking: "",
      },
      opex: {
        insurance: "",
        maintenance: "",
        security: "",
        monitoring: "",
      },
    });
  };

  const toggleSiteExpanded = (siteId: string) => {
    const newExpanded = new Set(expandedSites);
    if (newExpanded.has(siteId)) {
      newExpanded.delete(siteId);
    } else {
      newExpanded.add(siteId);
    }
    setExpandedSites(newExpanded);
  };

  const openAttachFleetDialog = (siteId: string) => {
    setAttachTargetSiteId(siteId);
    setSelectedFleetId("");
    setAttachFleetDialogOpen(true);
  };

  const openAttachTeamDialog = (targetId: string, type: "site" | "tranche" = "site", trancheId?: string) => {
    setAttachTargetSiteId(targetId);
    setAttachTargetType(type);
    setAttachTargetTrancheId(trancheId || null);
    setSelectedProfileId("");
    setTeamMemberFormData({
      startDate: "",
      employmentRate: "100",
    });
    setAttachTeamDialogOpen(true);
  };

  const handleAttachFleet = async () => {
    if (!attachTargetSiteId || !selectedFleetId) {
      toast({
        title: "Error",
        description: "Please select a fleet",
        variant: "destructive",
      });
      return;
    }

    try {
      // Calculate the next priority for this site
      const siteAssignments = fleetAssignments.filter(a => a.siteId === attachTargetSiteId);
      const maxPriority = siteAssignments.length > 0
        ? Math.max(...siteAssignments.map(a => a.priority || 0))
        : -1;

      await createFleetAssignment({
        id: crypto.randomUUID(),
        fleetId: selectedFleetId,
        siteId: attachTargetSiteId,
        priority: maxPriority + 1,
      });

      loadData();
      setAttachFleetDialogOpen(false);

      toast({
        title: "Success",
        description: "Fleet attached to site successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to attach fleet",
        variant: "destructive",
      });
    }
  };

  const handleAttachTeamMember = async () => {
    if (!selectedProfileId || !teamMemberFormData.startDate) {
      toast({
        title: "Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const memberData: TeamMember = {
        id: crypto.randomUUID(),
        projectId: projectId,
        profileId: selectedProfileId,
        startDate: teamMemberFormData.startDate,
        employmentRate: parseFloat(teamMemberFormData.employmentRate) / 100,
        scope: {
          type: attachTargetType,
          targetId: attachTargetType === "tranche" ? attachTargetTrancheId! : attachTargetSiteId!,
        },
      };

      await createTeamMember(memberData);
      loadData();
      setAttachTeamDialogOpen(false);

      toast({
        title: "Success",
        description: "Team member attached successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to attach team member",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTeamMember = async (memberId: string) => {
    try {
      await deleteTeamMember(memberId);
      loadData();
      toast({
        title: "Success",
        description: "Team member removed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFleetAssignment = async (assignmentId: string) => {
    try {
      await deleteFleetAssignment(assignmentId);
      loadData();
      toast({
        title: "Success",
        description: "Fleet unassigned from site",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unassign fleet",
        variant: "destructive",
      });
    }
  };

  const calculateTotalCapex = () => {
    return Object.values(trancheFormData.capex).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );
  };

  const calculateTotalOpex = () => {
    return Object.values(trancheFormData.opex).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );
  };

  if (!projectId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sites</h1>
          <p className="text-muted-foreground mt-1">
            Manage mining sites and power tranches
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
          <h1 className="text-3xl font-bold">Sites</h1>
          <p className="text-muted-foreground mt-1">
            Configure mining sites with power tranches and costs
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Site
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmitSite}>
              <DialogHeader>
                <DialogTitle>{editingSite ? "Edit" : "Create"} Site</DialogTitle>
                <DialogDescription>Define a mining site</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="siteName">Site Name</Label>
                  <Input
                    id="siteName"
                    placeholder="e.g., Texas Facility A"
                    value={siteFormData.name}
                    onChange={(e) =>
                      setSiteFormData({ ...siteFormData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteStartDate">Start Date</Label>
                  <Input
                    id="siteStartDate"
                    type="date"
                    value={siteFormData.startDate}
                    onChange={(e) =>
                      setSiteFormData({
                        ...siteFormData,
                        startDate: e.target.value,
                      })
                    }
                  />
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
                  {editingSite ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {sites.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            No sites yet. Create one to get started.
          </div>
        ) : (
          sites.map((site) => {
            const isExpanded = expandedSites.has(site.id);
            return (
              <div key={site.id} className="border rounded-lg overflow-hidden">
                <div className="p-4 flex justify-between items-center bg-card">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleSiteExpanded(site.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <div>
                      <h3 className="font-semibold">{site.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Start: {format(new Date(site.startDate), "MMM d, yyyy")} •{" "}
                        {site.tranches.length} tranche(s) •{" "}
                        {site.tranches
                          .reduce((sum, t) => sum + t.powerMW, 0)
                          .toFixed(1)}{" "}
                        MW total
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddTranche(site)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Tranche
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditSite(site)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteSite(site.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* TEAM SECTION */}
                {isExpanded && (
                  <div className="border-t">
                    <div className="bg-muted/30 px-4 py-3 font-semibold text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        TEAM
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAttachTeamDialog(site.id, "site")}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Team Member
                      </Button>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Site-level team */}
                      {(() => {
                        const siteTeamMembers = teamMembers.filter(
                          tm => tm.scope.type === "site" && tm.scope.targetId === site.id
                        );
                        return siteTeamMembers.length > 0 ? (
                          <div>
                            <h5 className="text-sm font-medium mb-2 text-muted-foreground">Site-level Team</h5>
                            <div className="space-y-2">
                              {siteTeamMembers.map(member => {
                                const profile = teamProfiles.find(p => p.id === member.profileId);
                                return (
                                  <div key={member.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
                                    <div className="flex-1">
                                      <div className="font-medium">{profile?.name || "Unknown Profile"}</div>
                                      <div className="text-sm text-muted-foreground">
                                        Started: {format(new Date(member.startDate), "MMM d, yyyy")} • {(member.employmentRate * 100).toFixed(0)}% employment rate
                                      </div>
                                    </div>
                                    {profile && (
                                      <div className="text-sm font-medium">
                                        ${profile.annualSalary.toLocaleString()}/year
                                      </div>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteTeamMember(member.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* Tranche-level team */}
                      {site.tranches.length > 0 && (() => {
                        const tranchesWithTeam = site.tranches.map(tranche => ({
                          tranche,
                          members: teamMembers.filter(
                            tm => tm.scope.type === "tranche" && tm.scope.targetId === tranche.id
                          )
                        })).filter(t => t.members.length > 0);

                        return tranchesWithTeam.length > 0 ? (
                          <div>
                            <h5 className="text-sm font-medium mb-2 text-muted-foreground">Tranche-level Team</h5>
                            <div className="space-y-3">
                              {tranchesWithTeam.map(({ tranche, members }) => (
                                <div key={tranche.id} className="border rounded-lg p-3 bg-muted/20">
                                  <div className="font-medium text-sm mb-2 flex items-center justify-between">
                                    <span>{tranche.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {tranche.powerMW} MW • starts {format(new Date(tranche.startDate), "MMM d, yyyy")}
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    {members.map(member => {
                                      const profile = teamProfiles.find(p => p.id === member.profileId);
                                      return (
                                        <div key={member.id} className="flex items-center gap-3 p-2 border rounded-lg bg-card">
                                          <div className="flex-1">
                                            <div className="font-medium text-sm">{profile?.name || "Unknown Profile"}</div>
                                            <div className="text-xs text-muted-foreground">
                                              {(member.employmentRate * 100).toFixed(0)}% employment rate
                                            </div>
                                          </div>
                                          {profile && (
                                            <div className="text-xs font-medium">
                                              ${profile.annualSalary.toLocaleString()}/year
                                            </div>
                                          )}
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteTeamMember(member.id)}
                                          >
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                          </Button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {(() => {
                        const siteTeam = teamMembers.filter(tm => 
                          (tm.scope.type === "site" && tm.scope.targetId === site.id) ||
                          (tm.scope.type === "tranche" && site.tranches.some(t => t.id === tm.scope.targetId))
                        );
                        return siteTeam.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            No team members assigned yet. Click &quot;Add Team Member&quot; to get started.
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )}

                {/* FLEET SECTION */}
                {isExpanded && (
                  <div className="border-t">
                    <div className="bg-muted/30 px-4 py-3 font-semibold text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        FLEET
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAttachFleetDialog(site.id)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Attach Fleet
                      </Button>
                    </div>
                    <div className="p-4">
                      {(() => {
                        const siteFleetAssignments = fleetAssignments
                          .filter(a => a.siteId === site.id)
                          .sort((a, b) => (a.priority || 0) - (b.priority || 0));

                        return siteFleetAssignments.length > 0 ? (
                          <>
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(event) => handleDragEnd(event, site.id)}
                            >
                              <SortableContext
                                items={siteFleetAssignments.map(a => a.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                <div className="space-y-2">
                                  {siteFleetAssignments.map((assignment, index) => {
                                    const fleet = fleets.find(f => f.id === assignment.fleetId);
                                    const model = fleet ? asicModels.find(m => m.id === fleet.modelId) : undefined;
                                    
                                    if (!fleet) return null;
                                    
                                    return (
                                      <SortableFleetItem
                                        key={assignment.id}
                                        fleet={fleet}
                                        assignment={assignment}
                                        model={model}
                                        priority={index}
                                        onDelete={handleDeleteFleetAssignment}
                                      />
                                    );
                                  })}
                                </div>
                              </SortableContext>
                            </DndContext>
                            <p className="text-xs text-muted-foreground mt-3">
                              Drag to reorder fleet deployment priority. Lower numbers are deployed first.
                            </p>
                          </>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            No fleets attached yet. Click &quot;Attach Fleet&quot; to get started.
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* TRANCHES SECTION */}
                {isExpanded && (
                  <div className="border-t">
                    <div className="bg-muted/30 px-4 py-3 font-semibold text-sm flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      TRANCHES
                    </div>
                    {site.tranches.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Power</TableHead>
                              <TableHead>Start Date</TableHead>
                              <TableHead>Ramp-up</TableHead>
                              <TableHead>Uptime</TableHead>
                              <TableHead>Electricity</TableHead>
                              <TableHead>Pool Fee</TableHead>
                              <TableHead>Total CAPEX</TableHead>
                              <TableHead>Yearly OPEX</TableHead>
                              <TableHead className="w-32"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {site.tranches.map((tranche, index) => {
                              const totalCapex = Object.values(tranche.capex).reduce((sum, val) => sum + val, 0);
                              const totalOpex = Object.values(tranche.opex).reduce((sum, val) => sum + val, 0);
                              return (
                                <TableRow key={tranche.id}>
                                  <TableCell className="font-medium">{tranche.name}</TableCell>
                                  <TableCell>{tranche.powerMW} MW</TableCell>
                                  <TableCell>
                                    {format(new Date(tranche.startDate), "MMM d, yyyy")}
                                  </TableCell>
                                  <TableCell>{tranche.rampUpMonths} months</TableCell>
                                  <TableCell>{(tranche.uptime * 100).toFixed(0)}%</TableCell>
                                  <TableCell>${tranche.electricityPricePerKWh.toFixed(4)}/kWh</TableCell>
                                  <TableCell>{(tranche.poolFee * 100).toFixed(1)}%</TableCell>
                                  <TableCell>${totalCapex.toLocaleString()}</TableCell>
                                  <TableCell>${totalOpex.toLocaleString()}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openAttachTeamDialog(site.id, "tranche", tranche.id)}
                                        title="Attach team member to this tranche"
                                      >
                                        <Users className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEditTranche(site, tranche, index)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteTranche(site, index)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        No tranches yet. Click &quot;Add Tranche&quot; above to configure power availability.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Tranche Edit/Create Dialog */}
      <Dialog
        open={isTranchDialogOpen}
        onOpenChange={setIsTranchDialogOpen}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmitTranche}>
            <DialogHeader>
              <DialogTitle>
                {editingTranche?.tranche ? "Edit" : "Add"} Power Tranche
              </DialogTitle>
              <DialogDescription>
                Configure power availability and costs for{" "}
                {editingTranche?.site.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-medium">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="trancheName">Tranche Name *</Label>
                    <Input
                      id="trancheName"
                      type="text"
                      placeholder="e.g., Main Facility, Phase 1, North Wing..."
                      value={trancheFormData.name}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="powerMW">Power Capacity (MW) *</Label>
                    <Input
                      id="powerMW"
                      type="number"
                      step="0.1"
                      value={trancheFormData.powerMW}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          powerMW: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trancheStartDate">Start Date *</Label>
                    <Input
                      id="trancheStartDate"
                      type="date"
                      value={trancheFormData.startDate}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          startDate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rampUpMonths">Ramp-up Period (months) *</Label>
                    <Input
                      id="rampUpMonths"
                      type="number"
                      step="1"
                      value={trancheFormData.rampUpMonths}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          rampUpMonths: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uptime">Estimated Uptime (%) *</Label>
                    <Input
                      id="uptime"
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={trancheFormData.uptime}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          uptime: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="electricity">Electricity Price ($/kWh) *</Label>
                    <Input
                      id="electricity"
                      type="number"
                      step="0.0001"
                      value={trancheFormData.electricityPricePerKWh}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          electricityPricePerKWh: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="poolFee">Pool Fee (%) *</Label>
                    <Input
                      id="poolFee"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={trancheFormData.poolFee}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          poolFee: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* CAPEX */}
              <div className="space-y-4">
                <h4 className="font-medium">
                  CAPEX Breakdown (Total: $
                  {calculateTotalCapex().toLocaleString()})
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="capexElectrical">
                      Electrical Infrastructure ($)
                    </Label>
                    <Input
                      id="capexElectrical"
                      type="number"
                      step="1000"
                      value={trancheFormData.capex.electrical}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          capex: {
                            ...trancheFormData.capex,
                            electrical: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capexCivil">Civil Works ($)</Label>
                    <Input
                      id="capexCivil"
                      type="number"
                      step="1000"
                      value={trancheFormData.capex.civil}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          capex: {
                            ...trancheFormData.capex,
                            civil: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capexWarehouse">Warehouse ($)</Label>
                    <Input
                      id="capexWarehouse"
                      type="number"
                      step="1000"
                      value={trancheFormData.capex.warehouse}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          capex: {
                            ...trancheFormData.capex,
                            warehouse: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capexContainers">Containers ($)</Label>
                    <Input
                      id="capexContainers"
                      type="number"
                      step="1000"
                      value={trancheFormData.capex.containers}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          capex: {
                            ...trancheFormData.capex,
                            containers: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capexOffice">Office ($)</Label>
                    <Input
                      id="capexOffice"
                      type="number"
                      step="1000"
                      value={trancheFormData.capex.office}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          capex: {
                            ...trancheFormData.capex,
                            office: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capexIT">IT & Networking ($)</Label>
                    <Input
                      id="capexIT"
                      type="number"
                      step="1000"
                      value={trancheFormData.capex.itNetworking}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          capex: {
                            ...trancheFormData.capex,
                            itNetworking: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* OPEX */}
              <div className="space-y-4">
                <h4 className="font-medium">
                  Yearly OPEX (Total: ${calculateTotalOpex().toLocaleString()})
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="opexInsurance">Insurance ($/year)</Label>
                    <Input
                      id="opexInsurance"
                      type="number"
                      step="1000"
                      value={trancheFormData.opex.insurance}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          opex: {
                            ...trancheFormData.opex,
                            insurance: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="opexMaintenance">Maintenance ($/year)</Label>
                    <Input
                      id="opexMaintenance"
                      type="number"
                      step="1000"
                      value={trancheFormData.opex.maintenance}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          opex: {
                            ...trancheFormData.opex,
                            maintenance: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="opexSecurity">Security ($/year)</Label>
                    <Input
                      id="opexSecurity"
                      type="number"
                      step="1000"
                      value={trancheFormData.opex.security}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          opex: {
                            ...trancheFormData.opex,
                            security: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="opexMonitoring">Monitoring ($/year)</Label>
                    <Input
                      id="opexMonitoring"
                      type="number"
                      step="1000"
                      value={trancheFormData.opex.monitoring}
                      onChange={(e) =>
                        setTrancheFormData({
                          ...trancheFormData,
                          opex: {
                            ...trancheFormData.opex,
                            monitoring: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTranchDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingTranche?.tranche ? "Update" : "Add"} Tranche
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteSiteDialogOpen} onOpenChange={setDeleteSiteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this site and all its tranches. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSite}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTrancheDialogOpen} onOpenChange={setDeleteTrancheDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this tranche. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTranche}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attach Fleet Dialog */}
      <Dialog open={attachFleetDialogOpen} onOpenChange={setAttachFleetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach Fleet to Site</DialogTitle>
            <DialogDescription>
              Select a fleet to attach to this site. The fleet will be deployed based on priority.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const availableFleets = fleets.filter(f => !fleetAssignments.some(a => a.fleetId === f.id && a.siteId === attachTargetSiteId));
            
            if (availableFleets.length === 0) {
              return (
                <div className="space-y-4">
                  <div className="rounded-md bg-muted p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No fleets available to attach. All fleets are already attached to this site or no fleets have been created yet.
                    </p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => {
                        setAttachFleetDialogOpen(false);
                        window.location.href = `/${projectId}/fleets`;
                      }}
                    >
                      Create a new fleet
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAttachFleetDialogOpen(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </div>
              );
            }
            
            return (
              <>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="fleet-select">Fleet</Label>
                    <Select value={selectedFleetId} onValueChange={setSelectedFleetId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a fleet..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFleets.map(fleet => {
                          const model = asicModels.find(m => m.id === fleet.modelId);
                          const quantityDisplay = fleet.quantityMode === "miners"
                            ? `${fleet.quantityMiners} miners`
                            : `${fleet.quantityMW} MW`;
                          return (
                            <SelectItem key={fleet.id} value={fleet.id}>
                              {model?.name || "Unknown Model"} - {quantityDisplay}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAttachFleetDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAttachFleet}>Attach Fleet</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Attach Team Member Dialog */}
      <Dialog open={attachTeamDialogOpen} onOpenChange={setAttachTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach Team Member</DialogTitle>
            <DialogDescription>
              Add a team member to this site or a specific tranche.
            </DialogDescription>
          </DialogHeader>
          {teamProfiles.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No team profiles available. Create a team profile first to add team members.
                </p>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => {
                    setAttachTeamDialogOpen(false);
                    window.location.href = `/${projectId}/settings/team-profiles`;
                  }}
                >
                  Create a team profile
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAttachTeamDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {/* Scope Selector */}
                {(() => {
                  const site = sites.find(s => s.id === attachTargetSiteId);
                  return site && site.tranches.length > 0 ? (
                    <div>
                      <Label htmlFor="scope-select">Assign To</Label>
                      <Select 
                        value={attachTargetType === "site" ? "site" : attachTargetTrancheId || ""}
                        onValueChange={(value) => {
                          if (value === "site") {
                            setAttachTargetType("site");
                            setAttachTargetTrancheId(null);
                          } else {
                            setAttachTargetType("tranche");
                            setAttachTargetTrancheId(value);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose assignment level..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="site">
                            Site Level - {site.name}
                          </SelectItem>
                          {site.tranches.map(tranche => (
                            <SelectItem key={tranche.id} value={tranche.id}>
                              Tranche: {tranche.name} ({tranche.powerMW} MW)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null;
                })()}
                
                <div>
                  <Label htmlFor="profile-select">Team Profile</Label>
                  <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a profile..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teamProfiles.map(profile => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} - ${profile.annualSalary.toLocaleString()}/year
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={teamMemberFormData.startDate}
                    onChange={(e) =>
                      setTeamMemberFormData({ ...teamMemberFormData, startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="employment-rate">Employment Rate (%)</Label>
                  <Input
                    id="employment-rate"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={teamMemberFormData.employmentRate}
                    onChange={(e) =>
                      setTeamMemberFormData({ ...teamMemberFormData, employmentRate: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    100% = full-time, 50% = half-time, etc.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAttachTeamDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAttachTeamMember}>Attach Team Member</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

