import { SiGithub } from "react-icons/si";
import { BarChart3, FileText, FolderGit2, GitPullRequest, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
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
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "My Repos", url: "/", icon: FolderGit2 },
  { title: "Pull Requests", url: "/pull-requests", icon: GitPullRequest },
  { title: "Reviews", url: "/reviews", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();

  const { data: user } = useQuery<{
    login: string;
    avatar_url: string;
    name?: string;
  }>({
    queryKey: ["auth-sidebar"],
    queryFn: () => apiFetch("/api/auth/me"),
    retry: false,
  });

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setLocation("/login");
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <SiGithub className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">
              Pull Panda
            </span>
            <span className="text-xs text-muted-foreground">AI Code Review</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Avatar className="h-8 w-8 border border-border">
              <AvatarImage src={user?.avatar_url || "https://github.com/github.png"} />
              <AvatarFallback>{user?.login?.slice(0, 2).toUpperCase() || "GH"}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.name || user?.login || "GitHub User"}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                @{user?.login || "authenticating"}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Logout"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
