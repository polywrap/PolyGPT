import { run } from "./index";

export async function cli() {
  const debugMode = process.argv.includes("--debug");
  const wipeMemory = process.argv.includes("--wipe-memory");

  await run({
    debugMode,
    wipeMemory
  });
}

if (require.main === module) {
  cli()
    .then(() => {
      process.exit();
    })
    .catch((err) => {
      console.error(err);
      process.abort();
    });
}
