import { InvokeOptions, PolywrapClient } from "@polywrap/client-js";
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
    parameters: { type: "object", properties: {} },
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
  GetWrapLibrary: async (_: PolywrapClient, wrapName: string) => {
    const wrapMappings: Record<string, string[]> = {
      ipfs: ["wrap/ipfs"],
      http: ["wrap/http"],
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
  GetFunctionsfromWrap: async (client: PolywrapClient, wrapUri: string) => {
    const resolutionResult = await client.invoke({
      uri: "ens/wraps.eth:ens-text-record-uri-resolver-ext@1.0.0",
      method: "tryResolveUri",
      args: { authority: "ens", path: "uniswap.wraps.eth:v3" },
    });

    return resolutionResult.ok
      ? {
        ok: true,
        result: resolutionResult.value,
      }
      : {
        ok: false,
        error: resolutionResult.error?.toString() ?? "",
      };
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
  private _client = new PolywrapClient();
  private _chatHistory: ChatHistoryEntry[] = [];

  promptForUserInput() {
    readline.question("Human feedback: ", async (userInput: string) => {
      try {
        const response = await this.sendMessageToAgent(userInput);
        const proposedFunction = this.processAgentResponse(response!);

        if (proposedFunction) {
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
      console.log(this._chatHistory);
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

const agent = new Agent();
agent.promptForUserInput();
