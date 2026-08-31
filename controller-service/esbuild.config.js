import esbuild from "esbuild";

const buildOptions = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: "dist/index.js",
  sourcemap: false,
  external: [],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  minify: true,
  keepNames: false,
  logLevel: "info",
};

// Build function
async function build() {
  try {
    await esbuild.build(buildOptions);
    console.log("Build completed successfully");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

// Run build if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  build();
}

export { buildOptions, build };
