import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Crown,
  Pencil,
  Save,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  UserCog,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { db } from "@/lib/data";
import { useAuth } from "@/contexts/AuthContext";
import type { PlayerCard, PlayerProfile, PlayerStatus, Tournament } from "@/types";
import type { PlayerRecord } from "@/lib/records";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate, initials, sexLabel } from "@/lib/format";

const SEX_OPTIONS = [
  { value: "M", label: "Varonil" },
  { value: "F", label: "Femenil" },
  { value: "X", label: "Mixto" },
] as const;

const HAND_OPTIONS = [
  { value: "right", label: "Diestro" },
  { value: "left", label: "Zurdo" },
  { value: "both", label: "Ambidiestro" },
] as const;

const POSITION_OPTIONS = [
  { value: "drive", label: "Drive" },
  { value: "reves", label: "Revés" },
  { value: "both", label: "Ambos" },
] as const;

const STATUS_COPY: Record<PlayerStatus, { title: string; body: string; tone: string }> = {
  pendiente: {
    title: "Tu perfil está pendiente de verificación",
    body: "Ya podés editarlo cuando quieras. Para inscribirte a un torneo, un organizador tiene que verificarlo.",
    tone: "text-amber-700 dark:text-amber-400",
  },
  verificado: {
    title: "Tu perfil está verificado",
    body: "Podés inscribirte a los torneos del circuito.",
    tone: "text-emerald-700 dark:text-emerald-400",
  },
  rechazado: {
    title: "El organizador revisó tu perfil",
    body: "Revisá tus datos y pedí una nueva verificación desde aquí.",
    tone: "text-destructive",
  },
};

type FormState = {
  display_name: string;
  username: string;
  city: string;
  state: string;
  sex: string;
  declared_level: string;
  dominant_hand: string;
  preferred_position: string;
  bio: string;
};

const emptyForm: FormState = {
  display_name: "",
  username: "",
  city: "Ciudad de México",
  state: "CDMX",
  sex: "X",
  declared_level: "3.0",
  dominant_hand: "right",
  preferred_position: "both",
  bio: "",
};

