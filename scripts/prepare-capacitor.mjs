import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const publicDir = join(process.cwd(), ".output", "public");
const assetsDir = join(publicDir, "assets");
const assets = await readdir(assetsDir);
const entry = assets.find((name) => /^index-[^/]+\.js$/.test(name));
const stylesheet = assets.find((name) => /^styles-[^/]+\.css$/.test(name));

if (!entry || !stylesheet) {
  throw new Error("Não foi possível localizar os assets cliente do build.");
}

const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0f766e" />
    <link rel="icon" href="./favicon.ico" />
    <link rel="stylesheet" href="./assets/${stylesheet}" />
    <title>GasoPop</title>
  </head>
  <body>
    <script type="module" src="./assets/${entry}"></script>
  </body>
</html>
`;

await writeFile(join(publicDir, "index.html"), html);
console.log(`Entrada Capacitor criada com ${entry}`);
