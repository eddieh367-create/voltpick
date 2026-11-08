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
for (const href of ['https://www.amazon.com/dp/B0113UZJE2?tag=voltpick-20', 'https://amazon.com/dp/example', 'https://smile.amazon.com/example', 'https://amzn.to/example']) {
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

const os = require('node:os');
const lib = require('../scripts/affiliate-build.cjs');
const ROOT = path.join(__dirname, '..');
const CONFIG = lib.loadConfig(path.join(ROOT, 'affiliate.config.json'));
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'vp-')); }
function buildRepo() {
  const out = path.join(tmp(), '_site');
  const r = lib.build({ root: ROOT, outDir: out, configFile: path.join(ROOT, 'affiliate.config.json') });
  return { out, r };
}

test('production build tags every Amazon link with configured ID', () => {
  const { out, r } = buildRepo();
  assert.ok(r.links >= 21, 'expected all existing Amazon shopping links, got ' + r.links);
  assert.ok(!fs.existsSync(path.join(out, 'tests')) && !fs.existsSync(path.join(out, 'affiliate.config.json')));
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /techwellness|amzn\.to/);
});
test('earbuds link preserves search rather than guessing a product', () => {
  const { out } = buildRepo();
  const html = fs.readFileSync(path.join(out, 'best-wireless-earbuds-under-100.html'), 'utf8');
  assert.ok(html.includes('https://www.amazon.com/s?k=samsung+galaxy+buds+3+pro&amp;tag=' + CONFIG.amazonAssociateTag));
});
test('Craighill and non-Amazon content preserved byte-for-byte', () => {
  const { out } = buildRepo();
  for (const f of ['craighill-desk-knife.html', 'voltpick.js', 'voltpick.css'])
    assert.equal(fs.readFileSync(path.join(out, f), 'utf8'), fs.readFileSync(path.join(ROOT, f), 'utf8'), f);
});
test('rewrite: missing, wrong, duplicate tags; escaping; quotes; spoof hosts', () => {
  const src = '<a href="https://www.amazon.com/dp/A">x</a><a href=\'https://amazon.com/s?k=a+b&amp;tag=old-20&amp;tag=old2-20\'>y</a>' +
    '<a href="https://smile.amazon.com/x?tag=bad-20">z</a><a href="https://amazon.com.evil.org/?tag=old-20">e</a>' +
    '<a href="https://evil.org/?u=amazon.com">f</a><a href="https://tidd.ly/3U2wJtr">c</a><p>amazon.com tag=old-20</p>';
  const { html, count } = lib.rewriteHtml(src, 'other-21');
  assert.equal(count, 3);
  assert.ok(html.includes('href="https://www.amazon.com/dp/A?tag=other-21"'));
  assert.ok(html.includes("href='https://amazon.com/s?k=a+b&amp;tag=other-21'"));
  assert.ok(html.includes('href="https://smile.amazon.com/x?tag=other-21"'));
  assert.ok(html.includes('href="https://amazon.com.evil.org/?tag=old-20"'));
  assert.ok(html.includes('href="https://evil.org/?u=amazon.com"') && html.includes('href="https://tidd.ly/3U2wJtr"'));
  assert.ok(html.includes('<p>amazon.com tag=old-20</p>'));
  assert.deepEqual(lib.validateHtml(html, 'other-21').errors, []);
});
test('validator rejects missing, wrong, duplicate tags, short links, unescaped &', () => {
  const bad = ['<a href="https://www.amazon.com/dp/A">', '<a href="https://www.amazon.com/dp/A?tag=x-20">',
    '<a href="https://www.amazon.com/dp/A?tag=voltpick-20&amp;tag=voltpick-20">', '<a href="https://amzn.to/abc">',
    '<a href="https://www.amazon.com/s?k=a&tag=voltpick-20">'];
  for (const h of bad) assert.ok(lib.validateHtml(h, 'voltpick-20').errors.length > 0, h);
  assert.throws(() => lib.rewriteHtml('<a href="https://amzn.to/abc">', 'voltpick-20'), /short link/);
});
test('invalid config fails', () => {
  const d = tmp();
  for (const body of ['{', '{}', '{"amazonAssociateTag":""}', '{"amazonAssociateTag":"bad tag"}', '{"amazonAssociateTag":"nosuffix"}']) {
    fs.writeFileSync(path.join(d, 'c.json'), body);
    assert.throws(() => lib.loadConfig(path.join(d, 'c.json')), /Invalid/, body);
  }
});
test('changing only config retags nested fixture site; short links fail build', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'guides/deep'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tests'));
  fs.writeFileSync(path.join(root, 'index.html'), '<a href="https://www.amazon.com/dp/B1?tag=voltpick-20">a</a>');
  fs.writeFileSync(path.join(root, 'guides/deep/p.html'), '<a href="https://amazon.com/s?k=x&amp;tag=old-20">b</a>');
  fs.writeFileSync(path.join(root, 'tests/skip.html'), '<a href="https://amzn.to/zzz">');
  fs.writeFileSync(path.join(root, 'cfg.json'), '{"amazonAssociateTag":"newid-20"}');
  const out = path.join(root, '_site');
  const r = lib.build({ root, outDir: out, configFile: path.join(root, 'cfg.json') });
  assert.equal(r.links, 2);
  assert.ok(fs.readFileSync(path.join(out, 'index.html'), 'utf8').includes('tag=newid-20'));
  assert.ok(fs.readFileSync(path.join(out, 'guides/deep/p.html'), 'utf8').includes('?k=x&amp;tag=newid-20'));
  assert.ok(!fs.existsSync(path.join(out, 'tests')));
  fs.writeFileSync(path.join(root, 'guides/deep/s.html'), '<a href="https://amzn.to/zzz">');
  assert.throws(() => lib.build({ root, outDir: out, configFile: path.join(root, 'cfg.json') }), /short link/);
});
