import { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, ArrowUpRight, ArrowDown, ChevronDown, Users, Target, ShieldAlert, Pencil, ImagePlus, Trophy, Medal, CalendarClock, Flame } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/data";
import type { Match, PlayerCard, PlayerProfile, Team } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { initials, SEX_BRANCHES, sexLabel, formatMatchTime, formatMatchDay, formatMatchMonth } from "@/lib/format";
import { matchState, matchWinner } from "@/lib/match-state";
import { parseRound } from "@/lib/groups";
import { cn } from "@/lib/utils";
import { PairAvatar } from "@/components/cards/card-kit";
import { toast } from "sonner";
import { analyzePlayerLocal, derivedFromRecord, type JevAnalysis } from "@/lib/jev";
import { buildPlayerRecords, type PlayerRecord } from "@/lib/records";
import { buildIndividualStandings, buildPlayerHonors, type TournamentHonor } from "@/lib/individual-ranking";
import { buildPlayerMedals, type MedalState } from "@/lib/medals";
import { MedalShelf } from "./medal-shelf";
import { qualificationFor, type QualificationView } from "@/lib/qualification";


const handLabel: Record<PlayerProfile["dominant_hand"], string> = { right: "Diestro", left: "Zurdo", both: "Ambidiestro" };
const positionLabel: Record<PlayerProfile["preferred_position"], string> = { drive: "Drive", reves: "Revés", both: "Ambos" };
function cardWon(c: PlayerCard | null | undefined) { return (c as unknown as { record?: { won: number; played: number }; won?: number })?.record?.won ?? (c as unknown as { won?: number })?.won ?? 0; }
function cardPlayed(c: PlayerCard | null | undefined) { return (c as unknown as { record?: { won: number; played: number }; played?: number })?.record?.played ?? (c as unknown as { played?: number })?.played ?? 0; }
function cardPartner(c: PlayerCard | null | undefined) { return (c as unknown as { frequent_partner?: string; partner?: string })?.frequent_partner ?? (c as unknown as { partner?: string })?.partner ?? null; }

// Animated bar component
function AnimatedBar({ value, max = 100, color = "primary", className = "" }: { value: number; max?: number; color?: string; className?: string }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(value), 100);
    return () => clearTimeout(timer);
  }, [value]);
  return (
    <div className={`h-2 rounded-full bg-muted overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${color === "primary" ? "bg-primary" : color === "success" ? "bg-success" : color === "warning" ? "bg-warning" : color === "destructive" ? "bg-destructive" : "bg-primary"}`}
        style={{ width: `${Math.min(100, (animated / max) * 100)}%` }}
      />
    </div>
  );
}

/** Tarjeta de comparativa: jugador vs rival con métricas visuales. */
function CompareCard({
  name,
  level,
  winPct,
  won,
  played,
  highlight,
  rivalLevel,
  rivalWinPct,
  rivalWon,
}: {
  name: string;
  level: number;
  winPct: number;
  won: number;
  played: number;
  highlight?: boolean;
  rivalLevel: number;
  rivalWinPct: number;
  rivalWon: number;
}) {
  const levelStr = level.toFixed(1);
  const tier = (label: string, a: number, b: number, max: number) => {
    const pctA = Math.max(8, Math.min(100, (a / Math.max(1, max)) * 100));
    const pctB = Math.max(8, Math.min(100, (b / Math.max(1, max)) * 100));
    const aWins = a >= b;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className={cn("font-bold tabular-nums", aWins ? "text-success" : "text-muted-foreground")}>{a}</span>
          <span className="text-muted-foreground">{label}</span>
          <span className={cn("font-bold tabular-nums", !aWins ? "text-destructive" : "text-muted-foreground")}>{b}</span>
        </div>
        <div className="flex gap-1">
          <span className="flex-1 overflow-hidden rounded-full bg-muted">
            <span className={cn("block h-1.5 rounded-full", aWins ? "bg-success" : "bg-muted-foreground/50")} style={{ width: `${pctA}%` }} />
          </span>
          <span className="flex-1 overflow-hidden rounded-full bg-muted">
            <span className={cn("block h-1.5 rounded-full", !aWins ? "bg-destructive" : "bg-muted-foreground/50")} style={{ width: `${pctB}%` }} />
          </span>
        </div>
      </div>
    );
  };
  return (
    <div className={cn("rounded-2xl border p-4 md:p-5", highlight ? "border-primary/40 bg-primary/[0.06]" : "border-border bg-muted/40")}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-headline text-lg font-bold text-foreground truncate">{name}</p>
          <p className="text-xs text-muted-foreground">{played} partidos · {won} ganados</p>
        </div>
        <Badge variant={highlight ? "default" : "secondary"} className="shrink-0">N {levelStr}</Badge>
      </div>
      <div className="mt-4 space-y-3">
        {tier("Nivel", level, rivalLevel, 8)}
        {tier("Win %", winPct, rivalWinPct, 100)}
        {tier("Victorias", won, rivalWon, 20)}
      </div>
    </div>
  );
}



/** Anillo de arcos por dimensión con el % protagonista al centro — la pieza
    central de la referencia (cada arco = una dimensión del índice). */
