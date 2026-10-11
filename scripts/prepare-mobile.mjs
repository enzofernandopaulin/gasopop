import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const publicDir = join(process.cwd(), ".output", "public-mobile");
const nestedIndex = join(publicDir, "mobile", "index.html");
const rootIndex = join(publicDir, "index.html");
const html = await readFile(nestedIndex, "utf8");
await writeFile(rootIndex, html.replaceAll("../assets/", "./assets/"));
console.log("Entrada client-only do Capacitor normalizada.");
