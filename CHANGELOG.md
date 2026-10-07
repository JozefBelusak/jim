# Zmeny a nadväzujúci audit

Tento súbor slúži ako trvalý log zmien podľa auditu zo 7. októbra 2026.
Pri ďalšej úprave zaznamenať výsledné správanie, overenie a stav súvisiacich bodov.
Zachovať existujúce tréningy, históriu a plány. Nepovažovať bod za hotový len preto,
že existuje jeho tlačidlo; rozhoduje celý používateľský tok.

## 2026-10-07 — fotky v súkromnom chate

- Viditeľné „Pridať fotku“, náhľad, odobratie/nahradenie a odoslanie jednej fotky
  s voliteľným popisom. Prijatú aj rozpracovanú fotku možno otvoriť vo väčšom náhľade.
- JPEG/PNG/WebP a prehliadačom podporované HEIC/HEIF sa zmenšia na najviac
  1600 px a prekodujú na JPEG bez pôvodných EXIF/GPS údajov. Limit originálu
  je 25 MB a výsledku 5 MiB; neplatná fotka zobrazí chybu a zachová pôvodný výber.
- Súkromný Storage bucket, rezervované nemenné cesty a autentifikované čítanie
  iba pre účastníkov chatu. Žiadne verejné alebo podpísané URL v správach.
  Foto RPC a text používajú spoločnú autorizáciu, nonce a limit 30 správ/minútu.
- Bajty rozpracovanej fotky sa ukladajú do IndexedDB, metadáta do existujúceho
  outboxu podľa účtu a chatu. Retry po reloade a strate odpovede pri uploade alebo
  odoslaní nevytvára druhú fotku/správu. IndexedDB používa prenositeľný ArrayBuffer.
- Chybu prípravy/odoslania už nevymaže automatické načítanie chatu. Potvrdenie
  správy odstráni jej pending stav aj lokálne bajty. Prehľad chatov zobrazuje „Fotka“.
- Nová migrácia `202610070002_chat_photos.sql` sa spúšťa po pôvodnej social
  migrácii. Zachováva existujúce profily, účty aj textové správy. Prihlásenie,
  Auth nastavenia, env premenné a formát tréningovej zálohy sa nemenia.
- Rozšírený WebKit test odhalil zmeškanú udalosť obnovy hesla pri rýchlej
  inicializácii SDK. Návrat teraz otvorí formulár aj v tomto prípade, iba ak
  SDK vráti session s tokenom z platného recovery návratu; samotný URL flag nestačí.
- Náhľad fotky aj existujúce panely zdieľajú obsluhu klávesnice: focus zostáva
  vo vrchnom dialógu a po zavretí sa vráti na pôvodný ovládací prvok.
- Testy pokrývajú súkromie, spoofing, blokovanie, nemennosť, upload pred publikovaním,
  idempotenciu, spoločný rate limit, prechod zo starej databázy a obnovu lokálnych bajtov.
- Overenie: TypeScript, ESLint, 183 unit/databázových testov v 22 súboroch,
  Chrome aj desktopový WebKit na 320/390/720 px. Prehliadače overili výber,
  kompresiu, chybnú náhradu, náhľad, focus, retry po reloade a strate upload/message
  odpovede, prijatie na druhom účte aj obnovu hesla. K tomu produkčný web build.
- Súbory: `src/social/{ChatSheet.tsx,ChatPhoto.tsx,photos.ts,outbox.ts,repository.ts,
  domain.ts,types.ts,photos.test.ts,photoDatabase.test.ts,testDatabase.ts,
  database.test.ts,repository.test.ts,authCallback.ts,authCallback.test.ts,
  client.ts,useSocialAccount.ts}`, `src/components/{BottomSheet.tsx,useDialogFocus.ts}`,
  `supabase/migrations/202610070002_chat_photos.sql`, `scripts/test-social.cjs`,
  `docs/social.md`, `CHANGELOG.md`.
