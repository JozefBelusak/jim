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

Manifest nastavuje názov, ikonu a samostatné okno. Nie je potrebný APK, App Store ani Expo Go. Pridanie na plochu nezaručuje použitie bez internetu; táto verzia nemá offline cache.

Tréningy sa ukladajú lokálne v prehliadači daného zariadenia. Neprenášajú sa automaticky z pôvodnej natívnej appky ani medzi zariadeniami; vymazanie dát webu ich odstráni.

## Overenie

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

## Dokumentácia konceptu

Pozri [koncept-aplikacie.md](./koncept-aplikacie.md).
