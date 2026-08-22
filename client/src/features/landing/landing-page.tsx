import { Link, Navigate } from 'react-router-dom';
import {
  BellRing,
  Bot,
  CheckCircle2,
  MapPinned,
  MessageSquareText,
  ShieldCheck,
  Truck,
  UserCheck,
} from 'lucide-react';
import { Plate } from '@/components/plate';
import { StatusBadge } from '@/components/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-context';

/*
 * Hero-ul arată produsul, nu vorbe: o comandă venită „pe telefon" și propunerea
 * dispecerului AI care așteaptă aprobarea — exact bucla human-in-the-loop.
 */
function DispatchPreview() {
  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
            <MessageSquareText className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <div className="rounded-lg rounded-tl-none bg-secondary px-3 py-2 text-sm">
            transport 4 paleți Oltenița → Constanța joi dimineața, client Agrofrig
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Bot className="size-4 text-primary" aria-hidden="true" />
          </span>
          <div className="flex-1 space-y-3 rounded-lg rounded-tl-none border px-3 py-2.5 text-sm">
            <p className="text-muted-foreground">Propunere: joi, 07:00 · 226 km · ~3h 40min</p>
            <div className="flex flex-wrap items-center gap-2">
              <Plate plateNumber="CL07TRK" />
              <span className="text-muted-foreground">·</span>
              <span className="font-medium">M. Dumitrescu</span>
              <StatusBadge kind="available" label="Disponibil" />
            </div>
            {/* span-uri, nu butoane: preview-ul e decorativ și nu trebuie să prindă focus */}
            <div className="flex gap-2 pt-1">
              <span className={buttonVariants({ size: 'sm', className: 'h-7 px-3 text-xs' })}>
                Aprobă
              </span>
              <span
                className={buttonVariants({
                  size: 'sm',
                  variant: 'outline',
                  className: 'h-7 px-3 text-xs',
                })}
              >
                Modifică
              </span>
              <span
                className={buttonVariants({
                  size: 'sm',
                  variant: 'ghost',
                  className: 'h-7 px-3 text-xs text-muted-foreground',
                })}
              >
                Respinge
              </span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Agentul propune. Dispecerul decide. Întotdeauna.
        </p>
      </CardContent>
    </Card>
  );
}

const STEPS = [
  {
    title: 'Scrii comanda cum o primești',
    body: 'Pe telefon, pe WhatsApp, pe scurt — o tastezi exact așa. Fără formulare cu 20 de câmpuri.',
    icon: MessageSquareText,
  },
  {
    title: 'AI-ul verifică flota și propune',
    body: 'Capacitate, șoferi liberi, concedii, conflicte de program, distanța rutei — și îți dă cea mai bună alocare, cu justificare.',
    icon: Bot,
  },
  {
    title: 'Tu aprobi. Nimic nu pleacă fără tine.',
    body: 'Fiecare propunere așteaptă decizia dispecerului, iar fiecare decizie rămâne în istoric.',
    icon: UserCheck,
  },
] as const;

const FEATURES = [
  {
    title: 'Evidența flotei',
    body: 'Vehicule, capacități, șoferi și disponibilitatea lor — în locul caietului și al Excelului.',
    icon: Truck,
  },
  {
    title: 'Tracking pe hartă',
    body: 'Vezi cursele în desfășurare pe hartă și răspunzi la „unde e marfa mea?" dintr-o privire.',
    icon: MapPinned,
  },
  {
    title: 'Alerte documente',
    body: 'ITP, RCA și rovinieta care expiră îți apar pe dashboard înainte să devină amenzi.',
    icon: BellRing,
  },
  {
    title: 'Audit complet',
    body: 'Tot ce a propus AI-ul și tot ce a decis dispecerul, cu oră și motiv. Nicio decizie pierdută.',
    icon: ShieldCheck,
  },
] as const;

export function LandingPage() {
  const { status } = useAuth();
  /*
   * Cine e deja logat merge direct în aplicație. În starea 'loading' afișăm
   * totuși landing-ul: publicul paginii e vizitatorul anonim, iar a bloca
   * first paint-ul până se rezolvă sesiunea l-ar penaliza pe el; userul logat
   * care intră pe / (caz rar — aplicația trăiește pe /app) acceptăm să vadă
   * o clipă landing-ul înainte de redirect.
   */
  if (status === 'authenticated') {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-80"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Truck className="size-4" aria-hidden="true" />
          </span>
          FleetPilot
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/login">Autentificare</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Creează cont</Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 overflow-x-clip px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
          <div className="space-y-6">
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              Dispecerat cu AI pentru flote de 2–20 camioane
            </p>
            <h1 className="text-4xl font-bold tracking-tighter text-balance md:text-5xl lg:text-6xl">
              Comenzile vin pe telefon.
              <br />
              Restul îl face <span className="text-primary">FleetPilot</span>.
            </h1>
            <p className="max-w-prose text-lg text-muted-foreground">
              Platforma de dispecerat care ține evidența flotei, urmărește cursele pe hartă și îți
              propune alocarea optimă — iar decizia finală rămâne mereu a ta.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/register">Începe cu firma ta</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Am deja cont</Link>
              </Button>
            </div>
          </div>
          <div className="relative flex justify-center md:justify-end">
            <div
              aria-hidden
              className="absolute -inset-8 -z-10 rounded-full bg-primary/20 blur-3xl"
            />
            <DispatchPreview />
          </div>
        </section>

        <section className="border-y bg-card">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Cum funcționează</h2>
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <div key={step.title} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-md bg-primary/15 font-mono text-sm font-bold text-primary">
                      {index + 1}
                    </span>
                    <step.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            Tot dispeceratul, într-un singur loc
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="space-y-2 p-5">
                  <feature.icon className="size-5 text-primary" aria-hidden="true" />
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t bg-card">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-16 text-center md:px-6">
            <CheckCircle2 className="size-8 text-primary" aria-hidden="true" />
            <h2 className="text-2xl font-semibold tracking-tight text-balance">
              Scapă de caiet, păstrează controlul.
            </h2>
            <p className="max-w-prose text-muted-foreground">
              Îți creezi contul firmei, îți adaugi flota și șoferii, iar de la prima comandă ai
              dispecerul AI lângă tine.
            </p>
            <Button size="lg" asChild>
              <Link to="/register">Creează contul firmei</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-8 text-sm text-muted-foreground md:px-6">
        <p>FleetPilot</p>
        <p className="font-mono">v0.1</p>
      </footer>
    </div>
  );
}
