import { openDB, DBSchema, IDBPDatabase } from "idb";
import type {
  Project,
  Site,
  TeamProfile,
  TeamMember,
  ASICModel,
  ASICFleet,
  FleetAssignment,
  Scenario,
  ExportData,
} from "@/lib/types";
import { PREDEFINED_ASIC_MODELS } from "@/lib/constants/asic-models";

const DB_NAME = "mining-financial-model";
const DB_VERSION = 1;

interface MiningDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
  sites: {
    key: string;
    value: Site;
    indexes: { projectId: string };
  };
  teamProfiles: {
    key: string;
    value: TeamProfile;
  };
  teamMembers: {
    key: string;
    value: TeamMember;
    indexes: { projectId: string };
  };
  asicModels: {
    key: string;
    value: ASICModel;
  };
  fleets: {
    key: string;
    value: ASICFleet;
    indexes: { projectId: string };
  };
  fleetAssignments: {
    key: string;
    value: FleetAssignment;
    indexes: { fleetId: string; siteId: string };
  };
  scenarios: {
    key: string;
    value: Scenario;
    indexes: { projectId: string };
  };
  settings: {
    key: string;
    value: any;
  };
}

let dbInstance: IDBPDatabase<MiningDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<MiningDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<MiningDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Projects store
      if (!db.objectStoreNames.contains("projects")) {
        db.createObjectStore("projects", { keyPath: "id" });
      }

      // Sites store
      if (!db.objectStoreNames.contains("sites")) {
        const sitesStore = db.createObjectStore("sites", { keyPath: "id" });
        sitesStore.createIndex("projectId", "projectId");
      }

      // Team profiles store
      if (!db.objectStoreNames.contains("teamProfiles")) {
        db.createObjectStore("teamProfiles", { keyPath: "id" });
      }

      // Team members store
      if (!db.objectStoreNames.contains("teamMembers")) {
        const teamMembersStore = db.createObjectStore("teamMembers", {
          keyPath: "id",
        });
        teamMembersStore.createIndex("projectId", "projectId");
      }

      // ASIC models store
      if (!db.objectStoreNames.contains("asicModels")) {
        db.createObjectStore("asicModels", { keyPath: "id" });
      }

      // Fleets store
      if (!db.objectStoreNames.contains("fleets")) {
        const fleetsStore = db.createObjectStore("fleets", { keyPath: "id" });
        fleetsStore.createIndex("projectId", "projectId");
      }

      // Fleet assignments store
      if (!db.objectStoreNames.contains("fleetAssignments")) {
        const assignmentsStore = db.createObjectStore("fleetAssignments", {
          keyPath: "id",
        });
        assignmentsStore.createIndex("fleetId", "fleetId");
        assignmentsStore.createIndex("siteId", "siteId");
      }

      // Scenarios store
      if (!db.objectStoreNames.contains("scenarios")) {
        const scenariosStore = db.createObjectStore("scenarios", {
          keyPath: "id",
        });
        scenariosStore.createIndex("projectId", "projectId");
      }

      // Settings store (for current project, etc.)
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    },
  });

  // Initialize predefined ASIC models if none exist
  const existingModels = await dbInstance.getAll("asicModels");
  if (existingModels.length === 0) {
    const tx = dbInstance.transaction("asicModels", "readwrite");
    for (const model of PREDEFINED_ASIC_MODELS) {
      await tx.store.add(model);
    }
    await tx.done;
  }

  return dbInstance;
}

// Current project management
export async function getCurrentProjectId(): Promise<string | null> {
  const db = await getDB();
  const setting = await db.get("settings", "currentProjectId");
  return setting?.value || null;
}

export async function setCurrentProjectId(projectId: string): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key: "currentProjectId", value: projectId });
}

// Projects CRUD
export async function createProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.add("projects", project);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return await db.get("projects", id);
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  return await db.getAll("projects");
}

export async function updateProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.put("projects", project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    [
      "projects",
      "sites",
      "teamMembers",
      "fleets",
      "fleetAssignments",
      "scenarios",
    ],
    "readwrite"
  );

  // Delete project
  await tx.objectStore("projects").delete(id);

  // Delete related sites
  const sites = await tx.objectStore("sites").index("projectId").getAll(id);
  for (const site of sites) {
    await tx.objectStore("sites").delete(site.id);
    // Delete fleet assignments for this site
    const assignments = await tx
      .objectStore("fleetAssignments")
      .index("siteId")
      .getAll(site.id);
    for (const assignment of assignments) {
      await tx.objectStore("fleetAssignments").delete(assignment.id);
    }
  }

  // Delete related team members
  const teamMembers = await tx
    .objectStore("teamMembers")
    .index("projectId")
    .getAll(id);
  for (const member of teamMembers) {
    await tx.objectStore("teamMembers").delete(member.id);
  }

  // Delete related fleets
  const fleets = await tx.objectStore("fleets").index("projectId").getAll(id);
  for (const fleet of fleets) {
    await tx.objectStore("fleets").delete(fleet.id);
  }

  // Delete related scenarios
  const scenarios = await tx
    .objectStore("scenarios")
    .index("projectId")
    .getAll(id);
  for (const scenario of scenarios) {
    await tx.objectStore("scenarios").delete(scenario.id);
  }

  await tx.done;

  // Clear current project if it was deleted
  const currentProjectId = await getCurrentProjectId();
  if (currentProjectId === id) {
    const db = await getDB();
    await db.delete("settings", "currentProjectId");
  }
}

