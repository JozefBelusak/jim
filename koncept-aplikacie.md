# Koncept aplikacie pre fitness komunitu

## 1. Nazov projektu

**GymRat / GymMate**

Pracovny nazov mobilnej aplikacie pre ludi, ktori cvicia, chcu zacat cvicit alebo si chcu systematicky sledovat svoj treningovy progres.

## 2. Definicia ulohy

Cielom projektu je navrhnut a vytvorit mobilnu aplikaciu pre Android a iOS, ktora pomoze pouzivatelom efektivnejsie cvicit, sledovat progres a jednoduchsie si organizovat treningovy plan.

Aplikacia ma byt zamerana najma na:

- sledovanie treningoveho progresu,
- zapisovanie odcvicenych treningov,
- tvorbu alebo pouzivanie treningovych planov,
- podporu zaciatocnikov,
- motivaciu cez komunitne prvky,
- jednoduche porovnavanie vysledkov v case.

## 3. Hlavna myslienka aplikacie

Aplikacia ma pouzivatelovi sluzit ako osobny fitness dennik. Pouzivatel si vie zapisovat cviky, serie, opakovania, vahy, telesne miery, telesnu hmotnost a fotografie progresu.

Okrem samotneho zapisovania treningov aplikacia poskytuje aj prehlad statistik, osobnych rekordov a vyvoja vykonnosti. V buducnosti moze aplikacia obsahovat aj komunitne funkcie, odporucania treningov alebo spolupracu s trenermi.

## 4. Vlastnik produktu

**Vlastnik aplikacie**

Vlastnik produktu je osoba alebo tim zodpovedny za smerovanie aplikacie, prioritizaciu funkcionalit a rozhodovanie o tom, ake problemy ma aplikacia riesit ako prve.

Hlavne zodpovednosti vlastnika produktu:

- definovanie cielov aplikacie,
- rozhodovanie o funkcionalitach,
- urcovanie priorit vyvoja,
- komunikacia s vyvojarmi,
- vyhodnocovanie spatnej vazby od pouzivatelov.

## 5. Cielova domena

Cielovou domenou je fitness, posilnovanie, rekreacne cvicenie a osobny treningovy progres.

Aplikacia je urcena pre ludi, ktori:

- pravidelne navstevuju posilnovnu,
- chcu zacat cvicit, ale nevedia ako,
- potrebuju sledovat svoj progres,
- chcu si vytvarat vlastne treningove plany,
- chcu mat treningovu historiu na jednom mieste,
- chcu ziskat inspiraciu od inych pouzivatelov,
- chcu si oznacit svoje oblubene alebo navstevovane fitka,
- chcu jednoduchsie rozhodovat o jedle pred alebo po treningu.

## 6. Pouzivatelia systemu

### 6.1 Primarny pouzivatel: GymRat

GymRat je bezny pouzivatel aplikacie. Moze ist o zaciatocnika, mierne pokrocileho alebo pokrocileho cvicenca.

#### Charakteristika

- chce pravidelne cvicit,
- chce sledovat svoj progres,
- chce mat prehlad o odcvicenych treningoch,
- chce si zapisovat vahy, opakovania a serie,
- chce vidiet, ci sa zlepsuje,
- moze hladat motivaciu alebo inspiraciu,
- chce mat prehlad o fitkach, ktore navstevuje,
- chce ziskat rychle odporucania k jedlu alebo produktu.

#### Ciele pouzivatela

- vytvorit si profil,
- nastavit si fitness ciel,
- vytvorit alebo vybrat treningovy plan,
- zapisovat treningy,
- sledovat progres v grafoch,
- porovnavat svoje vykony v case,
- objavovat nove cviky,
- pripadne zdielat progres s komunitou,
- oznacit svoje navstevovane fitko alebo fitka,
- analyzovat jedlo z fotografie,
- vyhladat produkt z bezneho supermarketu,
- nastavit si jednoduchost vysvetlenia cvikov.

