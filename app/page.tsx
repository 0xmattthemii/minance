"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  getAllProjects,
  createProject,
  updateProject,
  deleteProject,
  exportProjectData,
  importProjectData,
} from "@/lib/db";
import type { Project } from "@/lib/types";
import { Plus, Pencil, Trash2, Download, Upload } from "lucide-react";
import { format } from "date-fns";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const data = await getAllProjects();
    setProjects(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.startDate || !formData.endDate) {
      toast.error("Error", { description: "Please fill in all fields" });
      return;
    }

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      toast.error("Error", { description: "End date must be after start date" });
      return;
    }

    try {
      if (editingProject) {
        await updateProject({
          ...editingProject,
          name: formData.name,
          startDate: formData.startDate,
          endDate: formData.endDate,
        });
        toast.success("Success", { description: "Project updated successfully" });
      } else {
        const newProject: Project = {
          id: crypto.randomUUID(),
          name: formData.name,
          startDate: formData.startDate,
          endDate: formData.endDate,
          createdAt: new Date().toISOString(),
        };
        await createProject(newProject);
        
        toast.success("Success", { description: "Project created successfully" });

        // Navigate to the new project
        router.push(`/${newProject.id}/sites`);
      }

      setIsDialogOpen(false);
      setEditingProject(null);
      setFormData({ name: "", startDate: "", endDate: "" });
      loadProjects();
    } catch (error) {
      toast.error("Error", { description: "Failed to save project" });
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      startDate: project.startDate,
      endDate: project.endDate,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setProjectToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;

    try {
      await deleteProject(projectToDelete);
      toast.success("Success", { description: "Project deleted successfully" });
      loadProjects();
    } catch (error) {
      toast.error("Error", { description: "Failed to delete project" });
    } finally {
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const handleOpenProject = (id: string) => {
    router.push(`/${id}/sites`);
  };

  const handleExport = async (projectId: string) => {
    try {
      const data = await exportProjectData(projectId);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const project = projects.find((p) => p.id === projectId);
      a.download = `${project?.name || "project"}-export-${format(
        new Date(),
        "yyyy-MM-dd"
      )}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success("Success", { description: "Project exported successfully" });
    } catch (error) {
      toast.error("Error", { description: "Failed to export project" });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const newProjectId = await importProjectData(data);
      
      toast.success("Success", { description: "Project imported successfully" });
      
      loadProjects();
      // Navigate to the imported project
      router.push(`/${newProjectId}/sites`);
    } catch (error) {
      toast.error("Error", { description: "Failed to import project. Please check the file format." });
    }
    
    // Reset input
    e.target.value = "";
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      // Reset form when closing
      setEditingProject(null);
      setFormData({ name: "", startDate: "", endDate: "" });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold">Mining Finance</h1>
        <p className="text-muted-foreground text-lg">
          Bitcoin Mining Financial Modeling
        </p>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Your Projects</h2>
          <p className="text-muted-foreground mt-1">
            Select a project to view and manage financial models
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => document.getElementById("import-file")?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <input
            id="import-file"
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingProject ? "Edit" : "Create"} Project
                  </DialogTitle>
                  <DialogDescription>
                    Define a mining project with timeline
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Project Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Texas Mining Operation"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) =>
                        setFormData({ ...formData, endDate: e.target.value })
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
                    {editingProject ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground mb-4 text-lg">
              No projects yet. Create your first project to get started.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="hover:border-primary transition-colors cursor-pointer"
              onClick={() => handleOpenProject(project.id)}
            >
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
                <CardDescription>
                  Created {format(new Date(project.createdAt), "MMM d, yyyy")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start:</span>
                    <span className="font-medium">
                      {format(new Date(project.startDate), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">End:</span>
                    <span className="font-medium">
                      {format(new Date(project.endDate), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(project.id);
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(project);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(project.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this project and all associated data (sites, fleets, teams, etc.). This action cannot be undone.
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
