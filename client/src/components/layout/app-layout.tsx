import { Suspense, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  Route,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Role } from '@fleetpilot/shared';
import { useAuth } from '@/features/auth/auth-context';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
  // dispecerul AI e unealtă de dispecerat — backend-ul refuză 403 pe rol DRIVER
  { to: '/app/agent', label: 'Dispecer AI', icon: Sparkles, roles: ['ADMIN', 'DISPATCHER'] },
  { to: '/app/trips', label: 'Curse', icon: Route },
  { to: '/app/vehicles', label: 'Vehicule', icon: Truck },
  { to: '/app/drivers', label: 'Șoferi', icon: Users },
  { to: '/app/clients', label: 'Clienți', icon: Building2 },
  { to: '/app/reports', label: 'Rapoarte', icon: BarChart3, roles: ['ADMIN', 'DISPATCHER'] },
];

function NavLinks({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigație principală" className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role)).map(
        ({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/app'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary before:transition-opacity',
                isActive
                  ? 'bg-primary/15 text-primary before:opacity-100'
                  : 'text-muted-foreground before:opacity-0 hover:bg-accent hover:text-accent-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </NavLink>
        ),
      )}
    </nav>
  );
}

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/app"
      onClick={onNavigate}
      className="flex items-center gap-2 px-6 font-semibold tracking-tight transition-opacity hover:opacity-80"
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Truck className="size-4" />
      </span>
      FleetPilot
    </Link>
  );
}

function RouteSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function AppLayout() {
  const { status, user, logout } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="w-full max-w-sm space-y-3 px-6">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (status === 'guest') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex min-h-dvh">
      {/* sidebar permanent pe desktop */}
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r bg-card py-5 md:flex">
        <Brand />
        <NavLinks role={user.role} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-card px-4 md:px-6">
          {/* pe mobil, sidebar-ul devine drawer */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Deschide meniul"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 gap-6 py-5">
              <SheetTitle className="sr-only">Meniu de navigație</SheetTitle>
              <Brand onNavigate={() => setMobileNavOpen(false)} />
              <NavLinks role={user.role} onNavigate={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-muted-foreground">{user.companyName}</p>
          </div>

          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-secondary text-xs font-semibold"
                aria-label="Meniul contului"
              >
                {initials}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="truncate">{user.name}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
                <LogOut className="size-4" />
                Deconectare
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 md:p-6">
          {/* fiecare pagină din /app e un chunk lazy (code-splitting pe rute) — Suspense
              acoperă intervalul scurt de descărcare la prima navigare către ea */}
          <Suspense fallback={<RouteSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