#### Problemy pouzivatela

- nevie, ako zacat cvicit,
- nema system v treningoch,
- nevie, ci sa realne zlepsuje,
- zabuda si zapisovat vykony,
- pouziva papierove poznamky alebo viac roznych aplikacii,
- chyba mu motivacia,
- nevie, ci je konkretne jedlo vhodne pred treningom,
- nevie rychlo porovnat bezne produkty zo supermarketu,
- pri cvikoch nerozumie prilis odbornym vysvetleniam.

### 6.2 Sekundarny pouzivatel: Administrator portalu

Administrator je osoba zodpovedna za spravu aplikacie a jej obsahu.

#### Charakteristika

- spravuje pouzivatelov,
- kontroluje obsah v aplikacii,
- riesi nahlasene problemy,
- upravuje databazu cvikov,
- zabezpecuje hladke fungovanie systemu.

#### Ciele administratora

- spravovat pouzivatelske ucty,
- riesit nahlaseny obsah,
- pridavat alebo upravovat cviky,
- kontrolovat kvalitu obsahu,
- zabezpecit bezpecne a stabilne pouzivanie aplikacie.

#### Problemy administratora

- velke mnozstvo poziadaviek,
- nahlaseny nevhodny obsah,
- technicke problemy pouzivatelov,
- potreba udrziavat databazu cvikov aktualnu,
- kontrola komunitnych funkcii.

### 6.3 Mozny buduci pouzivatel: Trener

Trener moze byt rozsirenim aplikacie v neskorsej faze.

#### Charakteristika

- vytvara treningove plany,
- sleduje progres svojich klientov,
- komunikuje s klientmi,
- odporuca zmeny v treningu.

#### Ciele trenera

- vytvarat treningove sablony,
- priradovat plany klientom,
- kontrolovat vykony klientov,
- upravovat trening podla progresu,
- mat prehlad o historii cvicenia klienta.

## 7. Konceptualny model

Konceptualny model opisuje hlavne objekty systemu a vztahy medzi nimi.

### 7.1 Hlavne entity

#### Pouzivatel

Predstavuje osobu, ktora pouziva aplikaciu. Pouzivatel ma ucet, profil, ciele, treningove plany, treningovu historiu a zaznamy progresu.

Zakladne atributy:

- ID pouzivatela,
- meno alebo prezyvka,
- e-mail,
- heslo,
- datum registracie,
- typ pouzivatela,
- stav uctu.

#### Profil

Profil obsahuje osobne a fitness informacie pouzivatela.

Zakladne atributy:

- vek,
- vyska,
- hmotnost,
- pohlavie,
- uroven skusenosti,
- preferovany typ treningu,
- profilova fotografia,
- sukromie profilu,
- navstevovane fitka,
- preferencie stravovania,
- uroven detailu vysvetleni cvikov.

#### Fitness ciel

Fitness ciel urcuje, co chce pouzivatel dosiahnut.

Priklady cielov:

- naberanie svalovej hmoty,
- chudnutie,
- zvysenie sily,
- zlepsenie kondicie,
- udrzanie formy,
- rehabilitacia alebo navrat k cviceniu.

#### Cvik

Cvik je zakladna jednotka treningu.

Zakladne atributy:

- nazov cviku,
- cielova svalova partia,
- typ cviku,
- narocnost,
- popis techniky,
- odporucane vybavenie,
- obrazok alebo video,
- bezpecnostne upozornenia,
- animacia alebo tutorial,
- kratky popis pre zaciatocnika,
- detailny popis pre pokrocileho,
- najcastejsie chyby pri cviku.

#### Fitko

Fitko predstavuje miesto, kde pouzivatel pravidelne cvici alebo ktore si chce ulozit ako oblubene.

Zakladne atributy:

- nazov fitka,
- adresa,
- mesto,
- GPS poloha,
- otvaracie hodiny,
- dostupne vybavenie,
- hodnotenie,
- poznamka pouzivatela.

