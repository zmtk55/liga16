/**
 * Proxy de JEV (TypeSafe System One) para producción.
 *
 * El navegador no puede llamar a `api.typesafe.ai` (no envía cabeceras CORS),
 * y la llave no debe viajar en el bundle. Esta función recibe el mismo cuerpo
 * que armaría el cliente, lo firma con la llave del servidor y devuelve la
 * respuesta tal cual.
 *
 * Variables: TYPESAFE_API_KEY (recomendada) o VITE_JEV_API_KEY.
 */
export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const key = process.env.TYPESAFE_API_KEY ?? process.env.VITE_JEV_API_KEY;
  if (!key) {
    return Response.json(
      { error: "Falta TYPESAFE_API_KEY en el proyecto de Vercel" },
      { status: 500 },
    );
  }

  try {
    const body = await req.text();
    const upstream = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body,
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
