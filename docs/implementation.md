# Implementované funkcie a zmenené súbory

Aplikácia zostáva statickou web appkou pre prehliadač a ikonu na ploche. Nasadenie cez Netlify používa existujúcu konfiguráciu: `npm run build`, publish directory `dist`, Node.js 22 a produkčnú vetvu z Git repozitára. Build teraz po exporte Expo vytvára aj offline service worker.

## Ukladanie, migrácia a záloha

Uložené dáta majú verziu 6. Pri načítaní sa rozpoznajú verzie 2–5 aj pôvodné úložisko verzie 1, doplnia sa nové polia a zachovajú existujúce záznamy. Pôvodné kľúče úložiska sa neodstraňujú. Poškodené aktuálne alebo staršie dáta zablokujú načítanie a zobrazia chybu; appka ich nenahradí prázdnym denníkom.

Zápisy sú zaradené do fronty a UI rozlišuje načítanie, ukladanie, uloženie a chybu. Neúspešný zápis možno zopakovať a priamo pri chybe otvoriť export zálohy. Web pri zatváraní stránky skúsi synchrónne uložiť aktuálny stav. Pri detekcii odlišného zápisu z inej karty zastaví ďalšie ukladanie konfliktnej karty a ponúkne export jej dát alebo načítanie aktuálneho stavu.

JSON export obsahuje históriu, aktívny tréning, rozvrh, plány, vlastné cviky a pamäť strojov. Import podporuje súbor aj vloženie textu, overuje formát, verziu, hodnoty, dátumy, unikátnosť identít a odkazy medzi cvikmi a strojmi. Limit zálohy je 20 MB. Po potvrdení nahradí aktuálny stav až po úspešnom zápise do úložiska. Appka ponúka vrátenie posledného importu počas aktuálnej relácie.

Zmenené alebo nové súbory:

- [`src/storage/trainingStorage.ts`](../src/storage/trainingStorage.ts), [`src/storage/trainingStorage.test.ts`](../src/storage/trainingStorage.test.ts) – rozšírený model úložiska, normalizácia a migrácia.
- [`src/storage/trainingRepository.ts`](../src/storage/trainingRepository.ts), [`src/storage/trainingRepository.test.ts`](../src/storage/trainingRepository.test.ts) – bezpečné načítanie a postupné zápisy.
- [`src/storage/useTrainingState.ts`](../src/storage/useTrainingState.ts) – stav načítania/ukladania, retry, import a ochrana pri detekcii konfliktu medzi kartami.
- [`src/storage/backup.ts`](../src/storage/backup.ts), [`src/storage/backup.test.ts`](../src/storage/backup.test.ts) – serializácia, validácia a migrácia záloh.
- [`src/components/BackupPanel.tsx`](../src/components/BackupPanel.tsx) – stiahnutie, výber súboru, import textom a potvrdenie nahradenia dát.

## Flexibilný tréning a čas

Tréning možno začať z plánu, histórie alebo ako prázdny. Počas tréningu možno pridávať, preskočiť, vymeniť a presúvať cviky, vracať sa k predchádzajúcim a pridávať alebo odoberať série aj počas prestávky. Výmena cviku ponechá už odcvičené série pri pôvodnom cviku a vymení zostávajúcu prácu. Dokončenie série možno vrátiť.

Predčasné ukončenie uloží odcvičené série bez vyžadovania dokončenia celého plánu. Zrušenie má potvrdenie a možnosť obnoviť tréning. Celkový čas podporuje pauzu/pokračovanie, opravu trvania a zastavenie pri dokončení. Supersety reálne striedajú cviky po sériách a prestávka nasleduje po kole.

Funkcia „Musím odísť o X minút“ používa odhad tempa, plánované prestávky, čas zostávajúcej aktuálnej prestávky a poradie cvikov ako prioritu. Pred použitím zobrazí počet ponechaných sérií, vynechané cviky a odhad trvania. Odstraňuje iba nedokončenú prácu a zachováva hotové série. Ide o časový odhad, ktorý si používateľ môže upraviť vlastným poradím cvikov.

Zmenené alebo nové súbory:

- [`src/domain/workouts.ts`](../src/domain/workouts.ts), [`src/domain/workouts.test.ts`](../src/domain/workouts.test.ts) – priebeh tréningu, čiastočné uloženie, úpravy cvikov/sérií, supersety, prestávky a časový návrh.
- [`src/screens/WorkoutScreen.tsx`](../src/screens/WorkoutScreen.tsx) – použiteľné ovládanie všetkých týchto zmien počas cvičenia.
- [`src/components/ConfirmationDialog.tsx`](../src/components/ConfirmationDialog.tsx) – potvrdenie zrušenia a ďalších krokov vyžadujúcich rozhodnutie.

## História, metriky a progres

História obsahuje otvoriteľný detail so sériami a poznámkami. Možno meniť názov, dátum, trvanie, poznámky, hodnoty aj typy sérií, rozsahy opakovaní a náročnosť; pridávať/odstraňovať série, vymazať tréning s potvrdením alebo ho zopakovať. Vymazanie možno počas relácie vrátiť. Objem, rekordy a grafy vychádzajú z aktuálnej histórie, takže oprava údaja upraví aj odvodené výsledky.

