const { Configuration, OpenAIApi } = require("openai");
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const functions = {
    GetName: function() {
      return "Jason";
    },
    GetDateTime: function() {
      return new Date().toLocaleString();
    }
  }

async function createChatCompletion(userInput, chatHistory = []) {
  chatHistory.push(
    {role: "system", "content": "You are the Polywrap Agent. Capable of interacting with any tool, service, or API that has a wrap hosted on the Polywrap Registry."},
    {role: "user", content: userInput}
  );
  
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-0613",
    messages: chatHistory,
    functions: [{
        name: "GetName",
        description: "A function to get the name of the user",
        parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "The name of the user",
              }
            }
        },
        name: "GetDateTime",
        description: "A function to get the current date and time",
        parameters: {
            type: "object",
            properties: {}
    }}],
    function_call:"auto"
  });

  let message = completion.data.choices[0].message;
  if (message.function_call) {
    console.log("-> Using a function call now");
    let functionName = message.function_call.name;
    let functionArgsString = message.function_call.arguments;
    let functionArgs = JSON.parse(functionArgsString);

    try {
        let functionResponse = functions[functionName]();
        let updatedChatHistory = [{ role: "assistant", content: String(functionResponse) }];
        console.log(functionResponse);
        chatHistory.push(...updatedChatHistory);

    } catch (error) {
        let errorMessage = String(error);
        let updatedChatHistory = [
            { role: "assistant", content: `Error: ${errorMessage}` }
        ];
        chatHistory.push(...updatedChatHistory);
    }
  } else {
    console.log("-> No function call used");
    console.log("Assistant: ", message.content) 
    chatHistory.push({ role: "assistant", content: message.content });
  }

  continueChat(chatHistory);
}

function continueChat(chatHistory) {
  readline.question('Human Feedback: ', userInput => {
    console.log(chatHistory);
    createChatCompletion(userInput, chatHistory).catch(console.error);
    
  });
}

continueChat([]);
