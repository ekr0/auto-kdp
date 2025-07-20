import { Book } from '../book/book.js';
import { ActionResult } from '../util/action-result.js';
import { debug, error, stripPrefix } from '../util/utils.js';
import { Urls, clickSomething } from './action-utils.js';
import { ActionParams } from '../util/action-params.js';
import { PageInterface } from '../browser.js';
import { Timeouts } from '../util/timeouts.js';

var globalBookshelfPage: PageInterface = null;

export async function scrape(book: Book, params: ActionParams): Promise<ActionResult> {
  const verbose = params.verbose

  if (params.dryRun) {
    debug(book, verbose, 'Scraping (dry run)');
    return new ActionResult(true);
  }

  const url = Urls.BOOKSHELF_URL;
  debug(book, verbose, 'Scraping at url: ' + url);

  if (book.id == '') {
    debug(book, verbose, 'NOT scraping - need book id for that');
    return new ActionResult(false).doNotRetry();
  }

  // We scrape *a lot*. For scrape we will keep a special 
  // page used only for scraping.
  const page = await _getScrapePage(url, params);
  await page.bringToFront();

  // Type the search query.
  debug(book, verbose, 'Querying for the book');
  let id = '#podbookshelftable-search-input';
  await page.clearTextField(id, Timeouts.SEC_5);
  await page.type(id, book.id, Timeouts.SEC_5);

  // Click search button.
  debug(book, verbose, 'Clicking Search');
  id = '#podbookshelftable-search-button-submit .a-button-input';
  await page.waitForTimeout(Timeouts.SEC_HALF);
  await page.focus(id, Timeouts.SEC_10);
  await page.click(id, Timeouts.SEC_10);

  // Get ASIN from the search result.
  if (book.asin == '') {
    debug(book, verbose, 'Getting ASIN');
    id = '#zme-indie-bookshelf-dual-print-price-asin-' + book.id;
    const rawAsin = await page.evalValue(id, el => el.innerText, Timeouts.SEC_10);
    const asin = stripPrefix(rawAsin.trim(), 'ASIN:').trim();
    debug(book, verbose, 'Got ASIN: ' + asin);
    book.asin = asin;
  }

  // Get pubStatus from the search result.
  {
    let id = '[id="' + book.id + '-status"] .element-popover-text span:nth-child(1)';
    debug(book, verbose, 'Getting pubStatus');
    const pubStatus = await page.evalValue(id, el => el.innerText.trim(), Timeouts.SEC_10);
    book.pubStatus = pubStatus.trim().toUpperCase();
    debug(book, verbose, 'Got pubStatus: ' + book.pubStatus);
  }

  // Get pubStatusDetail from the search result (it's right after the pubStatus).
  {
    let id = '[id="' + book.id + '-status"] .element-popover-text span:nth-child(2)';
    debug(book, verbose, 'Getting pubStatusDetail');
    let pubStatusDetail = await page.evalValue(id, el => el.innerText.trim(), Timeouts.SEC_10);
    pubStatusDetail = stripPrefix(pubStatusDetail, book.pubStatus).trim();
    book.pubStatusDetail = pubStatusDetail;
    debug(book, verbose, 'Got pubStatusDetail: ' + pubStatusDetail);
  }

  // Get publication date
  {
    if (book.pubStatus == 'LIVE') {
      let id = '#zme-indie-bookshelf-dual-print-status-release-date-' + book.id;
      debug(book, verbose, 'Getting pubDate');
      const pubDate = await page.evalValue(id, el => el.innerText.trim(), Timeouts.SEC_10);
      book.pubDate = _formatDate(stripPrefix(pubDate, 'Submitted on ').trim(), book);
      debug(book, verbose, `Got pubDate ${book.pubDate} (${pubDate})`);
    } else {
      book.pubDate = '';
    }
  }

  // Get titleId
  {
    debug(book, verbose, 'Getting title id');
    id = `img[id="${book.id}"]`;
    const imgDataSource = await page.evalValue(id, x => (x as HTMLElement).getAttribute('data-source').trim(), Timeouts.SEC_5);
    const regexp = /amazon[^\\]*\/CAPS-SSE\/kdp_print\/[a-zA-Z0-9]{1,5}\/([a-zA-Z0-9]{1,20})\/KDP/m;
    const match = imgDataSource.match(regexp);
    if (match == null || match.length <= 1) {
      debug(book, verbose, 'Could not get title id: could not match img data-source: ' + imgDataSource);
    } else {
      book.titleId = match[1];
      debug(book, verbose, 'Got title id: ' + book.titleId);
    }
  }

  // Get series title.
  // TODO: Needs to be update wrt subtitle.
  debug(book, verbose, 'Getting series title');
  id = '#zme-indie-bookshelf-dual-metadata-series_title-' + book.id + ' > a';
  let scrapedSeriesTitle = '';
  let attempt = 1;
  for (; attempt < 3; ++attempt) {
    try {
      await page.bringToFront();
      await page.focus(id, Timeouts.SEC_3);
      await page.waitForTimeout(Timeouts.SEC_1);
      scrapedSeriesTitle = await page.evalValue(id, el => el.innerText.trim(), Timeouts.SEC_30);
    } catch (e) {
    }
    if (scrapedSeriesTitle != 'SERIES_TITLE') {
      // We only repeat if we get that magical "SERIES_TITLE" string, which means the title has not loaded yet.
      break;
    }
  }

  if (scrapedSeriesTitle == book.seriesTitle.toLowerCase()) {
    book.scrapedSeriesTitle = 'ok';
  } else if (scrapedSeriesTitle == '') {
    book.scrapedSeriesTitle = 'missing should be: ' + book.seriesTitle;
  } else {
    book.scrapedSeriesTitle = 'mismatch - got ' + scrapedSeriesTitle + ' but expecting ' + book.seriesTitle.toLowerCase();
  }

  debug(book, verbose, 'Got scraped series title: ' + scrapedSeriesTitle + ' - ' + book.scrapedSeriesTitle);

  // Check whether this book is archived.
  // Opening menu
  debug(book, verbose, 'Checking if archived');
  const draftStatus = ['IN REVIEW', 'PUBLISHING'].includes(book.pubStatus) ? 'draft' :
    (book.pubStatus == 'LIVE' && ['With unpublished changes', 'Updates publishing', 'Updates in review'].includes(book.pubStatusDetail) ? 'live-progress' :
      book.pubStatus.toLowerCase());
  id = `#zme-indie-bookshelf-dual-print-actions-${draftStatus}-book-actions-${book.id}-other-actions-announce`;
  await page.focus(id, Timeouts.SEC_1);
  await page.waitForTimeout(Timeouts.SEC_1);
  await page.tap(id, Timeouts.SEC_1);
  await page.waitForTimeout(Timeouts.SEC_1);
  // Reading if there is an option to archive or to unarchive
  const hasArchiveOption = await page.hasElement(`#print_archive_title-${book.titleId}`, Timeouts.SEC_3);
  const hasUnarchiveOption = await page.hasElement(`#print_unarchive_title-${book.titleId}`, Timeouts.SEC_3);
  debug(book, verbose, "Has archive option = " + hasArchiveOption);
  debug(book, verbose, "Has unarchive option = " + hasUnarchiveOption);
  let archivedStatus = 'unknown';
  if (hasUnarchiveOption && !hasArchiveOption) {
    archivedStatus = 'archived';
  } else if (hasArchiveOption && !hasUnarchiveOption) {
    archivedStatus = '';
  } else {
    archivedStatus = 'undetermined';
  }
  book.scrapedIsArchived = archivedStatus;
  debug(book, verbose, "Got archived status: " + book.scrapedIsArchived);

  /* We do not close this special page.
    await maybeClosePage(params, page);
  */

  const forceScrapeRepeat = (!book.isFullyLive() && !book.isArchived()) &&
    (book.action == 'scrape' || book.action == 'scrape:scrape-amazon-image');
  debug(book, verbose, `Repeating scrape? ${forceScrapeRepeat}`);
  const nextActions = forceScrapeRepeat ? 'scrape' : '';
  return new ActionResult(true).setNextActions(nextActions);
}

async function _getScrapePage(url: string, params: ActionParams): Promise<PageInterface> {
  if (globalBookshelfPage == null) {
    globalBookshelfPage = await params.browser.newPage();

    await globalBookshelfPage.goto(url, Timeouts.MIN_3);
    await globalBookshelfPage.waitForTimeout(Timeouts.SEC_1);  // Just in case.

    // Select "ALL" books, i.e. include archived ones.
    await globalBookshelfPage.select('#podbookshelftable_view_input-option', 'ALL', Timeouts.SEC_3);
  }
  return globalBookshelfPage;
}

function _formatDate(str: string, book: Book) {
  try {
    return new Date(str).toDateString();
  } catch (e) {
    error(book, 'Cannot parse date: ' + str, e);
    return '';
  }
}