#### Treningovy plan

Treningovy plan obsahuje pripraveny rozpis treningov.

Zakladne atributy:

- nazov planu,
- ciel planu,
- uroven narocnosti,
- pocet treningov za tyzden,
- dlzka trvania,
- zoznam treningovych dni,
- autor planu.

#### Treningovy den

Treningovy den reprezentuje jeden den v treningovom plane.

Zakladne atributy:

- nazov treningu,
- zameranie,
- zoznam cvikov,
- odporucane serie a opakovania,
- odporucane prestavky.

#### Odcviceny trening

Odcviceny trening je realny zaznam treningu, ktory pouzivatel absolvoval.

Zakladne atributy:

- datum,
- cas zaciatku,
- cas ukoncenia,
- zoznam odcvicenych cvikov,
- poznamka,
- subjektivna narocnost.

#### Seria

Seria popisuje konkretny vykon v jednom cviku.

Zakladne atributy:

- pocet opakovani,
- pouzita vaha,
- dlzka prestavky,
- pocitova narocnost,
- poznamka.

#### Progres

Progres vyjadruje zmenu vykonnosti alebo telesnych parametrov v case.

Moze obsahovat:

- osobne rekordy,
- vyvoj vah pri cvikoch,
- telesnu hmotnost,
- telesne miery,
- fotografie progresu,
- pocet treningov,
- pravidelnost cvicenia.

#### Produkt

Produkt predstavuje znamu potravinu alebo snack dostupny v beznych supermarketoch.

Priklady produktov:

- proteinova tycinka,
- sladkost pred treningom,
- jogurt,
- napoj,
- hotove jedlo,
- pecivo,
- mliecny produkt.

Zakladne atributy:

- nazov produktu,
- znacka,
- kategoria,
- energia,
- bielkoviny,
- sacharidy,
- tuky,
- cukry,
- vlaknina,
- zlozenie,
- alergeny,
- odporucane pouzitie,
- vhodnost pred treningom alebo po treningu.

#### Jedlo

Jedlo predstavuje rucne zadany alebo fotografiou rozpoznany pokrm.

Zakladne atributy:

- nazov alebo odhad nazvu jedla,
- fotografia,
- odhad porcie,
- odhad kalorii,
- odhad makrozivin,
- benefity,
- negativa,
- odporucanie pre pouzivatela,
- miera istoty analyzy.

#### AI analyza jedla

AI analyza jedla vyhodnocuje fotografiu jedla alebo vybrany produkt a poskytuje pouzivatelovi jednoduche vysvetlenie.

Analyza moze obsahovat:

- odhad typu jedla,
- odhad zlozenia,
- hlavne benefity,
- mozne negativa,
- vhodnost pred treningom,
- vhodnost po treningu,
- odporucanie alternativy,
- upozornenie, ze ide iba o orientacny odhad.

#### Komunitny prispevok

Komunitny prispevok sluzi na zdielanie progresu, treningu alebo motivacie.

Zakladne atributy:

- autor,
- text,
- fotografia,
- datum pridania,
- pocet paci sa mi,
- komentare,
- stav nahlasenia.

#### Nahlasenie

Nahlasenie sluzi na upozornenie administratora na nevhodny obsah alebo problem.

Zakladne atributy:

- nahlasujuci pouzivatel,
- nahlaseny obsah,
- dovod,
- datum,
- stav riesenia.

## 8. Vztahy medzi entitami

