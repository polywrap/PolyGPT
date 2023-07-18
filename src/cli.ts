import { Agent } from "./agent";

export async function run() {
  const agent = await Agent.createAgent();
  await agent.run();
}
