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
      saveChatHistoryToFile([
        ...agent._initializationMessages,
        ...agent._loadwrapData,
        ...agent._chatInteractions
      ]);
    }
  } catch (e) {
    prettyPrintError(e)
  }
}
