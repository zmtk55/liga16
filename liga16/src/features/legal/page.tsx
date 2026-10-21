import type { ReactNode } from "react";
import { Link } from "react-router";

/**
 * Páginas legales mínimas y honestas. No es boilerplate de relleno: cada
 * texto dice qué es la liga, qué datos guarda y a quién pedirle las cosas.
 * El footer enlaza a estas rutas, así que un "Términos" que no dice nada
 * sería igual de muerto que un link sin destino.
 */

type LegalSection = { title: string; body: ReactNode };

const PRIVACIDAD: LegalSection[] = [
  {
    title: "Qué guardamos",
    body: (
      <>
        <p>
          Liga16 guarda la información que registras para participar: nombre, correo
          electrónico, teléfono (opcional) y la información de juego que se genera al
          registrarte en un torneo: parejas, categorías, resultados, historial de
          partidos y posición en el ranking.
        </p>
        <p>
          No vendemos ni compartimos tus datos con terceros con fines comerciales. Los
          datos públicos de una pareja (nombre de los jugadores, estadísticas y
          posición en el ranking) se muestran en el sitio porque son parte de la
          competencia.
        </p>
      </>
    ),
  },
  {
    title: "Para qué los usamos",
    body: (
      <p>
        Para administrar el circuito: organizar torneos, publicar la agenda, calcular
        posiciones y mostrarlas. También para avisarte de confirmaciones, cambios de
        horario y resultados por correo.
      </p>
    ),
  },
  {
    title: "Tus derechos",
    body: (
      <p>
        Puedes pedir una copia de tus datos o que los eliminemos. Escríbenos a
        <a className="font-semibold text-primary underline-offset-4 hover:underline" href="mailto:admin@liga16.mx">
          admin@liga16.mx
        </a>{" "}
        o usa la página de{" "}
        <Link className="font-semibold text-primary underline-offset-4 hover:underline" to="/cuenta/eliminar">
          eliminar mi cuenta
        </Link>
        .
      </p>
    ),
  },
];

const TERMINOS: LegalSection[] = [
  {
    title: "Sobre la liga",
    body: (
      <p>
        Liga16 es el circuito de pádel de Caborca. Publica torneos, agenda, resultados y
        ranking de las parejas inscritas. La operación de las canchas, la Sede y el
        cobro de inscripciones corresponde a la organización de la liga, que los
        publica en la página de cada torneo.
      </p>
    ),
  },
  {
    title: "Inscripciones y pagos",
    body: (
      <p>
        El precio de inscripción y las fechas límite se muestran en cada torneo. Al
        registrarte en un torneo aceptas pagar la inscripción correspondiente. Si
        cancelas antes del cierre, el reembolso sigue la política que publica el
        organizador en el torneo; si no hay una política publicada, se reembolsa el
        importe de la inscripción menos los anticipos no reembolsables, si los hay.
      </p>
    ),
  },
  {
    title: "Reglas de juego",
    body: (
      <p>
        Cada torneo publica su reglamento (modalidad, formato, criterios de desempate y
        Shader de advancing). Los resultados cargados por el organizador son la fuente
        de verdad del ranking: si un resultado se carga mal, escríbenos y lo
        corregimos.
      </p>
    ),
  },
  {
    title: "Ranking y posiciones",
    body: (
      <p>
        Las posiciones se calculan por puntos, con desempate por diferencia de sets y
        después por partidos jugados. Las parejas empatadas comparten posición y se
        muestra el criterio aplicado en la tabla del ranking.
      </p>
    ),
  },
];

