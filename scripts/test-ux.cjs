const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

const scriptDirectory = path.dirname(path.resolve(process.argv[1]));
const root = path.resolve(scriptDirectory, '../dist');
const artifacts = path.resolve(scriptDirectory, '../.expo/ux-checks');
const key = 'jimappka.training.v6';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon', '.css': 'text/css' };
const server = http.createServer(async (request, response) => {
  const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, name === '/' ? 'index.html' : `.${name}`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
  try { const bytes = await fs.readFile(file); response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }); response.end(bytes); }
  catch { response.writeHead(404).end(); }
});

function fixture() {
  const now = Date.now();
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava' }).format(now);
  return { version: 6, savedAt: now, data: {
    schedule: {}, customExercises: [], machineMemories: [], onboardingCompleted: true, activeWorkout: null,
    logs: [{ id: 'existing-log', userId: 'local-user', dayId: date, date, name: 'Existing workout', startedAt: now - 3600000, finishedAt: now - 1800000, durationSeconds: 1800, volumeKg: 400, entries: [{ id: 'old-entry', exerciseId: 'bench-press', metric: 'weight_reps', sets: [{ id: 'old-set', workoutExerciseId: 'old-entry', type: 'normal', targetReps: 8, reps: 8, weightKg: 50, done: true, createdAt: now - 3600000, completedAt: now - 1800000 }] }] }],
    templates: Array.from({length: 8}, (_, i) => ({ id: `plan-${i}`, userId: 'local-user', name: `Plan ${i + 1}`, createdAt: now, updatedAt: now, exercises: [{ id: `target-${i}`, exerciseId: 'plank', order: 0, targetSets: 2, repRangeMin: 20, repRangeMax: 40, restSeconds: 60 }] })),
  } };
}

async function read(page) { return page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)).data, key); }
async function closeSheet(page, title) { await page.getByLabel(`Close ${title}`, { exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); }
async function noOverflow(page, label) {
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(widths.scroll <= widths.viewport + 1, `${label}: horizontal document overflow ${JSON.stringify(widths)}`);
}
async function inFirstViewport(page, label, reserve = 20) {
  const box = await page.getByLabel(label, { exact: true }).boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= page.viewportSize().height - reserve, `${label}: outside initial viewport: ${JSON.stringify(box)}`);
  assert.ok(box.width >= 40 && box.height >= 40, `${label}: too small: ${JSON.stringify(box)}`);
  return box;
}

