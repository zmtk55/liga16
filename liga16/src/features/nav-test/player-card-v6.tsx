// PlayerCardV6 — comparador con más stats y gráfica.
// Frente: foto + panel con dropdown "Comparar" (jugador o equipo), chips de
// stats y barra G/P. Click = flip y la card crece ×3 (popup grande) mostrando
// las estadísticas de los dos lados.
import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { sexShort, winRate } from "@/lib/format";
import { buzz } from "@/lib/haptics";
import { FavStar, samplePlayers, divisionFromLevel } from "./player-card";
import type { PlayerCardProps } from "./player-card";

export type CompareRival = {
  id: string;
  kind: "jugador" | "equipo";
  name: string;
  subtitle: string;
  played: number;
  won: number;
  levelLabel: string;
  position: string | null;
};

export const sampleTeams: CompareRival[] = [
  {
    id: "t1",
    kind: "equipo",
    name: "Dupla Fénix",
    subtitle: "2da · Varonil",
    played: 30,
    won: 21,
    levelLabel: "2da",
    position: null,
  },
  {
    id: "t2",
    kind: "equipo",
    name: "Los Titanes",
    subtitle: "3ra · Mixto",
    played: 24,
    won: 13,
    levelLabel: "3ra",
    position: null,
  },
];

function rivalsFor(player: PlayerCardProps["player"]): CompareRival[] {
  const players: CompareRival[] = samplePlayers
    .filter((s) => s.player.id !== player.id)
    .map((s) => {
      const lvl = s.player.official_level ?? s.player.declared_level;
      return {
        id: s.player.id,
        kind: "jugador" as const,
        name: s.player.display_name,
        subtitle: `${divisionFromLevel(lvl)} · ${sexShort(s.player.sex)}`,
        played: s.played ?? 0,
        won: s.won ?? 0,
        levelLabel: String(lvl),
        position: s.player.preferred_position,
      };
    });
  return [...players, ...sampleTeams];
}

const POSITION_LABEL: Record<string, string> = {
  drive: "Drive",
  reves: "Revés",
  both: "Ambos",
};

function posLabel(p: string | null) {
  if (!p) return "—";
  return POSITION_LABEL[p] ?? p;
}

function pct(won: number, played: number) {
  return played > 0 ? `${Math.round((won / played) * 100)}%` : "—";
}

function CmpRow({ a, label, b }: { a: string; label: string; b: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1">
      <span className="text-right text-sm leading-none font-extrabold tabular-nums">
        {a}
      </span>
      <span className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-left text-sm leading-none font-extrabold tabular-nums text-muted-foreground">
        {b}
      </span>
    </div>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md bg-black/55 px-1 py-0.5 text-center">
      <span className="block text-xs leading-tight font-bold text-white">
        {value}
      </span>
      <span className="block text-[8px] leading-tight text-white/60">
        {label}
      </span>
    </div>
  );
}