function DimensionRing({
  center,
  centerLabel,
  arcs,
  className,
}: {
  center: string;
  centerLabel: string;
  arcs: { label: string; value: number; className: string }[];
  className?: string;
}) {
  const size = 230;
  const r = 84;
  const c = 2 * Math.PI * r;
  const n = arcs.length;
  const seg = c / n;
  const gap = 16;
  return (
    <div className={cn("relative mx-auto h-60 w-60", className)}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full -rotate-90">
        {arcs.map((arc, i) => {
          const val = Math.max(0, Math.min(100, arc.value));
          const len = ((seg - gap) * val) / 100;
          return (
            <g key={arc.label}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={9}
                strokeLinecap="round"
                className="stroke-muted"
                strokeDasharray={`${seg - gap} ${c - (seg - gap)}`}
                strokeDashoffset={-i * seg}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={9}
                strokeLinecap="round"
                stroke="currentColor"
                className={arc.className}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-i * seg}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-poster text-6xl font-bold tabular-nums leading-none">{center}</span>
        <span className="mt-1 text-xs text-muted-foreground">{centerLabel}</span>
      </div>
      {arcs.map((arc, i) => {
        const theta = (((i + 0.5) * 360) / n - 90) * (Math.PI / 180);
        const x = 50 + 46 * Math.cos(theta);
        const y = 50 + 46 * Math.sin(theta);
        return (
          <div
            key={arc.label}
            className="absolute w-20 -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <p className="text-xs font-bold tabular-nums leading-tight">{arc.value}%</p>
            <p className="text-xs leading-tight text-muted-foreground">{arc.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [record, setRecord] = useState<PlayerRecord | null>(null);
  const [qualification, setQualification] = useState<QualificationView | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [myMatches, setMyMatches] = useState<Match[]>([]);
  const [compareId, setCompareId] = useState<string>("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [rivals, setRivals] = useState<PlayerProfile[]>([]);
  const [pairInfo, setPairInfo] = useState<{ tournament: string | null; tournamentSlug: string | null; category: string | null } | null>(null);
  const [compareData, setCompareData] = useState<{
    p: PlayerProfile;
    jev: JevAnalysis;
    played: number;
    won: number;
  } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  // Palmarés y posición en el ranking individual, derivados de los mismos partidos.
  const [honors, setHonors] = useState<TournamentHonor[]>([]);
  const [medals, setMedals] = useState<MedalState[]>([]);
  const [rankingIndividual, setRankingIndividual] = useState<{ position: number; points: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, isConfigured } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "organizer";

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([db.getPlayer(id), db.getPlayerCard(id), db.getPlayerRecord(id), db.listTeams(), db.listPlayers(), db.listRecentMatches(), db.listTournaments(), db.listAllPairs()])
      .then(([p, c, rec, teams, pls, allMatches, tournaments, allPairs]) => {
        if (!active || !p) return;
        setPlayer(p); setCard(c); setRecord(rec);
        // Equipo por ID real o, si el pair viejo no lo liga, por nombre en el roster
        const norm = (s: string) => s.trim().toLowerCase();
        const t =
          teams.find((tm) => tm.player1?.player_id === p.id || tm.player2?.player_id === p.id) ??
          teams.find((tm) => [tm.player1?.name, tm.player2?.name].some((n) => n && norm(n) === norm(p.display_name))) ?? null;
        setTeam(t);
        // Pareja actual = la inscripción más reciente del jugador; de ahí
        // salen el torneo y la categoría que se muestran en el cover.
        const myPairs = (allPairs ?? [])
          .filter((ap) => ap.player1_id === p.id || ap.player2_id === p.id || norm(ap.name) === norm(p.display_name) || norm(ap.name).includes(norm(p.display_name)))
          .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
        const latest = myPairs[0] ?? null;
        setPairInfo(
          latest
            ? {
                tournament: latest.tournament_name,
                tournamentSlug: tournaments.find((tr) => tr.name === latest.tournament_name)?.slug ?? null,
                category: latest.category_name,
              }
            : null,
        );

        // Camino a semifinales: tabla de la MISMA división y rama, con el cupo
        // que definió el organizador. Los puntos por victoria se deducen del
        // propio récord de la pareja, no se escriben a mano.
        if (t) {
          const cut = teams.filter(
            (tm) => tm.division === t.division && tm.sex === t.sex && tm.position > 0,
          );
          const active = tournaments.find(
            (tr) => tr.status === "registration_open" || tr.status === "in_progress",
          );
          setQualification(
            qualificationFor(
              cut.map((tm) => ({
                pairId: tm.id,
                name: tm.name,
                position: tm.position,
                points: tm.points,
                played: tm.played,
              })),
              { pairId: t.id, played: t.played, setsWon: t.sets_for },
              {
                slots: active?.semifinal_slots ?? 4,
                pointsPerWin: t.won > 0 ? Math.round(t.points / t.won) : 3,
              },
            ),
          );
        } else {
          setQualification(null);
        }
        // Partidos reales del jugador, cruzados contra `allPairs` (las filas crudas de
        // `pairs`), NO contra `teams`. `buildTeamsFromPairs` colapsa las parejas
        // por nombre entre torneos: la misma pareja inscrita en dos torneos es UN
        // `Team` con UN id, el del más reciente, y los partidos del otro torneo se
        // quedaban sin pareja que los reconociera. Alguien con dos etapas perdía
        // media historia sin que nada lo indicara.
        const myPairIds = new Set(
          (allPairs ?? [])
            .filter((ap) => ap.player1_id === p.id || ap.player2_id === p.id)
            .map((ap) => ap.id),
        );
        const nameIn = (side: { pair_name: string } | null) =>
          (side?.pair_name ?? "").split("/").some((n) => n && norm(n) === norm(p.display_name));
        const mine = allMatches
          .filter((m) =>
            (m.side_a.pair_id && myPairIds.has(m.side_a.pair_id)) ||
            (m.side_b.pair_id && myPairIds.has(m.side_b.pair_id)) ||
            (!m.side_a.pair_id || !m.side_b.pair_id) && (nameIn(m.side_a) || nameIn(m.side_b)),
          )
          .sort((a, b) => String(b.scheduled_at).localeCompare(String(a.scheduled_at)));
        setMyMatches(mine);

        // Palmarés y ranking individual: se derivan de los partidos ya cargados,
        // nada se guarda aparte (lib/individual-ranking).
        const records = buildPlayerRecords(allMatches, allPairs as never, pls);
        const standings = buildIndividualStandings(allMatches, allPairs, pls, tournaments, records);
        const mine2 = standings.find((st) => st.playerId === p.id);
        setRankingIndividual(mine2 ? { position: mine2.position, points: mine2.points } : null);
        setHonors(buildPlayerHonors(p.id, allMatches, allPairs, pls, tournaments));
        setMedals(buildPlayerMedals(p.id, allMatches, allPairs, pls, tournaments, records));
        // Rivales = los demás jugadores de SU CATEGORÍA.
        //
        // Antes filtraba las parejas del mismo torneo en las que ESTÁ el jugador,
        // así que el único resultado posible era su propio compañero: el
        // comparador preguntaba "¿con quién juego?" cuando la pregunta es
        // "¿con quién me mido?". Y lo que importa para compararse es la
        // categoría —ahí es donde la posición y el % significan algo—, no el
        // torneo, que cambia cada semana.
        const myCategory = latest?.category_name ?? null;
        const rivalPairs = myCategory
          ? (allPairs ?? []).filter((ap) => ap.category_name === myCategory)
          : [];
        // Sin categoría (inscripción sin categoría, o la base no la trae) se cae
        // al mismo torneo: peor que nada, pero es lo más cerca que hay.
        const myTournamentId = tournaments.find((tr) => tr.name === latest?.tournament_name)?.id ?? null;
        const sameTournament =
          myTournamentId === null
            ? []
            : (allPairs ?? []).filter((ap) => ap.tournament_id === myTournamentId);
        const pool = rivalPairs.length > 1 ? rivalPairs : sameTournament;

        const rivalIds = new Set(
          pool.flatMap((ap) => [ap.player1_id, ap.player2_id].filter(Boolean) as string[]),
        );
        rivalIds.delete(p.id);
        const byId = new Map(pls.map((x) => [x.id, x]));
        setRivals(
          [...rivalIds].map((rid) => byId.get(rid)).filter((x): x is PlayerProfile => Boolean(x)),
        );
      })
      .catch(() => { /* id inexistente: la UI ya muestra "Jugador no encontrado" */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!compareId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset compare when no selection
      setCompareData(null);
      return;
    }
    // El rival se compara con SU récord derivado, igual que el titular: comparar
    // contra `player_cards` era comparar contra ceros.
    Promise.all([db.getPlayer(compareId), db.getPlayerRecord(compareId)])
      .then(([p, rec]) => {
        if (!p) return;
        setCompareData({
          p,
          jev: analyzePlayerLocal(p, null, derivedFromRecord(rec)),
          played: rec?.played ?? 0,
          won: rec?.won ?? 0,
        });
      })
      .catch(() => { /* id inválido: se queda sin comparador */ });
  }, [compareId]);

  const jev = useMemo(
    () => (player ? analyzePlayerLocal(player, card, derivedFromRecord(record)) : null),
    [player, card, record],
  );

  if (loading) {
    return (
      <section className="space-y-6 animate-pulse">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[380px] w-full rounded-2xl" />
        <div className="grid gap-4 [&>*]:min-w-0 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      </section>
    );
  }
  if (!player || !jev) {
    return (
      <section className="space-y-4">
        <Button asChild variant="ghost" size="sm"><Link to="/jugadores"><ArrowLeft className="h-4 w-4" /> Jugadores</Link></Button>
        <p className="text-muted-foreground">Jugador no encontrado.</p>
      </section>
    );
  }

  // Solo el dueño del perfil o un admin pueden ver stats individuales
  const canView = !isConfigured || isAdmin || user?.player_id === player.id;
  if (!canView) {
    return (
      <section className="space-y-4">
        <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="h-4 w-4" /> Inicio</Link></Button>
        <Card className="max-w-md">
          <CardContent className="pt-6 space-y-4 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-destructive" />
            <div>
              <h2 className="text-xl font-bold">Acceso privado</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Solo puedes ver tu propio perfil. Las estadísticas de otros jugadores están reservadas para administradores.
              </p>
            </div>
            <Button asChild><Link to={user?.player_id ? `/jugadores/${user.player_id}` : "/login"}>Ir a mi perfil</Link></Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  // El historial derivado manda para la tendencia: player_cards nunca se actualiza.
  const trendData = (record?.trend?.length ? record.trend : card?.trend ?? []).map((v, i) => ({ i, v }));
  // El historial derivado manda (player_cards nunca se actualiza):
  // si hay récord con partidos, la racha, el % y los PJ salen del mismo sitio.
  const won = record && record.played > 0 ? record.won : cardWon(card);
  const played = record && record.played > 0 ? record.played : cardPlayed(card);
  const winPct = played > 0 ? Math.round((won / played) * 100) : 0;
  const partner = cardPartner(card);
  // El historial derivado manda: la pareja actual es la de su última etapa.
  const currentPartner = record?.partners[0]?.partnerName ?? partner;
  // Categoría real: la del último torneo (pair) o la división del equipo.
  const category = pairInfo?.category ?? team?.division ?? null;
  // Títulos derivados de las finales capturadas; player_cards.titles siempre fue 0.
  const titles = honors.filter((h) => h.kind === "title").length;
  const metaLine = [
    [player.city, player.state].filter(Boolean).join(", "),
    `Nivel ${(player.official_level ?? player.declared_level).toFixed(1)}${player.official_level != null ? " oficial" : " declarado"}`,
    sexLabel(player.sex),
    titles > 0 ? `${titles} título${titles === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(" · ");

  // Racha = victorias consecutivas al final de la forma, no de toda la temporada.
  const streak = (() => {
    const form = record?.form ?? [];
    let n = 0;
    for (let i = form.length - 1; i >= 0 && form[i] === "G"; i--) n++;
    return n;
  })();
  const canEditPhoto = !isConfigured || isAdmin || user?.player_id === player.id;

  const normName = (s: string) => s.trim().toLowerCase();
  const mySideOf = (m: Match): "a" | "b" => {
    const inA = (m.side_a.pair_name ?? "").split("/").some((n) => normName(n) === normName(player.display_name));
    const inB = (m.side_b.pair_name ?? "").split("/").some((n) => normName(n) === normName(player.display_name));
    return inA ? "a" : inB ? "b" : "a";
  };
  const setsFor = record?.setsFor ?? 0;
  const setsAgainst = record?.setsAgainst ?? 0;
  const setsPct = setsFor + setsAgainst > 0 ? Math.round((setsFor / (setsFor + setsAgainst)) * 100) : 0;
  // Las 4 dimensiones del índice: las mismas del anillo y de la card flotante.
  const dims = [
    { label: "Forma", value: Math.min(100, jev.forma.score * 20) },
    { label: "Consistencia", value: jev.consistencia.score },
    { label: "Sets", value: setsPct },
    { label: "Rivales", value: jev.rival?.score ?? 0 },
  ];
  const upcoming = myMatches
    .filter((m) => matchState(m) !== "finished")
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
  const nextMatch = upcoming.find((m) => matchState(m) === "live") ?? upcoming[0] ?? null;
  const trendMax = Math.max(1, ...trendData.map((d) => d.v));

  return (
    <div className="space-y-10 -mx-4 -mt-8 md:-mx-6">
      {/* HERO — foto con la card flotante del índice (como la referencia),
          nombre en display y la métrica protagonista. */}
      <section className="mx-auto max-w-7xl px-4 pt-2 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ms-2">
            <Link to="/jugadores"><ArrowLeft className="h-4 w-4" /> Jugadores</Link>
          </Button>
          {canEditPhoto && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 rounded-full font-semibold"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" /> Editar perfil
            </Button>
          )}
        </div>

        <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,320px)_1fr] md:gap-12">
          <div className="relative mx-auto w-full max-w-[300px] md:mx-0">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.display_name} className="aspect-[3/4] w-full rounded-[2rem] object-cover object-top" />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center rounded-[2rem] bg-surface-inverse text-surface-inverse-foreground">
                <span className="font-poster text-8xl font-bold text-white/80">{initials(player.display_name)}</span>
              </div>
            )}
            {/* Card flotante sobre la foto: el índice en 4 mini-barras con el
                botón circular que lleva al rendimiento. */}
            <div className="absolute inset-x-3 -bottom-6 rounded-2xl border bg-background/95 p-3.5 shadow-lg backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-caption font-bold uppercaser text-muted-foreground">Índice</p>
                <a
                  href="#rendimiento"
                  aria-label="Ver rendimiento"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background transition-transform duration-300 hover:scale-105"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </a>
              </div>
              <dl className="mt-2 space-y-1.5">
                {dims.map((d) => (
                  <div key={d.label} className="grid grid-cols-[68px_1fr_auto] items-center gap-2">
                    <dt className="truncate text-xs text-muted-foreground">{d.label}</dt>
                    <dd className="h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, d.value))}%` }} />
                    </dd>
                    <dd className="text-xs font-semibold tabular-nums">{d.value}%</dd>
                  </div>
                ))}
              </dl>
            </div>
            {canEditPhoto && (
              <div className="mt-10">
                <input
                  id="player-photo"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const dataUrl = String(reader.result);
                      setPlayer({ ...player, photo_url: dataUrl });
                      db.updatePlayer(player.id, { photo_url: dataUrl })
                        .then(() => toast.success("Foto de perfil actualizada"))
                        .catch((err: Error) => toast.error(err.message ?? "No se pudo guardar la foto"));
                    };
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
                <Button asChild size="sm" variant="ghost" className="w-full font-semibold text-muted-foreground">
                  <label htmlFor="player-photo" className="cursor-pointer">
                    <ImagePlus className="h-4 w-4" /> Cambiar foto
                  </label>
                </Button>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {category && (
                <span className="rounded-full bg-foreground px-3 py-1 text-xs font-bold tracking-wide text-background">
                  {category}
                </span>
              )}
              {titles > 0 && (
                <span className="rounded-full border px-3 py-1 text-xs font-semibold">
                  {titles} {titles === 1 ? "título" : "títulos"}
                </span>
              )}
            </div>
            <h1 className="mt-3 font-poster text-6xl font-bold uppercase leading-[0.9] tracking-tight md:text-8xl">
              {player.display_name}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">{metaLine}</p>

            {/* La métrica protagonista en gigante, como el 82% de la referencia. */}
            <div className="mt-8">
              <p className="flex items-baseline gap-1.5">
                <span className="font-poster text-[6rem] font-bold tabular-nums leading-[0.85] md:text-[8.5rem]">{winPct}</span>
                <span className="font-poster text-4xl font-bold text-muted-foreground md:text-5xl">%</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                efectividad · {won} ganados de {played}
              </p>
            </div>

            {/* Pareja actual: fila limpia con botón circular de flecha. */}
            {(() => {
              const mate = team
                ? (team.player1?.player_id === player.id ? team.player2?.name : team.player1?.name) ?? currentPartner
                : currentPartner;
              const [m1, m2] = (team?.name ?? "").split(" / ");
              return (
                <div className="mt-8 flex items-center gap-3 rounded-2xl border p-4 transition-shadow duration-300 hover:shadow-md">
                  <PairAvatar p1={m1 || player.display_name} p2={m2} className="h-11 w-11 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {team?.name ?? (mate ? `con ${mate}` : "Sin equipo")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[pairInfo?.tournament, pairInfo?.category ?? team?.division].filter(Boolean).join(" · ") || "Sin torneo activo"}
                    </p>
                  </div>
                  <Link
                    to={pairInfo?.tournamentSlug ? `/torneos/${pairInfo.tournamentSlug}` : "/torneos"}
                    aria-label="Ver torneo"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform duration-300 hover:scale-105"
                  >
                    <ArrowUpRight className="h-5 w-5" />
                  </Link>
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      {editOpen && (
        <ProfileEditDialog
          player={player}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={(p) => setPlayer(p)}
        />
      )}

      {/* Navegación interna: pill sticky en vez de 10 pantallas de scroll. */}
      <nav className="sticky top-2 z-30 mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex gap-1.5 rounded-full border bg-background/85 p-1.5 shadow-sm backdrop-blur">
          {([
            ["#resumen", "Resumen"],
            ["#rendimiento", "Rendimiento"],
            ["#partidos", "Partidos"],
          ] as const).map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="flex-1 whitespace-nowrap rounded-full px-2 py-2 sm:px-4 text-center text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* RESUMEN — tarjetas de estado con color por categoría, en carrusel
          horizontal (mobile) / fila de 3 (desktop). */}
      <section id="resumen" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-6">
        <div className="flex snap-x gap-3 overflow-x-auto pb-1 md:grid md:snap-none md:grid-cols-3 md:overflow-visible md:pb-0">
          {/* Próximo partido: la tarjeta de acción, en negro. */}
          {nextMatch ? (
            (() => {
              const live = matchState(nextMatch) === "live";
              const mySide = mySideOf(nextMatch);
              const opp = mySide === "a" ? nextMatch.side_b.pair_name : nextMatch.side_a.pair_name;
              const { jornada } = parseRound(nextMatch.round ?? "");
              const when = nextMatch.scheduled_at
                ? `${new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short" }).format(new Date(nextMatch.scheduled_at))} · ${formatMatchTime(nextMatch.scheduled_at)}`
                : "Por programar";
              const court = nextMatch.court_name?.trim();
              return (
                <Link
                  to={pairInfo?.tournamentSlug ? `/torneos/${pairInfo.tournamentSlug}` : "/torneos"}
                  className="flex min-w-[240px] flex-1 snap-start flex-col justify-between rounded-3xl bg-surface-inverse p-5 text-surface-inverse-foreground transition-transform duration-300 hover:-translate-y-0.5 md:min-w-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-primary px-2.5 py-1 text-caption font-bold uppercase text-primary-foreground">
                      {live ? "En vivo" : "Próximo"}
                    </span>
                    <CalendarClock className="h-4 w-4 text-white/50" />
                  </div>
                  <div className="mt-8">
                    <p className="font-poster text-3xl font-bold uppercase leading-none">
                      {jornada ? `Jornada ${jornada}` : "Partido"}
                    </p>
                    <p className="mt-1.5 truncate text-sm font-medium text-white/80">vs {opp}</p>
                    <p className="mt-1 truncate text-xs text-white/50">{[when, court].filter(Boolean).join(" · ")}</p>
                  </div>
                </Link>
              );
            })()
          ) : (
            <div className="flex min-w-[240px] flex-1 snap-start flex-col justify-between rounded-3xl bg-surface-inverse p-5 text-surface-inverse-foreground md:min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-caption font-bold uppercase">Agenda</span>
                <CalendarClock className="h-4 w-4 text-white/50" />
              </div>
              <p className="mt-8 text-sm text-white/60">Sin partidos programados todavía.</p>
            </div>
          )}

          {/* Camino a semifinales: verde si está dentro del corte. */}
          {qualification && (
            <div
              className={cn(
                "flex min-w-[240px] flex-1 snap-start flex-col justify-between rounded-3xl border p-5 md:min-w-0",
                qualification.reliable && qualification.inCut
                  ? "border-success/30 bg-success/10"
                  : qualification.reliable
                    ? "border-warning/30 bg-warning/10"
                    : "border-border bg-muted/50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-caption font-bold uppercase text-muted-foreground">
                  <Target className="h-3.5 w-3.5" /> Camino a semis
                </span>
                {qualification.reliable && (
                  <span className="font-display text-2xl tabular-nums text-primary">{qualification.semifinalProbability}%</span>
                )}
              </div>
              <div className="mt-8">
                <p className="font-poster text-3xl font-bold leading-none">{qualification.position}º</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {!qualification.reliable
                    ? "Falta muestra para estimar el corte"
                    : qualification.inCut
                      ? "Dentro del corte. A mantener el lugar."
                      : `A ${qualification.pointsNeeded} pts del corte.`}
                </p>
                {qualification.reliable && !qualification.inCut && qualification.mustBeat[0] && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    Gánale a {qualification.mustBeat[0].name} (+{qualification.mustBeat[0].lead} pts)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Racha: color por dirección. */}
          <div
            className={cn(
              "flex min-w-[240px] flex-1 snap-start flex-col justify-between rounded-3xl border p-5 md:min-w-0",
              jev.momentum?.label === "Viene ganando"
                ? "border-success/30 bg-success/10"
                : jev.momentum?.label === "Viene perdiendo"
                  ? "border-destructive/30 bg-destructive/10"
                  : "border-border bg-muted/50",
            )}
          >
            <span className="flex items-center gap-1.5 text-caption font-bold uppercase text-muted-foreground">
              <Flame className="h-3.5 w-3.5" /> Racha
            </span>
            <div className="mt-8">
              <p className="font-poster text-3xl font-bold tabular-nums leading-none">
                {jev.momentum?.reliable
                  ? `${jev.momentum.score > 0 ? "+" : ""}${jev.momentum.score}`
                  : streak > 0
                    ? `${streak}G`
                    : "—"}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {jev.momentum?.reliable
                  ? `${jev.momentum.label} · últimos ${jev.momentum.muestra}`
                  : streak > 0
                    ? "victorias seguidas"
                    : "Faltan partidos"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* RENDIMIENTO — anillo por dimensión (referencia) + panel negro con
          columnas, mini-barras verticales y CTA pill. */}
      <section id="rendimiento" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-6">
        <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          <div className="rounded-[2rem] border bg-background p-6">
            <h2 className="font-display text-lg font-bold">Rendimiento por dimensión</h2>
            <DimensionRing
              className="mt-4"
              center={`${winPct}%`}
              centerLabel="efectividad"
              arcs={[
                { label: dims[0].label, value: dims[0].value, className: "text-primary" },
                { label: dims[1].label, value: dims[1].value, className: "text-foreground" },
                { label: dims[2].label, value: dims[2].value, className: "text-primary/50" },
                { label: dims[3].label, value: dims[3].value, className: "text-foreground/35" },
              ]}
            />
          </div>

          <div className="rounded-[2rem] bg-surface-inverse p-6 text-surface-inverse-foreground md:p-8">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-bold">Efectividad</h2>
              <p className="font-poster text-6xl font-bold tabular-nums leading-none">
                {winPct}
                <span className="text-3xl text-white/50">%</span>
              </p>
            </div>
            <dl className="mt-6 grid grid-cols-3 gap-4">
              {([
                { label: "Partidos", value: String(played) },
                { label: "Ganados", value: String(won) },
                { label: "Sets", value: `${setsFor}-${setsAgainst}` },
              ]).map((s) => (
                <div key={s.label}>
                  <dt className="text-xs text-white/50">{s.label}</dt>
                  <dd className="mt-1.5 font-poster text-4xl font-bold tabular-nums leading-none md:text-5xl">{s.value}</dd>
                </div>
              ))}
            </dl>
            {trendData.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 text-xs text-white/50">Juegos por partido · últimos {trendData.length}</p>
                <div className="flex h-20 items-end gap-1.5">
                  {trendData.map((d, idx) => (
                    <div
                      key={d.i}
                      className={cn("flex-1 rounded-full", idx === trendData.length - 1 ? "bg-primary" : "bg-white/25")}
                      style={{ height: `${Math.max(8, Math.round((d.v / trendMax) * 100))}%` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <Button asChild size="lg" className="mt-6 h-12 w-full rounded-full text-base font-semibold">
              <Link to={pairInfo?.tournamentSlug ? `/torneos/${pairInfo.tournamentSlug}` : "/torneos"}>
                Ver torneo
              </Link>
            </Button>
          </div>
        </div>

        {/* Palmarés: strip de números + filas densas, sin card. */}
        {(honors.length > 0 || (rankingIndividual?.points ?? 0) > 0) && (
          <div className="mt-10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Trophy className="h-4 w-4 text-primary" /> Palmarés
              </h2>
              {rankingIndividual && (
                <Button asChild variant="outline" size="sm" className="h-7 rounded-full text-xs tabular-nums">
                  <Link to="/ranking?vista=individual">
                    #{rankingIndividual.position} · {rankingIndividual.points.toLocaleString("es-MX")} pts
                  </Link>
                </Button>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-xl border bg-muted/30">
              {[
                { k: "Títulos", v: honors.filter((h) => h.kind === "title").length },
                { k: "Finales", v: honors.filter((h) => h.kind === "final").length },
                { k: "Semifinales", v: honors.filter((h) => h.kind === "semi").length },
              ].map((s) => (
                <div key={s.k} className="px-2 py-2.5 text-center">
                  <p className="text-xl font-extrabold leading-none tabular-nums">{s.v}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{s.k}</p>
                </div>
              ))}
            </div>
            {honors.length > 0 && (
              <ul className="mt-2 divide-y divide-border">
                {honors.map((h, i) => (
                  <li key={`${h.tournamentId}-${h.kind}-${i}`} className="flex items-center gap-3 py-2.5">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        h.kind === "title" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {h.kind === "title" ? <Trophy className="h-4 w-4" /> : <Medal className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {h.kind === "title" ? "Campeón" : h.kind === "final" ? "Finalista" : "Semifinalista"}
                        {" · "}
                        {h.tournamentSlug ? (
                          <Link to={`/torneos/${h.tournamentSlug}`} className="hover:underline">
                            {h.tournamentName}
                          </Link>
                        ) : (
                          h.tournamentName
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[h.category, h.partnerName ? `con ${h.partnerName}` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {h.date && (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{h.date.slice(0, 4)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {medals.length > 0 && ((record?.played ?? 0) > 0 || (rankingIndividual?.points ?? 0) > 0) && (
              <div className="mt-4">
                <MedalShelf medals={medals} />
              </div>
            )}
          </div>
        )}

        {/* Cómo juega: estilo + datos de juego en dos columnas compactas. */}
        <div className="mt-10">
          <h2 className="font-display text-lg font-bold">Cómo juega</h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold capitalize">Estilo {jev.estilo.choice}</p>
              <div className="mt-3 space-y-2">
                {Object.entries(jev.estilo.probabilities).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-xs">
                    <span className="w-20 capitalize text-muted-foreground">{k}</span>
                    <AnimatedBar value={(v as number) * 100} max={100} color="primary" className="h-2 flex-1" />
                    <span className="w-10 text-right tabular-nums">{((v as number) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Mano:</span> {handLabel[player.dominant_hand]}
                {" · "}
                <span className="text-muted-foreground">Posición:</span> {positionLabel[player.preferred_position]}
              </p>
              {jev.rival?.reliable && (
                <p>
                  <span className="text-muted-foreground">Contra quién:</span> {jev.rival.label}
                </p>
              )}
              {player.bio && <p className="text-muted-foreground">{player.bio}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* PARTIDOS — historial en filas densas + comparador como herramienta. */}
      <section id="partidos" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Partidos</h2>
          <span className="text-xs text-muted-foreground">{myMatches.length} en el sistema</span>
        </div>
        {myMatches.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sin partidos todavía — aparecen cuando tu equipo tenga partidos en un torneo.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {myMatches.slice(0, 8).map((m) => {
              const mySide = mySideOf(m);
              const opp = mySide === "a" ? m.side_b.pair_name : m.side_a.pair_name;
              const state = matchState(m);
              const winner = matchWinner(m);
              const iWon = winner ? winner === mySide : null;
              const { jornada } = parseRound(m.round ?? "");
              const setsStr = m.sets.map((s) => (mySide === "a" ? `${s.a}-${s.b}` : `${s.b}-${s.a}`)).join("  ");
              return (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      state === "live"
                        ? "bg-primary text-primary-foreground"
                        : state === "finished"
                          ? iWon
                            ? "bg-success/15 text-success"
                            : "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {state === "live" ? "•" : state === "finished" ? (iWon ? "G" : "P") : m.scheduled_at ? formatMatchDay(m.scheduled_at) : "·"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">vs {opp}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[jornada ? `J${jornada}` : null, m.tournament_name].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {state === "finished"
                      ? setsStr
                      : m.scheduled_at
                        ? `${formatMatchDay(m.scheduled_at)} ${formatMatchMonth(m.scheduled_at)} · ${formatMatchTime(m.scheduled_at)}`
                        : "Por programar"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {/* Comparar: herramienta secundaria, colapsada por defecto. */}
        {canView && (
          <Card className="mt-6">
            <button
              type="button"
              onClick={() => setCompareOpen((o) => !o)}
              aria-expanded={compareOpen}
              className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
            >
              <span className="flex items-center gap-2 text-base font-semibold">
                <Users className="h-4 w-4" /> Comparar jugadores
              </span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300", compareOpen && "rotate-180")} />
            </button>
            {compareOpen && (
              <CardContent className="space-y-4 border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Los demás de tu categoría, que es donde la comparación sí significa algo.
                </p>
                <div className="max-w-sm">
                  <Select value={compareId} onValueChange={setCompareId}>
                    <SelectTrigger><SelectValue placeholder="Elige a quién medirte" /></SelectTrigger>
                    <SelectContent>
                      {rivals.length === 0 ? (
                        <SelectItem value="__none__" disabled>Nadie más en tu categoría todavía</SelectItem>
                      ) : (
                        rivals.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.display_name} · N {(p.official_level ?? p.declared_level).toFixed(1)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {compareData ? (
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <CompareCard
                      name={player.display_name}
                      level={player.official_level ?? player.declared_level}
                      winPct={winPct}
                      won={won}
                      played={played}
                      highlight
                      rivalLevel={compareData.p.official_level ?? compareData.p.declared_level}
                      rivalWinPct={
                        compareData.played > 0
                          ? Math.round((compareData.won / compareData.played) * 100)
                          : 0
                      }
                      rivalWon={compareData.won}
                    />
                    <CompareCard
                      name={compareData.p.display_name}
                      level={compareData.p.official_level ?? compareData.p.declared_level}
                      winPct={
                        compareData.played > 0
                          ? Math.round((compareData.won / compareData.played) * 100)
                          : 0
                      }
                      won={compareData.won}
                      played={compareData.played}
                      rivalLevel={player.official_level ?? player.declared_level}
                      rivalWinPct={winPct}
                      rivalWon={won}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Elige un rival para ver lado a lado nivel, juegos ganados y efectividad.
                  </p>
                )}
              </CardContent>
            )}
          </Card>
        )}
      </section>
    </div>
  );
}


/**
 * Diálogo para que el dueño del perfil (o un admin) edite sus datos personales
 * y de pádel. El nivel oficial no es editable: lo asigna la organización.
 */
function ProfileEditDialog({
  player,
  open,
  onOpenChange,
  onSaved,
}: {
  player: PlayerProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (p: PlayerProfile) => void;
}) {
  const [form, setForm] = useState({
    display_name: player.display_name,
    username: player.username,
    city: player.city ?? "",
    state: player.state ?? "",
    country: player.country ?? "",
    sex: player.sex,
    declared_level: String(player.declared_level ?? 4),
    dominant_hand: player.dominant_hand,
    preferred_position: player.preferred_position,
    bio: player.bio ?? "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const name = form.display_name.trim();
      const username = form.username.trim().toLowerCase();
      if (!name) throw new Error("El nombre no puede estar vacío");
      if (!/^[a-z0-9_-]{3,24}$/.test(username)) {
        throw new Error("El usuario debe tener 3-24 caracteres (letras, números, - o _)");
      }
      const updates = {
        display_name: name,
        username,
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        sex: form.sex,
        declared_level: Number(form.declared_level) || 0,
        dominant_hand: form.dominant_hand,
        preferred_position: form.preferred_position,
        bio: form.bio.trim() || null,
      };
      const updated = await db.updatePlayer(player.id, updates);
      onSaved(updated as PlayerProfile);
      toast.success("Perfil actualizado");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message ?? "No se pudo guardar el perfil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Editar perfil
          </DialogTitle>
          <DialogDescription>
            Estos datos se muestran en tu dashboard público.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pp-name">Nombre</Label>
              <Input id="pp-name" value={form.display_name} onChange={(e) => set("display_name", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pp-username">Usuario</Label>
              <Input id="pp-username" value={form.username} onChange={(e) => set("username", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pp-city">Ciudad</Label>
              <Input id="pp-city" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pp-state">Estado</Label>
              <Input id="pp-state" value={form.state} onChange={(e) => set("state", e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pp-country">País</Label>
            <Input id="pp-country" value={form.country} onChange={(e) => set("country", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Rama</Label>
              <Select value={form.sex} onValueChange={(v) => set("sex", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEX_BRANCHES.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
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
                onChange={(e) => set("declared_level", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Mano</Label>
              <Select value={form.dominant_hand} onValueChange={(v) => set("dominant_hand", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">Diestro</SelectItem>
                  <SelectItem value="left">Zurdo</SelectItem>
                  <SelectItem value="both">Ambidiestro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Posición</Label>
            <Select value={form.preferred_position} onValueChange={(v) => set("preferred_position", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="drive">Drive</SelectItem>
                <SelectItem value="reves">Revés</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
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
              onChange={(e) => set("bio", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
