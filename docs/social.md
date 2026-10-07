# Účty, verejné profily a chat

Aplikácia používa Supabase Auth, PostgreSQL a Realtime. Netlify zostáva hostingom
statickej web appky; správy dvoch rôznych používateľov ukladá spoločný Supabase projekt.
Lokálny tréningový denník funguje aj bez účtu. Prihlásenie ani odhlásenie nemení
existujúce tréningy, plány, zálohy alebo ich `local-user` identitu.

## Aktivácia

1. Vytvor Supabase projekt alebo použi existujúci. V jeho SQL Editore spusti raz
   celý súbor `supabase/migrations/202610070001_social.sql`. Pri správe migrácií cez
   Supabase CLI ho aplikuj ako bežnú migráciu. Je transakčný a nemení tréningové dáta.
   Pre fotky potom spusti aj `supabase/migrations/202610070002_chat_photos.sql`.
   Ak prvá migrácia už prešla, spusti iba tento nový súbor; pôvodnú neopakuj.
2. V **Authentication → URL Configuration** nastav **Site URL** na adresu svojho
   Netlify webu. Do povolených **Redirect URLs** pridaj tú istú adresu s `?account=1`
   a lokálnu adresu pre vývoj, napr. `http://localhost:8081/?account=1`.
   Pre vlastnú doménu použi jej presnú adresu. Povoľ e-mail/heslo a potvrdenie e-mailu.
3. Pre reálnych používateľov nastav vlastné **SMTP** v Supabase Auth. Predvolený
   testovací odosielateľ má obmedzenia a nie je určený pre všeobecnú registráciu.
