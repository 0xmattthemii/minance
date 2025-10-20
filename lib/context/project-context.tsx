"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getCurrentProjectId, setCurrentProjectId, getProject } from "@/lib/db";
import type { Project } from "@/lib/types";

interface ProjectContextType {
  currentProjectId: string | null;
  currentProject: Project | null;
  setCurrentProject: (projectId: string) => Promise<void>;
  refreshProject: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(
    null
  );
  const [currentProject, setCurrentProjectState] = useState<Project | null>(
    null
  );

  useEffect(() => {
    loadCurrentProject();
  }, []);

  const loadCurrentProject = async () => {
    const projectId = await getCurrentProjectId();
    setCurrentProjectIdState(projectId);
    if (projectId) {
      const project = await getProject(projectId);
      setCurrentProjectState(project || null);
    }
  };

  const setCurrentProject = async (projectId: string) => {
    await setCurrentProjectId(projectId);
    setCurrentProjectIdState(projectId);
    const project = await getProject(projectId);
    setCurrentProjectState(project || null);
  };

  const refreshProject = async () => {
    await loadCurrentProject();
  };

  return (
    <ProjectContext.Provider
      value={{
        currentProjectId,
        currentProject,
        setCurrentProject,
        refreshProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}

