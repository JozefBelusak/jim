# Zmeny a nadväzujúci audit

Tento súbor slúži ako trvalý log zmien podľa auditu zo 7. októbra 2026.
Pri ďalšej úprave zaznamenať výsledné správanie, overenie a stav súvisiacich bodov.
Zachovať existujúce tréningy, históriu a plány. Nepovažovať bod za hotový len preto,
že existuje jeho tlačidlo; rozhoduje celý používateľský tok.

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
