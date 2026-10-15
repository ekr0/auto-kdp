# Objective

Command-line tool to create or update books on Amazon KDP book publishing site. Books are stored in your local CSV file, PDFs to upload are in a local directory, and auto-kdp uses Puppeteer to run a browser on your behalf.

## More details

[KDP](https://kdp.amazon.com) is a wonderful service that allows you to publish print and digital books for free and sell them on Amazon. But if you have a larger number of books, clicking through the website is just mind-numbing. Auto-kdp uses puppeteer under the hood to click thorugh the KDP pages like a human would. 

This software does _not_ bypass any checks in KDP, or solves any problems that KDP itself has. Auto-kdp is just a monkey clicking for you: it can handle a few key pages (create book, upload content, update prices, click publish). 

If you publish few books, you do _not_ need this - but if you publish, say, 100, you absolutely do, unless you want to spend nights on clicking through the KDP site.

If this was useful, drop me a line. It took me quite some time to separate and generalize this code out of my personal use case. If someone finds this useful, it would make my day. Thanks!

## Caveats

- Please note auto-kdp does not handle _everything_ - I created it for my own needs. For example does not currently support subtitle, or kindle books. I wrote it as cleanly as possible so new fields can be added by pattern matching. 
- It may break if amazon changes something in the page, e. g. uses different ```id``` for HTML elements we refer to. There is nothing we can do about it. In My about 2 years of experience this has happened only once.

# Installation

Requires Node.js 18 or newer. Node 22 or 24 (LTS) is recommended: on Node 26, Puppeteer's Chrome download currently fails to unpack.

```bash
git clone https://github.com/elutek/auto-kdp.git
cd auto-kdp
npm install          # installs dependencies, downloads Chrome for Puppeteer, builds dist/
npm install -g .     # puts an `auto-kdp` command on your PATH
```

Then run `auto-kdp --help` from any directory. To update, run `git pull && npm install` in the clone.

When changing the code, run `npm run build` to update `dist/` (or keep `npm run build:watch` running to rebuild on every save), or `npx tsx src/index.ts ...` to run straight from the sources.

# How it works

![auto-kdp diagram](images/auto-kdp.png)

Auto-kdp consumes 

* a list of books in a CSV file (```books.csv```) - one book per row
* key-val defaults file (```books.conf```) 
* path a directory containing all the content (not directly - the content can sit in subdirectories. Each book defined **manuscriptLocalFile** subpath)

The CSV file may look something like this:
| Action                 | title                | authorFirstName | authorLastName | .... |
| ---------------------- | -------------------- | --------------- | -------------- | ---- |
| all                    | Where is my giraffe? | Jane            | Smith          |      |
| all                    | Where is my chicken  | Jane            | Smith          |      |
| pricing:publish:scrape | Where is my froggy?  | Jane            | Smith          |      |

Column names matter, this is how the tool knows what is what (full list in [keys.js](https://github.com/elutek/auto-kdp/blob/main/src/keys.js)). The column **action** tells the tool what to do. 

Run it something like:

```auto-kdp --books books.csv --config books.conf --content-dir ./content/ [--verbose] [--dry-run] ``` 

Auto-kdp processes books in-order. It executes actions one-by-one until all actions are done, or until failure. If an action fails, it is retried twice. Each action may modify the book data (e. g. action 'scrapeIsbn' fills out the 'isbn' column), and consumes the executed action. After every action, a new CSV file is written out (".new") with current data about all books.

When the tool is done (or, in case it crashes), the ".new" file has the state. You should compare it with the original CSV file, and if all looks good, replace the original books CSV file:

```bash
meld books.csv books.csv.new
mv books.csv.new books.csv
```

# Getting started

NOTE: auto-kdp does not save your KDP credentionals, or transfer it anywhere - they stay in a local directory that you own and can delete any time.

- Step 1: I highly recommend familiarity with using Amazon KDP manually. Publish at least one book from end-to-end and learn KDP's terminology and all flows.
- Step 2: Read the file [keys.ts](src/book/keys.ts). This is the list of key:values that auto-kdp supports.
- Step 3: Create files called `books.csv` and `books.conf`. See examples in the [test-data](test-data) directory.
  - Start by setting your book's title, subtitle, edition, author, illustrator, prices, etc.
  - If it's the same for all books set it in `books.conf`. If it varies between books, add a column in `books.csv`. Column names correspond to the names listed in [keys.ts](src/book/keys.ts).
  - Note that some columns like `pubStatus` or `ISBN` must be in the CSV file because they are scraped from KDP. The full list can be found by searching for [_KEYS_WITH_NO_DEFAULT](src/book/book.ts).
  - Set `action` to empty.
  - Tip: The [Edit csv](https://marketplace.visualstudio.com/items?itemName=janisdd.vscode-edit-csv) extension to VS Code is very useful (I'm not associated with them).
- Step 4: Try with `action` empty. This means `auto-kdp` will parse all books but do nothing, except signing into your KDP account.
  - `auto-kdp --books books.csv --config books.conf --content-dir book/ --user-data ./user_data --verbose --keep-open --headless=no`
  - "keep open" means that browser tabs will not be closed.
  - "headless=no" means that you can see the browser and observe actions that it's doing for you. The only action needed is to sign into your KDP account.
  - If you get errors, check the syntax of the CSV file.
- Step 5: Set `action` to `book-metadata` for one book and rerun. `auto-kdp` will create a book with a new `id` set its title, author, etc. It will *not* get ISBN, so this book will be easy to delete and you can try as much as you wish.
- Step 6: Visit your [KDP bookshelf](https://kdp.amazon.com/en_US/bookshelf) and see if the book showed up.
- Step 7: Run with `headless=yes`. The work will be done without the browser's UI. Now you can try more books or other actions. To see exactly what each action is doing, you can read [src/action](src/action), for example [src/action/publish.ts](src/action/publish.ts), which basically clicks the "Publish" button.


> *WARNING*. KDP pages can be finicky. Sometimes they are fast and sometimes slow, sometimes they change or rename fields or move fields, but `auto-kdp` was not updated yet. I am actively using it (Jul'23) but am just one person doing a side project. Being successful with `auto-kdp` will require babysitting it and a dose of tech savvy. Feel free to start and issue or send me a PR. Thanks!

# Custom keys

### Defaults

Look again at the table above. Lots of columns will have the same value, for example maybe you are one author publishing many books, or all your books are in the same category. Such columns can be specified in a 'defaults' file, e. g. `books.conf`

```bash
authorFirstName = Jane
authorLastName = Smith
```

If you have a default defined, you can delete the column.

### Variables and resolution

Notice how also ```title``` has a similar structure, just for a different animal? You can create a new column ```animal``` in the CSV file, delete the ```title``` column and configure the default title instead:

```title = Where is my ${animal}?```

Anything in ```${key}```  is resolved by auto-kdp at runtime. It can refer to another key-value (which itself may depend on other variables). The tool will fail if it cannot resolve everything.

It is also possible to put a conditional in a variable
```bash
isGirl = $vareq ${gender} == F
possessivePronoun = $varif ${isGirl} ?? her :: his
```
or refer to a field in another book:
```bash
asinGiraffe = $varbookref ${animal} == Giraffe !! asin
```
The keywords ```$vareq```, ```$varif``` and ```$varbookref``` have special meaning (this is not any proper language, just a trivial hack to express conditionals and book references).

# Actions

One *action* corresponds to a single activity on a single URL: get the page, read something in the page, and click on some things.

Some actions are "shortcuts" to a list of actions proper. For example  **all** is "book-metadata:content-metadata:scrapeIsbn:produceManuscript:content:pricing:publish:scrape:scrapeAmazonCoverImageUrl".

Individual actions are:

* ```book-metadata``` - update book metadata (first page of book creation). After publishing, only some fields can be updated, such as ```description``` but not ```title```.
* ```content-metadata``` - update content metadata, e.g. glossy vs matte, paper size, etc. This cannot be changed after the book is published.
* ```scrapeIsbn``` - currently we only support getting ISBN from Amazon. When we do that, due to a bug in Amazon, the ISBN is assigned but not shown during creation. This command makes sure we have the ISBN - it may be needed to create a manuscript.
* ```produceManuscript``` - executes a command ```manuscriptCreationCommand```, for example it might be ```cd some/path && make ${animal}.pdf && cd -```. I am writing my books in LaTeX so the manuscript is configurable too. This command will fail if the ```manuscriptLocalFile``` or ```coverLocalFile``` are not found on disk.
* ```content``` - upload cover and manuscript PDFs and get them approved. This cannot be changed after the book is published. If there is an error (KDP shows it during review), e.g. manuscript is wrong size, or there is text in the margins, this action will repeatedly fail, until you resolve the issues with the manuscript.
* ```pricing``` update pricing, set for example in ```priceEur```, ```priceUsd```, etc. This action does not publish, only saves the new prices.
* ```publish``` clicks publish
* ```scrape``` scrapes status (```pubStatus```, ```pubStatusDetail```, ```pubDate```). This action won't be "consumed" from the ```action``` field until the book is fully LIVE and no updates are pending.
* ```scrapeAmazonCoverImageUrl``` gets you the link to an image with a cover used by Amazon. This is optional, but can be useful when you publish elsewhere a link to your book - this cover will be definitely correct, and is hosted conveniently by amazon, 

Code links: 
* individual actions defined here in [index.js](https://github.com/elutek/auto-kdp/blob/a82f1248e36c145131868abe0c30e764e2368c6a/index.js#L27) 
* shortcuts here in [book.js](https://github.com/elutek/auto-kdp/blob/main/src/book.js#L102). 


## Running for the first time

Please use ```--verbose --dry-run --headless=no``` options when you're getting started. These let you see what is going on, and the "dry run" prevents actual modifications in KDP. When you think you are fine,  "dry run" but keep keep headless off.

# Troubleshooting

Common issues
* If KDP finds error in content (pretty common for new manuscript), it blocks publishing and the ```content``` action will fail repeatedly. You must manually visit the book content page, go through the pages, and see what the errors are. It might be wrong covers size, or text in margins. Trim sizing in particular is non-trivial: read [guide on trim](https://kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6) or upload whatever, and the error will tell you expected size.
- Content upload may not work with headless browser - for unknown reason. If any book has ```content``` action, auto-kdp will run in non-headless mode, i.e. you will see the browser. 
- For debugging there are useful options
  - ```--verbose``` Prints a lot of messages, so you can see where exactly it stops. Personally, I just always use this.
  - ```--keep-open```Does not close open tabs in puppeteer. Watch for your RAM if you have many books - you should do this only for debugging.
  - ```--headless=no``` Forces out of the headless mode, i.e. you will see what's happening in the browser. Very useful.
- A quirk in KDP is that content upload does not work with browser window is too small - make it big, or just fullscreen. 


# Development

## To add a new custom key

1. First add to keys.js
2. Then add to book.js in the constructor
3. Make all tests pass, which typically update book.js, test-utils.js and some random locations
4. Use the new fields in some actions update desired src/action/...

## Tests

Tests are written in jest.

```npm run test```

To run from source without building: ```npx tsx src/index.ts --help```.

All actions and puppeteer messiness is in  ```src/action``` - this is not tested. Everything else is tested with 100% coverage.



## What is needed

- Some fields missing e.g. contributors other than illustrator
