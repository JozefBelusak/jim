// End-to-end UI + real PostgreSQL/RLS. Auth and network transports are test fixtures.
const { chromium } = require('playwright');
const { PGlite } = require('@electric-sql/pglite');
const { spawnSync } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { Buffer } = require('node:buffer');
const scriptDirectory = path.dirname(path.resolve(process.argv[1]));
const project = path.resolve(scriptDirectory, '..');
const root = path.join(project, '.expo/social-web');
const artifacts = path.join(project, '.expo/social-checks');
const origin = 'https://social-fixture.supabase.co';
const build = spawnSync(process.execPath, [require.resolve('expo/bin/cli'), 'export', '--clear', '--platform', 'web', '--output-dir', root], {
  cwd: project, stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: origin, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_fixture' },
});
if (build.status !== 0) process.exit(build.status ?? 1);
const server = http.createServer(async (request, response) => {
  const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, name === '/' ? 'index.html' : `.${name}`);
  if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
  try {
    const bytes = await fs.readFile(file);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
const db = new PGlite();
const users = new Map();
const tokens = new Map();
let serial = Promise.resolve();
const errors = [];
const requests = [];
function runAs(id, action) {
  const result = serial.then(async () => {
    await db.exec(`reset role; set role ${id ? 'authenticated' : 'anon'};`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    return action();
  });
  serial = result.catch(() => undefined); return result;
}
function session(user) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated',aud:'authenticated'})}.fixture`;
  tokens.set(token, user.id);
  return { access_token: token, refresh_token: `refresh-${user.id}`, expires_in: 3600, token_type: 'bearer', user };
}
function localFixture() {
  const now = Date.now();
  return { version: 6, savedAt: now, data: { schedule: {}, customExercises: [], machineMemories: [], onboardingCompleted: true, activeWorkout: null, templates: [], logs: [{id:'keep-history',userId:'local-user',dayId:'2026-10-07',date:'2026-10-07',name:'Keep my training',startedAt:now-3600000,finishedAt:now-1800000,durationSeconds:1800,volumeKg:400,entries:[{id:'keep-entry',exerciseId:'bench-press',metric:'weight_reps',sets:[{id:'keep-set',workoutExerciseId:'keep-entry',type:'normal',targetReps:8,reps:8,weightKg:50,done:true,createdAt:now-3600000,completedAt:now-1800000}]}]}] } };
}
async function transport(route, controls) {
  const req = route.request(); const url = new URL(req.url()); const body = req.postDataJSON() ?? {};
  const token = (req.headers().authorization ?? '').replace(/^Bearer /, ''); const userId = tokens.get(token);
  requests.push(`${req.method()} ${url.pathname}`);
  const reply = (data, status = 200) => route.fulfill({status, contentType:'application/json', body:JSON.stringify(data)});
  try {
    if (url.pathname === '/auth/v1/signup') {
      let user = users.get(body.email)?.user;
      if (!user) {
        user = {id:crypto.randomUUID(),email:body.email,aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},identities:[]};
        users.set(body.email, {user,password:body.password});
        await runAs(null, async () => { await db.exec('reset role'); await db.query('insert into auth.users(id,email) values($1,$2)', [user.id,user.email]); });
      }
      return reply(user); // Confirmation required; test simulates email confirmation before login.
    }
    if (url.pathname === '/auth/v1/token') {
      const existing = users.get(body.email);
      if (!existing || existing.password !== body.password) return reply({msg:'Invalid login credentials',error_code:'invalid_credentials'},400);
      return reply(session(existing.user));
    }
    if (url.pathname === '/auth/v1/logout') return reply({});
    if (url.pathname === '/auth/v1/recover') return reply({});
    if (url.pathname === '/auth/v1/user') {
      const account = [...users.values()].find(entry => entry.user.id === userId);
      if (!account) return reply({msg:'Not authorized'},401);
      if (req.method() === 'PUT' && body.password) account.password = body.password;
      return reply(account.user);
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const rpc = url.pathname.split('/').pop();
      if (rpc === 'send_direct_message' && controls.failBefore) { controls.failBefore = false; return route.abort('failed'); }
      const result = await runAs(userId, async () => {
        if (rpc === 'list_direct_chats') return (await db.query('select * from public.list_direct_chats()')).rows;
        if (rpc === 'start_direct_chat') return (await db.query('select public.start_direct_chat($1) as id',[body.other_user_id])).rows[0].id;
        if (rpc === 'send_direct_message') return (await db.query('select * from public.send_direct_message($1,$2,$3)',[body.chat_id,body.message_body,body.client_id])).rows;
        if (rpc === 'get_direct_messages') return (await db.query('select * from public.get_direct_messages($1,$2,$3)',[body.chat_id,body.before_time??null,body.before_id??null])).rows;
        if (rpc === 'mark_direct_chat_read') { await db.query('select public.mark_direct_chat_read($1,$2)',[body.chat_id,body.message_id]); return null; }
        throw new Error(`Unexpected RPC ${rpc}`);
      });
      if (rpc === 'send_direct_message' && controls.loseAck) { controls.loseAck = false; return route.abort('failed'); }
      return reply(result);
    }
    if (url.pathname === '/rest/v1/social_profiles') {
      const result = await runAs(userId, async () => {
        if (req.method() === 'POST') return (await db.query('insert into public.social_profiles(id,username,display_name,bio) values($1,$2,$3,$4) returning *',[body.id,body.username,body.display_name,body.bio])).rows;
        if (req.method() === 'PATCH') return (await db.query('update public.social_profiles set username=$1,display_name=$2,bio=$3 where id=$4 returning *',[body.username,body.display_name,body.bio,url.searchParams.get('id')?.slice(3)])).rows;
        if (url.searchParams.has('id')) return (await db.query('select * from public.social_profiles where id=$1',[url.searchParams.get('id').slice(3)])).rows;
        if (url.searchParams.has('username')) return (await db.query('select * from public.social_profiles where username=$1',[url.searchParams.get('username').slice(3)])).rows;
        const term = url.searchParams.get('or')?.match(/username.ilike.%(.+?)%/)?.[1] ?? '';
        return (await db.query('select * from public.social_profiles where username ilike $1 or display_name ilike $1 order by username limit 30',[`%${term}%`])).rows;
      });
      return reply(req.headers().accept?.includes('application/vnd.pgrst.object+json') ? result[0] : result);
    }
    if (url.pathname === '/rest/v1/social_blocks') {
      const result = await runAs(userId, async () => {
        if (req.method() === 'POST') { await db.query('insert into public.social_blocks values($1,$2)',[body.blocker_id,body.blocked_id]); return null; }
        const blocker = url.searchParams.get('blocker_id')?.slice(3); const blocked = url.searchParams.get('blocked_id')?.slice(3);
        if (req.method() === 'DELETE') { await db.query('delete from public.social_blocks where blocker_id=$1 and blocked_id=$2',[blocker,blocked]); return null; }
        return (await db.query('select * from public.social_blocks where blocker_id=$1 and blocked_id=$2',[blocker,blocked])).rows;
      }); return reply(result);
    }
    throw new Error(`Unexpected test request ${url.pathname}`);
  } catch (error) {
    if (!error.code) errors.push(error.message);
    return reply({message:error.message,code:error.code??'test_error'},400);
  }
}
async function noOverflow(page) {
  const result = await page.evaluate(() => ({viewport:innerWidth,width:document.documentElement.scrollWidth}));
  assert.ok(result.width <= result.viewport+1, JSON.stringify(result));
}
async function signup(page, email, username, name) {
  await page.getByText('Profile',{exact:true}).click();
  await page.getByRole('button',{name:'Vytvoriť účet / prihlásiť sa',exact:true}).click();
  await page.getByLabel('E-mail',{exact:true}).fill(email);
  await page.getByLabel('Heslo',{exact:true}).fill('Test-Password123');
  await page.getByRole('button',{name:'Vytvoriť účet',exact:true}).click();
  await page.getByText(/Skontroluj e-mail a potvrď účet/).waitFor();
  await page.getByRole('button',{name:'Už mám účet — prihlásiť',exact:true}).click();
  await page.getByLabel('Heslo',{exact:true}).fill('wrong');
  await page.getByRole('button',{name:'Prihlásiť sa',exact:true}).click();
  await page.getByText('Nesprávny e-mail alebo heslo.',{exact:true}).waitFor();
  await page.getByLabel('Heslo',{exact:true}).fill('Test-Password123');
  await page.getByRole('button',{name:'Prihlásiť sa',exact:true}).click();
  await page.getByRole('button',{name:'Vytvoriť profil',exact:true}).click();
  await page.getByLabel('Používateľské meno',{exact:true}).fill(username);
  await page.getByLabel('Meno na profile',{exact:true}).fill(name);
  await page.getByLabel('Bio (voliteľné)',{exact:true}).fill('Testovací verejný profil');
  await page.getByRole('button',{name:'Uložiť profil',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByText(`@${username}`,{exact:true}).waitFor();
}
async function findChat(page, query, name) {
  await page.getByRole('button',{name:'Nájsť ľudí',exact:true}).click();
  await page.getByLabel('Vyhľadať profil',{exact:true}).fill(query);
  await page.getByRole('button',{name:`Profil ${name}`,exact:true}).click();
  await page.getByRole('button',{name:'Napísať správu',exact:true}).click();
  await page.getByLabel('Správa',{exact:true}).waitFor();
}
async function main() {
  await fs.mkdir(artifacts,{recursive:true});
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  await db.exec(await fs.readFile(path.join(project,'supabase/migrations/202610070001_social.sql'),'utf8'));
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const address = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({channel:process.env.UX_BROWSER_CHANNEL||'chrome',headless:true});
  let current;
  try {
    for (const width of [320,390,720]) {
      const aliceContext = await browser.newContext({viewport:{width,height:844}});
      const bobContext = await browser.newContext({viewport:{width,height:844}});
      const controls = {failBefore:false,loseAck:false};
      const pages = [];
      for (const [context, failure] of [[aliceContext,controls],[bobContext,{}]]) {
        await context.route(`${origin}/**`, route => transport(route,failure));
        await context.routeWebSocket(`${origin.replace('https:','wss:')}/**`, socket => socket.close());
        await context.addInitScript(envelope => {
          if (!localStorage.getItem('jimappka.training.v6')) localStorage.setItem('jimappka.training.v6',JSON.stringify(envelope));
          // Accelerate periodic reconnect checks; production remains 15 seconds.
          const interval = window.setInterval.bind(window);
          window.setInterval = (callback,timeout,...args) => interval(callback,timeout===15000?1000:timeout,...args);
        }, localFixture());
        const page = await context.newPage(); pages.push(page); current = page;
        page.setDefaultTimeout(15000); page.on('pageerror',error => errors.push(error.message));
        await page.goto(address);
      }
      const [alicePage,bobPage] = pages;
      current = alicePage;
      await signup(alicePage,`alice${width}@fixture.test`,`alice_${width}`,`Alice ${width}`);
      await signup(bobPage,`bob${width}@fixture.test`,`bob_${width}`,`Bob ${width}`);
      await findChat(alicePage,`bob_${width}`,`Bob ${width}`);
      await alicePage.getByLabel('Správa',{exact:true}).fill('Ahoj z prvého účtu');
      await alicePage.getByRole('button',{name:'Odoslať správu',exact:true}).click();
      await alicePage.getByRole('dialog').getByText('Ahoj z prvého účtu',{exact:true}).waitFor();
      await findChat(bobPage,`alice_${width}`,`Alice ${width}`);
      await bobPage.getByRole('dialog').getByText('Ahoj z prvého účtu',{exact:true}).waitFor();
      await bobPage.getByLabel('Správa',{exact:true}).fill('Ahoj z druhého účtu');
      await bobPage.getByRole('button',{name:'Odoslať správu',exact:true}).click();
      await alicePage.getByRole('dialog').getByText('Ahoj z druhého účtu',{exact:true}).waitFor();
      controls.failBefore = true;
      await alicePage.getByLabel('Správa',{exact:true}).fill('Správa po výpadku');
      await alicePage.getByRole('button',{name:'Odoslať správu',exact:true}).click();
      await alicePage.getByRole('button',{name:'Zopakovať správu: Správa po výpadku',exact:true}).waitFor();
      await alicePage.reload();
      await alicePage.getByText('Profile',{exact:true}).click();
      await alicePage.getByRole('button',{name:new RegExp(`Chat s Bob ${width}`)}).click();
      controls.loseAck = true;
      await alicePage.getByRole('button',{name:'Zopakovať správu: Správa po výpadku',exact:true}).click();
      // A lost acknowledgement is reconciled either by retry or the next server refresh.
      const retry = alicePage.getByRole('button',{name:'Zopakovať správu: Správa po výpadku',exact:true});
      if (await retry.isVisible()) await retry.click();
      await bobPage.getByRole('dialog').getByText('Správa po výpadku',{exact:true}).waitFor();
      await retry.waitFor({state:'hidden'});
      await runAs(users.get(`alice${width}@fixture.test`).user.id,async () => {
        const rows = (await db.query("select * from public.chat_messages where body='Správa po výpadku'")).rows;
        assert.equal(rows.length,1,'Retries must not duplicate committed messages.');
      });
      await alicePage.getByRole('dialog').getByText('Správa po výpadku',{exact:true}).waitFor();
      assert.equal(await alicePage.getByRole('dialog').getByText('Správa po výpadku',{exact:true}).count(),1);
      const input = await alicePage.getByLabel('Správa',{exact:true}).boundingBox();
      assert.ok(input.y+input.height <= 844,'Composer must be visible without scrolling.');
      await noOverflow(alicePage);
      await alicePage.screenshot({path:path.join(artifacts,`chat-${width}.png`),animations:'disabled'});
      await alicePage.getByRole('button',{name:'Zobraziť profil a možnosti',exact:true}).click();
      await alicePage.getByRole('button',{name:'Zablokovať profil',exact:true}).click();
      const blockedAction = alicePage.getByRole('button',{name:'Profil je zablokovaný',exact:true});
      await blockedAction.waitFor();
      assert.equal(await blockedAction.getAttribute('aria-disabled'),'true');
      await alicePage.getByRole('button',{name:'Odblokovať profil',exact:true}).click();
      await alicePage.getByRole('button',{name:'Napísať správu',exact:true}).click();
      await alicePage.getByLabel('Správa',{exact:true}).waitFor();
      await alicePage.getByLabel(`Close Bob ${width}`,{exact:true}).click();
      await alicePage.getByRole('button',{name:'Upraviť profil',exact:true}).click();
      await alicePage.getByLabel('Meno na profile',{exact:true}).fill(`Alice updated ${width}`);
      await alicePage.getByRole('button',{name:'Uložiť profil',exact:true}).click();
      await alicePage.getByRole('dialog').waitFor({state:'hidden'});
      await alicePage.getByText(`Alice updated ${width}`,{exact:true}).waitFor();
      await alicePage.getByRole('button',{name:'Odhlásiť sa',exact:true}).click();
      await alicePage.getByRole('button',{name:'Vytvoriť účet / prihlásiť sa',exact:true}).waitFor();
      assert.equal(await alicePage.getByRole('button',{name:new RegExp(`Chat s Bob ${width}`)}).count(),0,'Logout must hide private chats.');
      assert.equal(await alicePage.evaluate(() => JSON.parse(localStorage.getItem('jimappka.training.v6')).data.logs[0].name),'Keep my training');
      if (width === 390) {
        await alicePage.getByRole('button',{name:'Vytvoriť účet / prihlásiť sa',exact:true}).click();
        await alicePage.getByRole('button',{name:'Už mám účet — prihlásiť',exact:true}).click();
        await alicePage.getByLabel('E-mail',{exact:true}).fill(`alice${width}@fixture.test`);
        await alicePage.getByRole('button',{name:'Zabudnuté heslo',exact:true}).click();
        await alicePage.getByRole('button',{name:'Poslať odkaz',exact:true}).click();
        await alicePage.getByText('Ak účet existuje, príde ti odkaz na nastavenie nového hesla.',{exact:true}).waitFor();
        const recovery = session(users.get(`alice${width}@fixture.test`).user);
        const fragment = new URLSearchParams({access_token:recovery.access_token,refresh_token:recovery.refresh_token,expires_in:'3600',token_type:'bearer',type:'recovery'});
        await alicePage.goto(`${address}/?account=1#${fragment}`);
        await alicePage.getByLabel('Nové heslo',{exact:true}).fill('New-Password123');
        await alicePage.getByRole('button',{name:'Uložiť heslo',exact:true}).click();
        await alicePage.getByRole('dialog').waitFor({state:'hidden'});
        assert.equal(users.get(`alice${width}@fixture.test`).password,'New-Password123');
        await alicePage.getByRole('button',{name:'Odhlásiť sa',exact:true}).click();
      }
      await alicePage.goto(`${address}/?profile=bob_${width}`);
      await alicePage.getByRole('button',{name:'Prihlásiť sa a napísať',exact:true}).waitFor();
      await noOverflow(alicePage);
      await alicePage.screenshot({path:path.join(artifacts,`guest-profile-${width}.png`),animations:'disabled'});
      await aliceContext.close(); await bobContext.close();
      console.log(`Social flows passed at ${width}px.`);
    }
    assert.deepEqual(errors,[],'Browser or transport errors');
  } catch (error) {
    if (current && !current.isClosed()) { await current.screenshot({path:path.join(artifacts,'failure.png')}); await fs.writeFile(path.join(artifacts,'failure.html'),await current.content()); }
    console.error('Recent test requests:',requests.slice(-20)); throw error;
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
