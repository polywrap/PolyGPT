import {
  Agent
} from "./index";

export async function cli(): Promise<void> {
  const agent = await Agent.create();
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
