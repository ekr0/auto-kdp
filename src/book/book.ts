import * as fs from 'fs';

import { Keys, ALL_MARKETPLACES, ALL_BOOK_LANGUAGES, OPTIONAL_KEYS } from './keys.js';
import { resolveAllValues } from './resolve.js';
import { copyMap, clipLen, isPositiveInt } from '../util/utils.js';

// List of keys for which there cannot be a "default" value.
// Reasons are that these field are unique or assigned from Amazon.
// These are the only keys that AutoKDP can update.
const _KEYS_WITH_NO_DEFAULT = [
  Keys.ACTION,
  Keys.ASIN,
  Keys.COVER_IMAGE_URL,
  Keys.ID,
  Keys.ISBN,
  Keys.PUB_DATE,
  Keys.PUB_STATUS,
  Keys.PUB_STATUS_DETAIL,
  Keys.PUBLISH_TIME,
  Keys.TITLE_ID,
  Keys.SCRAPED_SERIES_TITLE,
  Keys.SCRAPED_IS_ARCHIVED
];

const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_TITLE_AND_SUBTITLE_LENGTH = 255;

export class Book {

  private origData: Map<string, string>;

  // Fields that AutoKdp is not allowed to update
  public action: string;
  public asin: string;
  public coverImageUrl: string;
  public id: string;
  public isbn: string;
  public pubDate: string;
  public pubStatus: string;
  public pubStatusDetail: string;
  public publishTime: Date | null;
  public titleId: string;
  public scrapedSeriesTitle: string;
  public scrapedIsArchived: string;

  // Fields that AutoKdp is not allowed to update
  readonly authorFirstName: string;
  readonly authorLastName: string;
  readonly category1: string;
  readonly category2: string;
  readonly newCategory1: string;
  readonly newCategory2: string;
  readonly newCategory3: string;
  readonly coverLocalFile: string;
  readonly description: string;
  readonly illustratorFirstName: string;
  readonly illustratorLastName: string;
  readonly keyword0: string;
  readonly keyword1: string;
  readonly keyword2: string;
  readonly keyword3: string;
  readonly keyword4: string;
  readonly keyword5: string;
  readonly keyword6: string;
  readonly language: string;
  readonly manuscriptCreationCommand: string;
  readonly manuscriptLocalFile: string;
  readonly notes: string;
  readonly priceAu: number;
  readonly priceCa: number;
  readonly priceEur: number;
  readonly priceGbp: number;
  readonly priceJp: number;
  readonly pricePl: number;
  readonly priceSe: number;
  readonly priceUsd: number;
  readonly primaryMarketplace: string;
  readonly seriesTitle: string;
  readonly seriesId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly edition: string;
  readonly signature: string;
  readonly paperColor: string;
  readonly paperTrim: string;
  readonly paperBleed: string;
  readonly paperCoverFinish: string;

  // Fields only needed for books in Japanese
  readonly titlePronunciation: string;
  readonly subtitlePronunciation: string;
  readonly authorWhole: string;
  readonly authorWholePronunciation: string;
  readonly illustratorWhole: string;
  readonly illustratorWholePronunciation: string;