// Sites CRUD
export async function createSite(site: Site): Promise<void> {
  const db = await getDB();
  await db.add("sites", site);
}

export async function getSite(id: string): Promise<Site | undefined> {
  const db = await getDB();
  return await db.get("sites", id);
}

export async function getSitesByProject(projectId: string): Promise<Site[]> {
  const db = await getDB();
  return await db.getAllFromIndex("sites", "projectId", projectId);
}

export async function updateSite(site: Site): Promise<void> {
  const db = await getDB();
  await db.put("sites", site);
}

export async function deleteSite(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sites", "fleetAssignments"], "readwrite");

  await tx.objectStore("sites").delete(id);

  // Delete fleet assignments for this site
  const assignments = await tx
    .objectStore("fleetAssignments")
    .index("siteId")
    .getAll(id);
  for (const assignment of assignments) {
    await tx.objectStore("fleetAssignments").delete(assignment.id);
  }

  await tx.done;
}

// Team Profiles CRUD
export async function createTeamProfile(profile: TeamProfile): Promise<void> {
  const db = await getDB();
  await db.add("teamProfiles", profile);
}

export async function getTeamProfile(
  id: string
): Promise<TeamProfile | undefined> {
  const db = await getDB();
  return await db.get("teamProfiles", id);
}

export async function getAllTeamProfiles(): Promise<TeamProfile[]> {
  const db = await getDB();
  return await db.getAll("teamProfiles");
}

export async function updateTeamProfile(profile: TeamProfile): Promise<void> {
  const db = await getDB();
  await db.put("teamProfiles", profile);
}

export async function deleteTeamProfile(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("teamProfiles", id);
}

// Team Members CRUD
export async function createTeamMember(member: TeamMember): Promise<void> {
  const db = await getDB();
  await db.add("teamMembers", member);
}

export async function getTeamMember(
  id: string
): Promise<TeamMember | undefined> {
  const db = await getDB();
  return await db.get("teamMembers", id);
}

export async function getTeamMembersByProject(
  projectId: string
): Promise<TeamMember[]> {
  const db = await getDB();
  return await db.getAllFromIndex("teamMembers", "projectId", projectId);
}

export async function updateTeamMember(member: TeamMember): Promise<void> {
  const db = await getDB();
  await db.put("teamMembers", member);
}

export async function deleteTeamMember(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("teamMembers", id);
}

// ASIC Models CRUD
export async function createASICModel(model: ASICModel): Promise<void> {
  const db = await getDB();
  await db.add("asicModels", model);
}

export async function getASICModel(id: string): Promise<ASICModel | undefined> {
  const db = await getDB();
  return await db.get("asicModels", id);
}

export async function getAllASICModels(): Promise<ASICModel[]> {
  const db = await getDB();
  return await db.getAll("asicModels");
}

export async function updateASICModel(model: ASICModel): Promise<void> {
  const db = await getDB();
  await db.put("asicModels", model);
}

export async function deleteASICModel(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("asicModels", id);
}

// Fleets CRUD
export async function createFleet(fleet: ASICFleet): Promise<void> {
  const db = await getDB();
  await db.add("fleets", fleet);
}

export async function getFleet(id: string): Promise<ASICFleet | undefined> {
  const db = await getDB();
  return await db.get("fleets", id);
}

export async function getFleetsByProject(projectId: string): Promise<ASICFleet[]> {
  const db = await getDB();
  return await db.getAllFromIndex("fleets", "projectId", projectId);
}

export async function updateFleet(fleet: ASICFleet): Promise<void> {
  const db = await getDB();
  await db.put("fleets", fleet);
}

export async function deleteFleet(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["fleets", "fleetAssignments"], "readwrite");

  await tx.objectStore("fleets").delete(id);

  // Delete fleet assignments for this fleet
  const assignments = await tx
    .objectStore("fleetAssignments")
    .index("fleetId")
    .getAll(id);
  for (const assignment of assignments) {
    await tx.objectStore("fleetAssignments").delete(assignment.id);
  }

  await tx.done;
}

// Fleet Assignments CRUD
export async function createFleetAssignment(
  assignment: FleetAssignment
): Promise<void> {
  const db = await getDB();
  await db.add("fleetAssignments", assignment);
}

export async function getFleetAssignment(
  id: string
): Promise<FleetAssignment | undefined> {
  const db = await getDB();
  return await db.get("fleetAssignments", id);
}

export async function getFleetAssignmentsByFleet(
  fleetId: string
): Promise<FleetAssignment[]> {
  const db = await getDB();
  return await db.getAllFromIndex("fleetAssignments", "fleetId", fleetId);
}

