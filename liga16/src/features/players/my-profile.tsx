import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertCircle, CheckCircle2, Save, ShieldCheck, UserCog } from "lucide-react";
import { db } from "@/lib/data";
import { useAuth } from "@/contexts/AuthContext";
import type { PlayerProfile, PlayerStatus } from "@/types";
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
import { toast } from "sonner";

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

/**
 * Mi perfil — opción A.
 *
 * El perfil es del jugador: lo crea, lo edita y lo corrige sin pedir permiso.
 * Lo que NO controla es su elegibilidad para competir: eso lo decide el admin,
 * y por eso el estado se muestra aquí pero nunca se edita aquí.
 */
function ProfileForm({
  form,
  update,
  onSubmit,
  saving,
  error,
  profile,
  onViewPublic,
}: {
  form: FormState;
  update: (field: keyof FormState, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  error: string | null;
  profile: PlayerProfile | null;
  onViewPublic: () => void;
}) {
  return (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">
        {profile ? "Editar datos" : "Completa tu perfil"}
      </CardTitle>
      <CardDescription>
        {profile
          ? "Los cambios se guardan al instante."
          : "Necesitamos estos datos para que los organizadores puedan reconocerte."}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="mi-nombre">Nombre que te muestran</Label>
            <Input
              id="mi-nombre"
              required
              value={form.display_name}
              onChange={(e) => update("display_name", e.target.value)}
              placeholder="Ana Ramírez"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mi-usuario">Usuario</Label>
            <Input
              id="mi-usuario"
              required
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              placeholder="anaramirez"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mi-ciudad">Ciudad</Label>
            <Input
              id="mi-ciudad"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mi-estado">Estado</Label>
            <Input
              id="mi-estado"
              value={form.state}
              onChange={(e) => update("state", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mi-rama">Rama</Label>
            <Select value={form.sex} onValueChange={(v) => update("sex", v)}>
              <SelectTrigger id="mi-rama">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEX_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mi-nivel">Nivel que te sientes (1.0–7.0)</Label>
            <Input
              id="mi-nivel"
              type="number"
              min={1}
              max={7}
              step={0.1}
              required
              value={form.declared_level}
              onChange={(e) => update("declared_level", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              El nivel oficial lo confirma un organizador.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mi-mano">Mano</Label>
            <Select
              value={form.dominant_hand}
              onValueChange={(v) => update("dominant_hand", v)}
            >
              <SelectTrigger id="mi-mano">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HAND_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mi-posicion">Posición preferida</Label>
            <Select
              value={form.preferred_position}
              onValueChange={(v) => update("preferred_position", v)}
            >
              <SelectTrigger id="mi-posicion">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="mi-bio">Bio</Label>
          <Textarea
            id="mi-bio"
            rows={3}
            value={form.bio}
            onChange={(e) => update("bio", e.target.value)}
            placeholder="Cuántas veces juegas, en qué division te gusta entrar…"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Guardando…" : profile ? "Guardar cambios" : "Crear mi perfil"}
          </Button>
          {profile && (
            <Button type="button" variant="ghost" onClick={onViewPublic}>
              Ver mi ficha pública
            </Button>
          )}
        </div>
      </form>
    </CardContent>
  </Card>
  );
}

export default function MyProfile() {
  const { user, isConfigured, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    db.getMyProfile()
      .then((p) => {
        if (!active) return;
        setProfile(p);
        if (p) setForm(toForm(p));
        setLoading(false);
      })
      .catch((e: Error) => {
        if (!active) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const update = (field: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
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
      toast.success(profile ? "Perfil actualizado" : "Perfil creado");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // En demo no hay sesión real, pero el provider siembra un perfil para que esta
  // pantalla se pueda recorrer completa sin Supabase.
  const demoMode = !isConfigured && !user;
  const status = (profile?.status ?? "verificado") as PlayerStatus;
  const copy = STATUS_COPY[status];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          <UserCog className="h-3.5 w-3.5" /> Tu cuenta
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estos datos los controlas tú. Tu nivel oficial y tu elegibilidad para competir los
          define un organizador.
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

      <ProfileForm
        form={form}
        update={update}
        onSubmit={handleSubmit}
        saving={saving}
        error={error}
        profile={profile}
        onViewPublic={() => profile && navigate(`/jugadores/${profile.id}`)}
      />



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
    </div>
  );
}
