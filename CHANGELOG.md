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
| BE-09 | Profile je lokálna história; účty, verejné profily, chat a synchronizácia medzi zariadeniami chýbajú. | Vyžaduje spoločný backend a identitu používateľov |
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
