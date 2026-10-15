import * as fs from 'fs';
import * as os from 'os';
import path from 'path';

import { BookFile } from './book-file.js';

const BOOKS_CONF = `
authorFirstName = author_first_name
authorLastName = author_last_name
category1 = cat1
category2 = cat2
newCategory1 = new_cat1
newCategory2 = new_cat2
newCategory3 = new_cat3
coverLocalFile = cover_file_\${name}
description = description for \${name}
illustratorFirstName = illustrator_first_name
illustratorLastName = illustrator_last_name
keyword0 = test \${name}
keyword1 = 
keyword2 =
keyword3 =
keyword4 =
keyword5 =
keyword6 = 
language = dutch
manuscriptCreationCommand = make book_\${name}
manuscriptLocalFile = manuscript/file/\${name}.pdf
notes = test notes
priceAu = 
priceCa = 
priceEur =
priceGbp =
priceJp = 
pricePl = 
priceSe = 
priceUsd = 1.2
primaryMarketplace = pl
paperBleed = paper_bleed
paperCoverFinish = paper_cover_finish
paperColor = paper_color
paperTrim = paper_trim
signature = \${name}
seriesTitle = My Series
title = Book for \${name}
subtitle = My subtitle
edition = 2
`

const originalCwd = process.cwd();
let tmpDir: string;

// Creates the given files in a fresh temp dir and makes it the cwd,
// so that tests can use relative paths.
function setupFiles(files: Record<string, string>) {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-kdp-test-'));
    process.chdir(tmpDir);
    fs.mkdirSync('content/dir', { recursive: true });
    for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(name, content);
    }
}

afterEach(() => {
    process.chdir(originalCwd);
    if (tmpDir) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        tmpDir = undefined;
    }
});

test('can read book file', async () => {
    const books_csv =
       `action,id ,titleId  ,isbn ,asin ,name ,pubStatus  ,pubDate  ,pubStatusDetail   ,publishTime             ,coverImageUrl   ,scrapedSeriesTitle   ,scrapedIsArchived
        actionA,idA,title_idA,isbnA,asinA,Ava  ,pub_statusA,pub_dateA,pub_status_detailA,2011-10-05T21:48:00.000Z,cover_image_urlA,scraped_series_titleA,archived
        actionB,idB,title_idB,isbnB,asinB,Belle,pub_statusB,pub_dateB,pub_status_detailB,2011-10-05T21:48:00.000Z,cover_image_urlB,scraped_series_titleB,undetermined`;

    setupFiles({
        'books.csv': books_csv,
        'books.csv.lock': '',
        'books.conf': BOOKS_CONF,
    });

    let bookFile = new BookFile('books.csv', 'books.conf', 'content/dir');
    const bookList = await bookFile.readBooksAsync();
    const books = bookList.getBooks();

    expect(books.length).toEqual(2);
    {
        let book = books[0];
        // Select only a few key fields for checking.
        expect(book.action).toEqual('actionA');
        expect(book.asin).toEqual('asinA');
        expect(book.authorFirstName).toEqual('author_first_name');
        expect(book.authorLastName).toEqual('author_last_name');
        expect(book.coverLocalFile).toEqual('content/dir/cover_file_Ava');
        expect(book.coverImageUrl).toEqual('cover_image_urlA');
        expect(book.description).toEqual('description for Ava');
        expect(book.id).toEqual('idA');
        expect(book.isbn).toEqual('isbnA');
        expect(book.keyword0).toEqual('test Ava');
        expect(book.manuscriptCreationCommand).toEqual('make book_Ava');
        expect(book.manuscriptLocalFile).toEqual('content/dir/manuscript/file/Ava.pdf');
        expect(book.priceUsd).toEqual(1.2);
        expect(book.publishTime.toISOString()).toEqual('2011-10-05T21:48:00.000Z');
        expect(book.signature).toEqual('Ava');
        expect(book.scrapedSeriesTitle).toEqual('scraped_series_titleA');
        expect(book.scrapedIsArchived).toEqual('archived');
    }
    {
        let book = books[1];
        expect(book.action).toEqual('actionB');
        expect(book.asin).toEqual('asinB');
        expect(book.authorFirstName).toEqual('author_first_name');
        expect(book.authorLastName).toEqual('author_last_name');
        expect(book.coverLocalFile).toEqual('content/dir/cover_file_Belle');
        expect(book.coverImageUrl).toEqual('cover_image_urlB');
        expect(book.description).toEqual('description for Belle');
        expect(book.id).toEqual('idB');
        expect(book.isbn).toEqual('isbnB');
        expect(book.keyword0).toEqual('test Belle');
        expect(book.manuscriptCreationCommand).toEqual('make book_Belle');
        expect(book.manuscriptLocalFile).toEqual('content/dir/manuscript/file/Belle.pdf');
        expect(book.priceUsd).toEqual(1.2);
        expect(book.publishTime.toISOString()).toEqual('2011-10-05T21:48:00.000Z');
        expect(book.signature).toEqual('Belle');
        expect(book.scrapedSeriesTitle).toEqual('scraped_series_titleB');
        expect(book.edition).toEqual('2');
        expect(book.scrapedIsArchived).toEqual('undetermined');
    }
});