- Produkčná aktivácia vyžaduje spustenie novej migrácie v Supabase a deploy kódu.
  SQL/RLS testy používajú PostgreSQL/PGlite; Auth/Storage HTTP je testovací transport.
  Živý Supabase Storage a fyzický iPhone neboli dostupné na overenie. Trvalo opustené
  uploady zatiaľ čistí správca cez Storage API; server má limit 20 nedokončených rezervácií.

## 2026-10-07 — iPhone rozloženie a presná primárna farba

- Opravené dvojité bezpečné odstupy: HTML aj React Native Web `SafeAreaView`
  používali `safe-area-inset-*`, čo na iPhone posunulo hlavičku aj navigáciu.
  Web teraz používa jeden odstup v HTML; natívna vetva zachováva `SafeAreaView`.
- Otvorené BottomSheet panely mimo HTML koreňa rešpektujú vlastný jeden odstup,
  aj v landscape. Koreň používa dynamickú výšku viewportu a iOS text-size-adjust.
- Aktívna navigácia, deň v kalendári, chips, toggles a dokončené série majú presné
  plné `#340055`. Staré `#C6A0E5`/`#A58CD8` akcenty sú odstránené; text používa
  svetlé neutrálne farby. Táto zmena nahrádza predchádzajúce rozhodnutie o levanduľovom akcente.
- Plocha za priehľadným iOS status barom má `#340055`; manifest a theme-color
  zostávajú v rovnakej farbe. O vykreslení systémových líšt rozhoduje aj OS.
- Netlify badge sa potvrdil vo verejnom HTML ako skript vložený hostingom.
  Postup vypnutia a aktualizácie appky bez mazania dát je v `docs/offline.md`.
- Overenie: TypeScript, ESLint, 167 unit/databázových testov, produkčný build,
  Chrome UX na 320/390/720 px a nový layout test v Chrome aj desktopovom WebKite
  na 320/390 px. Chrome emuluje reálne CSS env insets, WebKit CSS premenné.
  Overené sú jediné odstupy, presné RGB výberov, panely, zmeny výšky a landscape.
  Fyzický iPhone nebol k dispozícii.
- Súbory: `App.tsx`, `public/index.html`, `src/theme/styles.ts`,
  `src/components/BottomSheet.tsx`, `scripts/test-mobile-layout.cjs`,
  `package.json`, `docs/offline.md`, `CHANGELOG.md`. Dáta tréningov sa nemenia.

## 2026-10-07 — neplatné registračné odkazy

- Návrat z e-mailu s `otp_expired` alebo inou chybou otvorí Profile a zobrazí
  zrozumiteľnú hlášku. Funguje aj pri príchode odkazu do už otvorenej appky.
- Chybové parametre sa odstránia z adresy; platné prihlasovacie/recovery tokeny
  a nesúvisiace URL parametre zostávajú pre auth SDK. Text chyby z URL sa nezobrazuje.
- Existujúce prihlásenie zostáva zachované. Upozornenie možno zavrieť; pri novom
  úspešnom prihlásení zmizne. Načítanie profilu ho predčasne nevymaže.
- Priame prihlásenie z upozornenia a opätovné odoslanie potvrdenia e-mailu cez
  Supabase Auth. Potvrdenie je dostupné aj z registračného/prihlasovacieho formulára.
  E-mail zostáva pri prepnutí formulára vyplnený; resend nevyžaduje heslo.
- Limity odosielania e-mailov sa zobrazia aj pri chybách určených len kódom.
- Overenie: TypeScript, ESLint, 167 unit/databázových testov v 20 súboroch,
  produkčný web build a Chrome na šírkach 320/390/720 px. Prehliadač overil
  návrat s chybou počas behu aj pri štarte, priame prihlásenie, resend a jeho
  rate limit, zachovanie session/tréningov a obnovu hesla. Auth/e-mailový transport
  je testovacia simulácia so skutočným Supabase SDK; SQL/RLS používa PostgreSQL/PGlite.
  Skutočné doručovanie e-mailov v produkčnom projekte nebolo týmto testom overené.
