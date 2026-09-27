// Local types for one-off capture scripts. Puppeteer is not an app dependency.
declare module "puppeteer" {
  type Shot = {
    path: string;
    type?: string;
    quality?: number;
  };

  export type Page = {
    goto: (url: string, options?: object) => Promise<unknown>;
    type: (selector: string, text: string) => Promise<unknown>;
    click: (selector: string) => Promise<unknown>;
    waitForNavigation: (options?: object) => Promise<unknown>;
    waitForSelector: (selector: string, options?: object) => Promise<unknown>;
    screenshot: (options: Shot) => Promise<unknown>;
    emulateMediaFeatures: (features: object[]) => Promise<unknown>;
    url: () => string;
    evaluate: {
      (fn: () => unknown): Promise<unknown>;
      (fn: (selector: string) => unknown, selector: string): Promise<unknown>;
    };
  };

  export type Browser = {
    newPage: () => Promise<Page>;
    close: () => Promise<void>;
  };

  type PuppeteerNode = {
    launch: (options?: object) => Promise<Browser>;
  };

  const puppeteer: PuppeteerNode;
  export default puppeteer;
}
