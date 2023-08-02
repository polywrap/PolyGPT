import { Agent } from "./";
import { Logger } from "./sys";

export async function cli(): Promise<void> {
  const logger = new Logger();
  const agent = await Agent.create({ logger });

  const goal = await logger.question(
    "Please enter your main goal: "
  );

  let iterator = agent.run(goal);
  let prompt: string | undefined;

  while(true) {
    let result = await iterator.next(prompt);
  
    if (result.done) {
      break;
    }

    let output = result.value;

    if (output.shouldPrompt) {
      prompt = await logger.prompt(output.message);
    }
  }
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