- Súbory: `App.tsx`, `src/social/{authCallback.ts,authCallback.test.ts,client.ts,
  useSocialAccount.ts,AccountSheet.tsx,SocialPanel.tsx,domain.ts}`,
  `scripts/test-social.cjs`, `docs/social.md`, `CHANGELOG.md`.
- Databázová migrácia sa nemení. Táto oprava nezaručuje doručenie e-mailu ani
  neobnovuje použitý token; odosielanie a platnosť nových odkazov spravuje Supabase/SMTP.

## Zadanie používateľa

„Tak oprav najprv toto a použi tento prompt ako log nasledujúcich zmien.“
Spresnenie: „Sa sústreď na pohodlnosť a intuitívnosť.“

## Evidencia auditu

| ID | Problém | Stav |
| --- | --- | --- |
| UX-01 | Detail cviku po kliknutí zostáva pod zoznamom mimo obrazovky. | Hotové: samostatný panel, zachované vyhľadávanie a návrat fokusu |
| UX-02 | Editor plánu sa otvorí pod celým zoznamom; pridávanie cvikov prekrýva úpravu existujúcich. | Hotové: samostatný editor a oddelený výber cviku |
| UX-03 | Názov a opis plánu majú manuálne ukladanie, ostatné polia automatické; Close zahodí zmeny bez upozornenia. | Hotové: automatické ukladanie všetkých polí so stavom a opakovaním pri chybe |
| UX-04 | Opakované pridanie starter plánov vytvára duplikáty. | Hotové: výber jedného plánu, identita startera a obnovenie archivovaného plánu |
| WF-05 | Do plánov nemožno uložiť supersety a typy jednotlivých sérií; upravený workout nemožno uložiť ako plán. | Nasledujúci krok |
| PR-06 | Odporúčania predpokladajú splnené RIR pri chýbajúcich údajoch a univerzálny krok 2,5 kg. | Nasledujúci krok |
| MM-07 | Výber stroja nedáva jasnú možnosť použiť jeho predchádzajúce hodnoty bez prepísania rozpracovanej práce. | Nasledujúci krok |
| GR-08 | Aj ročný a celkový graf zobrazujú iba posledných šesť tréningov; chýba spoločný prehľad progresu. | Nasledujúci krok |
| BE-09 | Profile je lokálna história; účty, verejné profily, chat a synchronizácia medzi zariadeniami chýbajú. | Implementované účty, verejné profily a súkromný chat cez Supabase; aktivácia potrebuje projekt. Synchronizácia tréningov zostáva otvorená. |
| UX-10 | Nejednotné názvy a jazyky, zbytočne veľa akcií na kartách, pomalé zadávanie časových cieľov. | Čiastočne hotové: jednotné označenie Plans, pomenované Manage plan, priame číselné polia; úplná lokalizácia zostáva otvorená |

## Ďalší smer

- Výmena obsadeného stroja za vhodný cvik s jeho vlastnou históriou.
- Skrátenie tréningu podľa priorít a pokrytia svalov, nie iba konca zoznamu.
- Prepínanie fitka so stanicami, nastaveniami a príslušnou históriou.
- Bohatšia knižnica a názorná technika cvikov; používateľský onboarding podľa cieľa a vybavenia.

## 2026-10-07 — pohodlnosť a intuitívnosť

### Výsledné správanie

- Kliknutie na cvik otvorí jeho detail, techniku, progres a históriu. Po zatvorení
  zostane zachované vyhľadávanie a fokus sa vráti na otvorený cvik.
- Vlastný cvik sa vytvára a upravuje v samostatnom paneli.
- Edit otvorí plán ihneď v samostatnom paneli, aj keď je plán na konci dlhého zoznamu.
- Názov, opis, ciele, odpočinok a poznámky plánu sa ukladajú priebežne rovnakým spôsobom.
  Editor zobrazuje skutočný stav uloženia; pri chybe ponúkne opakovanie.
  Neplatný prázdny názov jasne označí a zachová posledný platný názov.