- Pouzivatel ma jeden profil.
- Pouzivatel moze mat viac fitness cielov.
- Pouzivatel moze mat viac treningovych planov.
- Treningovy plan obsahuje viac treningovych dni.
- Treningovy den obsahuje viac cvikov.
- Odcviceny trening patri jednemu pouzivatelovi.
- Odcviceny trening obsahuje viac odcvicenych cvikov.
- Cvik moze byt pouzity vo viacerych treningovych planoch.
- Cvik v odcvicenom treningu obsahuje viac serii.
- Progres sa vytvara zo zaznamov treningov, merani a osobnych rekordov.
- Pouzivatel moze sledovat inych pouzivatelov.
- Pouzivatel moze vytvarat komunitne prispevky.
- Pouzivatel moze mat oznacene jedno alebo viac navstevovanych fitiek.
- Pouzivatel moze pridavat fotografie jedla.
- Jedlo moze mat jednu alebo viac AI analyz.
- Produkt patri do produktovej databazy.
- Produkt moze byt odporucany podla ciela pouzivatela a casu treningu.
- Cvik moze mat viac urovni vysvetlenia a tutorial animaciu.
- Administrator moze spravovat pouzivatelov, cviky, prispevky a nahlasenia.

## 9. Scenare pouzitia

### Scenar 1: Registracia pouzivatela

**Aktor:** GymRat

**Ciel:** Vytvorit si pouzivatelsky ucet a zacat pouzivat aplikaciu.

**Zakladny priebeh:**

1. Pouzivatel otvori aplikaciu.
2. Zvoli moznost registracie.
3. Zada e-mail, heslo a zakladne udaje.
4. Vyplni informacie o svojej urovni skusenosti.
5. Vyberie si hlavny fitness ciel.
6. Aplikacia vytvori profil pouzivatela.
7. Pouzivatel sa dostane na hlavnu obrazovku aplikacie.

**Vysledok:** Pouzivatel ma vytvoreny ucet a moze zacat pracovat s aplikaciou.

### Scenar 2: Vytvorenie treningoveho planu

**Aktor:** GymRat

**Ciel:** Vytvorit si treningovy plan podla svojho ciela.

**Zakladny priebeh:**

1. Pouzivatel prejde do sekcie treningovych planov.
2. Zvoli moznost vytvorit novy plan.
3. Vyberie ciel, uroven pokrocilosti a pocet treningov za tyzden.
4. Aplikacia ponukne odporucany plan alebo prazdnu sablonu.
5. Pouzivatel upravi cviky, serie a opakovania.
6. Plan ulozi.

**Vysledok:** Pouzivatel ma vlastny treningovy plan pripraveny na pouzivanie.

### Scenar 3: Zaznamenanie odcviceneho treningu

**Aktor:** GymRat

**Ciel:** Zapisat vykon z konkretneho treningu.

**Zakladny priebeh:**

1. Pouzivatel otvori aktualny trening.
2. Pri kazdom cviku zada pocet serii, opakovani a pouzitu vahu.
3. Podla potreby doplni poznamku.
4. Po skonceni trening ulozi.
5. Aplikacia aktualizuje historiu a statistiky.

**Vysledok:** Trening je ulozeny a pouzivatel vie sledovat svoj progres.

### Scenar 4: Sledovanie progresu

**Aktor:** GymRat

**Ciel:** Zistit, ako sa pouzivatel zlepsuje.

**Zakladny priebeh:**

1. Pouzivatel otvori sekciu progresu.
2. Vyberie si typ statistiky.
3. Aplikacia zobrazi grafy a prehlady.
4. Pouzivatel porovna vykony za rozne obdobia.
5. Pouzivatel moze pridat aktualnu hmotnost, miery alebo fotografiu.

**Vysledok:** Pouzivatel vidi objektivny vyvoj svojich vysledkov.

### Scenar 5: Podpora zaciatocnika

**Aktor:** Zacinajuci GymRat

**Ciel:** Ziskat jednoduchy plan a zakladne instrukcie.

**Zakladny priebeh:**

1. Pouzivatel pri registracii oznaci, ze je zaciatocnik.
2. Aplikacia mu odporuci jednoduchy zaciatocnicky trening.
3. Pouzivatel si zobrazi vysvetlenia cvikov.
4. Aplikacia mu ponukne odporucany pocet treningov za tyzden.
5. Pouzivatel postupne zapisuje treningy a sleduje zlepsenie.

