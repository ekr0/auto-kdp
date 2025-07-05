import { addAfter, addBefore, arraysEqual, cleanupHtmlForAmazonDescription, clipLen, isInt, isPositiveInt, mergeActions, removeSpacesInHtml, normalizeSearchQuery, stripPrefix, stripSuffix, stripQuotes, stringToIntOrThrow, removeComment, goToSleep } from './utils.js';

test('mergeActions', () => {
  expect(mergeActions('a:b', 'c:d')).toEqual('a:b:c:d');
  expect(mergeActions('a', 'c')).toEqual('a:c');
  expect(mergeActions('a:b', '')).toEqual('a:b');
  expect(mergeActions('a', '')).toEqual('a');
  expect(mergeActions('', 'a:b')).toEqual('a:b');
  expect(mergeActions('', 'a')).toEqual('a');
  expect(mergeActions('', '')).toEqual('');
});

test('arraysEqual', () => {
  expect(arraysEqual(null, null)).toEqual(true);
  expect(arraysEqual([], [])).toEqual(true);
  expect(arraysEqual([], null)).toEqual(false);
  expect(arraysEqual(null, ['a'])).toEqual(false);
  expect(arraysEqual(['a'], ['a'])).toEqual(true);
  expect(arraysEqual(['a'], ['b'])).toEqual(false);
  expect(arraysEqual(['a'], ['b', 'c'])).toEqual(false);
  expect(arraysEqual(['a', 'c'], ['a', 'b'])).toEqual(false);
  expect(arraysEqual(['a', 'c'], ['a', 'c'])).toEqual(true);

  let arr = ['a', 'z'];
  expect(arraysEqual(arr, arr)).toEqual(true);
});

test('removeSpacesInHtml', () => {
  expect(removeSpacesInHtml('')).toEqual('');

  // Preservation
  expect(removeSpacesInHtml('blah blah')).toEqual('blah blah');

  // Spaces
  expect(removeSpacesInHtml('  \t\nblah\t      ')).toEqual('blah');
  expect(removeSpacesInHtml('  blah \n \t blah \n\t \n\n')).toEqual('blah blah');

  // Lists 
  expect(removeSpacesInHtml(' <li> a </li> ')).toEqual('<li>a</li>');
  expect(removeSpacesInHtml(' <ul> <li> a </li> <li> b</li></ul>')).toEqual('<ul><li>a</li><li>b</li></ul>');
  expect(removeSpacesInHtml(' <ol> <li> a </li> </ol>')).toEqual('<ol><li>a</li></ol>');
  expect(removeSpacesInHtml('</ul> <p>')).toEqual('</ul><p>');

  // Headers
  expect(removeSpacesInHtml(' <h1>h1</h1><h4> a </h4> <p>b</p>')).toEqual('<h1>h1</h1><h4>a</h4><p>b</p>');

  // Paragraphs.
  expect(removeSpacesInHtml('  <p>abc</p>   <p>def</p>')).toEqual('<p>abc</p><p>def</p>');
  expect(removeSpacesInHtml('  <p>abc. </p>')).toEqual('<p>abc.</p>');
  expect(removeSpacesInHtml('  <p>   </p>')).toEqual('');
});

test('addBefore', () => {
  expect(addBefore("a!!!bc", "b", "!!!")).toEqual("a!!!bc");
  expect(addBefore("abc", "b", "!!!")).toEqual("a!!!bc");
  expect(addBefore("abc", "a", "!!!")).toEqual("!!!abc");
  expect(addBefore("abc", "c", "!!!")).toEqual("ab!!!c");
  expect(addBefore("abc", "d", "!!!")).toEqual("abc");
  expect(addBefore("abc", "ab", "!!!")).toEqual("!!!abc");
  expect(addBefore("abc", "bc", "!!!")).toEqual("a!!!bc");
  expect(addBefore("abc", "abc", "!!!")).toEqual("!!!abc");
  expect(addBefore("abc", "abcd", "!!!")).toEqual("abc");
  expect(addBefore("abac", "a", "!!!")).toEqual("!!!ab!!!ac");
});

test('addAfter', () => {
  expect(addAfter("abc", "b", "!!!")).toEqual("ab!!!c");
  expect(addAfter("abc", "a", "!!!")).toEqual("a!!!bc");
  expect(addAfter("abc", "c", "!!!")).toEqual("abc!!!");
  expect(addAfter("abc", "d", "!!!")).toEqual("abc");
  expect(addAfter("abc", "ab", "!!!")).toEqual("ab!!!c");
  expect(addAfter("abc", "bc", "!!!")).toEqual("abc!!!");
  expect(addAfter("abc", "abc", "!!!")).toEqual("abc!!!");
  expect(addAfter("abc", "abcd", "!!!")).toEqual("abc");
  expect(addAfter("abac", "a", "!!!")).toEqual("a!!!ba!!!c");
});

test('cleanupHtmlForAmazonDescription', () => {
  expect(cleanupHtmlForAmazonDescription('blah <ul> <li>a</li> </ul> test <ul><li>aa</li></ul>')).toEqual('blah</p><ul><li>a</li></ul><p>test</p><ul><li>aa</li></ul>');
});

