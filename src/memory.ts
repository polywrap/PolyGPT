import chalk from "chalk";
import { logToFile } from "./utils";
import fs from 'fs';
import { summarizerPrompt } from './prompt';
import {
  ChatCompletionRequestMessage,
  OpenAIApi
} from "openai";
import * as path from 'path';

const dir = 'workspace'
export const memoryPath = `${dir}/summary.md`


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
    };

    // Check if the summary file exists
    if (fs.existsSync(memoryPath)) {
      const existingSummaryContent = fs.readFileSync(memoryPath, 'utf-8');
      const existingSummaryMessage: ChatCompletionRequestMessage = {
        role: "assistant",
        content: existingSummaryContent,
      };
      chatInteractions.push(existingSummaryMessage);
    }

    const messages = [...chatInteractions, summarizationRequest];

    const completion = await agent.createChatCompletion({
      model: process.env.GPT_MODEL!,
      messages,
      temperature: 0,
      max_tokens: 1000
    });

    // Update the summary file with the new summary
    fs.writeFile(memoryPath, completion.data.choices[0].message?.content!, (err) => {
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