**Vysledok:** Zaciatocnik ma jasny system a nemusi si vsetko nastavovat sam.

### Scenar 6: Zdielanie progresu v komunite

**Aktor:** GymRat

**Ciel:** Zdielat svoj progres s ostatnymi pouzivatelmi.

**Zakladny priebeh:**

1. Pouzivatel otvori komunitnu sekciu.
2. Vytvori novy prispevok.
3. Prida text, fotografiu alebo vysledok treningu.
4. Prispevok zverejni.
5. Ostatni pouzivatelia mozu reagovat alebo komentovat.

**Vysledok:** Pouzivatel ziska motivaciu a spatnu vazbu od komunity.

### Scenar 7: Sprava obsahu administratorom

**Aktor:** Administrator portalu

**Ciel:** Spravovat obsah a riesit problemy v aplikacii.

**Zakladny priebeh:**

1. Administrator sa prihlasi do administracneho rozhrania.
2. Zobrazi si zoznam nahlaseni.
3. Skontroluje nahlaseny obsah alebo pouzivatela.
4. Rozhodne o dalsom postupe.
5. Podla potreby odstrani obsah, zablokuje ucet alebo oznaci nahlasenie ako vyriesene.

**Vysledok:** Aplikacia zostava bezpecna a obsahovo kvalitna.

### Scenar 8: Oznacenie navstevovaneho fitka

**Aktor:** GymRat

**Ciel:** Ulozit si fitko alebo viac fitiek, ktore pouzivatel pravidelne navstevuje.

**Zakladny priebeh:**

1. Pouzivatel otvori sekciu fitiek.
2. Vyhlada fitko podla nazvu, mesta alebo polohy.
3. Zobrazi si detail fitka.
4. Oznaci fitko ako navstevovane alebo oblubene.
5. Aplikacia ulozi fitko do profilu pouzivatela.

**Vysledok:** Pouzivatel ma vo svojom profile ulozene fitka, kde cvici.

### Scenar 9: AI analyza jedla z fotografie

**Aktor:** GymRat

**Ciel:** Ziskat orientacne vyhodnotenie jedla na zaklade fotografie.

**Zakladny priebeh:**

1. Pouzivatel otvori sekciu jedla.
2. Odfoti alebo nahra fotografiu jedla.
3. Aplikacia posle fotografiu na AI analyzu.
4. AI odhadne typ jedla, porciu a zakladne zlozenie.
5. Aplikacia zobrazi benefity, negativa a odporucanie.
6. Pouzivatel moze analyzu ulozit do historie.

**Vysledok:** Pouzivatel ziska rychly prehlad o tom, ci je jedlo vhodne k jeho cielu alebo treningu.

**Poznamka:** Vysledok AI analyzy je iba orientacny a nema nahradzat odborne nutricne poradenstvo.

### Scenar 10: Vyhladanie produktu zo supermarketu

**Aktor:** GymRat

**Ciel:** Zistit, ci je konkretny produkt vhodny pred treningom alebo po treningu.

**Zakladny priebeh:**

1. Pouzivatel otvori produktovu databazu.
2. Zada nazov produktu alebo naskenuje ciarovy kod.
3. Aplikacia zobrazi nutricne hodnoty produktu.
4. Pouzivatel vidi vyhody, nevyhody a odporucane pouzitie.
5. Aplikacia moze ponuknut vhodnejsiu alternativu.

**Vysledok:** Pouzivatel sa vie rychlejsie rozhodnut, ci si produkt dat pred treningom, po treningu alebo iba prilezitostne.

### Scenar 11: Tutorial cviku s nastavitelnou urovnou opisu

**Aktor:** Zacinajuci alebo pokrocily GymRat

**Ciel:** Pochopit spravnu techniku cviku podla vlastnej urovne skusenosti.