  constructor(data: Map<string, string>, defaults: Map<string, string>, contentDir: string, allDataMaps: Array<Map<string, string>>) {
    // Check for illegal defaults.
    for (const k of _KEYS_WITH_NO_DEFAULT) {
      if (defaults.has(k)) {
        throw 'Cannot have default for key: ' + k;
      }
    }

    // Save all the original data for later writing it out
    this.origData = copyMap(data);

    // Combine defaults with data.
    let mergedDataMap = new Map<string, string>();
    for (const [key, val] of defaults) {
      mergedDataMap.set(key, val);
    }
    for (const [key, val] of data) {
      mergedDataMap.set(key, val);
    }

    let unresolvedKeys = new Set<string>();
    let resolvedDataMap = resolveAllValues(mergedDataMap, unresolvedKeys, allDataMaps);

    // Check if everything was resolved
    if (unresolvedKeys.size > 0) {
      throw 'Could not resolve keys: ' + Array.from(unresolvedKeys);
    }

    // Retrieve all required values.
    let getValue = (x: string, isOptional: boolean = false) => {
      if (!resolvedDataMap.has(x)) {
        if (x == 'category1' || x == 'category2') {
          // Permit category1 or category2 be missing because they are getting deprecated.
          return '';
        }
        if (isOptional) {
          return '';
        } else {
          throw 'Key not found: ' + x;
        }
      }
      let val = resolvedDataMap.get(x);
      if (val.startsWith("file:")) {
        const fileName = val.substring("file:".length);
        try {
          val = fs.readFileSync(fileName).toString();
        } catch (e) {
          /* istanbul ignore next */
          throw new Error("Could not read file: " + fileName + " to set the value of " + x);
        }
      }
      return val;
    }
    let getOptionalValue = (x: string) => getValue(x,  /*isOptional=*/ true);
    let parseFloatOrNull = (x: string | null) => x == null || x == '' ? null : parseFloat(x);

    // Fields that AutoKdp is allowed to update
    this.action = getValue(Keys.ACTION);
    this.asin = getValue(Keys.ASIN);
    this.id = getValue(Keys.ID);
    this.titleId = getValue(Keys.TITLE_ID);
    this.isbn = getValue(Keys.ISBN);
    this.pubDate = getValue(Keys.PUB_DATE);
    this.pubStatus = getValue(Keys.PUB_STATUS);
    this.pubStatusDetail = getValue(Keys.PUB_STATUS_DETAIL);
    const publishTimeStr = getValue(Keys.PUBLISH_TIME);
    this.publishTime = publishTimeStr == '' ? null : new Date(Date.parse(publishTimeStr));
    this.scrapedSeriesTitle = getValue(Keys.SCRAPED_SERIES_TITLE);
    this.scrapedIsArchived = getValue(Keys.SCRAPED_IS_ARCHIVED);
    if (!["undetermined", "archived", ""].includes(this.scrapedIsArchived)) {
      throw new Error("Unknown value for 'is archived': " + this.scrapedIsArchived);
    }
    this.coverImageUrl = getValue(Keys.COVER_IMAGE_URL);

    // Fields that AutoKdp is not allowed to updaten
    this.authorFirstName = getValue(Keys.AUTHOR_FIRST_NAME);
    this.authorLastName = getValue(Keys.AUTHOR_LAST_NAME);
    this.category1 = getOptionalValue(Keys.CATEGORY1);
    this.category2 = getOptionalValue(Keys.CATEGORY2);
    this.newCategory1 = getValue(Keys.NEW_CATEGORY1);
    this.newCategory2 = getValue(Keys.NEW_CATEGORY2);
    this.newCategory3 = getValue(Keys.NEW_CATEGORY3);
    this.coverLocalFile = contentDir + '/' + getValue(Keys.COVER_FILE);
    this.description = getValue(Keys.DESCRIPTION);
    if (this.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error("Description too long: max len is " + MAX_DESCRIPTION_LENGTH +
        " but got: " + this.description.length + ": " + this.description)
    }
    this.illustratorFirstName = getValue(Keys.ILLUSTRATOR_FIRST_NAME);
    this.illustratorLastName = getValue(Keys.ILLUSTRATOR_LAST_NAME);
    this.keyword0 = getOptionalValue(Keys.KEYWORD0);
    this.keyword1 = getOptionalValue(Keys.KEYWORD1);
    this.keyword2 = getOptionalValue(Keys.KEYWORD2);
    this.keyword3 = getOptionalValue(Keys.KEYWORD3);
    this.keyword4 = getOptionalValue(Keys.KEYWORD4);
    this.keyword5 = getOptionalValue(Keys.KEYWORD5);
    this.keyword6 = getOptionalValue(Keys.KEYWORD6);
    this.language = getValue(Keys.LANGUAGE).toLowerCase();
    if (ALL_BOOK_LANGUAGES.indexOf(this.language) < 0) {
      throw new Error("Unsupported book language: " + this.language);
    }
    this.manuscriptCreationCommand = getValue(Keys.MANUSCRIPT_CREATION_COMMAND);
    this.manuscriptLocalFile = contentDir + '/' + getValue(Keys.MANUSCRIPT_FILE);
    this.notes = getValue(Keys.NOTES);
    this.priceAu = parseFloatOrNull(getValue(Keys.PRICE_AU));
    this.priceCa = parseFloatOrNull(getValue(Keys.PRICE_CA));
    this.priceEur = parseFloatOrNull(getValue(Keys.PRICE_EUR));
    this.priceGbp = parseFloatOrNull(getValue(Keys.PRICE_GBP));
    this.priceJp = parseFloatOrNull(getValue(Keys.PRICE_JP));
    this.pricePl = parseFloatOrNull(getValue(Keys.PRICE_PL));
    this.priceSe = parseFloatOrNull(getValue(Keys.PRICE_SE));
    this.priceUsd = parseFloatOrNull(getValue(Keys.PRICE_USD));
    this.primaryMarketplace = getValue(Keys.PRIMARY_MARKETPLACE);
    if (!Object.keys(ALL_MARKETPLACES).includes(this.primaryMarketplace)) {
      throw new Error("Unrecognized primary marketplace: " + this.primaryMarketplace)
    }
    this.seriesTitle = getOptionalValue(Keys.SERIES_TITLE);
    this.seriesId = getOptionalValue(Keys.SERIES_ID);
    this.title = getValue(Keys.TITLE);
    this.subtitle = getOptionalValue(Keys.SUBTITLE);
    if (this.title.length + this.subtitle.length > MAX_TITLE_AND_SUBTITLE_LENGTH) {
      throw new Error("Title+Subtitle too long: max len is " + MAX_TITLE_AND_SUBTITLE_LENGTH +
        " but got: " + (this.title.length + this.subtitle.length) + ": " + this.title + " / " + this.subtitle)
    }
    this.edition = getOptionalValue(Keys.EDITION);
    if (this.edition != '' && !isPositiveInt(this.edition)) {
      throw new Error("Edition must be a positive integer, but got: " + this.edition)
    }
    this.signature = getValue(Keys.SIGNATURE);
    this.paperColor = getValue(Keys.PAPER_COLOR);
    this.paperTrim = getValue(Keys.PAPER_TRIM);
    this.paperBleed = getValue(Keys.PAPER_BLEED);
    this.paperCoverFinish = getValue(Keys.PAPER_COVER_FINISH);

    // Fields needed only for the Japanese language.
    this.titlePronunciation = getOptionalValue(Keys.TITLE_PRONUNCIATION);
    this.subtitlePronunciation = getOptionalValue(Keys.SUBTITLE_PRONUNCIATION);
    this.authorWhole = getOptionalValue(Keys.AUTHOR_WHOLE);
    this.authorWholePronunciation = getOptionalValue(Keys.AUTHOR_WHOLE_PRONUNCIATION);
    this.illustratorWhole = getOptionalValue(Keys.ILLUSTRATOR_WHOLE);
    this.illustratorWholePronunciation = getOptionalValue(Keys.ILLUSTRATOR_WHOLE_PRONUNCIATION);

    // Handle special actions
    if (this.action == 'all') {
      this.action = 'book-metadata:assign-isbn:produce-manuscript:content:scrape-isbn:pricing:set-series-title:scrape:publish:scrape';
      /* after the book is published, do the 'scrape-amazon-image' action */
    } else if (this.action == 'all-but-no-publish') {
      this.action = 'book-metadata:assign-isbn:produce-manuscript:content:scrape-isbn:pricing:set-series-title:scrape';
    }
  }

