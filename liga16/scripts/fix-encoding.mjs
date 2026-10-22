// Invierte el mojibake: PowerShell leyó UTF-8 como Windows-1252 y lo
// reescribió como UTF-8. Cada carácter del archivo actual corresponde a UN
// byte CP1252 del archivo original, que era UTF-8. Se reconstruye byte a byte.
import fs from "node:fs";

const dec = new TextDecoder("windows-1252");
const map = new Map();
for (let b = 0; b < 256; b++) {
  const s = dec.decode(new Uint8Array([b]));
  if (s !== "\uFFFD" && !map.has(s)) map.set(s, b);
}

for (const p of process.argv.slice(2)) {
  const raw = fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
  let latin = "";
  let unknown = 0;
  for (const ch of raw) {
    if (map.has(ch)) latin += String.fromCharCode(map.get(ch));
    else if (ch.codePointAt(0) < 256) latin += ch;
    else unknown++;
  }
  if (unknown) {
    console.error(`${p}: ${unknown} caracter(es) fuera de CP1252, no se toca`);
    continue;
  }
  fs.writeFileSync(p, Buffer.from(latin, "latin1"));
  console.log(`${p}: ok`);
}
