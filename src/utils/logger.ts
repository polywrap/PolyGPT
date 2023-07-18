import { ChatCompletionRequestMessage } from "openai";
import winston, { Logger } from "winston";
import figlet from "figlet";
import chalk from "chalk";
import fs from 'fs';
import path from "path";

let _logDir: string = "chats";
let _logger: Logger | undefined;

function logger(): Logger {
  if (_logger) {
    return _logger;
  }

  // Generate a unique log file name
  const date = new Date();
  const formattedDate = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
  const logFile = `${_logDir}/chat_${formattedDate}.md`;

  // Create the logger
  _logger = winston.createLogger({
    format: winston.format.printf(info => `${info.message}`),
    transports: [
      new winston.transports.File({ filename: logFile }),
    ],
  });
  return _logger;
}

export function init(logDir: string) {
  _logDir = logDir;
}

/**
 * Logs a message to file.
 * @param {ChatCompletionRequestMessage} message The message to log.
 */
export const logToFile = (message: ChatCompletionRequestMessage) => {
  logger().info(`


  **${message.role.toUpperCase()}**: ${message.content}`);
};

/**
 * Logs a stylized header to the console.
 */
export const logHeader = () => {
  figlet.text('PolyGPT', {
    font: 'Slant',
    horizontalLayout: 'default',
    verticalLayout: 'default',
    whitespaceBreak: true
  }, function(err: Error | null, data?: string) {
    if (err) {
      console.log('Something went wrong...');
      console.dir(err);
      
      return;
    }
    console.log(data);
    console.log(`
    You should now be transferred to the AI agent. If it doesn't load, restart the CLI application with Ctrl+C.
    
    Once loaded, ask it to load a wrap and then to execute one of its functions! Welcome to the future!`)
    logger().info('```\n' + data + '\n```');
  });
};

/**
 * Prints an error in a pretty format.
 * @param {any} error The error to print.
 */
export function prettyPrintError(error: any): void {
  console.error(chalk.red('Something went wrong:'));
  if (error.response) {
    console.error(chalk.yellow('Response Status:'), chalk.blueBright(error.response.status));
    console.error(chalk.yellow('Response Data:'), chalk.blueBright(JSON.stringify(error.response.data, null, 2)));
  }
  if (error.request) {
    console.error(chalk.yellow('Request:'), chalk.blueBright(JSON.stringify(error.request, null, 2)));
  }
  console.error(chalk.yellow('Message:'), chalk.blueBright(error.message));
}

/**
 * Saves the chat history to a file.
 * @param {Agent} agent The agent whose chat history is to be saved.
 */
export function saveChatHistoryToFile(chatHistory: ChatCompletionRequestMessage[]) {
  const chatHistoryStr = chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n');
  fs.writeFileSync(path.join(dirPath, 'chat-history.txt'), chatHistoryStr, 'utf-8');
}

// TODO: look at this later
// Define the directory path
const dirPath = path.join(__dirname, '..', '..', 'workspace');

// Check if the directory exists
if (!fs.existsSync(dirPath)){
    // If the directory does not exist, create it
    fs.mkdirSync(dirPath, { recursive: true });
}
