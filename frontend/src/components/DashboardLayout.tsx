import { ReactNode } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { ReviewOverlay } from "./ReviewOverlay";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const getBreadcrumbs = (pathname: string) => {
  if (pathname === "/dashboard") return ["Dashboard", "Overview"];
  if (pathname === "/leads") return ["Contacts", "Directory"];
  if (pathname === "/email") return ["Inbox", "Messages"];
  if (pathname === "/create") return ["Contacts", "Import"];
  if (pathname === "/message") return ["Campaigns", "Create Campaign"];
  if (pathname === "/message-campaigns") return ["Campaigns", "Campaign History"];
  if (pathname.startsWith("/settings")) return ["Settings", "Configuration"];
  return ["App", "Dashboard"];
};

export function DashboardLayout({
  children,
  hideSidebar = false,
  fullBleed = false,
  overflowHidden = false,
}: {
  children: ReactNode;
  hideSidebar?: boolean;
  fullBleed?: boolean;
  overflowHidden?: boolean;
}) {
  const { onboardingStatus, user, signOut } = useAuth();
  const isReviewing = onboardingStatus === "setup_in_progress";
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const userInitials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "U";

  const breadcrumbs = getBreadcrumbs(location.pathname);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {!hideSidebar && <DashboardSidebar />}
      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        {isReviewing && <ReviewOverlay />}
        
        {/* Top Header Bar */}
        {user && (
          <header className="flex h-16 shrink-0 items-center justify-between mt-4 mx-6 px-6 bg-white/80 backdrop-blur-xl border border-orange-500/10 shadow-[0_8px_32px_rgba(255,102,0,0.05)] rounded-2xl z-20">
            <div className="flex items-center gap-3">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className="text-muted-foreground">{breadcrumbs[0]}</span>
                <span className="text-muted-foreground/45">/</span>
                <span className="text-foreground font-semibold">{breadcrumbs[1]}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* SMTP Status */}
              <div className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1 bg-orange-500/5 border border-orange-500/10 text-xs font-semibold text-orange-600 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                <span>SMTP Relay Live</span>
              </div>

              {/* Quick Action Button */}
              {location.pathname !== "/message" && (
                <button
                  onClick={() => navigate("/message")}
                  className="hidden md:flex items-center gap-1.5 rounded-full px-3.5 py-1.5 bg-gradient-to-r from-primary to-orange-600 hover:from-primary/95 hover:to-orange-600/95 text-white text-xs font-bold shadow-[0_2px_8px_rgba(255,102,0,0.2)] hover:shadow-[0_4px_12px_rgba(255,102,0,0.3)] transition-all duration-300"
                >
                  <span>+ New Campaign</span>
                </button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger className="focus:outline-none">
                  <Avatar className="h-10 w-10 border-2 border-orange-500/20 hover:border-orange-500 hover:shadow-[0_0_12px_rgba(255,102,0,0.35)] transition-all duration-300 cursor-pointer">
                    <AvatarFallback className="bg-orange-500/10 text-sm font-bold text-orange-600">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 mt-2 p-2 bg-white/90 backdrop-blur-2xl border border-orange-500/25 shadow-[0_12px_40px_rgba(255,102,0,0.15)] rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                  <DropdownMenuLabel className="font-normal px-3 py-2.5 rounded-xl bg-orange-500/[0.03] border border-orange-500/5 mb-1.5">
                    <div className="flex flex-col space-y-0.5">
                      <p className="text-sm font-bold text-foreground">
                        {user?.displayName || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-orange-500/10 mb-1.5" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2.5 text-xs text-orange-700 hover:text-orange-950 bg-orange-500/5 hover:bg-orange-500/15 focus:bg-orange-500/20 focus:text-orange-950 font-bold rounded-xl transition-all duration-200 cursor-pointer border border-orange-500/10"
                  >
                    <LogOut className="h-4 w-4 text-orange-500" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
        )}

        {/* Page Content Wrapper */}
        <div className={cn("flex-1", (isReviewing || overflowHidden) ? "overflow-hidden" : "overflow-y-auto")}>
          <div className={fullBleed ? "h-full" : "mx-auto max-w-7xl p-6 lg:p-8"}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
