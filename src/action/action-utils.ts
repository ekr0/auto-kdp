import * as fs from 'fs';

import { ActionParams } from '../util/action-params.js';
import { Book } from '../book/book.js';
import { clipLen, debug, error } from '../util/utils.js';
import { BrowserInterface, PageInterface } from '../browser.js';
import { Timeouts } from '../util/timeouts.js';

export let Urls = {
    AMAZON_IMAGE_URL: 'https://images-na.ssl-images-amazon.com/images/I/',
    AMAZON_IMAGE_URL2: 'https://m.media-amazon.com/images/I/',
    AMAZON_PRODUCT_URL: 'https://www.amazon.com/dp/',
    BOOKSHELF_URL: 'https://kdp.amazon.com/en_US/bookshelf?ref_=kdp_kdp_TAC_TN_bs',
    CREATE_PAPERBACK: 'https://kdp.amazon.com/en_US/title-setup/paperback/new/details?ref_=kdp_kdp_BS_D_cr_ti',
    EDIT_PAPERBACK_CONTENT: 'https://kdp.amazon.com/en_US/title-setup/paperback/$id/content',
    EDIT_PAPERBACK_DETAILS: 'https://kdp.amazon.com/en_US/title-setup/paperback/$id/details?ref_=kdp_BS_D_ta_de',
    EDIT_PAPERBACK_PRICING: 'https://kdp.amazon.com/en_US/title-setup/paperback/$id/pricing?ref_=kdp_BS_D_ta_pr',
};

export function fileExists(path: string): boolean {
    try {
        if (fs.existsSync(path)) {
            return true;
        }
    } catch (err) {
        console.error(err);
    }
    return false;
}

export async function waitForElements(page: PageInterface, ids: string[]) {
    for (const id of ids) {
        await page.waitForSelector(id, Timeouts.SEC_1);
    }
    await page.waitForTimeout(Timeouts.SEC_1); // Just in case.
}

export async function maybeClosePage(params: ActionParams, page: PageInterface, force: boolean = false) {
    if (!params.keepOpen || force) {
        await page.close();
    } else {
        const n = numOpenTabs(params.browser);
        if (n > 20) {
            await page.close();
        } else {
            // console.log(`Not closing: have ${n} tab`);
        }
    }
}

function numOpenTabs(browser: BrowserInterface): number {
    return browser.pages().length;
}

export async function getTextFieldValue(id: string, page: PageInterface): Promise<string> {
    // debug(book, verbose, `Waiting for the text element (${id})`);
    try {
        await page.waitForSelector(id, Timeouts.SEC_2);
    } catch (TimeoutError) {
        return '';
    }

    // Read the old value.
    const oldValue = await page.evalValue(id, x => (x as HTMLInputElement).value, Timeouts.SEC_10);

    return oldValue;
}

export async function updateTextFieldIfChanged(id: string, value: string, fieldHumanName: string, page: PageInterface, book: Book, verbose: boolean): Promise<boolean> {
    // Read the old value.
    const oldValue = await page.evalValue(id, x => (x as HTMLInputElement).value, Timeouts.SEC_10);

    // If they are the same, we are done.
    if (oldValue == value) {
        debug(book, verbose, `No need to update ${fieldHumanName}, got ${oldValue}`);
        return false;
    }
    // Otherwise, update the value.
    debug(book, verbose, `Updating ${fieldHumanName} from ${oldValue} to ${value}`);
    await page.clearTextField(id, Timeouts.SEC_10, oldValue.split("\n").length);
    if (value != '') {
        await page.type(id, value, Timeouts.SEC_10);
    }

    return true;
}
export async function updateHiddenTextField(id: string, value: string, fieldHumanName: string, page: PageInterface, book: Book, verbose: boolean): Promise<boolean> {
    // debug(book, verbose, `Waiting for the text element (${id})`);
    await page.waitForSelector(id, Timeouts.SEC_10);

    // Read the old value.
    const oldValue = await page.evalValue(id, x => (x as HTMLInputElement).value, Timeouts.SEC_10);

    // If they are the same, we are done.
    if (oldValue == value) {
        debug(book, verbose, `No need to update ${fieldHumanName} (hidden), got ${oldValue}`);
        return false;
    }
    // Otherwise, update the value.
    debug(book, verbose, `Updating ${fieldHumanName} (hidden) from ${oldValue} to ${value}`);
    await page.updateValue(id, value);

    return true;
}

export async function selectValue(id: string, value: string, fieldHumanName: string, page: PageInterface, book: Book, verbose: boolean) {
    // debug(book, verbose, `Waiting for the element to select (${id})`);
    const oldValue = await page.evalValue(id, x => (x as HTMLSelectElement).value, Timeouts.SEC_10);
    if (oldValue != value) {
        debug(book, verbose, `Selecting ${value} for ${fieldHumanName}`);
        await page.select(id, value, Timeouts.SEC_10);
    } else {
        debug(book, verbose, `No need to update ${fieldHumanName}, got ${oldValue}`);
    }
}

export async function clickSomething(id: string, fieldHumanName: string, page: PageInterface, book: Book, verbose: boolean) {
    // debug(book, verbose, `Waiting for ${fieldHumanName}`);
    debug(book, verbose, `Clicking ${fieldHumanName}`);
    await page.focus(id, Timeouts.SEC_15);
    await page.click(id, Timeouts.SEC_15);
}

export async function updateTextAreaIfChanged(id: string, value: string, processor: (str: string) => string, fieldHumanName: string, page: PageInterface, book: Book, verbose: boolean) {
    //debug(book, verbose, `Waiting for the text area element (${id})`)
    await page.waitForSelector(id, Timeouts.SEC_10);
    const rawOldValue = await page.evalValue('#cke_1_contents > textarea', x => (x as HTMLTextAreaElement).value, Timeouts.SEC_10);
    const linesToRemove = rawOldValue.split('\n').length;
    const oldValue = processor(rawOldValue);
    const newValue = processor(value);
    if (oldValue != newValue) {
        // Description needs to be updated.
        debug(book, verbose, `Updating ${fieldHumanName} from \n\t${oldValue}\n\tto\n\t${newValue}`);
        await page.clearTextField(id, Timeouts.SEC_10, linesToRemove);
        await page.type(id, newValue, Timeouts.SEC_10);
    } else {
        debug(book, verbose, `Updating ${fieldHumanName}- not needed, got ${clipLen(oldValue)}`);
    }
}

export async function hasElement(id: string, page: PageInterface, book: Book, verbose: boolean): Promise<boolean> {
    try {
        await page.waitForSelector(id, Timeouts.SEC_HALF);
        debug(book, verbose, `Element exists: ${id}`);
        return true;
    } catch (e) {
        debug(book, verbose, `Element does not exist: ${id}`);
        return false;
    }
}
