#!/usr/bin/env node

import { program } from 'commander';

import { BookFile } from './book/book-file.js';
import { ExecuteBookActions } from './util/book-action-executor.js';
import { ActionParams } from './util/action-params.js';
import { debug, goToSleep } from './util/utils.js';

// Action
import { scrapeAmazonCoverImageUrl } from './action/scrape-amazon-cover-image-url.js';
import { assignIsbn } from './action/assign-isbn.js';
import { scrapeIsbn } from './action/scrape-isbn.js';
import { scrape } from './action/scrape.js';
import { produceManuscript } from './action/produce-manuscript.js';
import { ensureLoggedIn } from './action/ensure-logged-in.js';
import { updatePricing } from './action/update-pricing.js';
import { updateBookMetadata } from './action/update-book-metadata.js';
import { updateContent } from './action/update-content.js';
import { publish } from './action/publish.js';
import { unpublish } from './action/unpublish.js';
import { archive } from './action/archive.js';
import { setSeriesTitle } from './action/set-series-title.js';

import { BookList } from './book/book-list.js';
import { Book } from './book/book.js';
import { BrowserInterface, PuppeteerBrowser } from './browser.js';

async function executeBookActionCallback(action: string, book: Book, params: ActionParams) {
  debug(book, params.verbose, '----- ' + action + '-----');

  switch (action) {
    case 'archive': return await archive(book, params); break;
    case 'book-metadata': return await updateBookMetadata(book, params); break;
    case 'content': return await updateContent(book, params); break;
    case 'force-publish': return await publish(book, params, true /*force*/); break;
    case 'pricing': return await updatePricing(book, params); break;
    case 'produce-manuscript': return await produceManuscript(book, params); break;
    case 'publish': return await publish(book, params); break;
    case 'remove-series-title': return await setSeriesTitle(book, params, true); break;
    case 'scrape': return await scrape(book, params);
    case 'scrape-amazon-image': return await scrapeAmazonCoverImageUrl(book, params); break;
    case 'assign-isbn': return await assignIsbn(book, params); break;
    case 'scrape-isbn': return await scrapeIsbn(book, params); break;
    case 'set-series-title': return await setSeriesTitle(book, params); break;
    case 'unpublish': return await unpublish(book, params); break;
  }
  throw new Error('Unknown action: ' + action);
}

async function _startPuppeteerBrowser(
  bookList: BookList,
  headlessOverride: boolean,
  userDataDir: string,
  verbose: boolean)
  : Promise<BrowserInterface> {
  const headless = headlessOverride != null ? headlessOverride :
    // Headless is not overriden: the default is whether there is a "content" action
    // which for an unknown reason does not work in a headless mode.
    !bookList.containsContentAction();

  return PuppeteerBrowser.create(headless, userDataDir);
}

async function processOneBook(bookFile: BookFile, bookList: BookList, book: Book, params: ActionParams) {
  const verbose = params.verbose;
  debug(book, verbose, "");
  debug(book, verbose, "--- START ----------------------- ");
  debug(book, verbose, "\n" + book.toString());

  const startTime = performance.now();
  await ExecuteBookActions(book, bookFile, bookList, (a, b, p) => executeBookActionCallback(a, b, p), params);
  const durationSeconds = (performance.now() - startTime) / 1000;

  debug(book, verbose, `DONE took ${Math.round(durationSeconds)} secs`);
  return durationSeconds;
}


async function processAllBooksOnce(scrapeOnly: boolean | null, bookList: BookList, bookFile: BookFile, params: ActionParams) {
  //
  // Ensure logged in.
  // 
  if (params.verbose) {
    console.debug('Ensuring logged in');
  }
  await ensureLoggedIn(params);
  if (params.verbose) {
    console.debug('Logged in');
  }

  //
  // Process all books, write useful stats.
  //
  let numConsecutiveFastOperations = 0;
  for (let book of bookList.getBooks()) {
    if (book.action != '' && (scrapeOnly == null || scrapeOnly == book.getActionList().every(a => a.startsWith("scrape")))) {
      const durationSeconds = await processOneBook(bookFile, bookList, book, params);

      //
      // Handle many consecutive fast operations
      //
      if (durationSeconds <= 2.0) {
        numConsecutiveFastOperations++;
        if (numConsecutiveFastOperations > 200) {
          // Take a little break.
          console.log("Too many fast operations - sleeping for 30s");
          await goToSleep(30_000);
          numConsecutiveFastOperations = 0;
        }
      } else {
        numConsecutiveFastOperations = 0;
      }
    }
  }
}

