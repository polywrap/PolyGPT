import { Workspace } from "../sys";

import {
  FileSystemPlugin
} from "@polywrap/file-system-plugin-js";
import {
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

export class WorkspacePlugin extends FileSystemPlugin {
  constructor(
    private _workspace: Workspace
  ) {
    super({});
  }

  readFile(args: Args_readFile): Promise<Uint8Array> {
    args.path = this._workspace.toWorkspacePath(args.path);
    return super.readFile(args);
  }

  readFileAsString(args: Args_readFileAsString): Promise<string> {
    args.path = this._workspace.toWorkspacePath(args.path);
    return super.readFileAsString(args);
  }

  exists(args: Args_exists): Promise<boolean> {
    args.path = this._workspace.toWorkspacePath(args.path);
    return super.exists(args);
  }

  writeFile(args: Args_writeFile): Promise<boolean | null> {
    args.path = this._workspace.toWorkspacePath(args.path);
    return super.writeFile(args);
  }

  mkdir(args: Args_mkdir): Promise<boolean | null> {
    args.path = this._workspace.toWorkspacePath(args.path);
    return super.mkdir(args);
  }

  rm(args: Args_rm): Promise<boolean | null> {
    args.path = this._workspace.toWorkspacePath(args.path);
    return super.rm(args);
  }

  rmdir(args: Args_rmdir): Promise<boolean | null> {
    args.path = this._workspace.toWorkspacePath(args.path);
    return super.rmdir(args);
  }
}

export const workspacePlugin = (workspace: Workspace): PluginFactory<{}> => {
  return () =>
    new PluginPackage(
      new WorkspacePlugin(workspace),
      manifest
    );
}
