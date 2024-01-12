import { Book } from '../book/book.js';
import { ActionResult } from '../util/action-result.js';
import { Urls, maybeClosePage } from './action-utils.js';
import { ActionParams } from '../util/action-params.js';
import { debug } from '../util/utils.js';
import { Timeouts } from '../util/timeouts.js';

export async function publish(book: Book, params: ActionParams, isForce: boolean = false): Promise<ActionResult> {
  const verbose = params.verbose;

  if (params.dryRun) {
    debug(book, verbose, 'Publishing (dry run)');
    return new ActionResult(true);
  }

  // If we are forcing, just publish. If we are not forcing, run some checks
  // first. The "forcing" feature is needed for some bug in KDP when the status
  // does not change soon enough.
  if (!isForce) {
    if (book.wasEverPublished && book.pubStatus == 'LIVE' && book.pubStatusDetail == '') {
      debug(book, verbose, 'Publishing - not needed, already fully published');
      // Publishing not needed.
      return new ActionResult(true);
    }

    if (book.wasEverPublished && (book.pubStatus == 'IN REVIEW' ||
      (book.pubStatus == 'LIVE' && book.pubStatusDetail == 'Updates publishing'))) {
      debug(book, verbose, 'Publishing - already in progress');
      // Publishing not needed.
      return new ActionResult(true);
    }
  }

  const url = Urls.EDIT_PAPERBACK_PRICING.replace('$id', book.id);
  debug(book, verbose, 'Publishing at url: ' + url);
  const page = await params.browser.newPage();
  await page.goto(url, Timeouts.MIN_3);
  await page.waitForTimeout(Timeouts.SEC_1);  // Just in case.

  debug(book, verbose, 'Checking if we can publish');
  const metadataStatus = await page.evalValue('#book-setup-navigation-bar-details-link .a-alert-content', x => x.textContent.trim(), Timeouts.SEC_5);
  const contentStatus = await page.evalValue('#book-setup-navigation-bar-content-link .a-alert-content', x => x.textContent.trim(), Timeouts.SEC_5);
  const pricingStatus = await page.evalValue('#book-setup-navigation-bar-pricing-link .a-alert-content', x => x.textContent.trim(), Timeouts.SEC_5);

  let ok = (metadataStatus == 'Complete') && contentStatus == 'Complete' && pricingStatus == 'Complete';

  let isSuccess = ok;
  if (ok) {
    debug(book, verbose, 'Metadata, content and pricing status: OK');

    debug(book, verbose, 'Clicking publish');
    await page.click('#save-and-publish-announce', Timeouts.MIN_1);
    await page.waitForNavigation(Timeouts.MIN_1 );
    await page.waitForTimeout(Timeouts.SEC_1);  // Just in case.

    book.wasEverPublished = true;
    book.publishTime = new Date();
  } else {
    debug(book, verbose, `Cannot publish! Metadata: ${metadataStatus}, content: ${contentStatus}, pricing: ${pricingStatus}`);
    isSuccess = false;
  }

  await maybeClosePage(params, page);
  return new ActionResult(isSuccess);
}