async function run() {
  await fs.mkdir(artifacts, {recursive: true});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({channel: process.env.UX_BROWSER_CHANNEL || 'chrome', headless: true});
  const errors = [];
  const contexts = [];
  let current;
  try {
    for (const [width, height] of [[320, 740], [390, 844], [720, 900]]) {
      const context = await browser.newContext({viewport: {width, height}, isMobile: width < 680, hasTouch: width < 680});
      contexts.push(context);
      const page = await context.newPage(); current = page;
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push(error.message));
      const envelope = fixture();
      await page.addInitScript(({storageKey, envelope}) => {
        if (localStorage.getItem(storageKey) === null) localStorage.setItem(storageKey, JSON.stringify(envelope));
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(name, value) {
          if (name === storageKey && window.rejectUxSave) throw new Error('Simulated save failure');
          return original.call(this, name, value);
        };
      }, {storageKey: key, envelope});
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.getByText('Library', {exact: true}).click();
      await page.getByRole('button', {name: 'View Chest press', exact: true}).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('heading', {name: 'Chest press', exact: true}).waitFor();
      const heading = await dialog.getByRole('heading', {name: 'Chest press', exact: true}).boundingBox();
      assert.ok(heading.y > 0 && heading.y + heading.height < height, 'Exercise detail must immediately be visible.');
      await noOverflow(page, `Library detail ${width}`);
      await page.screenshot({path: path.join(artifacts, `exercise-detail-${width}.png`), animations: 'disabled'});
      await page.keyboard.press('Escape');
      await dialog.waitFor({state: 'hidden'});
      const focus = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
      assert.equal(focus, 'View Chest press', 'Closing details must return focus to the exercise.');
      await page.getByLabel('Search exercises', {exact: true}).fill('plank');
      await page.getByRole('button', {name: 'View Plank', exact: true}).click();
      await dialog.getByRole('heading', {name: 'Plank', exact: true}).waitFor();
      await closeSheet(page, 'Plank');
      assert.equal(await page.getByLabel('Search exercises').inputValue(), 'plank', 'Library query must survive viewing details.');

      await page.getByText('Plans', {exact: true}).click();
      await page.getByRole('button', {name: 'Edit Plan 8', exact: true}).click();
      await inFirstViewport(page, 'Plan name', 10);
      await page.screenshot({path: path.join(artifacts, `plan-editor-${width}.png`), animations: 'disabled'});
      await page.getByLabel('Plan name', {exact: true}).fill('My timed plan');
      await dialog.getByRole('button', {name: 'Plan description', exact: true}).click();
      await dialog.getByRole('textbox', {name: 'Plan description', exact: true}).fill('Comfortable targets');
      await page.getByLabel('Targets & rest', {exact: true}).click();
      await page.getByLabel('Min sec for Plank 1', {exact: true}).fill('600');
      await page.getByLabel('Max sec for Plank 1', {exact: true}).fill('900');
      await page.getByLabel('Target RIR for Plank 1', {exact: true}).fill('2');
      await page.getByLabel('Notes for Plank 1', {exact: true}).fill('Keep breathing');
      await page.screenshot({path: path.join(artifacts, `plan-targets-${width}.png`), animations: 'disabled'});
      await dialog.getByRole('button', {name: 'Done', exact: true}).click();
      await dialog.waitFor({state: 'hidden'});
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('jimappka.training.v6')).data.templates[7].exercises[0].repRangeMax === 900);
      let data = await read(page);
      assert.equal(data.templates[7].name, 'My timed plan');
      assert.equal(data.templates[7].description, 'Comfortable targets');
      assert.equal(data.templates[7].exercises[0].notes, 'Keep breathing');
      assert.equal(data.templates[7].exercises[0].targetRir, 2);
      assert.deepEqual(data.logs, envelope.data.logs, 'Editing plans must preserve existing history.');
      await page.reload();
      await page.getByText('Plans', {exact: true}).click();
      await page.getByRole('button', {name: 'Edit My timed plan', exact: true}).click();
      assert.equal(await page.getByLabel('Plan name', {exact: true}).inputValue(), 'My timed plan');
      await page.getByRole('button', {name: 'Plan description', exact: true}).click();
      assert.equal(await dialog.getByRole('textbox', {name: 'Plan description', exact: true}).inputValue(), 'Comfortable targets');
      await dialog.getByRole('button', {name: '+ Add exercise', exact: true}).click();
      await page.getByLabel('Search exercises', {exact: true}).fill('bench press');
      await page.getByRole('button', {name: 'Add Bench press', exact: true}).click();
      await page.getByLabel('Plan name', {exact: true}).waitFor();
      await dialog.getByText('2. Bench press', {exact: true}).waitFor();
      await dialog.getByRole('button', {name: 'Done', exact: true}).click();
      await dialog.waitFor({state: 'hidden'});

      await page.getByRole('button', {name: 'Browse starter plans', exact: true}).click();
      await page.getByRole('button', {name: 'Add Upper body', exact: true}).click();
      await page.getByLabel('Plan name', {exact: true}).fill('My upper workout');
      await dialog.getByRole('button', {name: 'Done', exact: true}).click();
      await dialog.waitFor({state: 'hidden'});
      await page.getByRole('button', {name: 'Browse starter plans', exact: true}).click();
      assert.equal(await page.getByRole('button', {name: 'Already added Upper body', exact: true}).getAttribute('aria-disabled'), 'true');
      await closeSheet(page, 'Starter plans');
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('jimappka.training.v6')).data.templates.length === 9);
      data = await read(page);
      assert.equal(data.templates[8].name, 'My upper workout');

      await page.getByRole('button', {name: 'Edit My timed plan', exact: true}).click();
      await page.evaluate(() => { window.rejectUxSave = true; });
      await page.getByLabel('Plan name', {exact: true}).fill('Retry saved plan');
      await dialog.getByText(/Ukladanie zlyhalo:/).waitFor();
      await page.screenshot({path: path.join(artifacts, `save-error-${width}.png`), animations: 'disabled'});
      await page.evaluate(() => { window.rejectUxSave = false; });
      await dialog.getByRole('button', {name: 'Zopakovať uloženie', exact: true}).click();
      await dialog.getByText('Uložené v tomto zariadení', {exact: true}).waitFor();
      assert.equal((await read(page)).templates[7].name, 'Retry saved plan');
      await page.getByLabel('Plan name', {exact: true}).fill('');
      await dialog.getByRole('alert').waitFor();
      await dialog.getByRole('button', {name: 'Done', exact: true}).click();
      await dialog.waitFor({state: 'hidden'});
      assert.equal((await read(page)).templates[7].name, 'Retry saved plan', 'An invalid blank name must retain the last valid saved name.');

      await page.getByRole('button', {name: 'Create plan', exact: true}).click();
      await page.getByLabel('Plan name', {exact: true}).fill('New plan');
      await dialog.getByRole('button', {name: '+ Add exercise', exact: true}).click();
      await page.getByLabel('Search exercises', {exact: true}).fill('plank');
      await page.getByRole('button', {name: 'Add Plank', exact: true}).click();
      await page.getByRole('button', {name: 'Duplicate plan', exact: true}).click();
      await page.getByLabel('Plan name', {exact: true}).waitFor();
      assert.equal(await page.getByLabel('Plan name', {exact: true}).inputValue(), 'New plan Copy');
      await page.getByLabel('Targets & rest', {exact: true}).click();
      await page.getByLabel('Target RIR for Plank 1', {exact: true}).fill('11');
      await dialog.getByText('0–10', {exact: true}).waitFor();
      await page.getByLabel('Target RIR for Plank 1', {exact: true}).fill('2');
      await page.getByLabel('Target RIR for Plank 1', {exact: true}).fill('');
      await dialog.getByRole('button', {name: 'Remove', exact: true}).click();
      await dialog.getByRole('button', {name: 'Keep exercise', exact: true}).click();
      await dialog.getByText('1. Plank', {exact: true}).waitFor();
      await dialog.getByRole('button', {name: 'Remove', exact: true}).click();
      await dialog.getByRole('button', {name: 'Remove exercise', exact: true}).click();
      await dialog.getByRole('button', {name: 'Done', exact: true}).click();
      await dialog.waitFor({state: 'hidden'});
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('jimappka.training.v6')).data.templates.length === 11);
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('jimappka.training.v6')).data.templates.find(template => template.name === 'New plan Copy')?.exercises.length === 0);
      assert.equal(await page.getByRole('button', {name: 'Start New plan Copy', exact: true}).getAttribute('aria-disabled'), 'true');
      const originalPlan = (await read(page)).templates.find(template => template.name === 'New plan');
      assert.equal(originalPlan.exercises.length, 1, 'Editing a duplicate must preserve the original plan.');
      const upperCard = page.getByText('My upper workout', {exact: true}).locator('xpath=..');
      await upperCard.getByRole('button', {name: 'Manage plan', exact: true}).click();
      await upperCard.getByRole('button', {name: 'Move My upper workout up', exact: true}).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('jimappka.training.v6')).data.templates[7].name === 'My upper workout');
      await upperCard.getByRole('button', {name: 'Archive', exact: true}).click();
      await page.getByRole('button', {name: 'Browse starter plans', exact: true}).click();
      await page.getByRole('button', {name: 'Restore Upper body', exact: true}).click();
      assert.equal(await page.getByLabel('Plan name', {exact: true}).inputValue(), 'My upper workout');
      await dialog.getByRole('button', {name: 'Done', exact: true}).click();
      await dialog.waitFor({state: 'hidden'});
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('jimappka.training.v6')).data.templates.filter(template => template.archived).length === 0);
      await noOverflow(page, `Plans ${width}`);
      await page.screenshot({path: path.join(artifacts, `plans-${width}.png`), animations: 'disabled'});
      console.log(`PASS ${width}px immediate details and editor, focus return, auto-save + reload, direct time entry, add exercise, starter deduplication and visible save error + retry`);
      console.log(`PASS ${width}px invalid name/effort handling, create + duplicate, confirmed removal, rotation order and archived starter restoration`);
    }
    assert.deepEqual(errors, []);
    console.log('PASS no browser runtime exceptions; existing workout history preserved');
  } catch (error) {
    if (current && !current.isClosed()) {
      await current.screenshot({path: path.join(artifacts, 'failure.png'), fullPage: true});
      console.error((await current.locator('body').innerText()).slice(0, 14000));
    }
    throw error;
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
