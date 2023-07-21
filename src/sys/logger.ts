import { Message } from "../chat";

import chalk from "chalk";
import figlet from "figlet";
import stripAnsi from "strip-ansi";
import winston, { LogEntry } from "winston";
import clui from "clui";
import * as read from "readline";

const readline = read.promises.createInterface({
  input: process.stdin,
  output: process.stdout,
});

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

  message(msg: Message) {
    this._logger.info(`**${msg.role.toUpperCase()}**: ${msg.content}`);
  }

  notice(msg: string) {
    this.info(chalk.yellow(msg));
  }

  success(msg: string) {
    this.info(chalk.green(msg));
  }

  error(msg: string, error?: unknown) {
    if (!error) {
      this._logger.error(chalk.red(msg));
      return;
    }

    let errorStr: string = "";
    let errorObj = error as Record<string, unknown>;
    if (
      typeof error === "object" &&
      errorObj.message
    ) {
      if (errorObj.response) {
        const responseObj = errorObj.response as Record<string, unknown>;
        const status = responseObj.status || "N/A";
        const data = responseObj.data || "N/A";
        errorStr += `\nResponse Status: ${status}`;
        errorStr += `\nResponse Data: ${JSON.stringify(data, null, 2)}`;
      }
      errorStr += `\nMessage: ${errorObj.message}`;
    }

    this._logger.error(chalk.red(
      `${msg}${errorStr}`
    ));
  }

  question(query: string): Promise<string> {
    return readline.question(query);
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
      logger.info("```\n" + data + "\n```");
      logger.info("Support: https://discord.polywrap.io");
    });
  }
}
