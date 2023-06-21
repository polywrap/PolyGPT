const { Configuration, OpenAIApi } = require("openai");
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function createChatCompletion(userInput, chatHistory = []) {
  chatHistory.push(
    {role: "system", "content": "You are the Polywrap Agent. Capable of interacting with any tool, service, or API that has a wrap hosted on the Polywrap Registry."},
    {role: "user", content: userInput}
  );
  
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-0613",
    messages: chatHistory
  });
  chatHistory.push({role: "assistant", content: completion.data.choices[0].message.content});

  console.log(completion.data.choices[0].message.content);

  continueChat(chatHistory);
}

function continueChat(chatHistory) {
  readline.question('Human Feedback: ', userInput => {
    createChatCompletion(userInput, chatHistory).catch(console.error);
  });
}

continueChat([]);