test('can read book with empty values', async () => {
    const empty_books_csv =
        `action,id,titleId,isbn,asin,name ,pubStatus,pubDate,pubStatusDetail,publishTime,coverImageUrl,scrapedSeriesTitle,scrapedIsArchived
               ,  ,       ,    ,    ,Belle,         ,       ,               ,           ,             ,                  ,`;

    const empty_books_conf = `
authorFirstName =
authorLastName =
category1 =
category2 =
newCategory1 =
newCategory2 =
newCategory3 =
coverLocalFile =
description =
illustratorFirstName =
illustratorLastName =
keyword0 =
keyword1 = 
keyword2 =
keyword3 =
keyword4 =
keyword5 =
keyword6 = 
language = english
manuscriptCreationCommand =
manuscriptLocalFile =
notes =
priceAu = 
priceCa = 
priceEur =
priceGbp =
priceJp = 
pricePl = 
priceSe = 
priceUsd =
primaryMarketplace = us
paperBleed =
paperCoverFinish =
paperColor =
paperTrim =
signature = \${name}
title =
subtitle =
edition = 123
seriesTitle =
`
    setupFiles({
        'books.csv': empty_books_csv,
        'books.csv.lock': '',
        'books.conf': empty_books_conf,
    });

    let bookFile = new BookFile('books.csv', 'books.conf', 'content/dir');
    const bookList = await bookFile.readBooksAsync();
    const books = bookList.getBooks();
    expect(books.length).toEqual(1);
    {
        let book = books[0];
        // Select only a few key fields for checking.
        expect(book.action).toEqual('');
        expect(book.asin).toEqual('');
        expect(book.authorFirstName).toEqual('');
        expect(book.authorLastName).toEqual('');
        expect(book.coverLocalFile).toEqual('content/dir/');
        expect(book.coverImageUrl).toEqual('');
        expect(book.description).toEqual('');
        expect(book.id).toEqual('');
        expect(book.isbn).toEqual('');
        expect(book.keyword0).toEqual('');
        expect(book.manuscriptCreationCommand).toEqual('');
        expect(book.manuscriptLocalFile).toEqual('content/dir/');
        expect(book.priceUsd).toBeNull();
        expect(book.publishTime).toEqual(null);
        expect(book.scrapedSeriesTitle).toEqual('');
        expect(book.scrapedIsArchived).toEqual('');
        expect(book.getPreservedKey('name')).toEqual('Belle');
        expect(book.edition).toEqual('123');
    }
});

test('detects same id', async () => {
    const books_csv =
        `action,id,titleId,isbn,asin,name ,pubStatus,pubDate,pubStatusDetail,publishTime,coverImageUrl,scrapedSeriesTitle,scrapedIsArchived
         a     ,X ,a      ,a   ,a   ,Ava  ,a        ,a      ,a              ,           ,a            ,A                 ,
         a     ,X ,b      ,b   ,b   ,Belle,b        ,b      ,b              ,           ,b            ,B                 ,`;

    setupFiles({
        'books.csv': books_csv,
        'books.csv.lock': '',
        'books.conf': BOOKS_CONF,
    });

    let bookFile = new BookFile('books.csv', 'books.conf', 'content/dir');
    await expect(bookFile.readBooksAsync()).rejects.toEqual(new Error('Id not unique: X'));
});