  getPriceForMarketplace(marketplace: string): number {
    switch (marketplace) {
      case "us": return this.priceUsd;
      case "uk": return this.priceGbp;
      case "be":
      case "de":
      case "es":
      case "fr":
      case "fr":
      case "ie":
      case "it":
      case "nl":
        return this.priceEur;
      case "pl":
        return this.pricePl;
      case "se":
        return this.priceSe;
      case "jp":
        return this.priceJp;
      case "ca":
        return this.priceCa;
      case "au":
        return this.priceAu;
    }
    throw new Error("Unrecognized marketplace: " + marketplace);
  }

  getPreservedKey(key: string): string {
    return this.origData.get(key);
  }

  hasOldCategories() {
    return this.category1 != '' && this.category2 != '';
  }

  hasNewCategories() {
    return this.newCategory1 != '' && this.newCategory2 != '' && this.newCategory3 != '';
  }

  canBeCreated() {
    let isJapanese = this.language.toLocaleLowerCase() == "japanese";

    let titleOk = this.title != '' && (!isJapanese || this.titlePronunciation != '');
    let subtitleOk = this.subtitle == '' || (!isJapanese || this.subtitlePronunciation != '') ;
    let authorOk = this.authorFirstName != '' && this.authorLastName != '' &&
      (!isJapanese || this.authorWhole != '' && this.authorWholePronunciation != '');
    let hasIllustrator = this.illustratorFirstName != '' || this.illustratorLastName != '';
    let illustratorOk = !hasIllustrator || (this.illustratorFirstName != '' && this.illustratorLastName != '' &&
      (!isJapanese || this.illustratorWhole != '' && this.illustratorWholePronunciation != ''));
    let descriptionOk = this.description != '';
    let categoriesOk = this.hasOldCategories() || this.hasNewCategories()

    return titleOk && subtitleOk && authorOk && illustratorOk && descriptionOk  && categoriesOk;
  }

