import { Agent } from "./agent";

export * from "./agent";

interface RunOptions {
  debugMode?: boolean;
  wipeMemory?: boolean;
}

export async function run(options: RunOptions = {}) {
  const agent = await Agent.createAgent({
    debugMode: options.debugMode
  });
  await agent.run();
}
