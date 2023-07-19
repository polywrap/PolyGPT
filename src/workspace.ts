import fs from "fs";
import path from "path";

export interface WorkspaceConfig {
  workspacePath: string;
}

const defaultConfig: WorkspaceConfig = {
  workspacePath: path.join(__dirname, "../../workspace")
};

export class Workspace {
  constructor(private _config: WorkspaceConfig = defaultConfig) {
    // Fully resolve the workspace path
    this._config.workspacePath = path.resolve(
      this._config.workspacePath
    );

    // Initialize the directory
    if (!fs.existsSync(this._config.workspacePath)) {
      fs.mkdirSync(
        this._config.workspacePath,
        { recursive: true }
      );
    }
  }

  private toWorkspacePath(subpath: string): string {
    const absPath = path.resolve(
      path.join(this._config.workspacePath, subpath)
    );

    if (absPath.indexOf(this._config.workspacePath) !== 0) {
      throw Error(
        `Path must be within workspace directory. Path: ${subpath}\n` +
        `Workspace: ${this._config.workspacePath}`
      );
    }

    return absPath;
  }

  writeFileSync(subpath: string, data: string): void {
    const absPath = this.toWorkspacePath(subpath);
    fs.writeFileSync(absPath, data);
  }
}
