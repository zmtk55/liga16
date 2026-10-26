import { useState } from "react";
import { db } from "@/lib/data";
import type { Pair, Match, Tournament, TournamentCategory } from "@/types";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BentoCard as Card } from "@/components/admin/bento-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { computeStandings, type Group } from "@/lib/groups";
import { LIGA16_CATEGORIES, getLiga16Category } from "@/lib/liga16-scoring";
import { DEFAULT_SCORING } from "@/lib/scoring";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Court } from "@/types";
import { DateTimePicker } from "@/components/ui/date-picker";
import { matchStatusKey } from "@/lib/match-state";

/** Captura y edición de marcador, cancha, fecha y hora desde el calendario del torneo. */
export function MatchResultDialog({
  match,
  nextMatchId,
  courts,
  open,
  onOpenChange,
  onAdvance,
}: {
  match: Match;
  nextMatchId: string | null;
  courts: Court[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdvance: (nextMatchId: string | null) => void;
}) {
  // El estado nace de `match`, así que el componente DEBE remontarse cuando
  // cambia el partido: el diálogo se encadena al siguiente con `onAdvance` sin
  // cerrarse. Sin la `key` que se le pone arriba, los sets del partido anterior
  // se guardaban encima del nuevo.
  const [sets, setSets] = useState<Array<{ a: string; b: string }>>(() =>
    match.sets.length > 0 ? match.sets.map((s) => ({ a: String(s.a), b: String(s.b) })) : [{ a: "", b: "" }],
  );
  const [courtName, setCourtName] = useState(match.court_name ?? "");
  const [scheduledAt, setScheduledAt] = useState(match.scheduled_at ? match.scheduled_at.slice(0, 16) : "");
  const [saving, setSaving] = useState(false);

  const finishedSets = sets.filter((s) => s.a !== "" && s.b !== "");
  const validSets = finishedSets.map((s) => ({ a: Number(s.a), b: Number(s.b), tiebreak_a: null, tiebreak_b: null }));
  const setsA = validSets.filter((s) => s.a > s.b).length;
  const setsB = validSets.filter((s) => s.b > s.a).length;
  const winner = setsA > setsB ? "a" : setsB > setsA ? "b" : null;

  async function save(status: Match["status"]) {
    if (status === "finished" && !winner) {
      toast.error("Marca los sets: deben ganar más sets una pareja para cerrar el partido");
      return;
    }
    setSaving(true);
    try {
      await db.updateMatch(match.id, {
        sets: status === "finished" ? validSets : match.sets,
        winner: status === "finished" ? winner : match.winner,
        status,
        court_name: courtName || null,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
      toast.success(status === "finished" ? (nextMatchId ? "Guardado — siguiente partido" : "Resultado guardado") : "Partido actualizado");
      onAdvance(status === "finished" ? nextMatchId : null);
    } catch (e) {
      toast.error((e as Error).message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar partido</DialogTitle>
          <DialogDescription>
            {match.side_a.pair_name} vs {match.side_b.pair_name} · {match.round}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {sets.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <div className="grid gap-1">
                <Label className="text-xs">Set {i + 1} — {match.side_a.pair_name}</Label>
                <Input
                  type="number"
                  min={0}
                  value={s.a}
                  onChange={(e) => setSets((arr) => arr.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
                  aria-label={`Juegos de ${match.side_a.pair_name} en el set ${i + 1}`}
                />
              </div>
              <span className="pb-2 text-muted-foreground">–</span>
              <div className="grid gap-1">
                <Label className="text-xs">{match.side_b.pair_name}</Label>
                <Input
                  type="number"
                  min={0}
                  value={s.b}
                  onChange={(e) => setSets((arr) => arr.map((x, j) => (j === i ? { ...x, b: e.target.value } : x)))}
                  aria-label={`Juegos de ${match.side_b.pair_name} en el set ${i + 1}`}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSets((arr) => [...arr, { a: "", b: "" }])}
              disabled={sets.length >= 5}
            >
              <Plus className="h-4 w-4 ms-1" /> Añadir set
            </Button>
{winner && (
                <Badge variant="default">
                  Gana: {winner === "a" ? match.side_a.pair_name : match.side_b.pair_name}
                </Badge>
              )}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t pt-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Cancha</Label>
              <Select value={courtName} onValueChange={setCourtName}>
                <SelectTrigger><SelectValue placeholder="Sin cancha" /></SelectTrigger>
                <SelectContent>
                  {courts.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Fecha y hora</Label>
              <DateTimePicker
                value={scheduledAt}
                onChange={(v) => setScheduledAt(v ?? "")}
                ariaLabel="Fecha y hora del partido"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => save("scheduled")} disabled={saving}>
            Guardar sin jugar
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => save("finished")} disabled={saving}>
              {saving ? "Guardando…" : "Guardar resultado"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Tabla de posiciones de un grupo: compacta por defecto, completa al expandir. */
export function GroupStandingsCard({
  group,
  matches,
  nameById,
  pairs,
  categories,
  tournament,
}: {
  group: Group;
  matches: Match[];
  nameById: Record<string, string>;
  pairs: Pair[];
  categories: TournamentCategory[];
  tournament: Tournament | null;
}) {
  const [expanded, setExpanded] = useState(false);

  // Determinar categoría del grupo (asumimos que todos los pares del grupo son de la misma categoría)
  const firstPairId = group.pairIds[0];
  const firstPair = pairs.find((p) => p.id === firstPairId);
  const catName = firstPair
    ? categories.find((c) => c.id === firstPair.category_id)?.name ?? ""
    : "";
  const liga16Cat = getLiga16Category(catName);

  // Usar computeStandings unificado con el scoring del torneo
  // Para categorías Liga16, forzar ranking_method = 'points_percentage'
  const baseScoring = tournament?.scoring ?? undefined;
  const effectiveScoring = liga16Cat
    ? { ...DEFAULT_SCORING, ...baseScoring, ranking_method: 'points_percentage' as const }
    : baseScoring;

  const standings = computeStandings(group.pairIds, matches, nameById, effectiveScoring);

  const groupMatches = matches.filter(
    (m) => group.pairIds.includes(m.side_a.pair_id ?? "") && group.pairIds.includes(m.side_b.pair_id ?? ""),
  );
  const played = groupMatches.filter((m) => matchStatusKey(m) === "finished").length;

  // Jornada summary solo para Liga16
  const isLiga16 = liga16Cat !== null;

  // Leyenda de columnas. Sin ella, PJ/PG/PP/%PTS obligan a adivinar: en la vista
  // completa PP va justo después de PG y se lee como "puntos por partido", pero
  // son partidos perdidos. La auditoría de Jev lo señaló como el punto ciego más
  // claro del admin (confianza 0.99). Mismo patrón que la leyenda de sets en
  // resultados.tsx: texto visible, no tooltip — en móvil no hay hover.
  const leyendaColumnas = expanded
    ? "PJ partidos jugados · PG ganados · PP perdidos · Sets G/P ganados/perdidos · Juegos G/P ganados/perdidos · Dif diferencia a favor · %Pts porcentaje de puntos ganados sobre el total de puntos jugados · G/D en Forma = victoria/derrota"
    : isLiga16
      ? "PJ partidos jugados · PG ganados · %PG porcentaje de victorias · %PTS puntos ganados sobre el total de puntos jugados · Pos posición"
      : "PJ partidos jugados · Sets ganados-perdidos · %Pts porcentaje de puntos ganados · G/D en Forma = victoria/derrota";

  let jornadaSummary: { JUEGOS_JUGADOS: number; TOTAL_JUEGOS: number; JUEGOS_FALTANTES: number } | null = null;
  if (isLiga16) {
    const totalPJ = standings.reduce((sum, s) => sum + s.played, 0);
    const JUEGOS_JUGADOS = Math.floor(totalPJ / 2);
    const TOTAL_JUEGOS = LIGA16_CATEGORIES[liga16Cat!].totalMatchesRoundRobin;
    jornadaSummary = { JUEGOS_JUGADOS, TOTAL_JUEGOS, JUEGOS_FALTANTES: TOTAL_JUEGOS - JUEGOS_JUGADOS };
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            {group.name}
            {liga16Cat && <Badge variant="secondary" className="text-xs">Liga16: {liga16Cat}</Badge>}
            <Badge variant="outline">{played}/{groupMatches.length} jugados</Badge>
          </span>
          {jornadaSummary && (
            <span className="text-xs text-muted-foreground">
              Jornada: {jornadaSummary.JUEGOS_JUGADOS}/{jornadaSummary.TOTAL_JUEGOS} · Faltan {jornadaSummary.JUEGOS_FALTANTES}
            </span>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Ver básico" : "Ver completa"}
            <ChevronDown className={`ms-1 h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4 w-8">#</TableHead>
              <TableHead>Equipo</TableHead>
              {isLiga16 ? (
                // Columnas Liga16: PJ, PG, %PG, %PTS, JERARQUIA
                !expanded && (
                  <>
                    <TableHead className="text-end" title="Partidos jugados">PJ</TableHead>
                    <TableHead className="text-end" title="Partidos ganados">PG</TableHead>
                    <TableHead className="text-end" title="Porcentaje de partidos ganados">%PG</TableHead>
                    <TableHead className="text-end" title="Puntos ganados sobre el total de puntos jugados">%PTS</TableHead>
                    <TableHead className="text-end pe-4" title="Posición en la tabla">Pos</TableHead>
                  </>
                )
              ) : (
                // Columnas genéricas
                !expanded && (
                  <>
                    <TableHead className="text-center w-28" title="Últimos partidos: G es victoria, D es derrota">Forma</TableHead>
                    <TableHead className="text-end" title="Partidos jugados">PJ</TableHead>
                    <TableHead className="text-end" title="Sets ganados - sets perdidos">Sets</TableHead>
                    <TableHead className="text-end pe-4" title="Porcentaje de puntos ganados sobre el total de puntos jugados">%Pts</TableHead>
                  </>
                )
              )}
              {expanded && (
                <>
                  <TableHead className="text-center w-28" title="Últimos partidos: G es victoria, D es derrota">Forma</TableHead>
                  <TableHead className="text-end" title="Partidos jugados">PJ</TableHead>
                  <TableHead className="text-end" title="Partidos ganados">PG</TableHead>
                  <TableHead className="text-end" title="Partidos perdidos (no puntos: van juntos a PJ y PG)">PP</TableHead>
                  <TableHead className="text-end" title="Sets ganados">Sets G</TableHead>
                  <TableHead className="text-end" title="Sets perdidos">Sets P</TableHead>
                  <TableHead className="text-end" title="Diferencia de sets a favor">Dif sets</TableHead>
                  <TableHead className="text-end" title="Juegos ganados">Juegos G</TableHead>
                  <TableHead className="text-end" title="Juegos perdidos">Juegos P</TableHead>
                  <TableHead className="text-end" title="Diferencia de juegos a favor">Dif juegos</TableHead>
                  <TableHead className="text-end pe-4" title="Porcentaje de puntos ganados sobre el total de puntos jugados">%Pts</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((row, i) => {
              const difSets = row.setsFor - row.setsAgainst;
              const difGames = row.gamesFor - row.gamesAgainst;
              const position = row.jerarquia ?? i + 1;
              return (
                <TableRow key={row.pairId} className={position === 1 ? "bg-primary/5" : ""}>
                  <TableCell className="ps-4 font-medium">{position}</TableCell>
                  <TableCell className="font-medium min-w-0 truncate">{nameById[row.pairId] ?? "?"}</TableCell>
                  {isLiga16 ? (
                    // Vista compacta Liga16
                    !expanded && (
                      <>
                        <TableCell className="text-end tabular-nums">{row.played}</TableCell>
                        <TableCell className="text-end tabular-nums text-success">{row.won}</TableCell>
                        <TableCell className="text-end tabular-nums">
                          {row.played > 0 ? ((row.won / row.played) * 100).toFixed(1) + "%" : "—"}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {row.gamesFor > 0 || row.gamesAgainst > 0
                            ? ((row.gamesFor / (row.gamesFor + row.gamesAgainst)) * 100).toFixed(1) + "%"
                            : "—"}
                        </TableCell>
                        <TableCell className="text-end pe-4 font-bold tabular-nums">{position}</TableCell>
                      </>
                    )
                  ) : (
                    // Vista compacta genérica
                    !expanded && (
                      <>
                        <TableCell className="text-center">
                          <span className="inline-flex gap-0.5">
                            {row.form.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                            {row.form.map((f, fi) => (
                              <span
                                key={fi}
                                className={`flex h-4.5 w-4.5 items-center justify-center rounded-xs text-xs font-bold text-white ${
                                  f === "G" ? "bg-success" : "bg-destructive"
                                }`}
                                title={f === "G" ? "Victoria" : "Derrota"}
                              >
                                {f}
                              </span>
                            ))}
                          </span>
                        </TableCell>
                        <TableCell className="text-end tabular-nums">{row.played}</TableCell>
                        <TableCell className="text-end tabular-nums">{row.setsFor}-{row.setsAgainst}</TableCell>
                        <TableCell className="text-end pe-4 font-bold tabular-nums">{row.points}</TableCell>
                      </>
                    )
                  )}
                  {expanded && (
                    <>
                      <TableCell className="text-center">
                        <span className="inline-flex gap-0.5">
                          {row.form.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          {row.form.map((f, fi) => (
                            <span
                              key={fi}
                              className={`flex h-4.5 w-4.5 items-center justify-center rounded-xs text-xs font-bold text-white ${
                                f === "G" ? "bg-success" : "bg-destructive"
                              }`}
                              title={f === "G" ? "Victoria" : "Derrota"}
                            >
                              {f}
                            </span>
                          ))}
                        </span>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{row.played}</TableCell>
                      <TableCell className="text-end tabular-nums text-success">{row.won}</TableCell>
                      <TableCell className="text-end tabular-nums text-destructive">{row.lost}</TableCell>
                      <TableCell className="text-end tabular-nums">{row.setsFor}</TableCell>
                      <TableCell className="text-end tabular-nums">{row.setsAgainst}</TableCell>
                      <TableCell className={`text-end tabular-nums ${difSets > 0 ? "text-success" : difSets < 0 ? "text-destructive" : ""}`}>
                        {difSets > 0 ? "+" : ""}{difSets}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{row.gamesFor}</TableCell>
                      <TableCell className="text-end tabular-nums">{row.gamesAgainst}</TableCell>
                      <TableCell className={`text-end tabular-nums ${difGames > 0 ? "text-success" : difGames < 0 ? "text-destructive" : ""}`}>
                        {difGames > 0 ? "+" : ""}{difGames}
                      </TableCell>
                      <TableCell className="text-end pe-4 font-bold tabular-nums">{row.points}</TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="border-t px-4 py-2 text-xs leading-relaxed text-muted-foreground">
          {leyendaColumnas}
        </p>
      </CardContent>
    </Card>
  );
}
