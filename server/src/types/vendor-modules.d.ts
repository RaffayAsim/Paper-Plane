declare module "nodemailer" {
  const nodemailer: {
    createTransport(options: unknown): {
      sendMail(input: unknown): Promise<{ messageId?: string }>;
      verify?(): Promise<unknown>;
    };
  };

  export default nodemailer;
}

declare module "ioredis" {
  export class Redis {
    constructor(url: string, options?: unknown);
    call(...args: string[]): Promise<unknown>;
    ping(): Promise<string>;
  }

  export default Redis;
}

declare module "node-cron" {
  export type ScheduledTask = {
    start(): void;
    stop(): void;
    destroy?(): void;
  };

  const cron: {
    schedule(expression: string, task: () => void | Promise<void>, options?: unknown): ScheduledTask;
  };

  export default cron;
}

declare module "axios" {
  const axios: {
    get(url: string): Promise<{ data: string }>;
  };

  export default axios;
}

declare module "puppeteer" {
  export type ElementHandle = {
    click(): Promise<void>;
    evaluate<T>(pageFunction: (element: unknown) => T | Promise<T>): Promise<T>;
  };

  export type Page = {
    waitForSelector(selector: string, options?: unknown): Promise<ElementHandle | null>;
    waitForFunction(pageFunction: (...args: never[]) => unknown, options?: unknown): Promise<unknown>;
    evaluate<T>(pageFunction: (...args: never[]) => T | Promise<T>, ...args: unknown[]): Promise<T>;
    authenticate(credentials: { username: string; password: string }): Promise<void>;
    setUserAgent(userAgent: string): Promise<void>;
    goto(url: string, options?: unknown): Promise<void>;
    waitForNavigation(options?: unknown): Promise<void>;
    $$(selector: string): Promise<ElementHandle[]>;
    content(): Promise<string>;
    title(): Promise<string>;
    url(): string;
    close(): Promise<void>;
  };

  export type Browser = {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  };

  const puppeteer: {
    launch(options?: unknown): Promise<Browser>;
  };

  export default puppeteer;
}

declare module "cloakbrowser/puppeteer" {
  export type Browser = {
    newPage(): Promise<import("puppeteer").Page>;
    close(): Promise<void>;
  };

  export function launch(options?: unknown): Promise<Browser>;
}