- Pridávanie cviku je oddelený vyhľadávací panel s návratom do plánu; neprekryje existujúce cviky.
- Ciele a čas možno napísať priamo. RIR zostáva voliteľné a odmieta neplatné hodnoty.
- Menej časté akcie sú pod pomenovaným Manage plan s náhľadom ich obsahu.
  Vymazanie plánu a odobratie cviku vyžadujú konkrétne potvrdenie.
- Starter plány sa vyberajú jednotlivo. Už pridaný plán je označený; archivovaný
  sa dá obnoviť s pôvodným názvom, cieľmi a identitou. Premenovanie nového startera
  ani úprava rozpoznaného staršieho startera nevedie k jeho opätovnému vytvoreniu.
- Existujúce tréningy a plány zostávajú zachované. `starterKey` je voliteľný údaj
  kompatibilný s aktuálnym formátom v6 aj JSON zálohami; pri editácii rozpoznaného
  staršieho startera sa doplní jeho pôvod. Staršie, už premenované plány bez tejto
  identity nemožno spoľahlivo spätne rozpoznať. Existujúce duplikáty sa automaticky nemažú.

### Overenie

- Prešlo: TypeScript, ESLint bez varovaní, 141 unit testov v 15 súboroch a produkčný web build.
- Regresné kontroly v Chrome na šírkach 320, 390 a 720 px: otvorenie detailu,
  návrat fokusu a vyhľadávania, otvorenie editora ôsmeho plánu, automatické uloženie
  a obnovenie stránky, zadávanie sekúnd, pridanie cviku, vytvorenie a duplikovanie
  plánu, potvrdenie odstránenia cviku, presun v rotácii, obnova archivovaného startera
  a simulované zlyhanie uloženia s opakovaním. Pôvodná história zostala zachovaná.
- Doménové regresné testy pre opakované pridávanie, premenovanie, archiváciu,
  staršie starter plány, zálohu s identitou startera a úmyselné duplikovanie.
- Fyzický iPhone/Safari a Android neboli v tomto kroku overené.

### Súbory

- `App.tsx`, `src/screens/LibraryScreen.tsx`, `src/screens/TemplatesScreen.tsx`
- `src/components/ExerciseSearch.tsx`, `src/components/PlanNumberField.tsx`, `src/components/SavingIndicator.tsx`
- `src/data/plans.ts`, `src/data/starterTemplates.ts`, `src/data/starterTemplates.test.ts`
- `src/domain/templates.ts`, `src/types.ts`, `src/storage/trainingStorage.ts`
- `scripts/test-ux.cjs`, `package.json`, `package-lock.json`, `CHANGELOG.md`

### Spustenie kontrol používateľských tokov

`npm run test:ux` vytvorí produkčný build a spustí kontroly v nainštalovanom Chrome.
Snímky a diagnostika sú v ignorovanom adresári `.expo/ux-checks`.
Alternatíva pre prostredie bez Chrome: nainštalovať Chromium cez
`npx playwright install chromium` a nastaviť `UX_BROWSER_CHANNEL=chromium`.


## 2026-10-07 — verejné profily, súkromný chat a primárna farba

### Výsledné správanie

- Registrácia e-mailom a heslom, potvrdenie e-mailu, prihlásenie, odhlásenie
  z tohto zariadenia a obnovenie hesla cez Supabase Auth.
- Vytvorenie a úprava verejného profilu: jedinečné @meno, meno a voliteľné bio.
  Vyhľadávanie podľa @mena/mena, zdieľanie odkazu a otvorenie profilu hosťom.
  E-mail a tréningy sa nezverejňujú. Hosť dostane konkrétnu možnosť vytvoriť účet
  a pred chatovaním dokončiť profil.
- Zrozumiteľný prehľad Správy v Profile. Chat dvojice sa otvorí v samostatnom
  paneli s pevne dostupným písaním správy, rozlíšenými bublinami, dátumami a časom.
  Staršie správy sa načítavajú po 50; rovnaké časy správ nespôsobia stratu pri stránkovaní.
- Realtime pre otvorený chat, oprava vynechaných správ pri návrate/pripojení,
  pravidelná kontrola ako záloha a počet neprečítaných správ v konverzáciách.