test('normalizeSearchQuery', () => {
  expect(normalizeSearchQuery('')).toEqual('');
  expect(normalizeSearchQuery('blah')).toEqual('blah');
  expect(normalizeSearchQuery('blah (a) "b" \'c\' ,d, .e. [f] g?')).toEqual('blah a b c d e f g');
  expect(normalizeSearchQuery('\tblah\n\t  blah  ')).toEqual('blah blah');
  expect(normalizeSearchQuery('blah R-Z')).toEqual('blah R Z');
  expect(normalizeSearchQuery('blah R/Z')).toEqual('blah R Z');
  expect(normalizeSearchQuery('blah R\\Z')).toEqual('blah R Z');
});

test('stripPrefix', () => {
  expect(stripPrefix('', 'blah')).toEqual('');
  expect(stripPrefix('test', 'blah')).toEqual('test');
  expect(stripPrefix('test', '')).toEqual('test');
  expect(stripPrefix('test', 't')).toEqual('est');
  expect(stripPrefix('test', 'te')).toEqual('st');
  expect(stripPrefix('test', 'test')).toEqual('');
});

test('stripSuffix', () => {
  expect(stripSuffix('', 'blah')).toEqual('');
  expect(stripSuffix('test', 'blah')).toEqual('test');
  expect(stripSuffix('test', '')).toEqual('test');
  expect(stripSuffix('test', 't')).toEqual('tes');
  expect(stripSuffix('test', 'st')).toEqual('te');
  expect(stripSuffix('test', 'test')).toEqual('');
});

test('stripQuotes', () => {
  expect(stripQuotes('')).toEqual('');
  expect(stripQuotes('blah')).toEqual('blah');
  expect(stripQuotes('"blah"')).toEqual('blah');
  expect(stripQuotes("'test 123'")).toEqual('test 123');
  expect(stripQuotes('test"')).toEqual('test"');
  expect(stripQuotes("'test")).toEqual("'test");
});

test('isInt', () => {
  expect(isInt('0')).toEqual(true);
  expect(isInt('1')).toEqual(true);
  expect(isInt('-1')).toEqual(true);
  expect(isInt('2')).toEqual(true);
  expect(isInt('-2')).toEqual(true);
  expect(isInt('-234')).toEqual(true);
  expect(isInt('-23456789')).toEqual(true);
  expect(isInt('1.1')).toEqual(false);
  expect(isInt('blah')).toEqual(false);
  expect(isInt('2blah')).toEqual(false);
  expect(isInt('blah2')).toEqual(false);
});


test('isPositiveInt', () => {
  expect(isPositiveInt('0')).toEqual(false);
  expect(isPositiveInt('1')).toEqual(true);
  expect(isPositiveInt('-1')).toEqual(false);
  expect(isPositiveInt('2')).toEqual(true);
  expect(isPositiveInt('-2')).toEqual(false);
  expect(isPositiveInt('-234')).toEqual(false);
  expect(isPositiveInt('234')).toEqual(true);
  expect(isPositiveInt('-23456789')).toEqual(false);
  expect(isPositiveInt('23456789')).toEqual(true);
  expect(isPositiveInt('1.1')).toEqual(false);
  expect(isPositiveInt('blah')).toEqual(false);
  expect(isPositiveInt('2blah')).toEqual(false);
  expect(isPositiveInt('blah2')).toEqual(false);
});

test('stringToInt', () => {
  expect(stringToIntOrThrow('0')).toEqual(0);
  expect(stringToIntOrThrow('1')).toEqual(1);
  expect(stringToIntOrThrow('-1')).toEqual(-1);
  expect(stringToIntOrThrow('2')).toEqual(2);
  expect(stringToIntOrThrow('22222')).toEqual(22222);
  expect(stringToIntOrThrow('-102938')).toEqual(-102938);
  expect(() => stringToIntOrThrow('1.1')).toThrow(/cannot parse/)
  expect(() => stringToIntOrThrow('abc')).toThrow(/cannot parse/)
});

test('clipLen', () => {
  expect(clipLen(null, 5)).toEqual(null);
  expect(clipLen('blah', 5)).toEqual('blah');
  expect(clipLen('blah', 4)).toEqual('blah');
  expect(clipLen('blah', 3)).toEqual('bla');
  expect(clipLen('blah', 2)).toEqual('bl');
  expect(clipLen('blah', 1)).toEqual('b');
  expect(clipLen('blah', 0)).toEqual('');
});

test('removeComment', () => {
  expect(removeComment('a bc')).toEqual('a bc');
  expect(removeComment('a bc ## blah')).toEqual('a bc ');
  expect(removeComment('a bc## blah ## blah')).toEqual('a bc');
});

test('goToSleep', async () => {
  const start = Date.now();
  await goToSleep(200);
  const elapsed = Date.now() - start;
  expect(elapsed).toBeGreaterThanOrEqual(180); // allow some timing inaccuracy
});
