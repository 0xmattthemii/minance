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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  getAllTeamProfiles,
  createTeamProfile,
  updateTeamProfile,
  deleteTeamProfile,
} from "@/lib/db";
import type { TeamProfile } from "@/lib/types";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function TeamProfilesPage() {
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TeamProfile | null>(
    null
  );
  const [formData, setFormData] = useState({
    name: "",
    annualSalary: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    const data = await getAllTeamProfiles();
    setProfiles(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.annualSalary) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingProfile) {
        await updateTeamProfile({
          ...editingProfile,
          name: formData.name,
          annualSalary: parseFloat(formData.annualSalary),
        });
        toast({
          title: "Success",
          description: "Team profile updated successfully",
        });
      } else {
        await createTeamProfile({
          id: crypto.randomUUID(),
          name: formData.name,
          annualSalary: parseFloat(formData.annualSalary),
        });
        toast({
          title: "Success",
          description: "Team profile created successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingProfile(null);
      setFormData({ name: "", annualSalary: "" });
      loadProfiles();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save team profile",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (profile: TeamProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      annualSalary: profile.annualSalary.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setProfileToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!profileToDelete) return;

    try {
      await deleteTeamProfile(profileToDelete);
      toast({
        title: "Success",
        description: "Team profile deleted successfully",
      });
      loadProfiles();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete team profile",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setProfileToDelete(null);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingProfile(null);
      setFormData({ name: "", annualSalary: "" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Team Profiles</h1>
          <p className="text-muted-foreground mt-1">
            Define team roles and their annual salaries
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Profile
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingProfile ? "Edit" : "Create"} Team Profile
                </DialogTitle>
                <DialogDescription>
                  Define a team role with its annual salary
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Profile Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Site Manager, Technician"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary">Annual Salary ($)</Label>
                  <Input
                    id="salary"
                    type="number"
                    step="1000"
                    placeholder="e.g., 75000"
                    value={formData.annualSalary}
                    onChange={(e) =>
                      setFormData({ ...formData, annualSalary: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingProfile ? "Update" : "Create"}
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
              <TableHead>Profile Name</TableHead>
              <TableHead className="text-right">Annual Salary</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No team profiles yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.name}</TableCell>
                  <TableCell className="text-right">
                    ${profile.annualSalary.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(profile)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(profile.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this team profile. This action cannot be undone.
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

