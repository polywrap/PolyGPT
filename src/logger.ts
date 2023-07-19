import chalk from "chalk";
import figlet from "figlet";
import { ChatCompletionRequestMessage } from "openai";
import stripAnsi from "strip-ansi";
import winston, { LogEntry } from "winston";
import clui from "clui";

export class Logger {
  protected _logDir: string = "chats";
  protected _logger: winston.Logger;
  protected _spinner: clui.Spinner = new clui.Spinner("Thinking...");

  constructor(logDir?: string) {
    if (logDir) {
      this._logDir = logDir;
    }

    // Generate a unique log file name
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
    const logFile = `${this._logDir}/chat_${formattedDate}.md`;

    // Create a file transport
    const fileTransport = new winston.transports.File({ filename: logFile });

    // Cache the old log method
    const fileTransportLog = fileTransport.log;
    const oldLog = fileTransportLog?.bind(fileTransport);

    // Override its log function to strip all ansi characters
    const logSanitizer = (...args: unknown[]) => {
      const newArgs = [];
      for (const arg of args) {
        let len = newArgs.length;

        if (typeof arg === "string") {
          newArgs.push(stripAnsi(arg));
        } else if (typeof arg === "object") {
          const entry = arg as LogEntry;
          if (entry.message && typeof entry.message == "string") {
            const newEntry = { ...entry };
            newEntry.message = stripAnsi(newEntry.message);

            // Required for hidden "Symbol(message)" property
            const sym = Object.getOwnPropertySymbols(newEntry).find(
              (v) => v.toString() === "Symbol(message)"
            );
            if (sym) {
              (newEntry as any)[sym] = newEntry.message;
            }

            newArgs.push(newEntry);
          }
        }

        if (len === newArgs.length) {
          newArgs.push(arg);
        }
      }

      if (oldLog) {
        (oldLog as any)(...newArgs);
      }
    }
    fileTransport.log = logSanitizer.bind(fileTransport);

    // Create a consoler logger
    const consoleTransport = new winston.transports.Console();

    // Create the logger
    this._logger = winston.createLogger({
      format: winston.format.printf(info => `${info.message}`),
      transports: [
        fileTransport,
        consoleTransport
      ],
    });
  }

  get spinner() {
    return this._spinner;
  }

  info(info: string) {
    this._logger.info(info);
  }

  error(msg: string) {
    this._logger.error(msg);
  }

  logMessage(message: ChatCompletionRequestMessage) {
    this._logger.info(`

    **${message.role.toUpperCase()}**: ${message.content}`);
  }

  logHeader() {
    const logger = this._logger;
    figlet.text("PolyGPT", {
      font: "Slant",
      horizontalLayout: "default",
      verticalLayout: "default",
      whitespaceBreak: true
    }, function(err: Error | null, data?: string) {
      if (err) {
        logger.error("Something went wrong...");
        logger.error(err);
        return;
      }
      logger.info(
`You should now be transferred to the AI agent. If it doesn't load in 10 seconds, restart the CLI application with Ctrl+C.

Once loaded, begin by giving it a goal. Right then you'll be able to ask to give you a detailed plan to achieve the goal!

To enable autopilot, type "auto -N" and press enter. N is the number of steps you want the autopilot to take. For example,
"auto -3" will make the autopilot take 3 steps. Beware this might make your runs take a long time, loop and waste more tokens than needed.

To exit the application at any time, press Ctrl+C.

For more info and support join our Discord server: https://discord.com/invite/Z5m88a5qWu

Welcome to the future!`
      );

      logger.info("```\n" + data + "\n```");
    });
  }

  prettyPrintError(error: any): void {
    this._logger.error(chalk.red("Something went wrong:"));
    if (error.response) {
      this._logger.error(chalk.yellow("Response Status:"), chalk.blueBright(error.response.status));
      this._logger.error(chalk.yellow("Response Data:"), chalk.blueBright(JSON.stringify(error.response.data, null, 2)));
    }
    if (error.request) {
      this._logger.error(chalk.yellow("Request:"), chalk.blueBright(JSON.stringify(error.request, null, 2)));
    }
    this._logger.error(chalk.yellow("Message:"), chalk.blueBright(error.message));
  }
}
