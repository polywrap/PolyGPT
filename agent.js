const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function returnName() {
    return "John";
}

async function createChatCompletion() {
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-0613",
    messages: [
      {role: "system", "content": "You are a helpful assistant."},
      {role: "user", content: "What's my name?"}
    ],
    // functions: {
    //     "name": "return_name",
    //     "description": "Use this function every time you need to know the user's name.",
    // },
    // function_call: "auto"
        
  });
  console.log(completion.data.choices[0].message);
}

createChatCompletion().catch(console.error);