Spoločná logika podporuje váhu + opakovania, samotné opakovania, trvanie, vzdialenosť + trvanie a asistenciu + opakovania. Objem externej záťaže sa počíta len pre bežné vážené cviky. Pri asistovaných cvikoch rekord menšej asistencie zohľadňuje počet opakovaní; časové a vzdialenostné cviky majú vlastné rekordy. Série zachovávajú plánovaný rozsah a voliteľný target RIR, namerané RIR/RPE a poznámky.

Grafy zobrazujú dátumy, hodnoty, jednotky, rozsah osi a zvolený výkon so sériami. Výber obdobia aj konkrétneho stroja filtruje porovnateľnú históriu. Týždenný prehľad ukazuje počet tréningov oproti minulému týždňu, pracovné série, čas, objem a primárne precvičené partie.

Odporúčania ďalšieho výkonu vychádzajú z posledných porovnateľných pracovných sérií, dokončeného plánovaného objemu, rozsahu opakovaní a dostupného údaja o náročnosti. Vysvetlia ponechanie, zvýšenie alebo zníženie cieľa; počas tréningu ich možno použiť na nedokončené pracovné série.

Zmenené alebo nové súbory:

- [`src/domain/history.ts`](../src/domain/history.ts), [`src/domain/history.test.ts`](../src/domain/history.test.ts) – validácia editácie, prepočet údajov a historické rekordy.
- [`src/domain/metrics.ts`](../src/domain/metrics.ts), [`src/domain/metrics.test.ts`](../src/domain/metrics.test.ts) – spoločná logika metrík, formátovanie a objem.
- [`src/domain/progress.ts`](../src/domain/progress.ts), [`src/domain/progress.test.ts`](../src/domain/progress.test.ts) – rekordy, grafové body, odporúčania a týždenný prehľad.
- [`src/components/WorkoutHistoryPanel.tsx`](../src/components/WorkoutHistoryPanel.tsx) – detail, úprava, mazanie a zopakovanie histórie.
- [`src/components/ExerciseProgressPanel.tsx`](../src/components/ExerciseProgressPanel.tsx) – čitateľné grafy, detail výkonu a výber stroja.
- [`src/screens/CalendarScreen.tsx`](../src/screens/CalendarScreen.tsx), [`src/screens/ProfileScreen.tsx`](../src/screens/ProfileScreen.tsx) – napojenie histórie a jej úprav.

## Plány, prvý tréning a knižnica

Prvý tréning možno začať priamo výberom pripraveného plánu: Full body s používaním strojov, Upper body, Lower body alebo Home bodyweight. Zvolený plán sa uloží a dá sa ďalej meniť. Plány podporujú archivovanie/obnovu, potvrdené mazanie s vrátením, poradie rotácie, duplicity toho istého cviku, poznámky, rozsah opakovaní a voliteľný cieľ RIR. Archivované plány sa nezaraďujú do odporúčanej rotácie.

Spoločné vyhľadávanie funguje v knižnici, editore plánu aj tréningu. Kombinuje názov, svaly a vybavenie, zvláda diakritiku a alternatívy vybavenia. Vyhľadávanie v knižnici je pred detailom a grafmi. Vlastné cviky umožňujú výber metriky, úpravu poznámok k technike a bezpečne overené HTTP/HTTPS odkazy na obrázok alebo video. Dátum „dnes“ sa priebežne prepočítava vrátane prechodu cez polnoc.

Zmenené alebo nové súbory:

- [`src/domain/templates.ts`](../src/domain/templates.ts), [`src/domain/templates.test.ts`](../src/domain/templates.test.ts) – pravidlá plánov a prenos rozsahov do tréningu.
- [`src/domain/exercises.ts`](../src/domain/exercises.ts), [`src/domain/exercises.test.ts`](../src/domain/exercises.test.ts) – vyhľadávanie a vlastné cviky.
- [`src/data/exercises.ts`](../src/data/exercises.ts), [`src/data/exercises.test.ts`](../src/data/exercises.test.ts) – metriky a alternatívy v existujúcom katalógu.
- [`src/data/plans.ts`](../src/data/plans.ts), [`src/data/plans.test.ts`](../src/data/plans.test.ts) – tvorba sérií, zachovanie cieľov a aktuálny dátum.
- [`src/data/starterTemplates.ts`](../src/data/starterTemplates.ts), [`src/data/starterTemplates.test.ts`](../src/data/starterTemplates.test.ts) – pripravené plány.
- [`src/components/ExerciseSearch.tsx`](../src/components/ExerciseSearch.tsx), [`src/components/CustomExerciseForm.tsx`](../src/components/CustomExerciseForm.tsx) – zdieľané hľadanie a formulár cviku.
- [`src/screens/TodayScreen.tsx`](../src/screens/TodayScreen.tsx), [`src/screens/TemplatesScreen.tsx`](../src/screens/TemplatesScreen.tsx), [`src/screens/LibraryScreen.tsx`](../src/screens/LibraryScreen.tsx) – onboarding, štart, plány, prehľad a knižnica.

