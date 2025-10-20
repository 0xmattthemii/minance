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
  getAllASICModels,
  createASICModel,
  updateASICModel,
  deleteASICModel,
} from "@/lib/db";
import type { ASICModel } from "@/lib/types";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function ASICModelsPage() {
  const [models, setModels] = useState<ASICModel[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ASICModel | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    powerW: "",
    hashrateThS: "",
    pricePerTh: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    const data = await getAllASICModels();
    // Sort by name
    data.sort((a, b) => a.name.localeCompare(b.name));
    setModels(data);
  };

  const calculateMinersPerMW = (powerW: number): number => {
    if (!powerW) return 0;
    return Math.floor((1000000 / powerW));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.name ||
      !formData.powerW ||
      !formData.hashrateThS ||
      !formData.pricePerTh
    ) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingModel) {
        await updateASICModel({
          ...editingModel,
          name: formData.name,
          powerW: parseFloat(formData.powerW),
          hashrateThS: parseFloat(formData.hashrateThS),
          pricePerTh: parseFloat(formData.pricePerTh),
        });
        toast({
          title: "Success",
          description: "ASIC model updated successfully",
        });
      } else {
        await createASICModel({
          id: crypto.randomUUID(),
          name: formData.name,
          powerW: parseFloat(formData.powerW),
          hashrateThS: parseFloat(formData.hashrateThS),
          pricePerTh: parseFloat(formData.pricePerTh),
          isPredefined: false,
        });
        toast({
          title: "Success",
          description: "ASIC model created successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingModel(null);
      setFormData({ name: "", powerW: "", hashrateThS: "", pricePerTh: "" });
      loadModels();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save ASIC model",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (model: ASICModel) => {
    setEditingModel(model);
    setFormData({
      name: model.name,
      powerW: model.powerW.toString(),
      hashrateThS: model.hashrateThS.toString(),
      pricePerTh: model.pricePerTh.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (model: ASICModel) => {
    setModelToDelete(model.id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!modelToDelete) return;

    try {
      await deleteASICModel(modelToDelete);
      toast({
        title: "Success",
        description: "ASIC model deleted successfully",
      });
      loadModels();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete ASIC model",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setModelToDelete(null);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingModel(null);
      setFormData({ name: "", powerW: "", hashrateThS: "", pricePerTh: "" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">ASIC Models</h1>
          <p className="text-muted-foreground mt-1">
            Manage Bitcoin mining hardware specifications
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Model
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingModel ? "Edit" : "Create"} ASIC Model
                </DialogTitle>
                <DialogDescription>
                  Define the specifications for an ASIC miner
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Model Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Antminer S19 XP"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="power">Power Consumption (W)</Label>
                  <Input
                    id="power"
                    type="number"
                    step="1"
                    placeholder="e.g., 3010"
                    value={formData.powerW}
                    onChange={(e) =>
                      setFormData({ ...formData, powerW: e.target.value })
                    }
                  />
                  {formData.powerW && (
                    <p className="text-xs text-muted-foreground">
                      ~{calculateMinersPerMW(parseFloat(formData.powerW))}{" "}
                      miners per MW
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hashrate">Hashrate (TH/s)</Label>
                  <Input
                    id="hashrate"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 140"
                    value={formData.hashrateThS}
                    onChange={(e) =>
                      setFormData({ ...formData, hashrateThS: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price per TH/s ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 28.57"
                    value={formData.pricePerTh}
                    onChange={(e) =>
                      setFormData({ ...formData, pricePerTh: e.target.value })
                    }
                  />
                  {formData.pricePerTh && formData.hashrateThS && (
                    <p className="text-xs text-muted-foreground">
                      Total price: $
                      {(
                        parseFloat(formData.pricePerTh) *
                        parseFloat(formData.hashrateThS)
                      ).toFixed(2)}
                    </p>
                  )}
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
                  {editingModel ? "Update" : "Create"}
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
              <TableHead>Model Name</TableHead>
              <TableHead className="text-right">Power (W)</TableHead>
              <TableHead className="text-right">Hashrate (TH/s)</TableHead>
              <TableHead className="text-right">Price/TH ($)</TableHead>
              <TableHead className="text-right">Miners/MW</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.id}>
                <TableCell className="font-medium">
                  {model.name}
                </TableCell>
                <TableCell className="text-right">
                  {model.powerW.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {model.hashrateThS.toFixed(1)}
                </TableCell>
                <TableCell className="text-right">
                  ${model.pricePerTh.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  {calculateMinersPerMW(model.powerW).toLocaleString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(model)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(model)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this ASIC model. This action cannot be undone.
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
