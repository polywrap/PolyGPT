import { InvokeOptions, PolywrapClient, PolywrapClientConfigBuilder } from "@polywrap/client-js";
import {
  ChatCompletionRequestMessageFunctionCall,
  ChatCompletionRequestMessageRoleEnum,
  ChatCompletionResponseMessage,
  Configuration,
  OpenAIApi,
} from "openai";
import dotenv from "dotenv";

dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

type Result =
  | {
    ok: true;
    result: any;
  }
  | {
    ok: false;
    error: string;
  };

interface ChatHistoryEntry {
  role: ChatCompletionRequestMessageRoleEnum;
  content: string;
}

type AgentFunction = (
  client: PolywrapClient,
  ...args: any[]
) => Promise<Result>;

const functions_description = [
  {
    name: "GetWrapLibrary",
    description: "A function to get a library of available wraps, given a wrap name",
    parameters: {
      type: "object",
      properties: {
        wrapName: {
          type: "string",
          description: "The name of the wrap to get the library for",
        },
      },
      required: ["wrapName"],
    },

  },
  {
    name: "GetFunctionsfromWrap",
    description:
      "A function to get available functions given a wrap's URI",
    parameters: {
      type: "object",
      properties: {
        uri: {
          type: "string",
          description: "The URI of the wrap"
        }
      }
    },
  },
  {
    name: "InvokeWrap",
    description: "A function to invoke or execute any wrap function, given a uri, method and optional args",
    parameters: {
      type: "object",
      properties: {
        options: {
          type: "object",
          description:
            "The options to invoke a wrap, including the URI, METHOD, ARGS, where ARGS is optional, and both Uri and Method are required",
        },
      },
      required: ["options"],
    },
  },
];

const functionsMap: Record<string, AgentFunction> = {
  GetWrapLibrary: async (_: PolywrapClient, { wrapName }: { wrapName: string }) => {
    console.log(wrapName)
    const wrapMappings: Record<string, string[]> = {
      ipfs: ["wrap/ipfs"],
      filesystem: ["wrap/fs"],
      http: ["wrap/http"],
      datetime: ["plugin/datetime@1.0.0"],
      ens: ["wrap/ens"],
      ethers: ["wrap/ethers"],
      ethereum: ["wrap/ethers"],
    };

    const keywords = wrapName.toLowerCase().split(" ");
    const matchingWraps: string[] = [];

    for (const keyword of keywords) {
      if (keyword in wrapMappings) {
        matchingWraps.push(...wrapMappings[keyword]);
      }
    }

    const uniqueWraps = Array.from(new Set(matchingWraps));
    const sortedWraps = uniqueWraps.sort();

    return {
      ok: true,
      result: sortedWraps.toString(),
    } as Result;
  },
  GetFunctionsfromWrap: async (client: PolywrapClient, { uri }: { uri: string }) => {
    const resolutionResult = await client.tryResolveUri({
      uri
    });

    if (resolutionResult.ok) {
      switch (resolutionResult.value.type) {
        case "uri": return {
          ok: false,
          error: `Resolved URI: ${resolutionResult.value.uri.toString()}`
        }
        case "wrapper": return {
          ok: true,
          result: resolutionResult.value.wrapper.getManifest().abi.moduleType?.methods?.map(m => m.name!) ?? []
        }
        case "package": {
          const manifest = await resolutionResult.value.package.getManifest()

          if (manifest.ok) {
            return {
              ok: true,
              result: manifest.value.abi.moduleType?.methods?.map(m => m.name!) ?? []
            }
          }

          return {
            ok: false,
            error: "Failed to get manifest for Wrap package"
          }
        }
      }
    }

    return {
      ok: false,
      error: "Failed to resolve wrap or package"
    }
  },
  InvokeWrap: async (client: PolywrapClient, options: InvokeOptions) => {
    console.log("Invoking wrap");
    console.log(options);

    try {
      const result = await client.invoke(options);
      return result.ok
        ? {
          ok: true,
          result: result.value,
        }
        : {
          ok: false,
          error: result.error?.toString() ?? "",
        };
    } catch (e: any) {
      return {
        ok: false,
        error: e,
      };
    }
  },
};

class Agent {
  private _openai = new OpenAIApi(configuration);
  private _client: PolywrapClient;
  private _chatHistory: ChatHistoryEntry[] = [];

  private constructor() {
    const config = new PolywrapClientConfigBuilder()
      .addBundle("web3")
      .addBundle("sys")
      .build()

    this._client = new PolywrapClient(config)
  }