test('detects same ASIN', async () => {
    const books_csv =
        `action,id,titleId,isbn,asin,name ,pubStatus,pubDate,pubStatusDetail,publishTime,coverImageUrl,scrapedSeriesTitle,scrapedIsArchived
         a     ,a ,a      ,a   ,X   ,Ava  ,a        ,a      ,a              ,           ,a            ,A                 ,
         a     ,b ,b      ,b   ,X   ,Belle,b        ,b      ,b              ,           ,b            ,B                 ,`;

    setupFiles({
        'books.csv': books_csv,
        'books.csv.lock': '',
        'books.conf': BOOKS_CONF,
    });

    let bookFile = new BookFile('books.csv', 'books.conf', 'content/dir');
    await expect(bookFile.readBooksAsync()).rejects.toEqual(new Error('ASIN not unique: X'));
});

test('detects same isbn', async () => {
    const books_csv =
        `action,id,titleId,isbn    ,asin,name ,pubStatus,pubDate,pubStatusDetail,publishTime,coverImageUrl,scrapedSeriesTitle,scrapedIsArchived
         a     ,a ,a      ,SAMEISBN,a   ,Ava  ,a        ,a      ,a              ,           ,a            ,A                 ,
         a     ,b ,b      ,SAMEISBN,b   ,Belle,b        ,b      ,b              ,           ,b            ,B                 ,`;

    setupFiles({
        'books.csv': books_csv,
        'books.csv.lock': '',
        'books.conf': BOOKS_CONF,
    });

    let bookFile = new BookFile('books.csv', 'books.conf', 'content/dir');
    await expect(bookFile.readBooksAsync()).rejects.toEqual(new Error('ISBN not unique: SAMEISBN'));
});

test('detects same titleId', async () => {
    const books_csv =
        `action,id,titleId,isbn,asin,name ,pubStatus,pubDate,pubStatusDetail,publishTime,coverImageUrl,scrapedSeriesTitle,scrapedIsArchived
         a     ,a ,SAME   ,a   ,a   ,Ava  ,a        ,a      ,a              ,           ,a            ,A                 ,
         a     ,b ,SAME   ,b   ,b   ,Belle,b        ,b      ,b              ,           ,b            ,B                 ,`;

    setupFiles({
        'books.csv': books_csv,
        'books.csv.lock': '',
        'books.conf': BOOKS_CONF,
    });

    let bookFile = new BookFile('books.csv', 'books.conf', 'content/dir');
    await expect(bookFile.readBooksAsync()).rejects.toEqual(new Error('TitleId not unique: SAME'));
});

test('detects same signature', async () => {
    const books_csv =
        `action,id,titleId,isbn,asin,name,pubStatus,pubDate,pubStatusDetail,publishTime,coverImageUrl,scrapedSeriesTitle,scrapedIsArchived
         a     ,a ,a      ,a  ,a   ,Ava ,a        ,a      ,a              ,           ,a            ,A                 ,
         a     ,b ,b      ,b  ,b   ,Ava ,b        ,b      ,b              ,           ,b            ,B                 ,`;

    setupFiles({
        'books.csv': books_csv,
        'books.csv.lock': '',
        'books.conf': BOOKS_CONF,
    });

    let bookFile = new BookFile('books.csv', 'books.conf', 'content/dir');
    expect.assertions(1);
    await expect(bookFile.readBooksAsync()).rejects.toEqual(new Error('Signature not unique: Ava'));
});

test('writes output', async () => {
    const books_csv =
        `action,id,titleId,isbn,asin,name,pubStatus,pubDate,pubStatusDetail,publishTime,coverImageUrl,scrapedSeriesTitle,scrapedIsArchived,description
test_actionA,test_idA,test_title_idA,test_isbnA,test_asinA,Ava,test_pub_statusA,test_pub_dateA,test_pub_status_detailA,,test_cover_image_urlA,title_a,archived,descriptionA
test_actionB,test_idB,test_title_idB,test_isbnB,test_asinB,Belle,test_pub_statusB,test_pub_dateB,test_pub_status_detailB,,test_cover_image_urlB,title_b,,descriptionB
`;

    setupFiles({
        'books.csv': books_csv,
        'books.csv.lock': '',
        'books.conf': BOOKS_CONF,
    });

    let bookFile = new BookFile('books.csv', 'books.conf', 'content/dir');
    const bookList = await bookFile.readBooksAsync();

    // Write the output.
    await bookFile.writeBooksAsync(bookList);

    // Test the file written is the same as the source.
    expect(fs.existsSync('books.csv.new')).toBe(true);
    let books_new = fs.readFileSync('books.csv.new').toString()
    expect(books_new).toEqual(books_csv);
});

