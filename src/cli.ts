import { Agent } from "./";
import { integrateAgentProtocol } from "./agent-protocol";
import { Logger } from "./sys";

export async function cli(): Promise<void> {
  const logger = new Logger();
  const agent = await Agent.create({ logger });

  const goal = await logger.question(
    "Please enter your main goal: "
  );

  for await (const _ of agent.run(goal)) {
  }
}

if (require.main === module) {

  integrateAgentProtocol();

  cli()
    .then(() => {
      process.exit();
    })
    .catch((err) => {
      console.error(err);
      process.abort();
    });
}
