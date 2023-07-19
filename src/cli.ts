import {
  Agent,
  AgentConfig
} from "./index";

export async function cli(): Promise<void> {
  const debugMode = process.argv.includes("--debug");
  const reset = process.argv.includes("--reset");

  const config: AgentConfig = {
    debugMode,
    reset
  };

  const agent = await Agent.create(config);

  await agent.run();
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
