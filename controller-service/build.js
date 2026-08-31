import { writeFileSync, mkdirSync, existsSync } from "fs";
import { build } from "./esbuild.config.js";

console.log("Starting esbuild bundling...");

if (!existsSync("dist")) {
  mkdirSync("dist");
}

// Write a minimal package.json for Lambda so Node treats .js as CommonJS (no "type": "module")
writeFileSync(
  "dist/package.json",
  JSON.stringify(
    { name: "scraper-controller-lambda", type: "commonjs" },
    null,
    0,
  ),
);

await build();

console.log("Build completed successfully!");
console.log("Output: dist/index.js");
