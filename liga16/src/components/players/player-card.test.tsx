import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { PlayerCard } from "./player-card";
import type { PlayerProfile } from "@/types";

const player = {
  id: "p1",
  user_id: "u1",
  display_name: "Jugador Demo",
  username: "demo",
  photo_url: null,
  city: "Hermosillo",
  state: "Sonora",
  country: "MX",
  birth_date: null,
  sex: "varonil",
  declared_level: 4,
  official_level: null,
  dominant_hand: "diestra",
  preferred_position: "drive",
  bio: null,
  is_public: true,
  role: "player",
} as unknown as PlayerProfile;

function card(props: { to?: string }) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <PlayerCard player={player} played={5} won={4} division="Cuarta" {...props} />
    </MemoryRouter>,
  );
}

describe("PlayerCard", () => {
  // Regresión 2026-10-31: en /jugadores las tarjetas no envolvían en <Link>
  // y el click no abría el perfil. La card con `to` debe ser un enlace real.
  it("con `to`, toda la card enlaza al perfil del jugador", () => {
    const html = card({ to: "/jugadores/p1" });
    expect(html).toContain('href="/jugadores/p1"');
    // El nombre queda dentro del enlace: el click sobre la card navega.
    expect(html).toMatch(/<a[^>]*href="\/jugadores\/p1"[^>]*>[\s\S]*Jugador Demo[\s\S]*<\/a>/);
  });

  it("sin `to`, la card es estática (comportamiento para usos no navegables)", () => {
    const html = card({});
    expect(html).not.toContain("<a");
    expect(html).toContain("Jugador Demo");
  });
});
