const { Configuration, OpenAIApi } = require("openai");
const { PolywrapClient } = require("@polywrap/client-js");

const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const client = new PolywrapClient();

uri_allowlist = [
  "ens/wraps.eth:ens-text-record-uri-resolver-ext@1.0.0",
  "ens/wraps.eth:logger@1.0.0",
  "ens/wraps.eth:uniswap-v3@1.0.0",
];

const functions = {
  GetToolLibrary: () => new Date().toLocaleString(),
  GetFunctionsfromTool: async () => {
    const resolutionResult = await client.invoke({
      uri: "ens/wraps.eth:ens-text-record-uri-resolver-ext@1.0.0",
      method: "tryResolveUri",
      args: { authority: "ens", path: "uniswap.wraps.eth:v3" },
    });
    console.log(
      resolutionResult.ok ? resolutionResult.value : resolutionResult.error
    );
  },
  InvokeWrap: (options) => {
    console.log("Invoking wrap");
    console.log(options);
    client.invoke(options).then(console.log);
    console.log("Invoked wrap");
  },
};

const functions_description = [
  {
    name: "GetToolLibrary",
    description: "A function to get the current date and time",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "GetFunctionsfromTool",
    description:
      "A function to log something in the CLI, like a console log or print",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "InvokeWrap",
    description: "A function to get the ENS record",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

async function createChatCompletion(userInput, chatHistory = []) {
  chatHistory.push(
    {
      role: "system",
      content:
        "You are the Polywrap Agent. Capable of interacting with any tool, service, or API that has a wrap hosted on the Polywrap Registry.",
    },
    { role: "user", content: userInput }
  );

  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-0613",
    messages: chatHistory,
    functions: functions_description,
    function_call: "auto",
  });

  let message = completion.data.choices[0].message;
  if (message.function_call) {
    console.log("-> Using a function call now");
    let functionName = message.function_call.name;
    let functionArgsString = message.function_call.arguments;
    let functionArgs = JSON.parse(functionArgsString);

    try {
      let functionResponse = functions[functionName]();
      let updatedChatHistory = [
        { role: "assistant", content: String(functionResponse) },
      ];
      console.log(functionResponse);
      chatHistory.push(...updatedChatHistory);
    } catch (error) {
      let errorMessage = String(error.message);
      let updatedChatHistory = [
        { role: "assistant", content: `Error: ${errorMessage}` },
      ];
      chatHistory.push(...updatedChatHistory);
    }
  } else {
    console.log("-> No function call used");
    console.log("Assistant: ", message.content);
    chatHistory.push({ role: "assistant", content: message.content });
  }

  continueChat(chatHistory);
}

function continueChat(chatHistory) {
  readline.question("Human Feedback: ", (userInput) => {
    createChatCompletion(userInput, chatHistory).catch((error) =>
      console.error(error.message)
    );
    console.log(chatHistory);
  });
}

continueChat([]);