**Zakladny priebeh:**

1. Pouzivatel otvori detail cviku.
2. Aplikacia zobrazi animaciu alebo kratke video cviku.
3. Pouzivatel si zvoli uroven vysvetlenia.
4. Zaciatocnik vidi jednoduchy opis, hlavne kroky a najcastejsie chyby.
5. Pokrocily pouzivatel vidi detailnejsie technicke odporucania.
6. Pouzivatel si moze cvik pridat do treningoveho planu.

**Vysledok:** Pouzivatel lepsie pochopi techniku cviku a znizi riziko nespravneho prevedenia.

## 10. Funkcionality aplikacie

### Zakladne funkcionality

- registracia a prihlasenie,
- vytvorenie pouzivatelskeho profilu,
- nastavenie fitness ciela,
- databaza cvikov,
- vytvorenie treningoveho planu,
- zapisovanie treningov,
- historia treningov,
- sledovanie progresu,
- zakladne grafy a statistiky,
- ulozenie navstevovaneho fitka,
- zakladne tutorialy cvikov.

### Pokrocile funkcionality

- komunitne prispevky,
- sledovanie inych pouzivatelov,
- komentare a reakcie,
- fotografie progresu,
- osobne rekordy,
- treningove vyzvy,
- upozornenia a pripomienky,
- odporucania cvikov,
- export dat,
- nastavitelna uroven vysvetlenia cvikov,
- animacie alebo videa k cvikom,
- produktova databaza supermarketovych produktov,
- odporucanie vhodnosti produktu pred alebo po treningu.

### Produktova databaza

Produktova databaza by mala obsahovat bezne potraviny a produkty, s ktorymi sa pouzivatel stretne v supermarketoch alebo potravinach.

Priklady pouzitia:

- pouzivatel chce nieco sladke pred treningom,
- pouzivatel porovnava dve proteinove tycinky,
- pouzivatel chce zistit, ci je produkt vhodny pri chudnuti,
- pouzivatel hlada rychly zdroj energie pred treningom,
- pouzivatel chce vediet, ake negativa ma casto konzumovana sladkost.

Pri produkte by aplikacia nemala zobrazovat iba kaloricke hodnoty. Mala by ich prelozit do zrozumitelneho jazyka:

- co je na produkte vyhodne,
- co je na produkte problematicke,
- kedy dava produkt zmysel,
- kedy je lepsie zvolit inu alternativu,
- ci je produkt vhodnejsi pred treningom, po treningu alebo skor ako obcasna sladkost.

### Buduce rozsirenia

- rola trenera,
- platene treningove plany,
- AI odporucanie treningu,
- AI analyza jedla z fotografie,
- skenovanie ciarovych kodov produktov,
- odporucanie alternativnych produktov,
- kaloricky dennik,
- jedalnicek,
- prepojenie s Apple Health,
- prepojenie s Google Fit,
- integracia s fitness hodinkami,
- rebricky a sutaze.

## 11. MVP verzia

MVP je prva jednoduchsia verzia aplikacie, ktora obsahuje iba najdolezitejsie funkcie.

Navrhovane MVP:

- registracia a prihlasenie,
- profil pouzivatela,
- vyber fitness ciela,
- databaza cvikov,
- zakladne textove alebo obrazkove vysvetlenie cvikov,
- vytvorenie jednoducheho treningoveho planu,
- zapisovanie treningu,
- historia treningov,
- zakladny prehlad progresu,
- oznacenie navstevovaneho fitka,
- jednoducha administracia cvikov.

Do MVP by som nezaradoval komunitu, trenerov, platene plany, AI odporucania, AI analyzu jedla ani rozsiahlu produktovu databazu. Tieto casti mozu prist az v dalsej faze, ked bude zaklad aplikacie funkcny.

### Mozna druha faza po MVP

