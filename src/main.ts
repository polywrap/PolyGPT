import { Agent } from "./agent";
import { prettyPrintError } from "./utils";

(async () => {
  try {
    const agent = await Agent.createAgent();

    while (true) {
      const userInput = await agent.getUserInput();
      await agent.processUserPrompt(userInput);
      agent.saveChatHistoryToFile('chat-history.txt');
    }
  } catch (e) {
    prettyPrintError(e)
  }
})()