export function PlayerCardV6({ player, played, won, onOpen }: PlayerCardProps) {
  const [flipped, setFlipped] = useState(false);
  const level = player.official_level ?? player.declared_level;
  const categoria = divisionFromLevel(level);
  const wr = played && played > 0 ? winRate(played, won ?? 0) : null;
  const lost = played != null && won != null ? Math.max(played - won, 0) : null;

  const rivals = rivalsFor(player);
  const [rivalId, setRivalId] = useState(rivals[0]?.id ?? "");
  const rival =
    rivals.find((r) => r.id === rivalId) ?? rivals[0] ?? sampleTeams[0];

  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const chartA = dark ? "#fafafa" : "#18181b";
  const chartB = dark ? "#a1a1aa" : "#a1a1aa";
  const chartTick = dark ? "#a1a1aa" : "#71717a";
  const chartLabelA = dark ? "#d4d4d8" : "#3f3f46";
  const chartLabelB = dark ? "#a1a1aa" : "#71717a";

  // Popup ×3 centrado en pantalla: escala hacia el tamaño que CABE en el
  // viewport (×3 máximo). ponytail: recalcula solo al abrir; si hace falta
  // re-escalar al rotar la pantalla con el popup abierto, mover a resize listener.
  const scale = flipped
    ? Math.min(
        3,
        (window.innerWidth - 32) / 320,
        (window.innerHeight - 32) / 288,
      )
    : 1;

  const toggleFlip = () => {
    buzz("tap");
    setFlipped((f) => !f);
  };

  const backChart = [
    { n: "G", a: won ?? 0, b: rival.won },
    { n: "P", a: lost ?? 0, b: rival.played - rival.won },
  ];

  return (
    <>
    {/* Placeholder: la card sale del flujo (fixed) al voltear; evita reflow */}
    {flipped && <div aria-hidden className="h-72 w-full max-w-xs" />}
    <Card
      onClick={toggleFlip}
      className={cn(
        "group relative h-72 w-full max-w-xs overflow-hidden py-0 gap-0",
        "rounded-xl border-none bg-muted shadow-lg outline-none",
        "transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [perspective:1200px]",
        "focus-visible:ring-2 focus-visible:ring-ring",
        flipped
          ? "fixed left-1/2 top-1/2 z-50 shadow-[0_30px_80px_rgba(0,0,0,0.6)] ring-2 ring-foreground/40"
          : "hover:-translate-y-1 hover:shadow-xl active:scale-[0.985]",
      )}
      style={flipped ? { transform: `translate(-50%, -50%) scale(${scale})` } : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          toggleFlip();
        }
      }}
    >
      <div
        className={cn(
          "relative h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] [transform-style:preserve-3d]",
          flipped && "[transform:rotateY(180deg)]",
        )}
      >
        {/* Frente: foto + panel con comparador */}
        <div className="absolute inset-0 flex flex-col [backface-visibility:hidden]">
          <img
            src={player.photo_url ?? undefined}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
            alt={player.display_name}
            className={cn(
              "absolute inset-0 h-full w-full object-cover object-center",
              "transition-transform duration-500",
              "group-hover:scale-105",
            )}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-background/28" />

          <button
            type="button"
            aria-label="Jugador verificado"
            title="Jugador verificado"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 z-20 rounded-full bg-black/45 p-1.5 text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ShieldCheck className="h-4 w-4" />
          </button>
          <FavStar className="absolute top-3 left-3 z-20" />

          {/* Panel compacto (face-safe): no tapa la cara */}
          <div className="absolute inset-x-0 bottom-0 z-10 m-2 rounded-xl border border-foreground/15 bg-background/75 p-2 text-foreground backdrop-blur-md dark:bg-background/45">
            <p className="truncate text-[13px] font-bold text-foreground">
              {player.display_name}
            </p>
            <p className="truncate text-xs text-foreground/80">
              {categoria} · {sexShort(player.sex)} · Nivel {level}
            </p>

            {/* Comparar: jugador o equipo */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <Select
                value={rivalId}
                onValueChange={(v) => {
                  buzz("select");
                  setRivalId(v);
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="h-6 flex-1 rounded-full border-white/20 bg-black/40 text-xs text-white hover:bg-black/55"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-white/60">Comparar</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-w-[240px]">
                  <SelectGroup>
                    <SelectLabel>Jugadores</SelectLabel>
                    {rivals
                      .filter((r) => r.kind === "jugador")
                      .map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Equipos</SelectLabel>
                    {rivals
                      .filter((r) => r.kind === "equipo")
                      .map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="h-6 w-6 shrink-0 rounded-full p-0 text-foreground hover:bg-foreground/10 hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpen) {
                    buzz("select");
                    onOpen(player);
                  }
                }}
              >
                <Link
                  to={`/jugadores/${player.id}`}
                  onClick={() => buzz("select")}
                  aria-label="Ver perfil"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {/* Stats completas:4 celdas valor/etiqueta */}
            <div className="mt-1.5 grid grid-cols-4 gap-1">
              <StatCell
                value={wr !== null ? `${wr}%` : "—"}
                label="Victorias"
              />
              <StatCell value={String(played ?? "—")} label="PJ" />
              <StatCell value={String(won ?? "—")} label="G" />
              <StatCell value={String(lost ?? "—")} label="P" />
            </div>

            {/* Gráfica G/P: barra apilada siempre visible */}
            <div className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-foreground">
              <span>G {won ?? "—"}</span>
              <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-foreground/15">
                <div
                  className="bg-foreground"
                  style={{ flexGrow: Math.max(won ?? 0, 0) }}
                />
                <div
                  className="bg-zinc-500"
                  style={{ flexGrow: Math.max(lost ?? 0, 0) }}
                />
              </div>
              <span className="text-muted-foreground">P {lost ?? "—"}</span>
            </div>
          </div>
        </div>

        {/* Reverso ×3: stats de los dos */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="flex h-full flex-col rounded-xl border border-border/60 bg-background p-3 text-foreground">
            <p className="truncate text-center text-xs font-bold">
              {player.display_name}{" "}
              <span className="text-muted-foreground">vs</span>{" "}
              <span className="text-muted-foreground">{rival.name}</span>
            </p>
            <p className="truncate text-center text-xs text-muted-foreground">
              {rival.subtitle}
            </p>

            <div className="mt-2 flex flex-1 flex-col justify-around divide-y divide-border/40">
              <CmpRow
                a={pct(won ?? 0, played ?? 0)}
                label="% Victorias"
                b={pct(rival.won, rival.played)}
              />
              <CmpRow
                a={String(played ?? "—")}
                label="Partidos"
                b={String(rival.played)}
              />
              <CmpRow a={String(won ?? "—")} label="Ganados" b={String(rival.won)} />
              <CmpRow
                a={String(lost ?? "—")}
                label="Perdidos"
                b={String(rival.played - rival.won)}
              />
              <CmpRow a={String(level)} label="Nivel/Cat" b={rival.levelLabel} />
              <CmpRow
                a={posLabel(player.preferred_position)}
                label="Posición"
                b={posLabel(rival.position)}
              />
            </div>

            <div className="mt-2 h-[64px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={backChart}
                  margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="n"
                    tick={{ fontSize: 9, fill: chartTick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide domain={[0, "dataMax"]} />
                  <Bar dataKey="a" fill={chartA} radius={[3, 3, 0, 0]}>
                    <LabelList
                      dataKey="a"
                      position="top"
                      style={{ fontSize: 8, fill: chartLabelA }}
                    />
                  </Bar>
                  <Bar dataKey="b" fill={chartB} radius={[3, 3, 0, 0]}>
                    <LabelList
                      dataKey="b"
                      position="top"
                      style={{ fontSize: 8, fill: chartLabelB }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-center text-xs tracking-wide text-muted-foreground uppercase">
              Toca para cerrar
            </p>
          </div>
        </div>
      </div>
    </Card>
    {flipped &&
      createPortal(
        <div
          aria-hidden
          onClick={toggleFlip}
          className="fixed inset-0 z-40 animate-in fade-in duration-300 bg-black/70"
        />,
        document.body,
      )}
    </>
  );
}

export function PlayerCardV6Demo() {
  return (
    <section className="grid gap-6 justify-items-center sm:grid-cols-2 sm:justify-items-start lg:max-w-3xl">
      {samplePlayers.map((p) => (
        <PlayerCardV6 key={p.player.id} {...p} />
      ))}
    </section>
  );
}
