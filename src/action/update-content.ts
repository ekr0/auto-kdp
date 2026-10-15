import { ActionResult } from '../util/action-result.js';
import { debug, error } from '../util/utils.js'
import { Urls, clickSomething, fileExists, maybeClosePage } from './action-utils.js';
import { Book } from '../book/book.js';
import { ActionParams } from '../util/action-params.js';
import { Timeouts } from '../util/timeouts.js';

export async function updateContent(book: Book, params: ActionParams): Promise<ActionResult> {
    const verbose = params.verbose;

    if (params.dryRun) {
        debug(book, verbose, 'Updating content metadata (dry run)');
        return new ActionResult(true);
    }

    if (!book.canEditCriticalMetadata()) {
        error(book, 'Cannot republish content of a published book');
        return new ActionResult(false).doNotRetry();
    }
    if (!fileExists(book.manuscriptLocalFile)) {
        error(book, "File does not exist: " + book.manuscriptLocalFile);
        return new ActionResult(false).doNotRetry();
    }
    if (!fileExists(book.coverLocalFile)) {
        error(book, "File does not exist: " + book.coverLocalFile);
        return new ActionResult(false).doNotRetry();
    }

    const url = Urls.EDIT_PAPERBACK_CONTENT.replace('$id', book.id);
    debug(book, verbose, 'Updating content metadata at url: ' + url);
    const page = await params.browser.newPage();

    await page.goto(url, Timeouts.MIN_1);
    await page.waitForTimeout(Timeouts.SEC_1);  // Just in case.
    debug(book, verbose, 'Loaded');

    const isJapanese = book.language.toLowerCase() == "japanese";
    debug(book, verbose, `isJapanese=${isJapanese}`);

    // if no ISBN, get one.
    // TODO: Support providing your own ISBN.
    if (book.isbn == '') {
        // Click 'Get a free KDP ISBN'
        await page.click('#free-print-isbn-btn-announce', Timeouts.MIN_3);
        await page.waitForTimeout(Timeouts.SEC_1);  // Just in case.

        // Confirm that this ISBN can only be used on Amazon.
        await page.click('#print-isbn-confirm-button-announce', Timeouts.MIN_3);
        debug(book, verbose, 'Getting ISBN/5');
        await page.waitForSelectorVisible('#free-print-isbn-accordion-row span[data-path="view.free_isbn"]', Timeouts.MIN_3);
        debug(book, verbose, 'Getting ISBN/6');
        await page.waitForTimeout(Timeouts.SEC_2);  // Just in case.
        debug(book, verbose, 'Getting ISBN/7');
        const isbn = await page.evalValue('#free-print-isbn-accordion-row span[data-path="view.free_isbn"]', el => el.innerText, Timeouts.SEC_30);
        debug(book, verbose, 'Got ISBN: ' + isbn);
        book.isbn = isbn;

        if (isbn == '') {
            debug(book, verbose, 'Could not get ISBN! This happens often that Amazon did assign ISBN but failed to display it here. Action scrapeIsbn solves it.')
        }
    }


    {
        // Print option: color print on white paper
        debug(book, verbose, 'Selecting paper color: ' + book.paperColor);
        let id = '';
        if (book.paperColor == 'black-and-cream') {
            id = '#a-autoid-0-announce';
        } else if (book.paperColor == 'black-and-white') {
            id = '#a-autoid-1-announce';
        } else if (book.paperColor == 'standard-color') {
            id = '#a-autoid-2-announce';
        } else if (book.paperColor == 'premium-color') {
            id = '#a-autoid-3-announce';
        } else {
            throw new Error('Unrecognized value for paper color: ' + book.paperColor);
        }
        await clickSomething(id, "Paper color", page, book, verbose);
        await page.waitForTimeout(Timeouts.SEC_1);  // Just in case.
    }

    {
        // Print option: bleed
        debug(book, verbose, 'Selecting bleed');
        let id = '';
        if (book.paperBleed == 'yes') {
            id = '#a-autoid-5-announce'; // Bleed (PDF only)
        } else if (book.paperBleed == 'no') {
            id = '#a-autoid-4-announce'; // No bleed
        } else {
            throw new Error('Unrecognized value for bleed: ' + book.paperBleed);
        }
        await clickSomething(id, "bleed", page, book, verbose);
        await page.waitForTimeout(Timeouts.SEC_1);  // Just in case.
    }

    {
        // Print option: glossy paper.
        debug(book, verbose, 'Selecting glossy paper');
        let id = '';
        if (book.paperCoverFinish == 'glossy') {
            id = 'button[name="GLOSSY"]'; // '#a-autoid-7-announce';
        } else if (book.paperCoverFinish == 'matte') {
            id = 'button[name="MATTE"]'; // '#a-autoid-6-announce';
        } else {
            throw new Error('Unrecognized value for paper finish: ' + book.paperCoverFinish);
        }
        await clickSomething(id, "glossy", page, book, verbose);
        await page.waitForTimeout(Timeouts.SEC_1);  // Just in case.
    }

    {
        // Select trim. First click 'select different size' 
        debug(book, verbose, 'Selecting trim');
        await clickSomething('#trim-size-btn-announce', "different size", page, book, verbose);
        await page.waitForTimeout(Timeouts.SEC_1);  // Just in case.

        // Select trim size.
        debug(book, verbose, 'Selecting trim: ' + book.paperTrim);
        let id = '';
        if (book.paperTrim == '5x8') {
            id = '#trim-size-popular-option-0-0-announce';
        } else if (book.paperTrim == '5.25x8') {
            id = '#trim-size-popular-option-0-1-announce';
        } else if (book.paperTrim == '5.5x8.5') {
            id = '#trim-size-popular-option-0-2-announce';
        } else if (book.paperTrim == '6x9') {
            id = '#trim-size-popular-option-0-3-announce';
        } else if (book.paperTrim == '8.5x8.5') {
            id = '#trim-size-nonstandard-option-0-3-announce';
        } else {
            throw new Error('Unrecognized value for paper trim: ' + book.paperTrim);
        }
        // TODO: Support more trim sizes
        await page.focus(id, Timeouts.SEC_5);
        await clickSomething(id, 'trim', page, book, verbose);
        await page.waitForTimeout(Timeouts.SEC_1);  // Just in case.
    }

    if (isJapanese) {
        //
        // Only for Japanese
        //
        {
            // Set "page turning direction".
            debug(book, verbose, 'Selecting page turning direction')
            const id = "button[name='LEFT_TO_RIGHT']"; // "#a-autoid-8-announce"
            await clickSomething(id, 'direction', page, book, verbose);
            await page.waitForTimeout(Timeouts.SEC_30);  // Just in case.
        }
        {
            // Cover
            debug(book, verbose, 'Uploading cover');
            const id = "#data-print-book-publisher-cover-pdf-only-file-upload-browse-button-announce";
            await page.waitForSelector(id, Timeouts.SEC_5);
            await page.selectFile(id, book.coverLocalFile, Timeouts.MIN_5);
            debug(book, verbose, 'Waiting for cover file chooser');
            await page.waitForSelectorVisible('#data-print-book-publisher-cover-pdf-only-file-upload-success', Timeouts.MIN_20);
            await page.waitForTimeout(Timeouts.SEC_2);
            debug(book, verbose, 'Cover upload done');
        }

    } else {
        //
        // Only for non-Japanese
        //
        {
            //  Select self-uploaded cover as PDF. This option is only available for non-Japanese.
            debug(book, verbose, 'Selecting PDF cover option');
            let id = '#data-print-book-publisher-cover-choice-accordion [data-a-accordion-row-name=\'UPLOAD\'] a[data-action=\'a-accordion\']';
            await clickSomething(id, "PDF cover option", page, book, verbose);
            await page.waitForTimeout(Timeouts.SEC_2);  // Just in case.
        }
        {
            // NOTE: We upload cover first becasue the manuscript will take a very long time.
            // Cover
            debug(book, verbose, 'Uploading cover');
            const id = '#data-print-book-publisher-cover-file-upload-browse-button-announce'
            await page.waitForSelector(id, Timeouts.SEC_5);
            await page.selectFile(id, book.coverLocalFile, Timeouts.MIN_5);
            debug(book, verbose, 'Waiting for cover file chooser');
            await page.waitForSelectorVisible('#data-print-book-publisher-cover-file-upload-success', Timeouts.MIN_20);
            await page.waitForTimeout(Timeouts.SEC_2);
            debug(book, verbose, 'Cover upload done');
        }
    }

    {
        // Manuscript
        debug(book, verbose, 'Uploading manuscript');
        const id = '#data-print-book-publisher-interior-file-upload-browse-button-announce';
        await page.waitForSelector(id, Timeouts.SEC_5);
        await page.selectFile(id, book.manuscriptLocalFile, Timeouts.MIN_5);
        debug(book, verbose, 'Waiting for manuscript file chooser'); 
        await page.waitForSelectorVisible('#data-print-book-publisher-interior-file-upload-success', Timeouts.MIN_20);
    }

    // Whether AI-generated. This must be set *before* launch previewer, 
    // as a lack of answer here, sometimes disables the launch preview.
    // TODO: For now only support "No", but would be nice to support "Yes".
    debug(book, verbose, "Clicking whether AI-generated")
    await page.click('#section-generative-ai div[aria-labelledby="generative-ai-questionnaire-question"] div[data-a-accordion-row-name="no"] a', Timeouts.SEC_10);

    // Click Launch previewer
    debug(book, verbose, 'Clicking Launch Previewer (typically takes 3.5min)');
    await page.waitForSelector('#print-preview-noconfirm-announce', Timeouts.SEC_30);
    debug(book, verbose, 'Clicking Launch Previewer/1');
    await page.click('#print-preview-noconfirm-announce', Timeouts.SEC_10);
    debug(book, verbose, 'Clicking Launch Previewer/2');
    await page.waitForNavigation(Timeouts.MIN_15);
    debug(book, verbose, 'Clicking Launch Previewer/3');
    await page.waitForTimeout(Timeouts.SEC_2);  // Just in case.

    // Click Approve on the preview page.
    debug(book, verbose, 'Clicking Approve');
    await page.waitForSelector('#printpreview_approve_button_enabled a', Timeouts.MIN_3);
    debug(book, verbose, 'Clicking Approve/1');
    await page.click('#printpreview_approve_button_enabled a', Timeouts.MIN_1);
    debug(book, verbose, 'Clicking Approve/2');
    await page.waitForSelectorVisible('#save-announce', Timeouts.MIN_3);
    debug(book, verbose, 'Clicking Approve/3');
    await page.waitForTimeout(Timeouts.SEC_1);  // Just in case.

    debug(book, verbose, "Clicking Confirm that my answers are accurate (this field only shows sometimes)")
    try {
        await page.click('#section-generative-ai .a-checkbox input', Timeouts.SEC_5)
    } catch (e) {
        console.log("Caught exception", e)
    }

    // Save
    debug(book, verbose, 'Clicking Save and Contnue');
    await page.click("#save-and-continue-announce", Timeouts.SEC_5);
    await page.waitForNavigation(Timeouts.MIN_1);
    await page.waitForTimeout(Timeouts.SEC_1);  // Just in case.

    await maybeClosePage(params, page);
    return new ActionResult(true);
}
