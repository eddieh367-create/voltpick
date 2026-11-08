#!/usr/bin/env node
'use strict';
// Builds a clean deploy artifact with every Amazon link tagged from affiliate.config.json.
const fs = require('node:fs');
const path = require('node:path');

const EXCLUDE = new Set(['.git', '.github', 'tests', 'scripts', 'node_modules', '_site',
  'package.json', 'package-lock.json', 'affiliate.config.json', '.gitignore']);
const TAG_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,60}-\d{2}$/;
const HREF_RE = /(\bhref\s*=\s*)(["'])(.*?)\2/gis;
const BASE = 'https://eddieh367-create.github.io/voltpick/';

function loadConfig(file) {
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error('Invalid affiliate config ' + file + ': ' + e.message); }
  const tag = cfg && cfg.amazonAssociateTag;
  if (typeof tag !== 'string' || !TAG_RE.test(tag)) {
    throw new Error('Invalid amazonAssociateTag in ' + file + ': ' + JSON.stringify(tag));
  }
  return { amazonAssociateTag: tag };
}

const decode = s => s.replace(/&amp;/gi, '&');
const encode = s => s.replace(/&/g, '&amp;');
function parse(raw) { try { return new URL(decode(raw.trim()), BASE); } catch (_) { return null; } }
function isAmazon(u) {
  if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:')) return false;
  const h = u.hostname.toLowerCase();
  return h === 'amazon.com' || h.endsWith('.amazon.com');
}
function isShort(u) {
  return !!u && (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.toLowerCase() === 'amzn.to';
}

function rewriteHtml(html, tag, label = 'html') {
  let count = 0;
  const out = html.replace(HREF_RE, (all, pre, q, raw) => {
    const u = parse(raw);
    if (isShort(u)) throw new Error(label + ': amzn.to short link not allowed (' + raw + ')');
    if (!isAmazon(u)) return all;
    u.searchParams.delete('tag');
    u.searchParams.append('tag', tag);
    count++;
    return pre + q + encode(u.href) + q;
  });
  return { html: out, count };
}

function validateHtml(html, tag, label = 'html') {
  const errors = []; let count = 0;
  for (const m of html.matchAll(HREF_RE)) {
    const raw = m[3]; const u = parse(raw);
    if (isShort(u)) { errors.push(label + ': amzn.to short link ' + raw); continue; }
    if (!isAmazon(u)) continue;
    count++;
    const tags = u.searchParams.getAll('tag');
    if (tags.length !== 1 || tags[0] !== tag) errors.push(label + ': expected single tag=' + tag + ' got [' + tags.join(',') + '] in ' + raw);
    if (/&(?!amp;|#\d+;|#x[0-9a-f]+;|[a-z]+;)/i.test(raw)) errors.push(label + ': unescaped & in ' + raw);
  }
  return { errors, count };
}

function walk(dir, root, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.relative(root, path.join(dir, ent.name));
    if (dir === root && EXCLUDE.has(ent.name)) continue;
    if (ent.name === '.git' || ent.name === 'node_modules') continue;
    if (ent.isDirectory()) walk(path.join(dir, ent.name), root, files);
    else if (ent.isFile()) files.push(rel);
  }
  return files;
}

function build({ root, outDir, configFile }) {
  const { amazonAssociateTag: tag } = loadConfig(configFile);
  fs.rmSync(outDir, { recursive: true, force: true });
  let links = 0, pages = 0; const errors = [];
  for (const rel of walk(root, root)) {
    const src = path.join(root, rel), dst = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (!/\.html?$/i.test(rel)) { fs.copyFileSync(src, dst); continue; }
    const r = rewriteHtml(fs.readFileSync(src, 'utf8'), tag, rel);
    const v = validateHtml(r.html, tag, rel);
    errors.push(...v.errors); links += r.count; pages++;
    fs.writeFileSync(dst, r.html);
  }
  if (errors.length) throw new Error('Affiliate validation failed:\n' + errors.join('\n'));
  return { tag, pages, links };
}

module.exports = { loadConfig, rewriteHtml, validateHtml, build, isAmazon };

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  try {
    const r = build({ root, outDir: path.join(root, '_site'), configFile: path.join(root, 'affiliate.config.json') });
    console.log('Built _site: ' + r.pages + ' HTML pages, ' + r.links + ' Amazon links tagged ' + r.tag);
  } catch (e) { console.error(e.message); process.exit(1); }
}
