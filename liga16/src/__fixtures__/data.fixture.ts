// DATOS SINTÉTICOS para capturas locales (torneos). Solo vite.screenshots.config.ts.
const TOURNAMENTS = [
  { id: "t-1", name: "Copa Primavera 2026", slug: "copa-primavera-2026", organizer_id: "org-1", status: "active", start_date: "2026-03-14" },
  { id: "t-2", name: "Liga Nocturna Martes", slug: "liga-nocturna-martes", organizer_id: "org-1", status: "active", start_date: "2026-04-07" },
  { id: "t-3", name: "Torneo Relámpago Mixto", slug: "torneo-relampago-mixto", organizer_id: "org-2", status: "draft", start_date: "2026-05-02" },
  { id: "t-4", name: "Copa Verano 2026", slug: "copa-verano-2026", organizer_id: null, status: "draft", start_date: "2026-06-20" },
  { id: "t-5", name: "Máster 40 Varonil", slug: "master-40-varonil", organizer_id: null, status: "active", start_date: "2026-07-11" },
];

const real: Record<string, unknown> = {
  async listTournaments() {
    await new Promise((r) => setTimeout(r, 100));
    return TOURNAMENTS;
  },
};

// El layout admin consulta otros datos (alertas, etc.): cualquier método no
// simulado responde una lista vacía en vez de tronar.
export const db = new Proxy(real, {
  get(target, prop) {
    if (prop in target) return target[prop as string];
    return async () => [];
  },
});