const SOPORTE: LegalSection[] = [
  {
    title: "Dudas sobre un torneo",
    body: (
      <p>
        Horarios, canchas, formato de inscripción y cambios de sede se anuncian en la
        agenda y en la ficha del torneo. Si algo no coincide con lo que viste ahí,
        escríbenos con el nombre del torneo y el partido.
      </p>
    ),
  },
  {
    title: "Problemas con tu cuenta o tus datos",
    body: (
      <p>
        Correo:{" "}
        <a className="font-semibold text-primary underline-offset-4 hover:underline" href="mailto:admin@liga16.mx">
          admin@liga16.mx
        </a>
        . Respondemos en horario de oficina de Caborca. Para retirar tus datos, usa{" "}
        <Link className="font-semibold text-primary underline-offset-4 hover:underline" to="/cuenta/eliminar">
          eliminar mi cuenta
        </Link>
        .
      </p>
    ),
  },
  {
    title: "Lo que no podemos hacer",
    body: (
      <p>
        No guardamos video ni capturas de las canchas, y no publicamos el detalle de
        contact de las parejas salvo que la pareja lo pida explícitamente. Todo lo que
        ves en el ranking es información de competencia, no información personal.
      </p>
    ),
  },
];

const ELIMINAR: LegalSection[] = [
  {
    title: "Qué pasa cuando pides eliminar tu cuenta",
    body: (
      <p>
        Se elimina tu cuenta de la liga: tu perfil, tus datos de contacto y tu
        historial de tournaments. Lo que ya fue público y forma parte del ranking
        (nombre de la pareja, resultados, puntos) se queda, porque son datos de
        competencia y no se pueden borrar sin reescribir la historia del torneo.
      </p>
    ),
  },
  {
    title: "Cómo pedirlo",
    body: (
      <>
        <p>
          Escríbenos a{" "}
          <a className="font-semibold text-primary underline-offset-4 hover:underline" href="mailto:admin@liga16.mx">
            admin@liga16.mx
          </a>{" "}
          desde el correo con el que te registraste, con el asunto{" "}
          <span className="font-mono text-sm">Solicitud de eliminación de cuenta</span>{" "}
          y tu nombre de jugador. Respondemos para confirmar la solicitud antes de
          borrarla.
        </p>
        <p>
          Si tienes parejas inscritas en un torneo en curso, la baja no cancela tu
          inscripción: avisa al organizador del torneo para que reasigne o libere el
          lugar.
        </p>
      </>
    ),
  },
];

const PAGES: Record<string, { title: string; intro: string; sections: LegalSection[] }> = {
  privacidad: {
    title: "Aviso de Privacidad",
    intro:
      "Qué datos guarda Liga16, para qué los usa y cómo pides que los borren. Versión vigente desde el 21 de octubre de 2026.",
    sections: PRIVACIDAD,
  },
  terminos: {
    title: "Términos y Condiciones",
    intro:
      "Las reglas del circuito: inscripciones, pagos, reglamento de cada torneo y cómo se calcula el ranking.",
    sections: TERMINOS,
  },
  soporte: {
    title: "Soporte y ayuda",
    intro:
      "Dónde escribir cuando algo no cuadra: horarios, cuentas, resultados o datos personales.",
    sections: SOPORTE,
  },
  eliminar: {
    title: "Eliminar mi cuenta",
    intro:
      "Cómo pedir la baja de tus datos y qué se conserva como historial de competencia.",
    sections: ELIMINAR,
  },
};

/** Un solo componente sirve a las cuatro rutas legales: cambian el contenido, no
 *  la estructura. Cada ruta legal declara su propio slug. */
export default function LegalPage({ slug }: { slug: string }) {
  const page = PAGES[slug];
  if (!page) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <p className="text-caption uppercase tracking-widest text-muted-foreground">
          Liga16
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight md:text-4xl">
          {page.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{page.intro}</p>
      </header>

      <div className="space-y-6">
        {page.sections.map((section) => (
          <section key={section.title} className="rounded-lg border bg-card p-5">
            <h2 className="font-headline text-lg font-bold">{section.title}</h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm">
        <Link
          to="/"
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          Volver al inicio
        </Link>
      </p>
    </div>
  );
}