test('can read description from a file', async () => {
    const books_csv =
        `description ,action,id,titleId,isbn,asin,name ,pubStatus,pubDate,pubStatusDetail,publishTime,coverImageUrl,scrapedSeriesTitle,scrapedIsArchived
        file:file.txt,      ,b ,b      ,b   ,b   ,Belle,         ,       ,               ,           ,             ,                  ,`;

    setupFiles({
        'books.csv': books_csv,
        'books.csv.lock': '',
        'books.conf': BOOKS_CONF,
        'file.txt': 'xxx',
    });

    let bookFile = new BookFile('books.csv', 'books.conf', 'content/dir');
    const bookList = await bookFile.readBooksAsync();
    const books = bookList.getBooks();
    expect(books.length).toEqual(1);
    expect(books[0].description).toEqual('xxx');
});

test('can read book file with line comments', async () => {
    const books_csv =
        `description,action,id,titleId,isbn,asin,name ,pubStatus,pubDate,pubStatusDetail,publishTime,coverImageUrl,scrapedSeriesTitle,scrapedIsArchived
        xxx ## blah ,      ,b ,b      ,b   ,b   ,Belle,         ,       ,               ,           ,             ,                  ,`;

    const BOOKS_CONF_WITH_COMMENTS = `
authorFirstName = Belle ## lalalalal lalal
authorLastName = test_author_last_name
category1 = test_cat1
category2 = test_cat2
newCategory1 = test_new_cat1
newCategory2 = test_new_cat2
newCategory3 = test_new_cat3
coverLocalFile = test_cover_file_\${name}
description = test_description for \${name}
illustratorFirstName = test_illustrator_first_name
illustratorLastName = test_illustrator_last_name
keyword0 = test \${name}
keyword1 = 
keyword2 =
keyword3 =
keyword4 =
keyword5 =
keyword6 = 
language = dutch
manuscriptCreationCommand = make book_\${name}
manuscriptLocalFile = manuscript/file/\${name}.pdf
notes = test notes
priceAu = 
priceCa = 
priceEur =
priceGbp =
priceJp = 
pricePl = 
priceSe = 
priceUsd = 1.2
primaryMarketplace = pl
paperBleed = test_paper_bleed
paperCoverFinish = test_paper_cover_finish
paperColor = test_paper_color
paperTrim = test_paper_trim
signature = \${name}
seriesTitle = My Series
title = Book for \${name}
subtitle = My subtitle
edition = 2
`

    setupFiles({
        'books.csv': books_csv,
        'books.csv.lock': '',
        'books.conf': BOOKS_CONF_WITH_COMMENTS,
    });

    let bookFile = new BookFile('books.csv', 'books.conf', 'content/dir');
    const bookList = await bookFile.readBooksAsync();
    const books = bookList.getBooks();
    expect(books.length).toEqual(1);
    expect(books[0].description).toEqual('xxx');
    expect(books[0].authorFirstName).toEqual('Belle');
});

test('detects default defined more than once (not supported)', async () => {
    const books_csv =
        `action,id,titleId,isbn,asin,name ,pubStatus,pubDate,pubStatusDetail,publishTime,coverImageUrl,scrapedSeriesTitle,scrapedIsArchived
               ,b ,b      ,b   ,b   ,Belle,         ,       ,               ,           ,             ,                  ,`;
    let books_conf = BOOKS_CONF
    books_conf += "mykey = v1\n"
    books_conf += "mykey = v2\n"
    books_conf += "another key = whatever\n"
    setupFiles({
        'books.csv': books_csv,
        'books.csv.lock': '',
        'books.conf': books_conf,
    });

    const bookFile = new BookFile('books.csv', 'books.conf', 'content/dir');
    expect(bookFile.getConfigForKey('mykey')).toBe("v2");
});
