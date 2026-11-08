# VoltPick

Static site published to GitHub Pages by `.github/workflows/pages.yml`.

## Amazon Associate ID: one setting

The Amazon tracking ID lives only in `affiliate.config.json`:

```json
{ "amazonAssociateTag": "voltpick-20" }
```

To change it, edit that value and push to `main`. The workflow runs the tests, builds `_site/`,
rewrites every Amazon `href` (amazon.com and its subdomains) to carry exactly one `tag=<value>`,
validates the result and deploys it. The source HTML is never modified, so tags in the source
files may be old; the deployed build is what counts.

The build fails on an invalid config, any `amzn.to` short link (its tag cannot be changed;
replace it with a full `https://www.amazon.com/dp/<ASIN>` link), a missing/wrong/duplicate tag,
or an unsupported HTML entity in an Amazon link. Non-Amazon links (e.g. Craighill) are untouched.

## Local commands

```sh
npm test        # run tests (Node 20+)
npm run build   # build and validate _site/
```
