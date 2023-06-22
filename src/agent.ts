import { ChatCompletionRequestMessageRoleEnum, Configuration, OpenAIApi } from "openai";
import { InvokeOptions, PolywrapClient } from "@polywrap/client-js";

interface ChatHistoryEntry {
  role: ChatCompletionRequestMessageRoleEnum;
  content: string
}

const readline = require('linebyline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const URI_ALLOWLIST = [    
  "ens/wraps.eth:ens-text-record-uri-resolver-ext@1.0.0",
  "ens/wraps.eth:logger@1.0.0",
  "ens/wraps.eth:uniswap-v3@1.0.0",
]

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const client = new PolywrapClient();

const functions: Record<string, any> = {
    GetToolLibrary: () => new Date().toLocaleString(),
    GetFunctionsfromTool: async () => {
        const resolutionResult = await client.invoke({ uri: "ens/wraps.eth:ens-text-record-uri-resolver-ext@1.0.0", method: "tryResolveUri", args: { authority: "ens", path: "uniswap.wraps.eth:v3" }});
        console.log(resolutionResult.ok ? resolutionResult.value : resolutionResult.error);
    },
    InvokeWrap: (options: InvokeOptions) => {
        console.log("Invoking wrap")
        console.log(options)
        client.invoke(options).then(console.log)
        console.log("Invoked wrap")

    }
};

const functions_description = [
    { name: "GetToolLibrary", description: "A function to get the current date and time", parameters: {type: "object", properties: {}}},
    { name: "GetFunctionsfromTool", description: "A function to log something in the CLI, like a console log or print", parameters: {type: "object", properties: { }}},
    { name: "InvokeWrap", description: "A function to get the ENS record", parameters: {type: "object", properties: {options: {type: "object", properties: {uri: {type: "string"}, method: {type: "string"}}}, required: ["uri", "method"]}}}
];

async function createChatCompletion(userInput: string, chatHistory: ChatHistoryEntry[] = []) {
  chatHistory.push(
    {role: "system", content: "You are the Polywrap Agent. Capable of interacting with any tool, service, or API that has a wrap hosted on the Polywrap Registry."},
    {role: "user", content: userInput}
  );
  
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-0613",
    messages: chatHistory,
    functions: functions_description,
    function_call:"auto"
  });

  const message = completion.data.choices[0].message!;
  if (message?.function_call) {
    console.log("-> Using a function call now");
    const functionName = message.function_call.name!;
    const functionArgsString = message.function_call.arguments;
    const functionArgs = JSON.parse(functionArgsString ?? "{}");

    try {
        const functionResponse = functions[functionName]();
        console.log(functionResponse);
        chatHistory.push({ role: "assistant", content: String(functionResponse) });

    } catch (error) {
        const errorMessage = String(error);
        chatHistory.push({ role: "assistant", content: `Error: ${errorMessage}` });
    }
  } else {
    console.log("-> No function call used");
    console.log("Assistant: ", message.content) 
    chatHistory.push({ role: "assistant", content: message.content! });
  }

  continueChat(chatHistory);
}

function continueChat(chatHistory: ChatHistoryEntry[]) {
  readline.question('Human Feedback: ', (userInput: string) => {
      createChatCompletion(userInput, chatHistory).catch( (error) => console.error(error.message));
      console.log(chatHistory);
    
  });
}

continueChat([]);
