// typings.d.ts
declare module "figlet" {
    export default function figlet(txt: string, cb: (error: Error | null, result?: string) => void): void;
  }
  