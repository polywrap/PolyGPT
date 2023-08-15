import { Agent, PromptType } from "./";
import { Logger } from "./sys";

export async function cli(): Promise<void> {
  let goal: string | undefined = process.argv[2];

  const logger = new Logger();
  const agent = await Agent.create({ logger, autoPilot: !!goal });

  goal = goal ?? await logger.question(
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

    switch (output.promptType) {
      case PromptType.Prompt:
        prompt = await logger.prompt(output.message);
        break;
      case PromptType.Question:
        prompt = await logger.question(output.message);
        break;
      default:
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
