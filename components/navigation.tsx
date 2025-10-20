"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Users,
  Cpu,
  TrendingUp,
  Settings,
  Home,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getProject } from "@/lib/db";
import type { Project } from "@/lib/types";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const getNavItems = (projectId: string) => {
  return [
    {
      title: "Sites",
      href: `/${projectId}/sites`,
      icon: Building2,
    },
    {
      title: "Fleets",
      href: `/${projectId}/fleets`,
      icon: Cpu,
    },
    {
      title: "Team",
      href: `/${projectId}/team`,
      icon: Users,
    },
    {
      title: "Results",
      href: `/${projectId}/results`,
      icon: TrendingUp,
    },
  ];
};

const getSettingsItems = (projectId: string) => {
  return [
    {
      title: "Team Profiles",
      href: `/${projectId}/settings/team-profiles`,
    },
    {
      title: "ASIC Models",
      href: `/${projectId}/settings/asic-models`,
    },
    {
      title: "Economics",
      href: `/${projectId}/settings/economics`,
    },
  ];
};

export function Navigation() {
  const pathname = usePathname();
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // Extract project ID from URL path
  const projectIdFromPath = pathname !== '/' ? pathname.split('/')[1] : null;
  const isInsideProject = projectIdFromPath !== null && pathname !== '/';

  useEffect(() => {
    if (projectIdFromPath) {
      loadProject(projectIdFromPath);
    } else {
      setCurrentProject(null);
    }
  }, [projectIdFromPath]);

  const loadProject = async (projectId: string) => {
    const project = await getProject(projectId);
    setCurrentProject(project || null);
  };

  // Don't render sidebar on homepage
  if (!isInsideProject) {
    return null;
  }

  const navItems = projectIdFromPath ? getNavItems(projectIdFromPath) : [];
  const settingsItems = projectIdFromPath ? getSettingsItems(projectIdFromPath) : [];

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-4">
          <Link href="/" className="block">
            <h1 className="text-xl font-bold mb-1">Mining Finance</h1>
            <p className="text-sm text-muted-foreground">Financial Modeling</p>
          </Link>
        </div>

        {currentProject && (
          <div className="px-2 pb-4">
            <div className="p-3 border rounded-lg bg-muted/50">
              <p className="font-medium truncate">{currentProject.name}</p>
              <Link
                href="/"
                className="text-xs text-primary hover:underline mt-2 flex items-center gap-1"
              >
                <Home className="h-3 w-3" />
                All projects
              </Link>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {currentProject && (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={item.href}>
                            <Icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {settingsItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={item.href}>
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
