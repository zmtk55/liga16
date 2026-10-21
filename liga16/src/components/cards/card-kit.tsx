/**
 * CardKit — anatomía ÚNICA para todas las cards del sistema.
 *
 *   ┌──────────────────────────────────────┐
 *   │ [lead] Título                 [end]  │  ← CardIdentity
 *   │        meta (1 línea)                │
 *   ├──────────────────────────────────────┤
 *   │ stat · stat · stat            [chip] │  ← CardFooterStrip
 *   └──────────────────────────────────────┘
 *
 * Reglas del sistema:
 *  1. Se compone de primitivos shadcn/ui (Card, Badge, Avatar). Nada de contenedores propios.
 *  2. Tipografía solo por tokens semánticos: text-stat (valor), text-caption (etiqueta),
 *     font-headline (jerarquía editorial). Las pages no inventan tamaños.
 *  3. Color solo por token: bg-card, text-muted-foreground, bg-success, surface-inverse… nunca hex.
 *  4. Un slot cuyo contenido pone quien llama se envuelve en `<div>`, nunca en `<p>`:
 *     `meta`, `title` y `value` son `ReactNode`, y `<p>` no admite descendientes de
 *     bloque. Con un `<div>` del caller dentro, el DOM quedaba `<p><div>…</div></p>`:
 *     HTML inválido y React avisando por consola
 *     (`In HTML, <div> cannot be a descendant of <p>`) en cada render.
 *     ElWrapper sigue siendo de bloque, así que `truncate` se comporta igual; lo que
 *     decide es el TIPO de la prop: `ReactNode` → `<div>`, `string` → `<p>`/`<span>`.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Calendar, Trophy } from "lucide-react";
import { initials, formatMatchTime, formatMatchDay, formatMatchMonth } from "@/lib/format";
import { matchState, matchWinner } from "@/lib/match-state";
import type { Match } from "@/types";

/** Contenedor uniforme: mismo radio, borde, hover y transición en TODO el sistema. */
export function CardShell({
  children,
  className,
  accent = false,
  banner,
  bannerAlt,
}: {
  children: ReactNode;
  className?: string;
  accent?: boolean;
  banner?: string | null;
  bannerAlt?: string;
}) {
  return (
    <Card
      className={cn(
        "group gap-0 overflow-hidden py-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      {accent && <div aria-hidden className="h-1 bg-primary" />}
      {banner && (
        <div className="relative aspect-[16/7] w-full overflow-hidden bg-muted">
          <img
            src={banner}
            alt={bannerAlt ?? ""}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-transparent" />
        </div>
      )}
      {children}
    </Card>
  );
}

/** Identidad: avatar opcional + título (o 2 líneas para parejas) + UNA meta + slot derecho. */
export function CardIdentity({
  lead,
  title,
  titleLines,
  meta,
  end,
  className,
}: {
  lead?: ReactNode;
  title?: ReactNode;
  /** Nombres apilados (parejas): cada uno en su línea, sin truncarse. */
  titleLines?: string[];
  meta?: ReactNode;
  end?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {lead}
      <div className="min-w-0 flex-1">
        {titleLines ? (
          <div className="flex flex-col justify-center gap-0.5 leading-tight">
            {titleLines.map((line, i) => (
              <p key={i} className="min-h-[1.25rem] truncate text-sm font-bold tracking-tight">
                {line}
                {i < titleLines.length - 1 && (
                  <span className="ms-1.5 text-caption text-muted-foreground">/</span>
                )}
              </p>
            ))}
          </div>
        ) : (
          // `div` y no `p`: `title` es ReactNode y quien llama puede pasar un bloque.
          <div className="truncate text-sm font-bold tracking-tight">{title}</div>
        )}
        {meta && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</div>
        )}
      </div>
      {end && <div className="shrink-0">{end}</div>}
    </div>
  );
}

/** Stat mini: valor (text-stat) sobre etiqueta (text-caption). Jerarquía descendente fija. */
export function CardStat({
  value,
  label,
  tone,
}: {
  value: ReactNode;
  label: string;
  tone?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center px-1 py-1.5">
      {/* `value` es ReactNode → bloque. `label` es string → puede seguir siendo inline. */}
      <div className={cn("text-stat tabular-nums", tone)}>{value}</div>
      <span className="text-caption uppercase text-muted-foreground">{label}</span>
    </div>
  );
}

/** Franja inferior: stats en grid + chip (Badge) a la derecha. */
export function CardFooterStrip({
  stats,
  chip,
  className,
}: {
  stats: ReactNode;
  chip?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-border/60 bg-muted/40 px-3 py-1.5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-stretch justify-around gap-1 divide-x divide-border/60">
        {stats}
      </div>
      {chip && <div className="ms-1 shrink-0">{chip}</div>}
    </div>
  );
}

/** Avatar ÚNICO de pareja: una sola letra por jugador, nada solapado.
    Para filas densa (listas maestro-detalle) donde dos círculos encimados
    tapan las iniciales y se ven como "letras encimadas". */
export function PairAvatar({
  p1,
  p2,
  className,
}: {
  p1?: string | null;
  p2?: string | null;
  className?: string;
}) {
  const t = `${p1?.trim().charAt(0) ?? "?"}${p2?.trim().charAt(0) ?? ""}`.toUpperCase();
  return (
    <Avatar className={cn("h-8 w-8 shrink-0 border-2 border-background bg-primary/10 text-xs", className)}>
      <AvatarFallback className="bg-primary/10 font-bold text-primary">{t}</AvatarFallback>
    </Avatar>
  );
}
/** Dos avatares solapados. Solo donde hay espacio (banners, detalle amplio). */
export function PairAvatars({
  names,
  size = "md",
}: {
  names: (string | null | undefined)[];
  size?: "sm" | "md";
}) {
  return (
    <div className="flex shrink-0 -space-x-2.5">
      {names.slice(0, 2).map((n, i) => (
        <Avatar
          key={i}
          className={cn(
            "border-2 border-background bg-primary/10",
            size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-xs",
          )}
        >
          <AvatarFallback className="bg-primary/10 font-bold text-primary">
            {initials(n ?? "?")}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}

/* ============================================================
 * MatchCard — LA card de partido del sistema (una sola anatomía).
 *
 *   ┌────────┬──────────────────────────────────────────────┐
 *   │  17:26 │ JORNADA 5 · QUINTA FEMENIL         Finalizado│
 *   │  10 OCT│──────────────────────────────────────────────│
 *   │        │ ♛ Erika Beltran / Monica          6   3   10 │
 *   │        │   Imeyra / Valeria Coronado       4   6    4 │
 *   │        │ 📍 Cancha 2 · LIGA16 4TA EDICION             │
 *   └────────┴──────────────────────────────────────────────┘
 *
 * Las reglas que la sostienen (antes la card se leía como un formulario):
 *  · El marcador va PEGADO a la pareja que le pertenece. Flotando al borde
 *    de una card ancha, el "6 3 10" se queda sin dueño.
 *  · Un set ganado se pinta y el perdido se apaga: el patrón se lee de un
 *    vistazo, sin tener que comparar dos números.
 *  · El ganador se marca con trofeo, no con un punto de radio que parece
 *    un control sin usar.
 *  · La hora es el riel fijo de la izquierda: es lo único que no cambia de
 *    lugar entre partido y partido.
 *  · Nada por debajo de 12px (la escala del sistema manda) y nada de chips
 *    que dicen lo que no pasó ("Cancha por asignar"): si no hay cancha, no
 *    hay chip.
 *
 * La usan: agenda/calendario, rol de equipo, ranking, panel del jugador y
 * la captura de resultados del admin.
 * ============================================================ */

/**
 * Sets ganados por cada lado leyendo el marcador como lo lee una persona:
 * el lado con más juegos ganó el set (el super tie-break a 10 también sale
 * así). La regla oficial (`determineMatchWinner`) necesita los puntos del
 * tie-break para resolver un 6-7, y ese dato casi nunca se captura: con esa
 * regla un partido claramente ganado se quedaba sin trofeo y la card se
 * contradecía a sí misma (dos sets en verde y ningún ganador).
 */
/** Los sets de un lado: el ganado se pinta, el perdido se apaga. */
export function MatchSets({
  match,
  side,
  size = "md",
}: {
  match: Match;
  side: "a" | "b";
  size?: "sm" | "md";
}) {
  if (match.sets.length === 0) {
    // Sin sets no hay columna: el estado ya lo dice la pastilla de arriba
    // ("Por jugar"). Escribirlo dos veces, en cada fila, era ruido puro.
    return null;
  }
  const cell =
    size === "sm"
      ? "h-6 min-w-6 px-1 text-xs"
      : // En móvil el marcador se achica: el nombre de la pareja importa más
        // que el aire alrededor del número.
        "h-6 min-w-6 px-1 text-xs sm:h-7 sm:min-w-7 sm:px-1.5 sm:text-sm";
  return (
    <div className="flex shrink-0 items-center gap-1">
      {match.sets.map((s, i) => {
        const mine = side === "a" ? (s.a ?? 0) : (s.b ?? 0);
        const theirs = side === "a" ? (s.b ?? 0) : (s.a ?? 0);
        const tb = side === "a" ? s.tiebreak_a : s.tiebreak_b;
        const tookSet = mine > theirs;
        // El tie-break sólo aparece en el set empatado (6-6): en cualquier
        // otro caso es ruido que confunde ("6" con un "5" pegado).
        const showTb = tb != null && (s.a ?? 0) === (s.b ?? 0);
        return (
          <span
            key={i}
            title={`Set ${i + 1}: ${mine} a ${theirs}`}
            className={cn(
              "flex items-center justify-center rounded-md font-bold tabular-nums transition-colors duration-150",
              cell,
              tookSet
                ? "bg-success/15 text-success"
                : // El set perdido se apaga, pero se LEE: al 50% de opacidad
                  // el número caía a 1.9:1 sobre la card clara.
                  "text-muted-foreground",
            )}
          >
            {mine}
            {showTb && (
              <span className="ms-0.5 text-2xs font-normal opacity-80">({tb})</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export function MatchCard({
  match,
  className,
  footer,
}: {
  match: Match;
  className?: string;
  /** Acción opcional bajo la card (ej. "Ver torneo"). */
  footer?: ReactNode;
}) {
  const isLive = match.status === "live";
  const hasScore = match.sets.length > 0;
  const matchTime = match.scheduled_at ? formatMatchTime(match.scheduled_at) : null;
  const winner = matchWinner(match);
  const state = matchState(match);
  const court = match.court_name?.trim();
  const context =
    [match.round, match.category_name].filter(Boolean).join(" · ") ||
    match.tournament_name ||
    "Liga16";

  const sideRow = (side: "a" | "b") => {
    const name = side === "a" ? match.side_a.pair_name : match.side_b.pair_name;
    const isWinner = hasScore && winner === side;
    return (
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2">
        <span aria-hidden className="flex h-4 w-4 items-center justify-center">
          {isWinner && <Trophy className="h-3.5 w-3.5 text-success" />}
        </span>
        <span
          title={name}
          className={cn(
            "truncate text-sm",
            !hasScore
              ? "font-semibold text-foreground"
              : isWinner
                ? "font-bold text-foreground"
                : "font-medium text-muted-foreground",
          )}
        >
          {name}
        </span>
        <MatchSets match={match} side={side} />
      </div>
    );
  };

  return (
    <Card
      className={cn(
        "group gap-0 overflow-hidden py-0 transition-all duration-200 ease-out active:scale-[0.995] liga16-card liga16-card--lift",
        isLive
          ? "border-destructive/40 bg-destructive/5 shadow-sm"
          : "hover:border-primary/30 hover:shadow-md",
        className,
      )}
    >
      <CardContent className="flex gap-0 p-0">
        {/* Riel izquierdo: CUÁNDO. Columna fija, el ancla de la card. */}
        <div
          className={cn(
            "flex w-[3.75rem] shrink-0 flex-col items-center justify-center gap-0.5 border-r py-3 sm:w-[4.25rem]",
            isLive ? "border-destructive/30 bg-destructive/10" : "border-border/60 bg-muted/30",
          )}
        >
          {matchTime ? (
            <>
              <span
                className={cn(
                  "font-headline text-lg leading-none tabular-nums sm:text-xl",
                  isLive ? "text-destructive" : "text-foreground",
                )}
              >
                {matchTime}
              </span>
              <span className="text-caption uppercase text-muted-foreground">
                {formatMatchDay(match.scheduled_at!)} {formatMatchMonth(match.scheduled_at!)}
              </span>
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="mt-1 text-caption uppercase text-muted-foreground">
                Sin hora
              </span>
            </>
          )}
        </div>

        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <p
              title={context}
              className="min-w-0 truncate text-caption uppercase text-muted-foreground"
            >
              {context}
            </p>
            {state === "live" ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-destructive/15 px-2 py-0.5 text-caption uppercase text-destructive">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
                En vivo
              </span>
            ) : (
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-caption uppercase",
                  state === "finished"
                    ? "border-success/40 bg-success/10 text-success"
                    : state === "playing"
                      ? "border-primary/40 bg-primary/10 text-primary-strong"
                      : "border-border/70 text-muted-foreground",
                )}
              >
                {state === "finished"
                  ? "Finalizado"
                  : state === "playing"
                    ? "En curso"
                    : "Por jugar"}
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1.5">
            {sideRow("a")}
            <div aria-hidden className="h-px bg-border/50" />
            {sideRow("b")}
          </div>

          {(court || match.tournament_name) && (
            <div className="mt-2.5 flex items-center gap-3 text-caption text-muted-foreground">
              {court && (
                <span className="inline-flex shrink-0 items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Cancha {court}
                </span>
              )}
              {match.tournament_name && (
                <span className="truncate">{match.tournament_name}</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
      {footer && (
        <div className="border-t border-border/60 bg-muted/30 px-3 py-2">{footer}</div>
      )}
    </Card>
  );
}
