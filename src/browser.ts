import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { Browser, Page } from 'puppeteer';
import { Timeouts } from './util/timeouts.js';
import { goToSleep } from './util/utils.js';

export interface BrowserInterface {
    newPage(): Promise<PageInterface>;
    pages(): Array<PageInterface>;
    close(): Promise<void>;
}

export interface PageInterface {
    url(): string;
    goto(url: string, timeoutMillis: number): Promise<number>;
    getRawContent(url: string, timeoutMillis: number): Promise<string>;
    waitForSelector(id: string, timeoutMillis: number): Promise<void>;
    waitForSelectorVisible(id: string, timeoutMillis: number): Promise<void>;
    waitForTimeout(timeoutMillis: number): Promise<void>;
    waitForNavigation(timeoutMillis: number): Promise<void>;
    selectFile(fileSelectorId: string, fileToSelect: string, timeoutMillis: number): Promise<void>;
    click(id: string, timeoutMillis: number): Promise<void>;
    hover(id: string, timeoutMillis: number): Promise<void>;
    tap(id: string, timeoutMillis: number): Promise<void>;
    type(id: string, text: string, timeoutMillis: number): Promise<void>;
    focus(id: string, timeoutMillis: number): Promise<void>;
    bringToFront(): Promise<void>;
    select(id: string, value: string, timeoutMillis: number): Promise<void>;
    evalValue(id: string, fun: (x: HTMLElement) => string, timeoutMillis: number): Promise<string>;
    updateValue(id: string, value: string): Promise<void>;
    clearTextField(id: string, timeoutMillis: number, numLines: number): Promise<void>;
    close(): Promise<void>;
    hasElement(id: string, timeoutMillis: number): Promise<boolean>;
}

export class PuppeteerBrowser implements BrowserInterface {
    private _browser: Browser;
    private _pages = new Array<PageInterface>();

    constructor(browser: Browser) {
        this._browser = browser;
    }

    pages(): Array<PageInterface> {
        return this._pages;
    }

    async newPage(): Promise<PageInterface> {
        const newPage = new PuppeteerPage(await this._browser.newPage());
        this._pages.push(newPage);
        return newPage;
    }

    async close() {
        await this._browser.close();
    }

    static async create(headless: boolean, userDataDir: string): Promise<BrowserInterface> {
        return new PuppeteerBrowser(await puppeteer
            .use(StealthPlugin())
            .launch({
                headless: headless,
                defaultViewport: null,
                userDataDir: userDataDir
            }));
    }
}

export class PuppeteerPage implements PageInterface {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    url(): string {
        return this.page.url();
    }

    async waitForNavigation(timeoutMillis: number): Promise<void> {
        await this.page.waitForNavigation({ timeout: timeoutMillis });
    }

    async waitForSelector(id: string, timeoutMillis: number) {
        await this.page.waitForSelector(id, { timeout: timeoutMillis });
    }

    async waitForSelectorVisible(id: string, timeoutMillis: number) {
        await this.page.waitForSelector(id, { timeout: timeoutMillis, visible: true });
    }

    async waitForTimeout(timeoutMillis: number) {
        await goToSleep(timeoutMillis);
    }

    async selectFile(fileSelectorId: string, fileToSelect: string, timeoutMillis: number): Promise<void> {
        const futureCoverFileChooser = this.page.waitForFileChooser({ timeout: timeoutMillis })
        await this.page.click(fileSelectorId);
        const coverFileChooser = await futureCoverFileChooser;
        await coverFileChooser.accept([fileToSelect]);
    }

    async goto(url: string, timeoutMillis: number): Promise<number> {
        // console.log("Going to URL: " + url);
        const response = await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMillis });
        await goToSleep(Timeouts.SEC_1); // Just in case.
        return response.status();
    }

    async getRawContent(url: string, timeoutMillis: number): Promise<string> {
        const response = await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMillis });
        return await response.text();
    }

    async bringToFront() {
        await this.page.bringToFront();
    }

    async select(id: string, value: string, timeoutMillis: number) {
        await this.waitForSelector(id, timeoutMillis);
        await this.page.select(id, value);
    }

    async evalValue(id: string, fun: (x: HTMLElement) => string, timeoutMillis: number): Promise<string> {
        try {
            await this.waitForSelector(id, timeoutMillis);
        } catch (TimeoutError) {
            return '';
        }
        return await this.page.$eval(id, fun) || "";
    }

    async focus(id: string, timeoutMillis: number) {
        await this.waitForSelector(id, timeoutMillis);
        await this.page.focus(id);
    }

    async click(id: string, timeoutMillis: number) {
        await this.waitForSelector(id, timeoutMillis);
        console.log("Clicking at id = " + id);
        await this.page.click(id);
    }

    async hover(id: string, timeoutMillis: number) {
        await this.waitForSelector(id, timeoutMillis);
        await this.page.hover(id);
    }

    async tap(id: string, timeoutMillis: number) {
        await this.waitForSelector(id, timeoutMillis);
        await this.page.tap(id);
    }

    async type(id: string, text: string, timeoutMillis: number) {
        await this.waitForSelector(id, timeoutMillis);
        await this.page.type(id, text);
    }

    async clearTextField(id: string, timeoutMillis: number, numLinesToRemove: number = 1) {
        await this.waitForSelector(id, timeoutMillis);
        await this.page.focus(id);
        // Ideally we just click Control-A (or Meta-A on Mac) to select all,
        // but this does not wait on IOS. So instead a triple click selects 
        // a line so we can delete it. 
        if (numLinesToRemove <= 0) {
            numLinesToRemove = 1
        } 
        for (let i = 0; i < numLinesToRemove; i++) {
            await this.page.click(id, { clickCount: 3 });
            await this.page.keyboard.press('Backspace');
        }
        await goToSleep(Timeouts.SEC_1);
    }

    async updateValue(id: string, value: string) {
        await this.page.$eval(id, (el: HTMLInputElement, value: string) => {
            if (el) {
                el.value = value;
            } else {
                throw Error('Could not update ' + id);
            }
        }, value);
    }

    async close() {
        await this.page.close();
    }

    async hasElement(id: string, timeoutMillis: number): Promise<boolean> {
        try {
            await this.waitForSelector(id, timeoutMillis);
            return true;
        } catch (e) {
            return false;
        }
    }
}
