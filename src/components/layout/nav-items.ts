import {
  Activity,
  BarChart2,
  Calendar,
  CheckSquare,
  FileText,
  FolderOpen,
  GraduationCap,
  PenTool,
  Shield,
  Sun,
  Target,
  Terminal,
  Trash2,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { name: string; short: string; href: string; icon: LucideIcon };

/** Every page in the app, in sidebar order. Shared by the sidebar and the phone menu. */
export const NAV_ITEMS: NavItem[] = [
  { name: "Today", short: "Today", href: "/today", icon: Sun },
  { name: "Notes", short: "Notes", href: "/notes", icon: FileText },
  { name: "Doodle", short: "Doodle", href: "/doodle", icon: PenTool },
  { name: "Tasks", short: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Projects", short: "Projects", href: "/projects", icon: FolderOpen },
  { name: "Calendar", short: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Developer Mode", short: "Developer", href: "/developer", icon: Terminal },
  { name: "Study Mode", short: "Study", href: "/study", icon: GraduationCap },
  { name: "Habits", short: "Habits", href: "/habits", icon: Activity },
  { name: "Goals", short: "Goals", href: "/goals", icon: Target },
  { name: "Analytics", short: "Analytics", href: "/analytics", icon: BarChart2 },
  { name: "Trash", short: "Trash", href: "/trash", icon: Trash2 },
];

export const ADMIN_NAV_ITEM: NavItem = { name: "Admin · Music", short: "Admin", href: "/admin/music", icon: Shield };

export const isActivePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");
