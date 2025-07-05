import { Book } from "../book/book.js";

export function mergeActions(action1: string, action2: string): string {
    let a1 = action1.split(':').filter(x => x);
    let a2 = action2.split(':').filter(x => x);
    return [...a1, ...a2].join(':');
}

/* istanbul ignore next */
export function debug(book: Book, verbose: boolean, message: string) {
    if (verbose) {
        const datePrefix = new Date().toLocaleString();
        const wholePrefix = datePrefix + " " + book.prefix() + "(" + book.id +"):: ";
        console.debug(wholePrefix + message);
    }
}

/* istanbul ignore next */
export function error(book: Book, message: string, e: Error | null = null) {
    const datePrefix = new Date().toLocaleString();
    const wholePrefix = datePrefix + " " + book.prefix() + ":: ";
    if (e) {
        console.error(wholePrefix + message, e);
    } else {
        console.error(wholePrefix + message);
    }
}

export function arraysEqual(a: Array<any>, b: Array<any>): boolean {
    if (a === b) {
        return true;
    }
    if (a == null) {
        return b == null;
    }
    if (b == null || a.length != b.length) {
        return false;
    }
    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

export function removeSpacesInHtml(str: string): string {
    return str
        .replaceAll('\n', ' ')  // Whitespace -> spaces
        .replaceAll('\t', ' ')  // Whitespace -> spaces
        .replaceAll(/\s+/g, ' ')
        .replaceAll(/\s+$/g, '')
        .replaceAll(' <li>', '<li>').replaceAll('<li> ', '<li>').replaceAll('</li> ', '</li>').replaceAll(' </li>', '</li>')
        .replaceAll(' <ul>', '<ul>').replaceAll('<ul> ', '<ul>').replaceAll('</ul> ', '</ul>').replaceAll(' </ul>', '</ul>')
        .replaceAll(' <ol>', '<ol>').replaceAll('<ol> ', '<ol>').replaceAll('</ol> ', '</ol>').replaceAll(' </ol>', '</ol>')
        .replaceAll(' <p>', '<p>').replaceAll('<p> ', '<p>').replaceAll('</p> ', '</p>').replaceAll(' </p>', '</p>')
        .replaceAll(' <h1>', '<h1>').replaceAll('<h1> ', '<h1>').replaceAll('</h1> ', '</h1>').replaceAll(' </h1>', '</h1>')
        .replaceAll(' <h2>', '<h2>').replaceAll('<h2> ', '<h2>').replaceAll('</h2> ', '</h2>').replaceAll(' </h2>', '</h2>')
        .replaceAll(' <h3>', '<h3>').replaceAll('<h3> ', '<h3>').replaceAll('</h3> ', '</h3>').replaceAll(' </h3>', '</h3>')
        .replaceAll(' <h4>', '<h4>').replaceAll('<h4> ', '<h4>').replaceAll('</h4> ', '</h4>').replaceAll(' </h4>', '</h4>')
        .replaceAll(' <h5>', '<h5>').replaceAll('<h5> ', '<h5>').replaceAll('</h5> ', '</h5>').replaceAll(' </h5>', '</h5>')
        .replaceAll(' <h6>', '<h6>').replaceAll('<h6> ', '<h6>').replaceAll('</h6> ', '</h6>').replaceAll(' </h6>', '</h6>')
        .replaceAll('<p></p>', '') // Remove empty paragraphs
        .replaceAll(/\s+$/g, '')
        .trim();
}

// In string 'str', where the 'locator' is found, prefix the locator with the provided prefix.
export function addBefore(str: string, locator, prefixToAddBeforeLocator) {
    const v = str.split(locator);
    if (v.length == 1) {
        return str;
    }
    const result = v.join(prefixToAddBeforeLocator + locator);
    // Now we maybe some preifx is there twice.
    return result.replaceAll(prefixToAddBeforeLocator + prefixToAddBeforeLocator + locator, prefixToAddBeforeLocator + locator);
}

// In string 'str', where the 'locator' is found, suffix the locator with the provided prefix.
export function addAfter(str: string, locator, suffixToAddAfterLocator) {
    const v = str.split(locator);
    if (v.length == 1) {
        return str;
    }
    const result = v.join(locator + suffixToAddAfterLocator);
    // Now we maybe some suffix is there twice.
    return result.replaceAll(locator + suffixToAddAfterLocator + suffixToAddAfterLocator, locator + suffixToAddAfterLocator);
}

// This is needec because Amazon is formatting the HTML in such a way that "<ul></ul>" is treated as a paragraph,
// even if it is inside a paragraph, so for example Amazon rewrites
//
//    <p>blah <ul> <li>abc</li></ul></p>
// to
//    <p>blah</p><ul> <li>abc</li></ul>
//
export function cleanupHtmlForAmazonDescription(str: string): string {
    // Need to extract "<ul>" into its own paragraphs.
    str = removeSpacesInHtml(str);
    str = addBefore(str, "<ul>", "</p>");
    str = addAfter(str, "</ul>", "<p>");
    str = stripPrefix(str, "</p>");
    str = stripSuffix(str, "<p>");
    str = removeSpacesInHtml(str); // To remove empty paragraphs.
    return str;
}

export function normalizeSearchQuery(str: string): string {
    return str
        .replaceAll('?', ' ')
        .replaceAll('(', ' ')
        .replaceAll(')', ' ')
        .replaceAll('[', ' ')
        .replaceAll(']', ' ')
        .replaceAll(',', ' ')
        .replaceAll('.', ' ')
        .replaceAll('"', ' ')
        .replaceAll('\'', ' ')
        .replaceAll('/', ' ')
        .replaceAll('\\', ' ')
        .replaceAll('-', ' ')
        .replaceAll(/\s+/g, ' ')
        .replaceAll(/\s+$/g, '')
        .trim();
}

export function stripPrefix(str: string, prefix: string): string {
    return str.startsWith(prefix) ? str.substring(prefix.length) : str;
}

export function stripSuffix(str: string, suffix: string): string {
    return str.endsWith(suffix) ? str.substring(0, str.length - suffix.length) : str;
}

export function stripQuotes(str: string): string {
    if (str.startsWith('"') && str.endsWith('"') ||
        str.startsWith("'") && str.endsWith("'")) {
        return str.substring(1, str.length - 1);
    }
    return str;
}

export function isInt(str: string): boolean {
    const i = parseInt(str);
    return str == ('' + i);
}

export function isPositiveInt(str: string): boolean {
    const i = parseInt(str);
    return str == ('' + i) && i > 0;
}

export function stringToIntOrThrow(str: string): number {
    const i = parseInt(str);
    if (str != ('' + i)) {
        throw `cannot parse as int: ${str}`;
    }
    return i;
}

export function copyMap(inputMap: Map<string, string>): Map<string, string> {
    const result = new Map();
    for (const [key, val] of inputMap) {
        result.set(key, val);
    }
    return result;
}

export function clipLen(value: string, maxLen: number = 100): string {
    if (value == null || value == undefined) {
        return null;
    }
    if (value.length <= maxLen) {
        return value;
    }
    return value
        .replaceAll("\n", " ")
        .replaceAll("  ", " ")
        .substring(0, maxLen);
}

export function removeComment(value: string): string {
    const i = value.indexOf("##");
    if (i >= 0) {
        value = value.substring(0, i);
    }
    return value;
}

export function goToSleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}