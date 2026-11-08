const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../voltpick.js'), 'utf8');
function click(href, dataset = {}, targetOverride) {
  let listener;
  const window = {};
  const document = {
    title: 'Example guide', baseURI: 'https://eddieh367-create.github.io/voltpick/',
    createElement: () => ({}), head: { appendChild() {} },
    addEventListener: (name, fn) => { assert.equal(name, 'click'); listener = fn; }
  };
  vm.runInNewContext(source, { window, document, URL });
  const link = { href, dataset };
  listener({ target: targetOverride === undefined ? { closest: () => link } : targetOverride });
  return window.dataLayer.filter(args => args[0] === 'event').map(args => JSON.parse(JSON.stringify(Array.from(args))));
}
for (const href of ['https://www.amazon.com/dp/B0113UZJE2?tag=techwellness-20', 'https://amazon.com/dp/example', 'https://smile.amazon.com/example', 'https://amzn.to/example']) {
  test('tracks Amazon once: ' + href, () => {
    const events = click(href, { product: 'Kitchen scale' });
    assert.equal(events.length, 1);
    assert.equal(events[0][1], 'affiliate_click');
    assert.deepEqual(events[0][2], { affiliate_partner: 'Amazon', product_name: 'Kitchen scale', destination_url: href });
  });
}
test('tracks explicitly labelled Craighill Awin link once', () => {
  const events = click('https://tidd.ly/3U2wJtr', { product: 'Craighill Desk Knife', affiliatePartner: 'Craighill' });
  assert.equal(events.length, 1);
  assert.deepEqual(events[0][2], { affiliate_partner: 'Craighill', product_name: 'Craighill Desk Knife', destination_url: 'https://tidd.ly/3U2wJtr' });
});
test('falls back to guide title', () => assert.equal(click('https://amzn.to/example')[0][2].product_name, 'Example guide'));
for (const href of ['https://tidd.ly/unlabelled', 'https://example.com/?url=amazon.com', 'https://amazon.com.example.org/', 'https://example.org/amazon.com', '/voltpick-blog.html', 'http://[', 'javascript:alert(1)', 'mailto:amazon.com']) {
  test('ignores unrelated or invalid destination: ' + href, () => assert.equal(click(href).length, 0));
}
test('ignores unrecognized Awin merchant label', () => assert.equal(click('https://tidd.ly/example', { affiliatePartner: 'Other merchant' }).length, 0));
test('ignores non-link target', () => assert.equal(click('', {}, { closest: () => null }).length, 0));
test('ignores target without closest', () => assert.equal(click('', {}, {}).length, 0));
test('ignores null event target', () => assert.equal(click('', {}, null).length, 0));
test('Craighill page provides merchant metadata and directory links to page', () => {
  const page = fs.readFileSync(path.join(__dirname, '../craighill-desk-knife.html'), 'utf8');
  assert.match(page, /data-product="Craighill Desk Knife" data-affiliate-partner="Craighill"/);
  const directory = fs.readFileSync(path.join(__dirname, '../voltpick-blog.html'), 'utf8');
  assert.match(directory, /href="craighill-desk-knife.html"/);
});