async function mainWithOptions(
  booksCsvFile: string,
  booksConfigFile: string,
  contentDir: string,
  userDataDir: string,
  keepOpen: boolean,
  headlessOverride: boolean,
  dryRun: boolean,
  verbose: boolean) {

  if (dryRun) {
    console.log('This is DRY RUN');
  }

  //
  // Read books
  //
  if (verbose) {
    console.log(`Using \n` +
      `\tbooks CSV file: ${booksCsvFile}\n` +
      `\tbook config file: ${booksConfigFile}\n` +
      `\tbooks content dir ${contentDir}\n` +
      `\tuser data dir ${userDataDir}\n` +
      `\tkeepOpen: ${keepOpen}\n` +
      `\tdryRun: ${dryRun}\n` +
      `\tverbose: ${verbose}`);
  }
  let bookFile = new BookFile(booksCsvFile, booksConfigFile, contentDir);
  let bookList = await bookFile.readBooksAsync();
  if (verbose) {
    console.log(`Found total ${bookList.size()} books, to process:`, bookList.getBooksToProcess());
  }

  //
  // Start browser and login. After this succeeds we should finally close the browser.
  //
  if (verbose) {
    console.debug('Starting browser');
  }
  const browser = await _startPuppeteerBrowser(bookList, headlessOverride, userDataDir, verbose);
  if (verbose) {
    console.debug('Browser started');
  }

  const params: ActionParams = {
    browser: browser,
    keepOpen: keepOpen,
    dryRun: dryRun,
    verbose: verbose,
  };

  try {
    await processAllBooksOnce(null, bookList, bookFile, params);
  } finally {
    if (!keepOpen) {
      await browser.close();
    }
  }
  if (verbose) {
    console.log('We are done');
  }
}

async function main() {
  program
    .requiredOption('-f, --books <file>', 'CSV file that contains info for all books', 'books.csv')
    .requiredOption('-c, --config <file>', 'Books config file', 'books.conf')
    .requiredOption('-d, --content-dir <file>', 'Books content directory', '.')
    .requiredOption('-u, --user-data <dir>', 'User data dir to store cookies, etc', './user_data')
    .option('-k, --keep-open', 'Keep tabs open', false)
    .option('-h, --headless <yes|no>', 'Open in headless mode (no browser visible)', '')
    .option('-d, --dry-run', 'Dry run - no actual actions taken', false)
    .option('-v, --verbose', 'Be chatty', false);

  program.parse();

  const opts = program.opts();

  let headlessStr = opts.headless != undefined && opts.headless != null ? opts.headless : '';
  let headlessOverride = headlessStr == 'yes' || headlessStr == 'true' ? true : (headlessStr == 'no' || headlessStr == 'false' ? false : null);
  let dryRun = opts.dryRun != undefined && opts.dryRun != null ? opts.dryRun : false;
  let keepOpen = opts.keepOpen != undefined && opts.keepOpen != null ? opts.keepOpen : false;
  let verbose = opts.verbose != undefined && opts.verbose != null ? opts.verbose : false;

  process.on("unhandledRejection", (error) => {
    console.error(error);
    throw error;
  });

  const startTime = performance.now();
  await mainWithOptions(opts.books, opts.config, opts.contentDir, opts.userData, keepOpen, headlessOverride, dryRun, verbose);
  const durationSeconds = (performance.now() - startTime) / 1000;
  const durationMinutes = Math.round(10 * durationSeconds / 60) / 10;
  console.log("Whole thing took " + durationMinutes + " minutes")
}

(async () => { main() })();

