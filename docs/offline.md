# Offline web appka

`npm run build` exportuje Expo web do `dist` a následne vytvorí `dist/sw.js` zo skutočných exportovaných súborov. Celý priečinok `dist` sa nasadzuje na Netlify. Service worker sa registruje v produkcii cez HTTPS; počas vývoja sa neregistruje.

Po prvom otvorení online sa uloží kompletná verzia appky: HTML, JavaScript, lokálne obrázky, ikony a manifest. Inštalácia musí úspešne stiahnuť všetky tieto súbory. Potom možno tú istú adresu otvoriť offline a používať lokálne uložené tréningy. Externé videá a obrázky potrebujú internet.

Otvorenie appky skúša najprv sieť a pri nedostupnosti použije úplnú uloženú verziu. HTML v offline zálohe zostáva spárované s JavaScriptom z rovnakého buildu. API požiadavky, exportované používateľské dáta a externé adresy service worker neukladá.

Nová verzia sa pripraví na pozadí. Appka nespúšťa automatický reload ani nevynucuje výmenu service workera počas otvoreného tréningu. Nový worker sa aktivuje po zatvorení všetkých existujúcich kariet alebo okien appky; pri ďalšom otvorení sa použije nová verzia. Po aktivácii sa vymažú iba staré cache patriace tejto appke.

Offline cache nenahrádza JSON zálohu tréningových dát. Dáta sa ukladajú osobitne v prehliadači a dajú sa preniesť exportom/importom v appke.