  // Checks whether we can edit critical metdata such as title or author. Editing becomes
  // impossible after the book is LIVE (and has not been unpublished).
  canEditCriticalMetadata() {
    return ['', 'DRAFT'].indexOf(this.pubStatus) >= 0 && !this.isArchived()
  }

  isFullyLive() {
    return this.pubStatus == 'LIVE' && this.pubStatusDetail == '' &&
      this.scrapedSeriesTitle.toLowerCase().includes('ok') && this.scrapedIsArchived == '';
  }

  isLive() {
    return this.pubStatus == 'LIVE'
  }

  canBePublished() {
    return this.pubStatus == 'DRAFT' || this.pubStatus == 'LIVE' && this.pubStatusDetail == 'With unpublished changes';
  }

  isPublishingInProgress() {
    return this.pubStatus == 'IN REVIEW' ||
      this.pubStatus == 'LIVE' && ['Updates publishing', 'Updates in review'].indexOf(this.pubStatusDetail) >= 0;
  }

  isUnpublished() {
    return this.pubStatus == 'DRAFT' && this.pubStatusDetail == 'Unpublished'
  }

  isArchived() {
    return this.scrapedIsArchived == 'archived';
  }

  numActions() {
    return this.action.split(':').filter(x => x).length;
  }

  hasAction() {
    return this.numActions() > 0;
  }

  // This constant splitting is inefficient, but is not worth optimizing.
  getFirstAction() {
    let actions = this.action.split(':').filter(x => x);
    return actions.length == 0 ? '' : actions[0];
  }

  popFirstAction() {
    let actions = this.action.split(':').filter(x => x);
    if (actions.length == 0) {
      return '';
    }
    let firstAction = actions.shift();
    this.action = actions.join(':');
    return firstAction;
  }

  getActionList() {
    return this.action.split(':').filter(x => x);
  }

  hasNonScrapingAction(): boolean {
    for (const action of this.getActionList()) {
      if (action != "scrape" && action != "scrape-amazon-image" && action != "scrape-isbn") {
        return true;
      }
    }
    return false;
  }

  getDataToWrite() {
    let result = {};
    // First return the original values.
    for (const [key, val] of this.origData) {
      result[key] = this.getValueToWrite(val);
    }
    // Override the changed values.
    for (const key of _KEYS_WITH_NO_DEFAULT) {
      result[key] = this.getValueToWrite(this[key]);
    }
    return result;
  }

  getValueToWrite(obj: any): string | boolean | null {
    if (obj instanceof Date) {
      return obj.toString();
    }
    if (["string", "boolean"].includes(typeof(obj))) {
      return obj;
    }
    if (obj == null) {
      return '';
    }
    throw Error("Uknown object type: " + typeof(obj) + ": for object: " + obj);
  }

  prefix(): string {
    return this.signature;
  }

  toString(): string {
    let result = "";
    for (const k in Keys) {
      const key = Keys[k];
      let val = this[key];
      if (OPTIONAL_KEYS.indexOf(key) >= 0 && (val == '' || val == undefined || val == null)) {
        // Do not export optional empty keys.
        continue
      }
      if (val != null) {
        if (typeof val === "string") {
          val = clipLen(val as string, 200);
        } else if (val instanceof Date) {
          val = val.toString()
        }
      }
      result += "    " + key + " = " + val + "\n";
    }
    return result;
  }
}

