import * as fs from 'fs';

import * as lockfile from 'proper-lockfile';
import CsvParser from 'csv-parser';
import * as CsvWriter from 'csv-writer';
import PropertiesReader from 'properties-reader';

import { Book } from './book.js';
import { BookList } from './book-list.js';
import { removeComment } from '../util/utils.js';

// This seems to be required on mac, even though all files are UTF-8.
// Change to utf-8 on other platforms. This seems to be a bug in
// properties-reader code.
export const FILE_ENCODING = "ascii";

// We protect  file with a lock, because it will be updated in-place.
export class BookFile {
  private contentDir: string;
  private bookFilePath: string;
  private lockFilePath: string;
  private outputFilePath: string;
  private bookConfig = new Map<string, string>();
  private headers = new Array<string>();
  private isbns = new Map<string, Book>();
  private ids = new Map<string, Book>();
  private titleIds = new Map<string, Book>();
  private asins = new Map<string, Book>();
  private signatures = new Map<string, Book>();

  constructor(bookFilePath: string, bookConfigFilePath: string, contentDir: string) {
    this.contentDir = contentDir;
    this.bookFilePath = bookFilePath;
    this.lockFilePath = bookFilePath + '.lock';
    this.outputFilePath = bookFilePath + '.new';

    PropertiesReader(bookConfigFilePath, FILE_ENCODING).each((k, v) => {
      /* Istanbul ignore next */
      if (this.bookConfig.has(k)) {
        throw new Error("Should not happen")
      }
      this.bookConfig.set(k, removeComment(v as string).trim())
    });
  }

  async readBooksAsync(): Promise<BookList> {
    return new Promise((resolve, reject) => {
      lockfile.lock(this.lockFilePath)
        .then((release) => {
          let dataMaps = [];
          fs.createReadStream(this.bookFilePath)
            .pipe(CsvParser({
              mapHeaders: ({ header, index }) => {
                let h = header.trim();
                this.headers[index] = h;
                return h;
              },
              mapValues: ({ header, index, value }) => {
                return removeComment(value).trim().replace('^"', '').replace('"$', '');
              },
              strict: true,
              skipComments: true
            }))
            .on('data', (data) => {
              dataMaps.push(new Map(Object.entries(data)));
            })
            .on('end', () => {
              // console.log('Read ' + dataMaps.length + ' rows');
              let bookList = new BookList();
              let rowNumber = 1;
              for (const dataMap of dataMaps) {
                try {
                  let book = new Book(dataMap, this.bookConfig, this.contentDir, dataMaps);
                  this.addBook(book, bookList);
                  rowNumber++;
                } catch (e) {
                  console.error('Problem processing row', rowNumber, 'with data:', dataMap, ': ', e);
                  reject(e);
                  return release();
                }
              }
              resolve(bookList);
              return release();
            })
        })
    });
  }

  async writeBooksAsync(bookList: BookList) {
    return new Promise((resolve, reject) =>
      lockfile.lock(this.lockFilePath)
        .then((release) => {
          try {
            const headers = this.headers.map(x => ({ id: x, title: x }));
            const writer = CsvWriter.createObjectCsvWriter({ path: this.outputFilePath, header: headers });
            const records = bookList.getBooks().map(x => x.getDataToWrite());
            writer.writeRecords(records)
              .then(() => resolve(records))
              .catch(/* istanbul ignore next */
                (e) => reject(e));
          } catch (e) {
            /* istanbul ignore next */
            reject(e);
          } finally {
            return release();
          }
        })
    );
  }

  addBook(book: Book, bookList: BookList) {
    // Check id uniqueness.
    if (book.id != '') {
      if (book.id in this.ids) {
        throw new Error('Id not unique: ' + book.id);
      }
      this.ids[book.id] = book;
    }

    // Check titleId uniqueness.
    if (book.titleId != '') {
      if (book.titleId in this.titleIds) {
        throw new Error('TitleId not unique: ' + book.titleId);
      }
      this.titleIds[book.titleId] = book;
    }

    // Check asin uniqueness.
    if (book.asin != '') {
      if (book.asin in this.asins) {
        throw new Error('ASIN not unique: ' + book.asin);
      }
      this.asins[book.asin] = book;
    }

    // Check isbn uniqueness.
    if (book.isbn != '') {
      if (book.isbn in this.isbns) {
        throw new Error('ISBN not unique: ' + book.isbn);
      }
      this.isbns[book.isbn] = book;
    }

    // Check signature (name, gender, image id) uniqness.
    let sig = book.signature;
    if (sig in this.signatures) {
      throw new Error('Signature not unique: ' + sig);
    }
    this.signatures[sig] = book;

    bookList.addBook(book);
  }

  getConfigForKey(key: string): string {
    return this.bookConfig.get(key);
  }
}
