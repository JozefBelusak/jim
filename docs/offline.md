# Offline web appka

`npm run build` exportuje Expo web do `dist` a následne vytvorí `dist/sw.js` zo skutočných exportovaných súborov. Celý priečinok `dist` sa nasadzuje na Netlify. Service worker sa registruje v produkcii cez HTTPS; počas vývoja sa neregistruje.

Po prvom otvorení online sa uloží kompletná verzia appky: HTML, JavaScript, lokálne obrázky, ikony a manifest. Inštalácia musí úspešne stiahnuť všetky tieto súbory. Potom možno tú istú adresu otvoriť offline a používať lokálne uložené tréningy. Externé videá a obrázky potrebujú internet.

Otvorenie appky skúša najprv sieť a pri nedostupnosti použije úplnú uloženú verziu. HTML v offline zálohe zostáva spárované s JavaScriptom z rovnakého buildu. API požiadavky, exportované používateľské dáta a externé adresy service worker neukladá.

Nová verzia sa pripraví na pozadí. Appka nespúšťa automatický reload ani nevynucuje výmenu service workera počas otvoreného tréningu. Nový worker sa aktivuje po zatvorení všetkých existujúcich kariet alebo okien appky; pri ďalšom otvorení sa použije nová verzia. Po aktivácii sa vymažú iba staré cache patriace tejto appke.

Offline cache nenahrádza JSON zálohu tréningových dát. Dáta sa ukladajú osobitne v prehliadači a dajú sa preniesť exportom/importom v appke.

## iPhone, Android a farby

Web používa bezpečné odstupy od výrezu a home indikátora iba raz, v HTML koreni.
Natívny `SafeAreaView` sa vo webovej vetve nepoužíva, pretože by tieto odstupy
pridal druhýkrát. Panely otvorené v portáli mimo koreňa majú vlastný jeden odstup.
Výška koreňa sleduje `100dvh` s fallbackom na `100%`.

Primárne tlačidlá, aktívne záložky a výbery majú plnú farbu `#340055`.
Staré levanduľové akcenty sú odstránené; text na tmavom pozadí zostáva svetlý.
PWA manifest, theme-color aj plocha za priehľadným iOS status barom používajú
rovnakú primárnu farbu. Systémové lišty sa na iOS a Androide môžu líšiť podľa OS.

Kontrola rozloženia: `npx playwright install webkit`, potom `npm run test:layout`.
Chrome testuje skutočné emulované `env(safe-area-inset-*)`; desktopový WebKit
používa pre odstupy CSS premenné. Test overí presnú farbu, jediné započítanie
odstupov, otvorenie panela, zmenu výšky okna a landscape. Nie je to test fyzického iPhonu.

„Powered by Netlify“ vkladá hosting, nie zdrojový kód. Vypneš ho pre všetkých
v **Netlify → Project configuration → General → Powered by Netlify badge**.
Podľa [dokumentácie Netlify](https://docs.netlify.com/manage/projects/powered-by-netlify-badge/)
sa zmena prejaví pri ďalšej požiadavke bez nového deployu; individuálne skrytie
badge platí len pre daný prehliadač. Offline HTML môže obsahovať starší vložený skript.

Po nasadení novej appky zatvor jej otvorené okná a karty a otvor ju znovu online.
Na aktualizáciu netreba mazať tréningové úložisko ani odstraňovať appku z plochy.