## Pamäť fitka a stroja

Ku cviku možno uložiť názov fitka, konkrétny stroj a jeho nastavenia, vybrať existujúci stroj alebo ho od cviku odpojiť. Appka zobrazí posledný výkon na tomto stroji. Predvyplnenie predchádzajúcich sérií, rekordy, grafy a odporúčania rozlišujú identitu stroja a metriku cviku.

Zmenené alebo nové súbory:

- [`src/domain/machineMemory.ts`](../src/domain/machineMemory.ts), [`src/domain/machineMemory.test.ts`](../src/domain/machineMemory.test.ts) – uloženie, prepojenie a posledný výkon stroja.
- [`src/components/MachineMemoryPanel.tsx`](../src/components/MachineMemoryPanel.tsx) – zvolenie stroja a úprava jeho nastavení.

## Produkčný offline režim a integrácia

Service worker precachuje kompletný export s cache odvodenou od obsahu. Navigácia najprv skúša sieť a offline používa zhodnú uloženú verziu HTML a JavaScriptu. Externé adresy, API a exportované dáta sa necachujú. Neúspešná inštalácia odstráni nedokončenú cache; aktualizácia čaká na zatvorenie existujúcich okien appky a nevynucuje reload tréningu. Podrobnosti: [offline.md](./offline.md).

Zmenené alebo nové súbory:

- [`src/web/offline.ts`](../src/web/offline.ts), [`src/web/offline.test.ts`](../src/web/offline.test.ts) – produkčná registrácia a jej ochrany.
- [`scripts/create-offline-bundle.cjs`](../scripts/create-offline-bundle.cjs), [`src/web/offlineBundle.test.ts`](../src/web/offlineBundle.test.ts) – generovanie manifestu/cache a testovanie správania workera.
- [`package.json`](../package.json) – doplnenie generovania service workera po Expo exporte.
- [`eslint.config.js`](../eslint.config.js) – vylúčenie vygenerovaného buildu z kontroly zdrojov.
- [`tsconfig.json`](../tsconfig.json) – vylúčenie buildov a dočasných súborov z TypeScript kontroly.
- [`src/types.ts`](../src/types.ts) – rozšírené typy metrík, sérií, plánov, časov a pamäte strojov.
- [`App.tsx`](../App.tsx) – integrácia úložiska, obrazoviek, histórie, potvrdení/vrátenia a offline registrácie.
- [`README.md`](../README.md), [`docs/offline.md`](./offline.md), [`docs/implementation.md`](./implementation.md) – aktuálna používateľská a technická dokumentácia.

## Overenie

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Automatické testy pokrývajú čiastočné uloženie tréningu, supersety, úpravy a opakovanie histórie, import/export, migráciu a odmietnutie poškodených dát, výpočty PR pre rôzne metriky, pamäť strojov, odporúčania, pripravené plány a úpravy času. Offline testy overujú úplnú inštaláciu, zmenu verzie pri zmene obsahu, odstraňovanie neúspešnej alebo starej cache, sieťovú navigáciu/offline fallback a vynechanie API, exportov a externých adries.

Posledná úplná testovacia kontrola: 136 úspešných testov v 15 súboroch. TypeScript, lint a produkčný build prešli; produkčný build vytvoril export `dist` a service worker s 8 statickými súbormi. Testy nenahrádzajú overenie inštalácie a životného cyklu PWA na fyzickom iPhone a Androide.

Produkčný export bol overený aj automatizovaným priechodom v Chrome pri mobilnom rozlíšení 390 × 844: prázdny tréning, okamžitý zápis čísel a čiastočné uloženie, úprava histórie a prepočet objemu, zopakovanie/zrušenie/undo, súborový export a import, offline reload, konflikt dvoch kariet, pamäť stroja a oprava času. Simulované zlyhanie úložiska overilo viditeľnú chybu, export neuloženého stavu, zachovanie pôvodných dát pri neúspešnom importe a opakovanie zápisu. Poškodené JSON úložisko zostalo zachované až do importu platnej zálohy. Prešiel aj celý superset A1 → B1 → rest → A2 → B2 → uloženie bez runtime výnimiek.

## Čo potrebuje externý backend alebo službu

Implementované funkcie fungujú lokálne a nevyžadujú účet ani externý backend. Prenos na iné zariadenie je cez JSON export/import.

Backend alebo externú službu vyžaduje automatická cloudová záloha, účty a obnova dát po prihlásení, automatická synchronizácia medzi zariadeniami a zdieľaný stav trénera s používateľom vrátane vzdialených úprav plánu alebo spoločnej histórie. Statický hosting samotný tieto dáta nesynchronizuje. Odporúčania progresie a skrátenia tréningu sú lokálne pravidlá a odhady; na ich aktuálne fungovanie nie je potrebná AI služba.
