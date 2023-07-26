import { Workspace } from "../sys";

import { FileSystemPlugin } from "@polywrap/file-system-plugin-js";
import {
  Module,
  Args_exists,
  Args_mkdir,
  Args_readFile,
  Args_readFileAsString,
  Args_rm,
  Args_rmdir,
  Args_writeFile,
  manifest
} from "@polywrap/file-system-plugin-js/build/wrap";
import {
  PluginFactory,
  PluginPackage
} from "@polywrap/plugin-js";

interface WorkspaceConfig {
  workspace: Workspace;
}

export class WorkspacePlugin extends Module<WorkspaceConfig> {
  private _plugin: FileSystemPlugin;

  constructor(config: WorkspaceConfig) {
    super(config);
    this._plugin = new FileSystemPlugin({});
  }

  readFile(args: Args_readFile): Promise<Uint8Array> {
    args.path = this.config.workspace.toWorkspacePath(args.path);
    return this._plugin.readFile(args);
  }

  readFileAsString(args: Args_readFileAsString): Promise<string> {
    args.path = this.config.workspace.toWorkspacePath(args.path);
    return this._plugin.readFileAsString(args);
  }

  exists(args: Args_exists): Promise<boolean> {
    args.path = this.config.workspace.toWorkspacePath(args.path);
    return this._plugin.exists(args);
  }

  writeFile(args: Args_writeFile): Promise<boolean | null> {
    args.path = this.config.workspace.toWorkspacePath(args.path);
    return this._plugin.writeFile(args);
  }

  mkdir(args: Args_mkdir): Promise<boolean | null> {
    args.path = this.config.workspace.toWorkspacePath(args.path);
    return this._plugin.mkdir(args);
  }

  rm(args: Args_rm): Promise<boolean | null> {
    args.path = this.config.workspace.toWorkspacePath(args.path);
    return this._plugin.rm(args);
  }

  rmdir(args: Args_rmdir): Promise<boolean | null> {
    args.path = this.config.workspace.toWorkspacePath(args.path);
    return this._plugin.rmdir(args);
  }
}

export const workspacePlugin = (workspace: Workspace): PluginFactory<{}> => {
  return () =>
    new PluginPackage(
      new WorkspacePlugin({ workspace }) as any,
      manifest
    );
}