- tutorial animacie k najdolezitejsim cvikom,
- nastavitelna uroven opisu cviku,
- produktova databaza beznych supermarketovych produktov,
- vyhladavanie produktu podla nazvu,
- jednoduche hodnotenie produktu pred alebo po treningu,
- komunitne funkcie.

### Mozna tretia faza

- AI analyza jedla z fotografie,
- skenovanie ciarovych kodov,
- odporucanie alternativnych produktov,
- personalizovane odporucania podla ciela,
- rola trenera,
- platene treningove plany.

## 12. Zakladne poziadavky

### Funkcne poziadavky

- System umozni pouzivatelovi registrovat sa a prihlasit sa.
- System umozni pouzivatelovi vytvorit a upravit profil.
- System umozni pouzivatelovi nastavit fitness ciel.
- System umozni pouzivatelovi zobrazit databazu cvikov.
- System umozni pouzivatelovi vytvorit treningovy plan.
- System umozni pouzivatelovi zapisat odcviceny trening.
- System umozni pouzivatelovi zobrazit historiu treningov.
- System umozni pouzivatelovi sledovat progres.
- System umozni pouzivatelovi oznacit navstevovane fitko.
- System umozni pouzivatelovi zobrazit tutorial alebo opis cviku.
- System umozni pouzivatelovi nastavit uroven detailu vysvetlenia cviku.
- System umozni pouzivatelovi vyhladat produkt v produktovej databaze.
- System umozni pouzivatelovi zobrazit benefity a negativa produktu.
- System umozni pouzivatelovi nahrat fotografiu jedla na AI analyzu.
- System umozni administratorovi spravovat cviky a pouzivatelov.
- System umozni administratorovi spravovat produktovu databazu.

### Nefunkcne poziadavky

- Aplikacia musi byt jednoducha na pouzivanie.
- Aplikacia musi fungovat na Android aj iOS.
- Data pouzivatela musia byt chranene.
- Aplikacia musi byt responzivna a rychla.
- Pouzivatelske rozhranie musi byt prehladne.
- System musi byt rozsiritelny o dalsie funkcionality.
- Aplikacia by mala vediet pracovat aj s nestabilnym internetom aspon pri zapisovani treningu.
- AI analyzy musia byt oznacene ako orientacne odporucania.
- Fotografie jedla a progresu musia byt spracovane s ohladom na sukromie pouzivatela.
- Produktova databaza musi byt navrhnuta tak, aby sa dala priebezne aktualizovat.

## 13. Rizika projektu

- Prilis vela funkcionalit v prvej verzii.
- Slaba motivacia pouzivatelov pravidelne zapisovat treningy.
- Narocnost spravneho navrhu treningovych planov.
- Potreba kvalitnej databazy cvikov.
- Ochrana osobnych a zdravotnych udajov.
- Komplexnost komunitnych funkcii a moderovania obsahu.
- Nepresnost AI analyzy jedla z fotografie.
- Neaktualne nutricne hodnoty v produktovej databaze.
- Narocnost ziskavania a udrziavania dat o produktoch zo supermarketov.
- Vyssie naklady na AI spracovanie fotografii.
- Riziko, ze pouzivatel bude brat AI odporucania ako lekarske alebo nutricne odporucanie.
- Narocnost tvorby kvalitnych animacii pre cviky.

## 14. Odporucany dalsi postup

1. Presne definovat MVP.
2. Navrhnut obrazovky aplikacie.
3. Vytvorit jednoduchy datovy model.
4. Rozhodnut technologicky stack.
5. Pripravit wireframy hlavnych obrazoviek.
6. Implementovat registraciu, profil a treningovy dennik.
7. Pripravit zakladnu databazu cvikov a opisov.
8. Navrhnut sposob evidencie fitiek.
9. Otestovat aplikaciu na malej skupine pouzivatelov.
10. Na zaklade spatnej vazby pridavat dalsie funkcie.
11. Az po overeni zakladnej aplikacie riesit AI analyzu jedla a produktovu databazu.
