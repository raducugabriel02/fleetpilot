import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // până la hidratarea temei nu știm ce iconiță să arătăm; evităm mismatch-ul
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-hidden className="opacity-0" />;
  }
  const isDark = resolvedTheme === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Comută pe tema luminoasă' : 'Comută pe tema întunecată'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
