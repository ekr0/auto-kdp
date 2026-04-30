import { makeOkTestBook } from "../util/test-utils.js";
import { ActionParams } from "../util/action-params.js";
import { publish } from "./publish.js";
import { OnePageFakeBrowser, FakePage } from "../util/fake-browser.js";

test('publishDryRun', async () => {
    const book = makeOkTestBook();
    const browser = new OnePageFakeBrowser([]);
    const params: ActionParams = {
        browser: browser,
        keepOpen: false,
        dryRun: true,
        verbose: true,
    };

    const actionResult = await publish(book, params);
    expect(actionResult.success).toBe(true);
});

test('alreadyPublished', async () => {
    const book = makeOkTestBook();
    const browser = new OnePageFakeBrowser([]);
    const params: ActionParams = {
        browser: browser,
        keepOpen: false,
        dryRun: false,
        verbose: true,
    };

    book.pubStatus = 'LIVE';
    book.pubStatusDetail = '';

    const actionResult = await publish(book, params);
    expect(actionResult.success).toBe(true);
});

test('publishingInProgress_InReview', async () => {
    const book = makeOkTestBook();
    const browser = new OnePageFakeBrowser([]);
    const params: ActionParams = {
        browser: browser,
        keepOpen: false,
        dryRun: false,
        verbose: true,
    };

    book.pubStatus = 'IN REVIEW';
    book.pubStatusDetail = '';

    const actionResult = await publish(book, params);
    expect(actionResult.success).toBe(true);
});

test('publishingInProgress_LiveUpdatesPublishing', async () => {
    // Setup
    const book = makeOkTestBook();
    book.pubStatus = 'LIVE';
    book.pubStatusDetail = 'Updates publishing';
    const browser = new OnePageFakeBrowser([]);
    const params: ActionParams = {
        browser: browser,
        keepOpen: false,
        dryRun: false,
        verbose: true,
    };
    // Publish
    const actionResult = await publish(book, params);
    // Check results
    expect(actionResult.success).toBe(true);
});

test('canPublish', async () => {
    //
    // Setup
    //
    const book = makeOkTestBook();
    book.pubStatus = 'DRAFT';
    book.pubStatusDetail = '';
    const browser = new OnePageFakeBrowser([]);
    const params: ActionParams = {
        browser: browser,
        keepOpen: false,
        dryRun: false,
        verbose: true,
    };

    //
    // Action
    //
    const actionResult = await publish(book, params, /*isForce=*/false, /*skipPricing=*/true);

    //
    // Verify
    //
    expect(actionResult).not.toBe(null);
    expect(actionResult.success).toBe(true);

    // Make sure the browser did what we wanted.
    expect(params.browser.pages().length).toBe(1);
    const page = params.browser.pages()[0] as FakePage;
    expect(page.performedActions).toEqual([
        'goto:https://kdp.amazon.com/en_US/title-setup/paperback/test_id/pricing?ref_=kdp_BS_D_ta_pr',
        'click',
        'nav',
        'close'
    ]);
    expect(page.closed).toBe(true);
});
