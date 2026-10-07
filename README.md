# Jimrat – web appka

Tréningová aplikácia pre prehliadač. Na telefóne stačí otvoriť jej webovú adresu a pridať ju na plochu.

## Spustenie

```bash
npm install
npm start
```

Otvor webovú adresu z terminálu v prehliadači. Telefón musí byť v rovnakej sieti ako počítač; použi jeho LAN adresu a port uvedený v termináli.

## Nasadenie na web

```bash
npm run build
```

Build vytvorí statický web a offline service worker v priečinku `dist/`.

### Netlify cez GitHub (automatické aktualizácie)

1. Commitni a pushni zdrojové súbory vrátane `public/`, `package-lock.json` a `netlify.toml` do repozitára `JozefBelusak/jim`.
2. V Netlify vyber **Add new project → Import an existing project → GitHub** a povoľ prístup k repozitáru.
3. Vyber repozitár `jim` a produkčnú vetvu `main`. Base directory nechaj prázdny.
4. Konfigurácia `netlify.toml` nastavuje build command `npm run build`, publish directory `dist` a Node.js 22.
5. Spusti nasadenie. Netlify vytvorí HTTPS adresu aplikácie.

Každý ďalší push do `main` spustí nový build a po jeho úspechu aktualizuje web na rovnakej adrese. `dist/` a `node_modules/` sú v `.gitignore`; Netlify ich vytvorí pri builde.

Podrobnosti: [nasadenie z repozitára v dokumentácii Netlify](https://docs.netlify.com/start/quickstarts/deploy-from-repository/).

Pri ručnom nasadení nahraj obsah priečinka `dist/` na statický hosting s HTTPS. Aplikáciu nasadzuj do koreňa domény. Vývojový server na počítači nie je verejný hosting.

## Ikona na ploche telefónu

- **iPhone / iPad:** otvor web v Safari → Zdieľať → Pridať na plochu → Pridať. Ak sa zobrazí voľba Otvoriť ako webovú apku, zapni ju.
- **Android / Chrome:** otvor web → menu ⋮ → Pridať na plochu alebo Nainštalovať aplikáciu (podľa prehliadača) → potvrď.

Manifest nastavuje názov, ikonu a samostatné okno. Nie je potrebný APK, App Store ani Expo Go. Produkčný build podporuje offline otvorenie po úspešnom prvom načítaní online. Aktualizácia nevynucuje reload otvoreného tréningu; nový service worker sa aktivuje po zatvorení existujúcich okien appky. Podrobnosti sú v [dokumentácii offline režimu](./docs/offline.md).

## Funkcie

- Tréning z vlastného alebo pripraveného plánu, prípadne prázdny tréning. Počas cvičenia možno pridávať, preskočiť, vymeniť a presúvať cviky, vracať sa k nim a upravovať série. Predčasné ukončenie uloží iba odcvičené série. Zrušenie má potvrdenie a možnosť vrátenia.
- Reálne striedanie sérií v supersete, rozsahy opakovaní, voliteľné RIR/RPE, prestávky, pauza tréningu a oprava uplynutého času. Návrh skrátenia podľa zostávajúcich minút zachová dokončené série a pred použitím ukáže navrhovanú zmenu.
- Detail a editácia histórie vrátane dátumu, trvania, poznámok a sérií; mazanie a zopakovanie tréningu. Rekordy, objem a grafy sa odvodzujú z aktuálnych dát.
- Váha + opakovania, samotné opakovania, čas, vzdialenosť + čas a asistencia + opakovania. Pri asistovaných cvikoch sa menšia asistencia posudzuje spolu s počtom opakovaní; nezapočítava sa ako bežná zdvihnutá záťaž.
- Vyhľadávanie podľa názvu, svalov a vybavenia, vlastné cviky a odkazy na techniku, archivovanie a poradie plánov. Grafy majú hodnoty, dátumy a detail výkonu; týždenný prehľad ukazuje tréningy, pracovné série, čas a precvičené partie.
- Pamäť konkrétneho fitka a stroja s nastaveniami a posledným výkonom. História a jednoduché odporúčania ďalšieho výkonu rozlišujú zvolený stroj.

## Ukladanie a zálohy

Dáta sa ukladajú lokálne v prehliadači daného zariadenia. Appka zobrazuje priebeh ukladania, úspech aj chybu s možnosťou zopakovania. Ak rozpozná zmenu z inej karty, zastaví ukladanie konfliktnej karty a ponúkne načítanie aktuálnych dát alebo export vlastnej zálohy.

V **Profile → Záloha tréningov → Záloha a prenos dát** možno stiahnuť JSON s históriou, rozbehnutým tréningom, rozvrhom, plánmi, vlastnými cvikmi aj pamäťou strojov. Import overí súbor a pred nahradením aktuálnych dát vyžaduje potvrdenie. Záloha sa najprv uloží; neúspešný import zachová existujúci stav. Posledný import možno počas otvorenej appky vrátiť.

Existujúce dáta starších verzií úložiska sa pri načítaní migrujú do verzie 6. Poškodené dáta sa zobrazia ako chyba a pôvodné uložené záznamy sa nevymažú. Offline cache uchováva súbory appky; JSON export zálohuje používateľské tréningové dáta.

Účet ani cloudová synchronizácia nie sú potrebné na tieto funkcie. Medzi zariadeniami možno dáta preniesť JSON zálohou. Automatická synchronizácia medzi zariadeniami a spolupráca trénera s používateľom by vyžadovali backend alebo externú službu. Vymazanie dát webu odstráni lokálne tréningy aj offline cache.

## Overenie

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

## Dokumentácia

Aktuálne správanie, zmenené súbory a overenia: [implementácia](./docs/implementation.md).

Produkčný offline režim: [offline web appka](./docs/offline.md).

Pôvodný produktový koncept: [koncept-aplikacie.md](./koncept-aplikacie.md).

## Verejné profily a súkromné správy

Účty a chat používajú Supabase. Návod na migráciu, Auth, e-maily a premenné
pre Netlify je v [docs/social.md](docs/social.md). Tréningy fungujú aj bez účtu
a zostávajú uložené lokálne. Bez nastaveného backendu je komunita označená ako nedostupná.
