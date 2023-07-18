import { Agent } from "./agent";
import {
  prettyPrintError,
  saveChatHistoryToFile,
} from "./utils";

export async function run() {
  try {
    const agent = await Agent.createAgent();

    while (true) {
      const userInput = await agent.getUserInput();
      await agent.processUserPrompt(userInput);
      saveChatHistoryToFile(agent);
    }
  } catch (e) {
    prettyPrintError(e)
  }
}
