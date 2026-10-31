import { useEffect, useMemo, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "react-router";
import { db } from "@/lib/data";
import type { Pair } from "@/types";
import { buildPlayerRecords } from "@/lib/records";
import { buildIndividualStandings, DEFAULT_INDIVIDUAL_POINTS, type IndividualStanding } from "@/lib/individual-ranking";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardShell, CardIdentity, CardStat, CardFooterStrip } from "@/components/cards/card-kit";
import { PlayerAvatar } from "@/components/cards/card-image";
import { sexLabel } from "@/lib/format";
import { buzz } from "@/lib/haptics";
import { Trophy, Medal, UserRound, ChevronDown, Info } from "lucide-react";

/**
 * Reglas de puntos, a un toque pero sin robar pantalla. Los números salen de
 * DEFAULT_INDIVIDUAL_POINTS: si la tabla cambia, este texto cambia solo (un
 * torneo puede ajustarlos vía scoring.individual_points).
 */
function ScoringExplainer() {
  const [open, setOpen] = useState(false);
  const c = DEFAULT_INDIVIDUAL_POINTS;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" /> Cómo se puntúa
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 grid gap-2 rounded-xl border bg-muted/30 p-3 text-xs sm:grid-cols-2">
          <div>
            <p className="font-bold uppercase tracking-widest text-muted-foreground">Fase de grupos</p>
            <p className="mt-1">
              Victoria <span className="font-bold tabular-nums">{c.groupWin}</span> pts · Derrota{" "}
              <span className="font-bold tabular-nums">{c.groupLoss}</span> pts (jugar suma)
            </p>
          </div>
          <div>
            <p className="font-bold uppercase tracking-widest text-muted-foreground">
              Bono al cerrar el torneo
            </p>
            <p className="mt-1">
              Campeón <span className="font-bold tabular-nums">{c.champion}</span> · Finalista{" "}
              <span className="font-bold tabular-nums">{c.finalist}</span> · Semifinal{" "}
              <span className="font-bold tabular-nums">{c.semifinalist}</span> · Cuartos{" "}
              <span className="font-bold tabular-nums">{c.quarterfinalist}</span> · Octavos{" "}
              <span className="font-bold tabular-nums">{c.roundOf16}</span>
            </p>
          </div>
          <p className="text-muted-foreground sm:col-span-2">
            Se calcula solo de los resultados capturados: si se corrige un partido, el ranking se
            ajusta solo. El bono cae cuando se captura la final del torneo. Empates: títulos,
            finales, efectividad y victorias.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Vista INDIVIDUAL del ranking: puntos acumulados entre torneos, derivados de
 * los partidos (ver lib/individual-ranking). Convive con la vista de parejas,
 * que sigue siendo por torneo.
 */
export function IndividualRankingView({
  query,
  sex,
  view,
}: {
  query: string;
  sex: string;
  view: "table" | "cards";
}) {
  const [standings, setStandings] = useState<IndividualStanding[] | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([db.listPlayers(), db.listAllPairs(), db.listTournaments(), db.listRecentMatches()])
      .then(([players, allPairs, tournaments, matches]) => {
        if (!active) return;
        const pairs = allPairs as unknown as Pair[];
        const records = buildPlayerRecords(matches, pairs, players);
        setStandings(buildIndividualStandings(matches, allPairs, players, tournaments, records));
      })
      .catch(() => {
        if (active) setStandings([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = standings ?? [];
    if (sex !== "all") list = list.filter((s) => s.sex === sex);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q));
    return list;
  }, [standings, sex, query]);

  if (standings === null) {
    return (
      <div className="space-y-3">
        <ScoringExplainer />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="space-y-3">
        <ScoringExplainer />
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <UserRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-lg font-medium">Nadie tiene puntos todavía</p>
          <p className="mt-1">Los puntos aparecen solos en cuanto se capturan resultados.</p>
        </CardContent>
      </Card>
      </div>
    );
  }

  if (view === "cards") {
    return (
      <div className="space-y-3">
        <ScoringExplainer />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s) => (
          <Link key={s.playerId} to={`/jugadores/${s.playerId}`} onClick={() => buzz("tap")}>
            <CardShell accent>
              <CardContent className="p-4">
                <CardIdentity
                  lead={<PlayerAvatar name={s.name} photoUrl={s.photoUrl} className="h-10 w-10" />}
                  titleLines={[s.name]}
                  meta={sexLabel(s.sex)}
                  end={
                    <span className="text-2xl font-extrabold tabular-nums text-muted-foreground">
                      {s.position}
                    </span>
                  }
                />
              </CardContent>
              <CardFooterStrip
                stats={
                  <>
                    <CardStat value={s.points.toLocaleString("es-MX")} label="Puntos" />
                    <CardStat value={s.titles} label="Títulos" />
                    <CardStat value={`${s.won}–${s.lost}`} label="Récord" />
                  </>
                }
              />
            </CardShell>
          </Link>
        ))}
      </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ScoringExplainer />
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Jugador</TableHead>
              <TableHead
                className="text-right"
                title="Puntos acumulados entre torneos: victorias en grupos + bono por ronda alcanzada en eliminatorias"
              >
                Puntos
              </TableHead>
              <TableHead className="text-right" title="Campeonatos (finales y semifinales entre paréntesis)">
                Títulos
              </TableHead>
              <TableHead className="text-right">Récord</TableHead>
              <TableHead className="text-right" title="Torneos con partidos contados">
                Torneos
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.playerId} className="transition-colors hover:bg-muted/40">
                <TableCell className="text-xl font-extrabold tabular-nums text-muted-foreground">
                  {s.position}
                </TableCell>
                <TableCell>
                  <Link
                    to={`/jugadores/${s.playerId}`}
                    onClick={() => buzz("tap")}
                    className="flex items-center gap-2.5 font-medium hover:underline"
                  >
                    <PlayerAvatar name={s.name} photoUrl={s.photoUrl} className="h-8 w-8" />
                    <span>
                      {s.name}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {sexLabel(s.sex)}
                      </span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {s.points.toLocaleString("es-MX")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    {s.titles > 0 && <Trophy className="h-3.5 w-3.5 text-primary" aria-hidden />}
                    {s.titles}
                  </span>
                  {(s.finals > 0 || s.semis > 0) && (
                    <span className="mt-0.5 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                      <Medal className="h-3 w-3" aria-hidden />
                      {s.finals}F · {s.semis}S
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.won}–{s.lost}
                  <div className="text-xs text-muted-foreground">{s.winRate}% efectividad</div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">{s.tournaments}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    </div>
  );
}
