/**
 * TeamCard — la pareja con la misma receta visual que el jugador.
 *
 * Por qué vive aquí y no en `features/nav-test`: `PlayerCardV5` nació como
 * maqueta pero ya está en producción (admin/jugadores) y el producto pidió
 * llevar ese tratamiento a los equipos. Esta es la versión de sistema: la usa
 * `/equipos` con el mismo `Team` que la ficha y la galería de jugadores, sin
 * duplicar la anatomía en otra página.
 *
 * Se hereda de V5 sin discutir: alto fijo, foto a sangre, panel inferior con
 * blur y chips oscuros (blanco sobre negro translúcido porque el fondo es una
 * foto y ningún color de marca sobrevive a una foto clara), click = flip con
 * `role="button"` + Enter/Espacio, y el enlace al detalle como botón propio
 * dentro del panel — envolver la card con un `Link` haría que el click fuera
 * siempre navegación y el flip quedaría inalcanzable.
 *
 * Lo único propio de la pareja es el fondo, y el orden importa:
 *   1. escudo — es lo que la pareja eligió poner de sí misma. Va centrado con
 *      `object-contain`: un escudo es un logo con fondo transparente, y estirado
 *      a sangre con `object-cover` se lee como una mancha.
 *   2. foto de un jugador (`photo1_url`, luego `photo2_url`) — una foto de
 *      persona sí se comporta como fondo y da la misma textura que el jugador.
 *   3. iniciales por apellido — la mayoría de las parejas del seed no tienen
 *      escudo ni fotos, así que esta es la vista por defecto de `/equipos` y
 *      tiene que verse intencional, no rota. Las iniciales van SIEMPRE debajo de
 *      la foto: si la URL falla, se revela esto en vez de un hueco vacío.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sexLabel, winRate } from "@/lib/format";
import { teamCategoryLabel } from "@/lib/categories";
import { buzz } from "@/lib/haptics";
// La estrella vive en el playground porque nació allí; ya es parte del
// sistema (la usa la galería de jugadores) y duplicarla sería peor que
// importar el original.
import { FavStar } from "@/features/nav-test/player-card";
import type { Team } from "@/types";

/** La pareja son DOS líneas ("Fuentes" / "Rojas"), igual que `CardIdentity`
 *  con `titleLines`. Se prefieren los nombres reales del jugador cuando
 *  existen: `name` es texto libre y a veces quedó desactualizado. */
function pairLines(team: Team): string[] {
  const fromPlayers = [team.player1?.name, team.player2?.name].filter(
    (n): n is string => Boolean(n),
  );
  if (fromPlayers.length) return fromPlayers;
  const parts = team.name
    .split(/\s*\/\s*|\s+y\s*|\s*&\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length) return parts;
  return [team.name.trim() || "Pareja"];
}

/** Iniciales por apellido ("Fuentes / Rojas" → FR): así se identifica una
 *  pareja de padel, y `initials()` a secas sobre el nombre completo sacaría
 *  la barra del separador ("F/"). */
function pairInitials(lines: string[]): string {
  return lines
    .slice(0, 2)
    .map((l) => {
      const parts = l.trim().split(/\s+/);
      return (parts[parts.length - 1] ?? "")[0] ?? "";
    })
    .join("")
    .toUpperCase();
}

