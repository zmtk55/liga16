import re

path = "liga16/src/features/home/page.tsx"
with open(path, "r", encoding="utf-8") as f:
    c = f.read()

# 1) Remove duplicate PRÓXIMO TORNEO block
start = c.find("      {/* PRÓXIMO TORNEO — póster */}")
end = c.find("      {/* PAREJAS — una sola sección.")
if start != -1 and end != -1:
    print("Removed duplicate.")
    c = c[:start] + c[end:]
else:
    print("WARNING: no duplicates found")

# 2) Insert marketing block before PAREJAS
block = (
    "\n      {/* MARKETING — 1, 2 y 10 */}\n"
    "      <section className=\"grid gap-6 md:grid-cols-3\">\n"
    "        <div className=\"rounded-2xl bg-surface-inverse p-6 text-white md:p-8\">\n"
    "          <p className=\"text-xs font-bold uppercase tracking-[0.24em] text-white/45\">Inscripción</p>\n"
    "          <h3 className=\"mt-3 font-headline text-2xl uppercase leading-none tracking-tight\">{featured ? \"Próximo torneo\" : \"Agenda\"}</h3>\n"
    "          <Button asChild size=\"lg\" className=\"mt-6 h-11 w-full rounded-none font-bold uppercase tracking-wide\">\n"
    "            <Link to=\"/torneos\">Ver torneo <ArrowRight className=\"ml-2 h-4 w-4\" /></Link>\n"
    "          </Button>\n"
    "        </div>\n"
    "        <div className=\"rounded-2xl border bg-card p-6 md:p-8\">\n"
    "          <h3 className=\"font-headline text-xl uppercase tracking-tight\">Top parejas</h3>\n"
    "          <div className=\"mt-4 text-sm text-muted-foreground\">Top 3 con puntos.</div>\n"
    "        </div>\n"
    "        <div className=\"rounded-2xl bg-primary/5 p-6 md:p-8 border border-primary/10\">\n"
    "          <h3 className=\"font-headline text-xl uppercase tracking-tight\">Alarmas de juego</h3>\n"
    "          <form onSubmit={(e) => e.preventDefault()} className=\"mt-4 flex gap-2\">\n"
    "            <input type=\"email\" placeholder=\"tu@email.com\" className=\"flex-1 rounded-none border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary\" />\n"
    "            <Button type=\"submit\" size=\"sm\" className=\"h-11 rounded-none px-4 font-bold uppercase tracking-wide\">Enviar</Button>\n"
    "          </form>\n"
    "        </div>\n"
    "      </section>\n"
    "\n"
)
marker = "      {/* PAREJAS — una sola sección."
c = c.replace(marker, block + marker)

# 3) Add subscribed state to Home
if "const [subscribed, setSubscribed]" not in c:
    c = c.replace(
        '  const [stats, setStats] = useState<HomeData | null>(null);\n',
        '  const [stats, setStats] = useState<HomeData | null>(null);\n  const [subscribed, setSubscribed] = useState(false);\n',
        1,
    )
    print("Added subscribed state.")
else:
    print("subscribed already present.")

with open(path, "w", encoding="utf-8") as f:
    f.write(c)
print("Done.")