  static async createAgent(): Promise<Agent> {
    console.log("Initializing agent...")
    const agent = new Agent()

    const messages: ChatHistoryEntry[] = [{
      role: "system",
      content: `Your name is PolyGPT. You have a set of wraps which are groups of functions that you can call on demand.
      First you need to call the function GetWrapLibrary, then GetFunctionFromWrap and finally InvokeWrap. GetWrapLibrary should return
      a list of unique string identifiers for each wrap possible; each string identifier will be called Uri. GetFunctionFromWrap
      will select one of the functions from the selected wrap. Finally, InvokeWrap will execute the selected function from the previous step
      and map user input to the selected function's arguments.
      You will respond with 'Acknowledged' and you will have to solve problems with your LLM knowledge`
    }, {
      role: "assistant",
      content: "Acknowledged"
    }, {
      role: "system",
      content: `You will now be transferred to your next user. They will give you an input in natural language,
      and you should use your wrap functions when needed`
    }]

    await agent._openai.createChatCompletion({
      model: "gpt-3.5-turbo-0613",
      messages,
      functions: functions_description,
      function_call: "auto",
    });

    agent._chatHistory.push(...messages);
    console.log("Agent initialized.")

    return agent
  }

  promptForUserConfirmation(proposedFunction: ChatCompletionRequestMessageFunctionCall) {
    return readline.question(
      `Do you wish to execute the following function?

    Name: ${proposedFunction.name}
    Arguments: ${proposedFunction.arguments}

    (Y/N)
  `,
      async (userInput: string) => {
        if (userInput === "Y" || userInput === "y") {
          const result = await this.executeProposedFunction(
            proposedFunction
          );
          console.log(result.content);

          return this.promptForUserInput();
        }

        this._chatHistory.push({
          role: "assistant",
          content: "Alright. Will not execute this function",
        });
        return this.promptForUserInput();
      }
    );
  }

  promptForUserInput() {
    readline.question("Human feedback: ", async (userInput: string) => {
      try {
        if (userInput === "history") {
          console.log(this._chatHistory)
          return this.promptForUserInput()
        }

        const response = await this.sendMessageToAgent(userInput);
        const proposedFunction = this.processAgentResponse(response!);

        if (proposedFunction) {
          this.promptForUserConfirmation(proposedFunction)
        } else {
          this._chatHistory.push({
            role: "assistant",
            content: response?.content!,
          });

          return this.promptForUserInput();
        }
      } catch (e) {
        console.log(e);
      }
    });
  }

  async sendMessageToAgent(
    message: string
  ): Promise<ChatCompletionResponseMessage | undefined> {
    this._chatHistory.push({ role: "user", content: message });

    const completion = await this._openai.createChatCompletion({
      model: "gpt-3.5-turbo-0613",
      messages: this._chatHistory,
      functions: functions_description,
      function_call: "auto",
    });

    return completion.data.choices[0].message;
  }

  processAgentResponse(
    response: ChatCompletionResponseMessage
  ): ChatCompletionRequestMessageFunctionCall | undefined {
    if (response.function_call) {
      return response.function_call;
    } else {
      console.log("-> No function call used");
      console.log("Assistant: ", response.content);
      this._chatHistory.push({ role: "assistant", content: response.content! });
    }
  }

  async executeProposedFunction(
    functionProposed: ChatCompletionRequestMessageFunctionCall,
    attemptsRemaining = 5
  ): Promise<ChatCompletionResponseMessage> {
    if (attemptsRemaining == 0) {
      const message: ChatHistoryEntry = {
        role: "assistant",
        content: "Sorry, couldn't process your request",
      };
      this._chatHistory.push(message);
      return message;
    }

    const functionName = functionProposed.name!;
    const functionArgs = functionProposed.arguments
      ? JSON.parse(functionProposed.arguments)
      : undefined;

    const functionResponse = await functionsMap[functionName](
      this._client,
      functionArgs
    );

    console.log(functionResponse)

    if (!functionResponse.ok) {
      console.log(
        `The last attempt was unsuccessful. This is the error message: ${functionResponse.error}. Retrying.... Attempts left: ${attemptsRemaining}`
      );
      const response = (await this.sendMessageToAgent(
        `The last attempt was unsuccessful. This is the error message: ${functionResponse.error}`
      ))!;
      const proposedFunction = this.processAgentResponse(response);

      if (proposedFunction) {
        return await this.executeProposedFunction(
          proposedFunction,
          attemptsRemaining - 1
        );
      }

      return response;
    } else {
      const message: ChatHistoryEntry = {
        role: "assistant",
        content: JSON.stringify(functionResponse.result),
      };
      this._chatHistory.push(message);
      return message;
    }
  }
}

(async () => {
  const agent = await Agent.createAgent();
  agent.promptForUserInput();
})()