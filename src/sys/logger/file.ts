import { ILogger } from "./";
import { Message } from "../../chat";

import fs from "fs";
import path from "path";

export class FileLogger implements ILogger {
  constructor(
    private _filePath: string
  ) {
    // Make the log directory if it doesn't exist
    const logDir = path.dirname(this._filePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Delete the file if it exists
    if (fs.existsSync(this._filePath)) {
      fs.rmSync(this._filePath);
    }
  }

  info(info: string): void {
    fs.appendFileSync(this._filePath, info);
  }

  message(msg: Message): void {
    const roleUpper = msg.role[0].toUpperCase() + (
      msg.role.length > 1 ? msg.role.substring(1) : ""
    );

    this.info(`**${roleUpper}**: ${msg.content}\n`);
  }

  action(msg: Message): void {
    this.message(msg);
  }

  notice(msg: string): void {
    this.info(msg);
  }

  success(msg: string): void {
    this.info(msg);
  }

  error(msg: string): void {
    this.info(msg);
  }
}
