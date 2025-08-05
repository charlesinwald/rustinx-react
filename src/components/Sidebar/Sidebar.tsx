import type React from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import NginxStatus from "../Status/Status";

interface SidebarLink {
  label: string;
  view: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SidebarProps {
  links: SidebarLink[];
  onLinkClick: (link: SidebarLink) => void;
  currentView: string;
}

export default function Sidebar({
  links,
  onLinkClick,
  currentView,
}: SidebarProps) {
  return (
    <div className="flex h-full w-64 flex-col border-r bg-background">
      {/* Header */}
      <div className="flex h-16 items-center border-b px-6">
        <h2 className="text-xl text-foreground font-extrabold">Rustinx</h2>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {links.map((link, index) => {
            const Icon = link.icon;
            const isActive = currentView === link.view;

            return (
              <Button
                key={index}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 h-10",
                  isActive &&
                    "bg-secondary text-secondary-foreground font-medium"
                )}
                onClick={() => onLinkClick(link)}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {link.label}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator />

      {/* Status Section */}
      <div className="p-4">
        <NginxStatus />
      </div>
    </div>
  );
}
