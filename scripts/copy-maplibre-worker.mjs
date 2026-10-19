// MapLibre 6 loads its web worker from a URL the bundler does not emit; serve the installed copy from public/.
import { copyFileSync } from "node:fs";

copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre-gl-worker.mjs");
