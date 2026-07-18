import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
      <Compass className="size-10 text-muted-foreground" aria-hidden="true" />
      <p className="font-mono text-5xl font-bold tracking-tight">404</p>
      <p className="max-w-prose text-muted-foreground">
        Pagina asta nu există. Poate ruta s-a schimbat sau adresa e greșită.
      </p>
      <Button asChild>
        <Link to="/">Înapoi la pagina principală</Link>
      </Button>
    </div>
  );
}