export async function getFleetAssignmentsBySite(
  siteId: string
): Promise<FleetAssignment[]> {
  const db = await getDB();
  return await db.getAllFromIndex("fleetAssignments", "siteId", siteId);
}

export async function getAllFleetAssignments(): Promise<FleetAssignment[]> {
  const db = await getDB();
  return await db.getAll("fleetAssignments");
}

export async function updateFleetAssignment(
  assignment: FleetAssignment
): Promise<void> {
  const db = await getDB();
  await db.put("fleetAssignments", assignment);
}

export async function deleteFleetAssignment(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("fleetAssignments", id);
}

// Scenarios CRUD
export async function createScenario(scenario: Scenario): Promise<void> {
  const db = await getDB();
  await db.add("scenarios", scenario);
}

export async function getScenario(id: string): Promise<Scenario | undefined> {
  const db = await getDB();
  return await db.get("scenarios", id);
}

export async function getScenariosByProject(
  projectId: string
): Promise<Scenario[]> {
  const db = await getDB();
  return await db.getAllFromIndex("scenarios", "projectId", projectId);
}

export async function updateScenario(scenario: Scenario): Promise<void> {
  const db = await getDB();
  await db.put("scenarios", scenario);
}

export async function deleteScenario(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("scenarios", id);
}

// Export/Import functionality
export async function exportProjectData(projectId: string): Promise<ExportData> {
  const project = await getProject(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const sites = await getSitesByProject(projectId);
  const teamMembers = await getTeamMembersByProject(projectId);
  const fleets = await getFleetsByProject(projectId);
  const scenarios = await getScenariosByProject(projectId);

  // Get all fleet assignments for this project's fleets
  const allAssignments = await getAllFleetAssignments();
  const fleetIds = new Set(fleets.map((f) => f.id));
  const fleetAssignments = allAssignments.filter((a) => fleetIds.has(a.fleetId));

  // Get all team profiles (not project-specific)
  const teamProfiles = await getAllTeamProfiles();

  // Get ASIC models used by fleets
  const modelIds = new Set(fleets.map((f) => f.modelId));
  const allModels = await getAllASICModels();
  const asicModels = allModels.filter((m) => modelIds.has(m.id));

  return {
    version: "1.0",
    exportDate: new Date().toISOString(),
    project,
    sites,
    teamProfiles,
    teamMembers,
    asicModels,
    fleets,
    fleetAssignments,
    scenarios,
  };
}

export async function importProjectData(data: ExportData): Promise<string> {
  const db = await getDB();

  // Generate new IDs for everything to avoid conflicts
  const idMap = new Map<string, string>();
  const generateNewId = (oldId: string): string => {
    if (!idMap.has(oldId)) {
      idMap.set(oldId, crypto.randomUUID());
    }
    return idMap.get(oldId)!;
  };

  // Import project with new ID
  const newProjectId = generateNewId(data.project.id);
  const newProject: Project = {
    ...data.project,
    id: newProjectId,
    name: `${data.project.name} (Imported)`,
    createdAt: new Date().toISOString(),
  };
  await createProject(newProject);

  // Import team profiles (may already exist, so check)
  for (const profile of data.teamProfiles) {
    const existing = await getTeamProfile(profile.id);
    if (!existing) {
      await createTeamProfile(profile);
    }
  }

  // Import ASIC models (may already exist, so check)
  for (const model of data.asicModels) {
    const existing = await getASICModel(model.id);
    if (!existing) {
      await createASICModel(model);
    }
  }

  // Import sites with new IDs
  for (const site of data.sites) {
    const newSiteId = generateNewId(site.id);
    const newSite: Site = {
      ...site,
      id: newSiteId,
      projectId: newProjectId,
      tranches: site.tranches.map((t) => ({
        ...t,
        id: generateNewId(t.id),
      })),
    };
    await createSite(newSite);
  }

  // Import fleets with new IDs
  for (const fleet of data.fleets) {
    const newFleetId = generateNewId(fleet.id);
    const newFleet: ASICFleet = {
      ...fleet,
      id: newFleetId,
      projectId: newProjectId,
    };
    await createFleet(newFleet);
  }

  // Import fleet assignments with new IDs
  for (const assignment of data.fleetAssignments) {
    const newAssignment: FleetAssignment = {
      id: generateNewId(assignment.id),
      fleetId: generateNewId(assignment.fleetId),
      siteId: generateNewId(assignment.siteId),
      priority: assignment.priority ?? 0, // Default to 0 for backwards compatibility
    };
    await createFleetAssignment(newAssignment);
  }

  // Import team members with new IDs
  for (const member of data.teamMembers) {
    const newMember: TeamMember = {
      ...member,
      id: generateNewId(member.id),
      projectId: newProjectId,
      scope: {
        ...member.scope,
        targetId: member.scope.targetId
          ? generateNewId(member.scope.targetId)
          : undefined,
      },
    };
    await createTeamMember(newMember);
  }

  // Import scenarios with new IDs
  for (const scenario of data.scenarios) {
    const newScenario: Scenario = {
      ...scenario,
      id: generateNewId(scenario.id),
      projectId: newProjectId,
    };
    await createScenario(newScenario);
  }

  return newProjectId;
}