const toForm = (p: PlayerProfile): FormState => ({
  display_name: p.display_name,
  username: p.username,
  city: p.city,
  state: p.state,
  sex: p.sex,
  declared_level: String(p.declared_level),
  dominant_hand: p.dominant_hand,
  preferred_position: p.preferred_position,
  bio: p.bio ?? "",
});

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function ProfileEditDialog({
  form,
  update,
  onSave,
  saving,
  open,
  onOpenChange,
}: {
  form: FormState;
  update: (field: keyof FormState, value: string) => void;
  onSave: () => void;
  saving: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Editar perfil
          </DialogTitle>
          <DialogDescription>
            Estos datos se muestran en tu ficha pública del circuito.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pp-name">Nombre</Label>
              <Input id="pp-name" value={form.display_name} onChange={(e) => update("display_name", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pp-username">Usuario</Label>
              <Input id="pp-username" value={form.username} onChange={(e) => update("username", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pp-city">Ciudad</Label>
              <Input id="pp-city" value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pp-state">Estado</Label>
              <Input id="pp-state" value={form.state} onChange={(e) => update("state", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Rama</Label>
              <Select value={form.sex} onValueChange={(v) => update("sex", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEX_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pp-level">Nivel (1–7)</Label>
              <Input
                id="pp-level"
                type="number"
                min={1}
                max={7}
                step={0.1}
                value={form.declared_level}
                onChange={(e) => update("declared_level", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Mano</Label>
              <Select value={form.dominant_hand} onValueChange={(v) => update("dominant_hand", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HAND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Posición</Label>
            <Select value={form.preferred_position} onValueChange={(v) => update("preferred_position", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {POSITION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pp-bio">Bio</Label>
            <Textarea
              id="pp-bio"
              rows={3}
              maxLength={280}
              placeholder="Cuéntale al circuito quién eres…"
              value={form.bio}
              onChange={(e) => update("bio", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatTile({
  label,
  value,
  caption,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  caption: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold tabular-nums", accent && "text-primary")}>{value}</p>
            <p className="text-xs text-muted-foreground">{caption}</p>
          </div>
          <div className={cn("rounded-lg p-2", accent ? "bg-primary/10" : "bg-muted")}>
            <Icon className={cn("h-4 w-4", accent ? "text-primary" : "text-muted-foreground")} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendChart({ trend }: { trend: number[] }) {
  const data = trend.map((v, i) => ({ i: i + 1, v }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="i" tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
          formatter={(value: number) => [`${value} sets`, "Partido"]}
          labelFormatter={(label: number) => `Partido ${label}`}
        />
        <Area type="monotone" dataKey="v" stroke="#e11d48" strokeWidth={2} fill="url(#colorTrend)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function MyProfile() {
  const { user, isConfigured, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [record, setRecord] = useState<PlayerRecord | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    let active = true;
    db.getMyProfile()
      .then(async (p) => {
        if (!active) return;
        setProfile(p);
        if (!p) {
          setLoading(false);
          return;
        }
        setForm(toForm(p));

        // El historial individual y el % salen del récord derivado. No hace falta ni
        // `listTeams` ni `listRecentMatches`: el récord ya sabe qué partidos son
        // de este jugador, quién era el rival y si los ganó.
        const [c, rec, tourns] = await Promise.all([
          db.getPlayerCard(p.id),
          db.getPlayerRecord(p.id),
          db.listTournaments(),
        ]);
        if (!active) return;

        setCard(c);
        setRecord(rec);
        setTournaments(tourns);

        setLoading(false);
      })
      .catch((e: Error) => {
        if (!active) return;
        toast.error(e.message);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const update = (field: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  async function handleSave() {
    setSaving(true);
    const payload = {
      display_name: form.display_name.trim(),
      username: form.username.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      sex: form.sex as PlayerProfile["sex"],
      declared_level: Number(form.declared_level),
      dominant_hand: form.dominant_hand as PlayerProfile["dominant_hand"],
      preferred_position: form.preferred_position as PlayerProfile["preferred_position"],
      bio: form.bio.trim() || null,
      is_public: true,
    };
    try {
      const saved = profile
        ? await db.updateMyProfile(profile.id, payload)
        : await db.createMyProfile(payload);
      setProfile(saved);
      setForm(toForm(saved));
      setEditOpen(false);
      toast.success(profile ? "Perfil actualizado" : "Perfil creado");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  // Todo el desempeño sale del récord derivado. Antes venía de `player_cards`,
  // que en producción queda con 0 y `recent_results` vacío: el % daba 0, la racha
  // daba 0 y la gráfica de tendencia salía plana para todos. Y "Tus últimos
  // partidos" sacaba el V/D de la tabla `teams`, que quedó obsoleta, así que
  // salía SIEMPRE "Derrota" aunque el jugador hubiera ganado.
  const winPct = record && record.played > 0 ? Math.round((record.won / record.played) * 100) : 0;
  const streak = useMemo(() => {
    const form = record?.form ?? [];
    let n = 0;
    for (let i = form.length - 1; i >= 0 && form[i] === "G"; i--) n++;
    return n;
  }, [record]);

  if (authLoading || loading) return <ProfileSkeleton />;

  const demoMode = !isConfigured && !user;
  const status = (profile?.status ?? "verificado") as PlayerStatus;
  const copy = STATUS_COPY[status];

  const upcomingTournaments = tournaments
    .filter((t) => t.status === "registration_open")
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          <UserCog className="h-3.5 w-3.5" /> Tu cuenta
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu dashboard personal en el circuito Liga16.
        </p>
      </header>

      {demoMode && (
        <Alert>
          <AlertDescription>
            Modo demo: no hay sesión real, así que estás viendo un perfil de ejemplo.{" "}
            <Link to="/login" className="underline">Inicia sesión</Link> con Supabase
            configurado para editar el tuyo.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <div className="flex items-start gap-3">
          {status === "verificado" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          ) : status === "pendiente" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <div>
            <p className={`text-sm font-semibold ${copy.tone}`}>{copy.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{copy.body}</p>
          </div>
        </div>
      </Alert>

      {/* === Cover del jugador ===
          Fondo "glowing wave" (gradientes radiales animados, sin WebGL) + la
          foto de perfil ENCIMA del fondo, no dentro de una caja gris. Antes el
          avatar era un círculo con iniciales sobre fondo plano: la foto que
          sube el jugador no aparecía nunca en su propio dashboard. */}
      <Card className="relative overflow-hidden">
        <div className="glow-wave-bg" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-warning to-primary" />
        <CardContent className="relative z-10 p-4 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {profile?.photo_url ? (
                <img
                  src={profile.photo_url}
                  alt={profile.display_name}
                  className="h-16 w-16 shrink-0 rounded-full border-2 border-primary/40 object-cover shadow-lg shadow-primary/20"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-gradient-to-br from-primary to-primary/60 text-2xl font-bold text-white shadow-lg shadow-primary/20">
                  {profile ? initials(profile.display_name) : "?"}
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold">{profile?.display_name ?? "Sin nombre"}</h2>
                <p className="text-sm text-muted-foreground">
                  @{profile?.username} · {profile?.city}, {profile?.state}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {record && record.played > 0 && (
                    <Badge variant="default" className="bg-primary">
                      {record.won}–{record.played - record.won} · Liga16
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {sexLabel(profile?.sex ?? "X")} · Nv {(profile?.official_level ?? profile?.declared_level ?? 1).toFixed(1)}
                  </Badge>
                  {streak > 0 && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                      <TrendingUp className="mr-1 h-3 w-3" />
                      {streak} ganados seguidos
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button onClick={() => setEditOpen(true)} variant="outline" size="sm" className="shrink-0">
              <Pencil className="h-4 w-4" />
              Editar perfil
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Partidos"
          value={record?.played ?? 0}
          caption={record && record.played > 0 ? `${record.won} ganados` : "aún no juega"}
          icon={Trophy}
          accent
        />
        <StatTile
          label="% Victoria"
          value={`${winPct}%`}
          caption={`${record?.won ?? 0} de ${record?.played ?? 0} PJ`}
          icon={Target}
        />
        <StatTile
          label="Títulos"
          value={card?.titles ?? 0}
          caption="en el circuito"
          icon={Crown}
        />
        <StatTile
          label="Racha"
          value={streak > 0 ? `${streak}G` : "—"}
          caption={streak > 0 ? "victorias seguidas" : "sin racha activa"}
          icon={Activity}
        />
      </div>

      {record && record.trend.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Juegos ganados por partido
            </CardTitle>
            <CardDescription>Tu tendencia en los últimos 10 partidos</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart trend={record.trend} />
          </CardContent>
        </Card>
      )}

      {upcomingTournaments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" />
              Inscripciones abiertas
            </CardTitle>
            <CardDescription>Torneos del circuito a los que puedes inscribirte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingTournaments.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(t.start_date)} · {t.city}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link to={`/torneos/${t.slug}`}>Ver torneo</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {record && record.recentMatches.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Tus últimos partidos
            </CardTitle>
            <CardDescription>
              Con rival y marcador desde tu punto de vista, no del de la pareja
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {record.recentMatches.map((m) => (
              <div key={m.matchId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">vs {m.opponentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.opponentLevel !== null ? `rival ${m.opponentLevel.toFixed(1)} · ` : ""}
                    {formatDate(m.playedAt ?? "")}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-mono text-sm font-semibold tabular-nums",
                    m.won ? "text-success" : "text-destructive",
                  )}
                >
                  {m.won ? "V" : "D"} {m.score}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4" /> Qué decide el organizador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm text-muted-foreground">
          <p>
            <Badge variant="outline" className="mr-1.5">Nivel oficial</Badge>
            el nivel real, que puede diferir del que declares.
          </p>
          <p>
            <Badge variant="outline" className="mr-1.5">Verificación</Badge>
            si podés inscribirte a un torneo. Es lo que hace legal la competencia.
          </p>
        </CardContent>
      </Card>

      <ProfileEditDialog
        form={form}
        update={update}
        onSave={handleSave}
        saving={saving}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
