import chalk from "chalk";
import { logToFile } from "./utils";
import fs from 'fs';
import { summarizerPrompt } from './prompt';
import {
  ChatCompletionRequestMessage,
  OpenAIApi
} from "openai";
import * as path from 'path';

const dir = 'worskpace';


// Check if the directory exists
if (!fs.existsSync(dir)){
  // If the directory does not exist, create it
  fs.mkdirSync(dir);
}



export async function summarizeHistory(chatInteractions: ChatCompletionRequestMessage[], agent: OpenAIApi): Promise<ChatCompletionRequestMessage> {
    try {
      let summarizationRequest: ChatCompletionRequestMessage = {
        role: "system",
        content: summarizerPrompt
      }
      const messages = [...chatInteractions, summarizationRequest];
      
      const completion = await agent.createChatCompletion({
        model: process.env.GPT_MODEL!,
        messages,
        temperature: 0,
        max_tokens: 300
      });

      // Now you can safely write the file
      fs.writeFile(path.join(dir, 'summary.md'), completion.data.choices[0].message?.content!, (err) => {
        if (err) {
            throw err;
        }
      });


      return completion.data.choices[0].message!;
    } catch (error: any) {
      const errorMessage = `Error: ${JSON.stringify(error?.response?.data, null, 2)}`;
      console.error(chalk.red('Error: '), chalk.yellow(errorMessage));
      logToFile({
        role: "system",
        content: errorMessage
      });
      throw error;
    }
}