4. Skopíruj `.env.example` na `.env` a nastav URL projektu a verejný
   **publishable** kľúč (prípadne starší verejný `anon` kľúč cez
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`). `service_role` ani secret kľúč do webu nepatria.
5. Tie isté dve premenné pridaj do **Netlify → Environment variables**, dostupné
   počas buildu. Spusti nový deploy. Expo ich vkladá do JS počas buildu; samotná
   zmena premenných bez nového buildu starý web nezmení. Lokálne reštartuj `npm start`.
6. Over dve rôzne registrácie a potvrdenie e-mailov. Každý vytvorí profil, jeden
   vyhľadá @meno druhého a otvorí „Napísať správu“. Over aj obnovenie hesla,
   prijatie na druhom zariadení a reconnect po prerušení internetu.

Bez konfigurácie appka jasne oznámi, že komunita zatiaľ nie je dostupná. Nevytvára
lokálny účet ani predstierané konverzácie.

## Neplatný alebo použitý e-mailový odkaz

`otp_expired` znamená neplatný alebo vypršaný e-mailový odkaz. Odkaz mohol byť
už použitý; niektoré e-mailové služby ho tiež otvoria pri bezpečnostnej kontrole.
Ak prihlásenie e-mailom a heslom funguje, pokračuj s existujúcim účtom a vytvor
si verejný profil. Samotné prihlásenie neurčuje, či je v projekte zapnuté potvrdenie e-mailu.

Appka otvorí Profile, zobrazí zrozumiteľné upozornenie a odstráni chybové parametre
z adresy. Existujúce prihlásenie zostáva zachované. Bez prihlásenia ponúkne
„Prihlásiť sa“ alebo „Poslať nové potvrdenie e-mailu“. Opätovné potvrdenie je dostupné
aj z registračného a prihlasovacieho formulára. Pri obnove hesla použi „Zabudnuté heslo“.
Odoslanie môže Supabase obmedziť; appka zobrazí chybu a dovolí skúsiť ho neskôr.
Formulár obnovy sa otvorí aj pri rýchlej inicializácii SDK, ktorá predbehne
React listener. Appka pritom overí zhodu návratového tokenu so session vrátenou SDK;
samotný `?recovery=1` ani stará session formulár neaktivujú.

Pre tento web je Site URL `https://gymratturbo.netlify.app` a povolený redirect
`https://gymratturbo.netlify.app/?account=1`. Kvôli `otp_expired` znovu nespúšťaj
databázovú migráciu ani nevytváraj druhý účet. Ak nový odkaz opakovane zlyhá už
pri prvom otvorení, skontroluj e-mailové prefetching/tracking nastavenia podľa
[dokumentácie Supabase](https://supabase.com/docs/guides/auth/auth-email-templates#limitations).

## Správanie a ochrana dát

- Verejný profil obsahuje @meno, meno, bio a čas vytvorenia. E-mail sa nepublikuje.
  Odkaz `/?profile=meno` otvorí profil aj hosťovi. Premenovaním @mena sa zmení odkaz.
- Na chat treba prihlásenie a vlastný profil. Konverzácia medzi dvojicou je jediná,
  aj keď ju naraz založia obaja. Podporuje text a jednu fotku na správu s voliteľným
  popisom. Skupiny, videá a ostatné prílohy zatiaľ nie sú implementované.
- Správy sú súkromné cez databázové oprávnenia/RLS; nejde o end-to-end šifrovanie.
  Prevádzkovateľ databázy má administrátorský prístup.
- Odosielateľa a čas určuje server. Pri opakovaní správy sa použije rovnaké `client_id`;
  server vráti pôvodnú správu, takže výpadok odpovede nevytvorí duplikát.
- Neodoslané správy sa uchovajú na zariadení oddelene podľa účtu a konverzácie.
  Odoslanie je viazané na účet, ktorý správu napísal, aj pri prepnutí účtu v inej karte.
  Po návrate sa zosúladia so serverom alebo ponúknu „Zopakovať“. Odhlásenie skryje
  účet a chat; lokálne tréningy aj neodoslané správy zostávajú v úložisku prehliadača.
- Chat načítava po 50 správach, vrátane starších strán. Realtime aktualizuje otvorený
  chat; kontrola každých 15 sekúnd a pri návrate do popredia opraví výpadky spojenia.
  Prehľad konverzácií sa kontroluje každých 15 sekúnd. Nezobrazuje neoverený online stav.
- Neprečítané správy sa označujú podľa poslednej skutočne zobrazenej správy pri
  dolnom okraji otvoreného chatu. Neaktívna karta sa nepovažuje za čítanie.
- Blokovanie zastaví nové správy v oboch smeroch. Staršie správy zostanú prístupné
  účastníkom. Server povoľuje najviac 30 nových správ za minútu na účet.
- Privilegované SQL funkcie sú v neexponovanej schéme `private`, majú pevný prázdny
  `search_path` a kontrolujú `auth.uid()`. Prehliadač nemôže priamo zapisovať do správ.
  Schému `private` nepridávaj medzi exposed schemas API.

## Fotky v chate

V Supabase SQL Editore spusti celý nový súbor `202610070002_chat_photos.sql`.
Vytvorí súkromný bucket `chat-photos`, tabuľku rezervácií, Storage RLS a RPC.
Bucket nemusíš vytvárať ručne a nesmie byť verejný. Prihlásenie, účty, pôvodné
správy a prvá migrácia sa nemenia. Po commite/pushi nechaj Netlify nasadiť nový
build a otvor appku znovu online.

V chate použi **Pridať fotku**, skontroluj náhľad, prípadne napíš popis a stlač
**Odoslať**. Pred odoslaním ju môžeš odobrať alebo nahradiť. Kliknutie na fotku
v správe otvorí väčší náhľad. Výber funguje vo web appke aj v PWA na telefóne.

- JPEG, PNG a WebP sa prekodujú na JPEG, najviac 1600 px na dlhšej strane.
  HEIC/HEIF funguje, ak ho daný prehliadač vie dekódovať; inak appka požiada o JPEG/PNG.
  Originál môže mať najviac 25 MB, výsledok najviac 5 MiB. Canvas export
  neprenesie pôvodné EXIF/GPS údaje. Fotka zostáva v pôvodnom pomere strán.
- Potvrdené fotky čítajú cez autentifikované Storage API účastníci konkrétneho
  chatu. Appka nevytvára verejné ani zdieľateľné podpísané odkazy; náhľad používa
  dočasný lokálny Blob URL, ktorý zruší po zatvorení komponentu. Administrátor
  projektu má prístup k úložisku; fotky nie sú end-to-end šifrované.
- Pred odoslaním sa pripravené bajty uložia do IndexedDB oddelene podľa účtu,
  chatu a nonce ako ArrayBuffer kvôli kompatibilite Safari/WebKit. Aj upload
  prenáša priamo JPEG bajty. Outbox obsahuje iba metadáta. Reload zachová neodoslanú fotku;
  **Neodoslané · Zopakovať** dokončí upload a správu s rovnakou identitou.
  Obe operácie tolerujú stratenú odpoveď bez prepísania fotky či duplikovania správy.
- Server povoľuje upload len do rezervovanej cesty vlastníka, publikovanie iba
  po existujúcom JPEG uploade a fotku nemožno použiť s iným účtom, chatom alebo nonce.
  Nahrané objekty sú nemenné. Blokovanie zastaví nové rezervácie/uploady/správy,
  staršia história zostáva prístupná. Fotky zdieľajú limit 30 správ za minútu s textom.
- Najviac 20 nepublikovaných rezervácií na účet obmedzuje nedokončené uploady.
  Správca služby musí prípadné trvalo opustené uploady čistiť cez Storage API;
  automatická úloha na ich čistenie nie je súčasťou tejto implementácie.
- Tréningový JSON export neobsahuje chat ani fotky. Lokálne bajty neodoslanej
  fotky sa vymažú po potvrdení správy serverom; odhlásenie ich zachová pre daný účet.

Overenie: `npm run test:social`, prípadne `npm run test:social -- --webkit`
po `npx playwright install webkit`. Test používa reálne dekódovanie/prekódovanie,
IndexedDB a Supabase SDK s testovacím Auth/Storage transportom a skutočným PostgreSQL/RLS.
Nie je to overenie produkčného Supabase Storage ani fyzických telefónov.

## Overenie

`npm test` obsahuje testy na skutočnom PostgreSQL cez PGlite: práva hosťa, izolácia
účtov, spoofing, idempotentné odosielanie, unread, blokovanie, rate limit a stránkovanie.
`npm run test:social` vytvorí oddelený testovací web build a overí UI + Supabase SDK
proti testovaciemu HTTP rozhraniu so skutočnými SQL/RLS pravidlami. Autentifikácia a
Realtime sieť sú v tomto teste simulované; nejde o overenie produkčného Supabase.
Snímky sú v `.expo/social-checks`. Žiadne skúšobné účty ani správy sa neposielajú
skutočným ľuďom. `npm run test:ux` overuje pôvodné tréningové toky.

## Externé závislosti a rozsah

Aktivácia potrebuje projekt, aplikovanú migráciu, verejné env premenné, Auth redirecty
 a odosielanie registračných e-mailov. Bez konkrétneho projektu nie je možné overiť
produkčné doručovanie ani projekt nasadiť. Push notifikácie pri zatvorenej appke,
moderovanie/nahlasovanie, mazanie účtu a cloudová synchronizácia tréningov sú samostatné
funkcie a táto zmena ich neimplementuje. Súčasný formát lokálnych záloh v6 sa nemení;
JSON tréningovej zálohy neobsahuje účet ani správy zo servera.

Oficiálne podklady: [Supabase Auth pre React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes),
[Storage RLS](https://supabase.com/docs/guides/storage/security/access-control),
[SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
