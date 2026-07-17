import { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Building2, LayoutDashboard, LogOut, Menu, Truck, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/vehicles', label: 'Vehicule', icon: Truck },
  { to: '/drivers', label: 'Șoferi', icon: Users },
  { to: '/clients', label: 'Clienți', icon: Building2 },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigație principală" className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )
          }
        >
          <Icon className="size-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-6 font-semibold tracking-tight">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Truck className="size-4" />
      </span>
      FleetPilot
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
        <NavLinks />
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
              <Brand />
              <NavLinks onNavigate={() => setMobileNavOpen(false)} />
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