export function TeamCard({ team, className }: { team: Team; className?: string }) {
  const [flipped, setFlipped] = useState(false);

  const lines = pairLines(team);
  const wr = team.played > 0 ? winRate(team.played, team.won) : null;
  const setDiff = team.sets_for - team.sets_against;
  const crest = team.crest_url ?? null;
  const photo = team.photo1_url ?? team.photo2_url ?? null;

  const toggleFlip = () => {
    buzz("tap");
    setFlipped((f) => !f);
  };

  return (
    <Card
      onClick={toggleFlip}
      className={cn(
        "group relative h-72 w-full max-w-xs overflow-hidden py-0 gap-0",
        "rounded-xl border-none bg-muted shadow-lg outline-none",
        "transition-all duration-500 ease-out [perspective:1200px]",
        "hover:-translate-y-1 hover:shadow-xl",
        "focus-visible:ring-2 focus-visible:ring-ring",
        flipped
          ? "z-30 scale-110 shadow-2xl ring-2 ring-foreground/40"
          : "active:scale-[0.985]",
        className,
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          toggleFlip();
        }
      }}
    >
      <div
        className={cn(
          "relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]",
          flipped && "[transform:rotateY(180deg)]",
        )}
      >
        {/* Frente: fondo + panel de blur */}
        <div className="absolute inset-0 flex flex-col [backface-visibility:hidden]">
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center bg-muted"
          >
            <span className="text-6xl font-black text-foreground/15">
              {pairInitials(lines)}
            </span>
          </div>

          {crest ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-muted to-muted/70 p-8">
              <img
                src={crest}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
                alt={`Escudo de ${team.name}`}
                className="h-1/2 w-1/2 max-h-40 object-contain"
              />
            </div>
          ) : photo ? (
            <img
              src={photo}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
              alt={`Foto de ${team.name}`}
              className={cn(
                "absolute inset-0 h-full w-full object-cover object-center",
                "transition-transform duration-500",
                "group-hover:scale-105",
              )}
            />
          ) : null}

          {/* Velo sutil */}
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-background/28" />

          {/* Puesto en la división. En el jugador esta esquina lleva el check de
              verificado; en la pareja lo que distingue de un vistazo es dónde
              está en el grupo, y una pareja recién inscrita aún no tiene
              posición, así que en su lugar se marca como nueva. */}
          <div className="absolute top-3 right-3 z-20">
            {team.position > 0 ? (
              <span className="rounded-full bg-black/45 px-2 py-1 text-xs font-bold tabular-nums text-white">
                #{team.position}
              </span>
            ) : team.played === 0 ? (
              <span className="rounded-full bg-black/45 px-2 py-1 text-xs font-bold text-white">
                Nuevo
              </span>
            ) : null}
          </div>
          {/* La DIVISIÓN con su abreviatura, arriba a la izquierda: es el dato
              que la gente busca primero ("¿en qué categoría juego?"). Va como
              rótulo propio y no dentro de la línea de la categoría del torneo
              porque son dos cosas distintas: "Suma 9" es la categoría con la que
              se inscribieron y "6ta" es la mesa en la que compiten. Antes acá
              salía "Sexta categoría", que además de ser otra respuesta para lo
              mismo obligaba a descifrar una abreviatura que nadie descifra. */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
            <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-sm">
              {team.division}
            </span>
            <FavStar />
          </div>

          {/* Panel con blur en la zona inferior (face-safe) */}
          <div className="relative z-10 mx-3 mb-3 mt-auto rounded-xl border border-foreground/15 bg-background/75 p-2.5 backdrop-blur-md dark:bg-background/45">
            <h3 className="text-sm leading-tight font-bold text-foreground">
              {lines.map((l, i) => (
                <span key={i} className="block truncate">
                  {l}
                </span>
              ))}
            </h3>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-foreground/80">
              {/* La categoría REAL del torneo ("Suma 9", "4ta Varonil"), que es
                  como la gente la reconoce; la división derivada es solo el
                  bucket de orden. Antes la card mostraba la división sola y una
                  pareja de Suma 9 aparecía como "6ta", que no es su categoría.
                  Mismo criterio que ya usa el Home. */}
              <Badge
                variant="outline"
                className="rounded-full border-foreground/20 bg-foreground/10 text-foreground"
              >
                {teamCategoryLabel(team)}
              </Badge>
              <span className="shrink-0">{sexLabel(team.sex)}</span>
              <span className="truncate">· {team.city}</span>
            </div>

            {/* Stats: chips oscuros siempre legibles (sin verde/naranja) */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-foreground/10 pt-1.5">
              <StatChip value={team.played} label="PJ" />
              <StatChip value={team.won} label="G" />
              <StatChip value={team.lost} label="P" />
              <StatChip value={wr !== null ? `${wr}%` : "—"} label="Efect." />
            </div>

            <Button
              asChild
              size="sm"
              variant="secondary"
              className="mt-1.5 h-7 w-full rounded-full font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                buzz("select");
              }}
            >
              <Link to={`/equipos/${team.slug}`}>Ver equipo</Link>
            </Button>
          </div>
        </div>

        {/* Reverso: stats grandes para comparar */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="flex h-full flex-col rounded-xl border border-border/60 bg-background p-4 text-foreground">
            <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
              {[
                team.position > 0 ? `#${team.position}` : null,
                teamCategoryLabel(team),
                sexLabel(team.sex),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {lines.map((l, i) => (
              <p key={i} className="truncate font-bold leading-tight">
                {l}
              </p>
            ))}

            <div className="mt-3 grid flex-1 grid-cols-2 gap-2">
              <BigStat value={`${team.won}–${team.lost}`} label="Récord" />
              <BigStat value={wr !== null ? `${wr}%` : "—"} label="Efectividad" />
              <BigStat
                value={team.points.toLocaleString("es-MX")}
                label="Puntos"
              />
              <BigStat
                value={setDiff > 0 ? `+${setDiff}` : String(setDiff)}
                label="Dif. sets"
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-7 shrink-0 rounded-full px-2.5 font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  buzz("select");
                }}
              >
                <Link to={`/equipos/${team.slug}`}>
                  Ver equipo
                  <ArrowUpRight className="ml-1.5 h-3.5 w-4" />
                </Link>
              </Button>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Toca para voltear
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Chip de stat sobre foto: blanco sobre negro translúcido, como en V5. */
function StatChip({ value, label }: { value: ReactNode; label: string }) {
  return (
    <span className="rounded-full bg-black/55 px-2 py-0.5 font-bold text-white">
      {value} <span className="text-xs opacity-80">{label}</span>
    </span>
  );
}

function BigStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-muted py-2">
      <span className="text-3xl leading-none font-extrabold tabular-nums">
        {value}
      </span>
      <span className="mt-1 text-xs uppercase text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
