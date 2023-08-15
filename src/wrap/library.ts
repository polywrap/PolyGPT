import axios from "axios";
import fs from "fs";
import path from "path";
import { isFileSystemUri } from "../utils/isFileSystemUri";

export namespace WrapLibrary {
  interface Index {
    wraps: string[];
  }

  interface WrapData {
    aliases: string[];
    description: string;
    uri: string;
    abi: string;
    repo: string;
    examplePrompts: {
      prompt: string;
      result: {
        uri: string;
        method: string;
        args: Record<string, any>;
      }
    }[]
  }

  export interface Wrap extends WrapData {
    name: string;
  }

  export class Reader {
    private _index: Index | undefined = undefined;
    private _wraps: Record<string, Wrap> = {};

    constructor(
      public url: string,
      public name: string
    ) { }

    get wraps(): Record<string, Wrap> {
      return this._wraps;
    }

    async getIndex(): Promise<Index> {
      if (this._index) {
        return this._index;
      }

      this._index = isFileSystemUri(this.url)
        ? JSON.parse(fs.readFileSync(`${path.resolve(this.url.slice("file://".length))}/index.json`, "utf8")) as Index
        : (await axios.get<Index>(
          `${this.url}/index.json`
        )).data;

      return this._index;
    }

    async getWrap(name: string): Promise<Wrap> {
      if (this._wraps[name]) {
        return this._wraps[name];
      }

      const wrapInfo = isFileSystemUri(this.url)
        ? JSON.parse(fs.readFileSync(`${path.resolve(this.url.slice("file://".length))}/${name}.json`, "utf8")) as WrapData
        : (await axios.get<WrapData>(
          `${this.url}/${name}.json`
        )).data;

      this._wraps[name] = {
        ...wrapInfo,
        name
      };
      return this._wraps[name];
    }

    async getWraps(names: string[]): Promise<Wrap[]> {
      return Promise.all(names.map((name) => this.getWrap(name)))
    }

    async loadWraps(): Promise<Index> {
      const index = await this.getIndex();
      await this.getWraps(index.wraps);
      return index;
    }
  }
}
