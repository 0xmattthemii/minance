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
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getTeamMembersByProject,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  getAllTeamProfiles,
  getSitesByProject,
} from "@/lib/db";
import type { TeamMember, TeamProfile, Site, ScopeType } from "@/lib/types";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useParams } from "next/navigation";

export default function TeamPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [formData, setFormData] = useState({
    profileId: "",
    scopeType: "company" as ScopeType,
    targetId: "",
    trancheId: "",
    startDate: "",
    employmentRate: 100,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    if (!projectId) return;

    const profilesList = await getAllTeamProfiles();
    setProfiles(profilesList);

    const membersData = await getTeamMembersByProject(projectId);
    setMembers(membersData);

    const sitesData = await getSitesByProject(projectId);
    setSites(sitesData);
  };

  const getProfileById = (profileId: string): TeamProfile | undefined => {
    return profiles.find((p) => p.id === profileId);
  };

  const getSiteById = (siteId: string): Site | undefined => {
    return sites.find((s) => s.id === siteId);
  };

  const getTrancheById = (siteId: string, trancheId: string) => {
    const site = getSiteById(siteId);
    return site?.tranches.find((t) => t.id === trancheId);
  };

  const handleScopeTypeChange = (type: ScopeType) => {
    setFormData({
      ...formData,
      scopeType: type,
      targetId: "",
      trancheId: "",
      startDate: "",
    });
  };

  const handleSiteChange = (siteId: string) => {
    const site = getSiteById(siteId);
    setFormData({
      ...formData,
      targetId: siteId,
      trancheId: "",
      startDate: site?.startDate || "",
    });
  };

  const handleTrancheChange = (trancheId: string) => {
    const site = getSiteById(formData.targetId);
    const tranche = site?.tranches.find((t) => t.id === trancheId);
    setFormData({
      ...formData,
      trancheId,
      startDate: tranche?.startDate || "",
    });
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

    if (!formData.profileId || !formData.startDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (formData.scopeType === "site" && !formData.targetId) {
      toast({
        title: "Error",
        description: "Please select a site",
        variant: "destructive",
      });
      return;
    }

    if (formData.scopeType === "tranche" && (!formData.targetId || !formData.trancheId)) {
      toast({
        title: "Error",
        description: "Please select a site and tranche",
        variant: "destructive",
      });
      return;
    }

    try {
      const memberData: TeamMember = {
        id: editingMember?.id || crypto.randomUUID(),
        projectId: projectId,
        profileId: formData.profileId,
        scope: {
          type: formData.scopeType,
          targetId:
            formData.scopeType === "company"
              ? undefined
              : formData.scopeType === "site"
              ? formData.targetId
              : formData.trancheId,
        },
        startDate: formData.startDate,
        employmentRate: formData.employmentRate / 100,
      };

      if (editingMember) {
        await updateTeamMember(memberData);
        toast({
          title: "Success",
          description: "Team member updated successfully",
        });
      } else {
        await createTeamMember(memberData);
        toast({
          title: "Success",
          description: "Team member added successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingMember(null);
      resetForm();
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save team member",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (member: TeamMember) => {
    setEditingMember(member);

    // Determine scope details
    let targetId = "";
    let trancheId = "";
    if (member.scope.type === "site") {
      targetId = member.scope.targetId || "";
    } else if (member.scope.type === "tranche") {
      trancheId = member.scope.targetId || "";
      // Find the site that contains this tranche
      for (const site of sites) {
        if (site.tranches.some((t) => t.id === trancheId)) {
          targetId = site.id;
          break;
        }
      }
    }

    setFormData({
      profileId: member.profileId,
      scopeType: member.scope.type,
      targetId,
      trancheId,
      startDate: member.startDate,
      employmentRate: Math.round(member.employmentRate * 100),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setMemberToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!memberToDelete) return;

    try {
      await deleteTeamMember(memberToDelete);
      toast({
        title: "Success",
        description: "Team member deleted successfully",
      });
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete team member",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setMemberToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      profileId: "",
      scopeType: "company",
      targetId: "",
      trancheId: "",
      startDate: "",
      employmentRate: 100,
    });
  };

  const getScopeDisplay = (member: TeamMember): string => {
    if (member.scope.type === "company") {
      return "Company-wide";
    } else if (member.scope.type === "site") {
      const site = getSiteById(member.scope.targetId || "");
      return site ? `Site: ${site.name}` : "Site: Unknown";
    } else {
      // tranche
      const trancheId = member.scope.targetId;
      for (const site of sites) {
        const tranche = site.tranches.find((t) => t.id === trancheId);
        if (tranche) {
          return `${site.name}: ${tranche.name}`;
        }
      }
      return "Unknown";
    }
  };

  // Sort members by start date first, then by scope (company → site → tranche)
  const sortedMembers = [...members].sort((a, b) => {
    // First sort by start date
    const dateA = new Date(a.startDate).getTime();
    const dateB = new Date(b.startDate).getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }

    // Then sort by scope type
    const scopeOrder = { company: 0, site: 1, tranche: 2 };
    return scopeOrder[a.scope.type] - scopeOrder[b.scope.type];
  });

  if (!projectId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Team Members</h1>
          <p className="text-muted-foreground mt-1">
            Assign team members to company, sites, or tranches
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
          <h1 className="text-3xl font-bold">Team Members</h1>
          <p className="text-muted-foreground mt-1">
            Configure team assignments and employment rates
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Team Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingMember ? "Edit" : "Add"} Team Member
                </DialogTitle>
                <DialogDescription>
                  Assign a team member to the project
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="profile">Team Profile *</Label>
                  <Select
                    value={formData.profileId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, profileId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} - $
                          {profile.annualSalary.toLocaleString()}/year
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {profiles.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No profiles yet. Create one in Settings → Team Profiles
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Assignment Scope *</Label>
                  <RadioGroup
                    value={formData.scopeType}
                    onValueChange={(value) =>
                      handleScopeTypeChange(value as ScopeType)
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="company" id="scope-company" />
                      <Label htmlFor="scope-company" className="font-normal">
                        Company-wide
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="site" id="scope-site" />
                      <Label htmlFor="scope-site" className="font-normal">
                        Specific Site
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="tranche" id="scope-tranche" />
                      <Label htmlFor="scope-tranche" className="font-normal">
                        Specific Tranche
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {formData.scopeType !== "company" && (
                  <div className="space-y-2">
                    <Label htmlFor="site">Select Site *</Label>
                    <Select
                      value={formData.targetId}
                      onValueChange={handleSiteChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a site" />
                      </SelectTrigger>
                      <SelectContent>
                        {sites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.scopeType === "tranche" && formData.targetId && (
                  <div className="space-y-2">
                    <Label htmlFor="tranche">Select Tranche *</Label>
                    <Select
                      value={formData.trancheId}
                      onValueChange={handleTrancheChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a tranche" />
                      </SelectTrigger>
                      <SelectContent>
                        {getSiteById(formData.targetId)?.tranches.map((tranche) => (
                          <SelectItem key={tranche.id} value={tranche.id}>
                            {tranche.name} ({tranche.powerMW} MW) - Start{" "}
                            {format(new Date(tranche.startDate), "MMM d, yyyy")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    disabled={formData.scopeType !== "company"}
                  />
                  {formData.scopeType !== "company" && (
                    <p className="text-xs text-muted-foreground">
                      Start date is automatically set based on site/tranche
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employmentRate">
                    Employment Rate: {formData.employmentRate}%
                  </Label>
                  <Slider
                    id="employmentRate"
                    min={0}
                    max={100}
                    step={5}
                    value={[formData.employmentRate]}
                    onValueChange={(value) =>
                      setFormData({ ...formData, employmentRate: value[0] })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    100% = full-time, 50% = half-time, etc.
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
                  {editingMember ? "Update" : "Add"}
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
              <TableHead>Profile</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead className="text-right">Annual Salary</TableHead>
              <TableHead className="text-right">Employment Rate</TableHead>
              <TableHead className="text-right">Effective Salary</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMembers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  No team members yet. Add one to get started.
                </TableCell>
              </TableRow>
            ) : (
              sortedMembers.map((member) => {
                const profile = getProfileById(member.profileId);
                const effectiveSalary = profile
                  ? profile.annualSalary * member.employmentRate
                  : 0;
                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {profile?.name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getScopeDisplay(member)}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(member.startDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      ${profile?.annualSalary.toLocaleString() || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {(member.employmentRate * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right">
                      ${effectiveSalary.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(member)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(member.id)}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this team member. This action cannot be undone.
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

