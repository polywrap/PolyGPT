import axios from "axios";

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

      const response = await axios.get<Index>(
        `${this.url}/index.json`
      );
      this._index = response.data;
      return this._index;
    }

    async getWrap(name: string): Promise<Wrap> {
      if (this._wraps[name]) {
        return this._wraps[name];
      }

      const response = await axios.get<WrapData>(`${this.url}/${name}.json`);
      const wrapInfo = response.data;

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
