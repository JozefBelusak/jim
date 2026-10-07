# Účty, verejné profily a chat

Aplikácia používa Supabase Auth, PostgreSQL a Realtime. Netlify zostáva hostingom
statickej web appky; správy dvoch rôznych používateľov ukladá spoločný Supabase projekt.
Lokálny tréningový denník funguje aj bez účtu. Prihlásenie ani odhlásenie nemení
existujúce tréningy, plány, zálohy alebo ich `local-user` identitu.

## Aktivácia

1. Vytvor Supabase projekt alebo použi existujúci. V jeho SQL Editore spusti raz
   celý súbor `supabase/migrations/202610070001_social.sql`. Pri správe migrácií cez
   Supabase CLI ho aplikuj ako bežnú migráciu. Je transakčný a nemení tréningové dáta.
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

## Správanie a ochrana dát

- Verejný profil obsahuje @meno, meno, bio a čas vytvorenia. E-mail sa nepublikuje.
  Odkaz `/?profile=meno` otvorí profil aj hosťovi. Premenovaním @mena sa zmení odkaz.
- Na chat treba prihlásenie a vlastný profil. Konverzácia medzi dvojicou je jediná,
  aj keď ju naraz založia obaja. Žiadne skupiny ani prílohy zatiaľ nie sú implementované.
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
[SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
