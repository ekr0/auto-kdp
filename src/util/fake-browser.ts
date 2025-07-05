import { BrowserInterface, PageInterface } from "../browser.js";

/* istanbul ignore next */
export class OnePageFakeBrowser implements BrowserInterface {
    private page: PageInterface | null = null;
    public closed = false;
    private evalsToReturn: Array<string>;

    constructor(evalsToReturn: Array<string>) {
        this.evalsToReturn = evalsToReturn;
    }

    async newPage(): Promise<PageInterface> {
        if (this.page != null) {
            throw new Error("This browser can only handle one page");
        }
        this.page = new FakePage(this.evalsToReturn);
        return this.page;
    }

    pages(): PageInterface[] {
        return [this.page];
    }

    async close(): Promise<void> {
        if (this.closed) {
            throw new Error("Closing a closed browser");
        }
        this.closed = false;
    }
}

/* istanbul ignore next */
export class FakePage implements PageInterface {
    public url = null;
    public closed = false;
    public performedActions = new Array<string>();
    private evalsToReturn: Array<string>;
    private currentEvalIndex = 0;

    constructor(evalsToReturn: Array<string>) {
        this.evalsToReturn = evalsToReturn;
    }

    async goto(url: string, timeoutMillis: number): Promise<number> {
        this.url = url;
        this.performedActions.push("goto:" + url);
        return 200;// OK status code
    }

    async getRawContent(url: string, timeoutMillis: number): Promise<string> {
        // TODO
        return "blah";
    }

    async selectFile(fileSelectorId: string, fileToSelect: string, timeoutMillis: number): Promise<void> {
        this.performedActions.push("selectFile:" + fileToSelect);
    }

    async waitForTimeout(timeoutMillis: number) {
    }

    async waitForSelector(id: string, timeoutMillis: number) {
    }

    async waitForSelectorVisible(id: string, timeoutMillis: number) {
    }

    async waitForNavigation(timeoutMillis: number): Promise<void> {
        this.performedActions.push("nav");
    }

    async type(id: string, text: string, timeoutMillis: number) {
        this.performedActions.push("type:" + test);
    }

    async bringToFront() {
        this.performedActions.push("front");
    }

    async click(id: string, timeoutMillis: number) {
        this.performedActions.push("click");
    }

    async tap(id: string, timeoutMillis: number) {
        this.performedActions.push("tap");
    }

    async hover(id: string, timeoutMillis: number): Promise<void> {
        this.performedActions.push("hover");
    }

    async focus(id: string, timeoutMillis: number): Promise<void> {
        this.performedActions.push("focus");
    }

    async select(id: string, value: string, timeoutMillis: number): Promise<void> {
    }

    async evalValue(id: string, fun: (x: HTMLElement) => string, timeoutMillis: number): Promise<string> {
        if (this.currentEvalIndex >= this.evalsToReturn.length) {
            throw new Error("Not enough values to return");
        }
        const valueToReturn = this.evalsToReturn[this.currentEvalIndex++];
        this.performedActions.push("eval:" + valueToReturn);
        return valueToReturn;
    }

    async updateValue(id: string, value: string) {
        this.performedActions.push("update:" + value);
    }

    async clearTextField(id: string, timeoutMillis: number, numLinesToRemove: number = 1) {
        this.performedActions.push("clear");
    }

    async close() {
        this.performedActions.push("close");
        if (this.closed) {
            throw new Error("Closing a closed page");
        }
        this.closed = true;
    }

    async hasElement(id: string, timeoutMillis: number): Promise<boolean> {
        return false;
    }
}