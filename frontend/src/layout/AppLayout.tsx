import {
  Bell,
  ClipboardList,
  CreditCard,
  Ellipsis,
  FileBarChart,
  Home,
  Landmark,
  Plus,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui";
import { LoginModal } from "../components/LoginModal";

const nav = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/families", label: "Families", icon: Users },
  { to: "/members", label: "Members", icon: ClipboardList },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/payment-transactions", label: "Transactions", icon: CreditCard },
  { to: "/treasury", label: "Treasury", icon: Landmark },
  { to: "/announcements", label: "Announcements", icon: Bell },
  { to: "/audit", label: "Audit Logs", icon: Shield },
  { to: "/settings", label: "Settings", icon: Settings },
];

const mobileNav = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/families", label: "Families", icon: Users },
  { to: "/members", label: "Members", icon: ClipboardList },
  { to: "/treasury", label: "Treasury", icon: Landmark },
];

function Shell() {
  const [dark, setDark] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const { isAuthenticated, role, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "SUPER_ADMIN";
  const canMutate = isAuthenticated && (role === "SUPER_ADMIN" || role === "TOUR_COMMITTEE");

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-card lg:block">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-sm font-bold text-white">FT</div>
          <div>
            <p className="font-semibold">Family Tour</p>
            <p className="text-xs text-muted-foreground">Management System</p>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  isActive ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-md border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Search families, members, phone numbers..."
            />
          </div>
          <Button variant="ghost" className="h-10 w-10 px-0" onClick={toggleTheme} aria-label="Toggle theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <div className="hidden rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground sm:block">
            {isAuthenticated ? role.replace("_", " ") : "PUBLIC READ ONLY"}
          </div>
          {isAuthenticated && (
            <Button variant="outline" onClick={logout}>
              Logout
            </Button>
          )}
        </header>
        <main className="pb-28 p-4 sm:p-6 lg:pb-6">
          <Outlet />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-soft backdrop-blur lg:hidden">
        {mobileNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>
        ))}
        <button
          className="flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground"
          onClick={() => setMoreOpen(true)}
          type="button"
        >
          <Ellipsis className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {canMutate && (
        <div className="fixed bottom-20 right-4 z-50 lg:bottom-6">
          <Button className="h-14 w-14 rounded-full px-0 shadow-soft" aria-label="Quick actions" onClick={() => setQuickOpen(true)}>
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}

      {moreOpen && (
        <BottomSheet title="More" onClose={() => setMoreOpen(false)}>
          <SheetLink icon={Bell} label="Announcements" to="/announcements" onNavigate={() => setMoreOpen(false)} />
          <SheetLink icon={FileBarChart} label="Tours" to="/tours" onNavigate={() => setMoreOpen(false)} />
          <SheetLink icon={FileBarChart} label="Reports" to="/reports" onNavigate={() => setMoreOpen(false)} />
          {isAdmin && <SheetLink icon={Settings} label="Settings" to="/settings" onNavigate={() => setMoreOpen(false)} />}
          {isAdmin && <SheetLink icon={Users} label="Users" to="/users" onNavigate={() => setMoreOpen(false)} />}
          {isAdmin && <SheetLink icon={Shield} label="Audit Logs" to="/audit" onNavigate={() => setMoreOpen(false)} />}
        </BottomSheet>
      )}

      {quickOpen && (
        <BottomSheet title="Quick actions" onClose={() => setQuickOpen(false)}>
          {[
            ["Add Family", "/families?new=1"],
            ["Add Member", "/members?new=1"],
            ["Record Collection", "/payment-transactions?new=1"],
            ["Record Expense", "/expenses?new=1"],
            ["Create Announcement", "/announcements?new=1"],
          ].map(([label, to]) => (
            <button
              key={to}
              className="flex h-12 w-full items-center justify-between rounded-md px-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                if (!isAuthenticated) {
                  setQuickOpen(false);
                  setLoginOpen(true);
                  return;
                }
                setQuickOpen(false);
                navigate(to);
              }}
              type="button"
            >
              {label}
              <Plus className="h-4 w-4 text-primary" />
            </button>
          ))}
        </BottomSheet>
      )}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

function BottomSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 max-h-[82vh] rounded-t-2xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-soft"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <div className="space-y-1">{children}</div>
      </div>
    </div>
  );
}

function SheetLink({
  icon: Icon,
  label,
  to,
  onNavigate,
}: {
  icon: typeof Home;
  label: string;
  to: string;
  onNavigate: () => void;
}) {
  return (
    <NavLink to={to} className="flex h-12 items-center gap-3 rounded-md px-2 text-sm hover:bg-muted" onClick={onNavigate}>
      <Icon className="h-5 w-5 text-muted-foreground" />
      {label}
    </NavLink>
  );
}

export function AppLayout() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