- Stav odosielania, potvrdenie serverom, retry a lokálne uchovanie neodoslaných
  správ oddelene podľa účtu/konverzácie. Dvojklik nevytvorí dve správy; dve karty
  si neprepíšu front. Rovnaký nonce pri opakovaní nevytvorí duplikát ani pri
  strate odpovede po uložení. Zaseknutá požiadavka má 15-sekundový limit. Rozpracované odoslanie alebo
  založenie chatu zostáva viazané na pôvodný účet aj pri prepnutí účtu v inej karte.
- Blokovanie/odblokovanie profilu zastaví nové správy v oboch smeroch.
  Databáza povoľuje čítanie správ iba účastníkom a odosielateľa určuje server.
  Limit 30 nových správ za minútu na účet; privilegované funkcie v schéme private.
- Lokálny denník je jasne oddelený od verejného profilu, bez druhého profilového avatara.
  Tréningy a existujúce zálohy v6 zostávajú zachované; účet ich zatiaľ nesynchronizuje.
  Záloha sa otvára pomenovaným tlačidlom Záloha tréningov; export pri chybe
  uloženia otvorí zálohu priamo. Účet a chat nepoužívajú
  lokálnu identitu tréningového denníka.
- Primárna farba tlačidiel je `#340055`, text na nej je biely. Svetlejší fialový
  akcent zachováva čitateľnosť aktívnych položiek, grafov a odkazov na tmavom pozadí.
  PWA theme-color je rovnaká primárna farba.
- Chýbajúci backend je označený ako nedostupná komunita. Appka nevytvára
  predstierané lokálne účty/správy. Konfigurácia a SQL migrácia sú pripravené.

### Overenie

- TypeScript, ESLint, 161 unit/databázových testov v 19 súboroch a produkčný web build.
- Skutočný PostgreSQL cez PGlite: guest práva, izolácia troch účtov, spoofing,
  identita konverzácie, idempotencia, unread/read, blokovanie, rate limit a stránkovanie.
- Chrome 320/390/720 px: dve oddelené prihlásenia, registrácia a chybná autentifikácia,
  tvorba/úprava profilov, vyhľadanie, výmena správ, výpadok a reload, stratená odpoveď
  po zápise, retry bez duplikátov, odhlásenie, blokovanie, obnova hesla, hosťovský profil a zachovanie tréningov.
  HTTP autentifikácia a Realtime prenos sú v tomto teste simulované, SQL/RLS sú reálne.
- Regresné tréningové UX kontroly na rovnakých šírkach prešli, vrátane exportu
  neuložených zmien pri chybe úložiska, priameho otvorenia zálohy a primárnej farby.
- Produkčný Supabase projekt, skutočné registračné e-maily a fyzické mobilné
  prehliadače neboli overené. Aktivácia je opísaná v docs/social.md.

### Súbory

- `src/social/`: klient, typy, repository, doména, účet, editor profilu, vyhľadávanie,
  chat, perzistentné neodoslané správy, timeout a testy.
- `supabase/migrations/202610070001_social.sql`, `.env.example`, `.gitignore`
- `App.tsx`, `src/screens/ProfileScreen.tsx`, `src/components/BottomSheet.tsx`
- `src/theme/styles.ts`, `src/screens/WorkoutScreen.tsx`,
  `src/components/MachineMemoryPanel.tsx`, `src/components/ExerciseProgressPanel.tsx`,
  `src/components/SavingIndicator.tsx`, `public/index.html`, `public/manifest.webmanifest`
- `scripts/test-social.cjs`, `scripts/test-ux.cjs`, `package.json`, `package-lock.json`, `docs/social.md`, `README.md`

### Čo ešte potrebuje službu

Konkrétny Supabase projekt, aplikovanie migrácie, jeho verejné premenné v Netlify,
Auth redirecty a SMTP pre potvrdenie/obnovu e-mailov. Kód nie je pripojený
k produkčnému projektu. Synchronizácia tréningov, push notifikácie a moderovanie
nie sú súčasťou tejto zmeny; tieto funkcie sa neprezentujú ako hotové.
