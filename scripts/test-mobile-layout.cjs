// Layout regression: Chrome uses real emulated CSS env() values; WebKit uses CSS
// inset overrides because its desktop port does not expose iPhone hardware insets.
const { chromium, webkit } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(path.dirname(path.resolve(process.argv[1])), '../dist');
const artifacts = path.resolve(root, '../.expo/mobile-layout-checks');
const server = http.createServer(async (request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname;
  const file = path.resolve(root, name === '/' ? 'index.html' : `.${name}`);
  if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
  try {
    const bytes = await fs.readFile(file);
    const types = {'.html':'text/html','.js':'text/javascript','.webmanifest':'application/manifest+json','.png':'image/png','.ico':'image/x-icon'};
    response.writeHead(200, {'Content-Type':types[path.extname(file)] ?? 'application/octet-stream'}); response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
async function frame(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function geometry(page) {
  const title = await page.getByText('Calendar',{exact:true}).first().boundingBox();
  const tab = await page.getByText('Calendar',{exact:true}).last().locator('xpath=..').boundingBox();
  assert.ok(title && tab);
  return {title,tab};
}
async function main() {
  await fs.mkdir(artifacts,{recursive:true});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const address = `http://127.0.0.1:${server.address().port}`;
  const errors = [];
  try {
    for (const engine of ['chrome','webkit']) {
      const browser = engine === 'chrome' ? await chromium.launch({channel:process.env.UX_BROWSER_CHANNEL || 'chrome',headless:true}) : await webkit.launch({headless:true});
      try {
        for (const width of [320,390]) {
          const context = await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Bratislava',serviceWorkers:'block'});
          const page = await context.newPage();
          page.on('pageerror',error => errors.push(`${engine}: ${error.message}`));
          page.setDefaultTimeout(15000);
          await page.goto(address);
          await page.getByText('Calendar',{exact:true}).click();
          const baseline = await geometry(page);
          const cdp = engine === 'chrome' ? await context.newCDPSession(page) : null;
          async function inset(top,bottom,left=0,right=0) {
            if (cdp) await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top,bottom,left,right}});
            else await page.evaluate(({top,bottom,left,right}) => {
              for (const [side,value] of Object.entries({top,bottom,left,right})) document.documentElement.style.setProperty(`--app-safe-${side}`,`${value}px`);
            },{top,bottom,left,right});
            await frame(page);
          }
          await inset(47,34);
          const portrait = await geometry(page);
          assert.ok(Math.abs(portrait.title.y-baseline.title.y-47)<1,'Top safe-area must apply once.');
          assert.ok(Math.abs(baseline.tab.y-portrait.tab.y-34)<1,'Bottom safe-area must apply once.');
          const color = await page.getByText('Calendar',{exact:true}).last().locator('xpath=..').evaluate(element => getComputedStyle(element).backgroundColor);
          assert.equal(color,'rgb(52, 0, 85)','Selected navigation must use exact #340055.');
          const day = new Intl.DateTimeFormat('en',{day:'numeric',timeZone:'Europe/Bratislava'}).format(Date.now());
          assert.equal(await page.getByText(day,{exact:true}).last().locator('xpath=..').evaluate(element => getComputedStyle(element).backgroundColor),'rgb(52, 0, 85)','Selected calendar day must use exact #340055.');
          const statusColor = await page.locator('#root').evaluate(element => getComputedStyle(element,'::before').backgroundColor);
          assert.equal(statusColor,'rgb(52, 0, 85)');
          await page.screenshot({path:path.join(artifacts,`${engine}-${width}-portrait.png`),animations:'disabled'});
          await page.getByText('Profile',{exact:true}).click();
          await page.getByRole('button',{name:'Záloha tréningov',exact:true}).click();
          const dialog = page.getByRole('dialog'); await dialog.waitFor();
          const sheet = await dialog.locator('[id^="sheet-"]').first().boundingBox();
          assert.ok(sheet && sheet.y>=47 && sheet.y+sheet.height<=844-34+1,'Sheet must remain within the safe area.');
          await page.getByRole('button',{name:'Close Záloha tréningov',exact:true}).click();
          await dialog.waitFor({state:'hidden'});
          await page.getByText('Calendar',{exact:true}).click();
          // A changing browser viewport must keep navigation above the home indicator.
          await page.setViewportSize({width,height:740}); await inset(47,34);
          const resized = await geometry(page);
          assert.ok(Math.abs(resized.tab.y-portrait.tab.y+104)<1,'Navigation must follow the dynamic viewport.');
          await page.setViewportSize({width:844,height:390}); await inset(0,21,47,47);
          const landscape = await geometry(page);
          assert.ok(landscape.title.x>=47 && landscape.tab.y+landscape.tab.height<=390-21,'Landscape safe-area must protect navigation.');
          const dimensions = await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,height:innerHeight,root:document.getElementById('root').getBoundingClientRect().height}));
          assert.ok(dimensions.scroll<=dimensions.width+1,'No horizontal overflow.');
          assert.ok(Math.abs(dimensions.root-dimensions.height)<1,'Root must match the available viewport.');
          await context.close();
          console.log(`PASS ${engine} ${width}px: single insets, exact brand colors, sheets, resized viewport and landscape`);
        }
      } finally { await browser.close(); }
    }
    assert.deepEqual(errors,[]);
  } finally { await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => {console.error(error);process.exitCode=1;});
