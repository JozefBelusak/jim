````md
# Codex prompt – refactor a rozšírenie existujúcej gym aplikácie

Mám rozpracovanú gym aplikáciu pre ľudí, ktorí pravidelne cvičia silový/hypertrofický tréning. Projekt už existuje, ale dlhšie som na ňom nerobil, kód je miestami messy a nechcem ho celý bezhlavo prepisovať od nuly.

Tvojou úlohou je najprv pochopiť existujúci projekt, potom ho postupne refaktorovať a rozšíriť na modernú workout tracking aplikáciu.

## 1. Najprv analyzuj existujúci projekt

Pred tým, než začneš implementovať nové features:

1. Prejdi celý repository.
2. Identifikuj:
   - použitý framework a knižnice,
   - routing,
   - state management,
   - databázovú vrstvu,
   - authentication,
   - hlavné komponenty,
   - existujúce modely/dátové štruktúry,
   - API/backend,
   - existujúce workout/exercise funkcionality,
   - duplicity,
   - dead code,
   - príliš veľké komponenty,
   - nekonzistentný naming,
   - problematické dependencies,
   - technický dlh.
3. Zisti, ktoré časti fungujú a ktoré sú nedokončené.
4. Neodstraňuj fungujúcu funkcionalitu len preto, že sa dá implementovať elegantnejšie.
5. Pred veľkým refactorom preferuj malé bezpečné zmeny.

Vytvor si interný prehľad architektúry projektu a podľa neho pokračuj.

Ak projekt už obsahuje feature podobnú tej, ktorú opisujem nižšie, rozšír ju namiesto vytvárania druhej paralelnej implementácie.

## 2. Cieľ aplikácie

Aplikácia má byť moderný workout tracker orientovaný hlavne na:

- hypertrofiu,
- silový tréning,
- pravidelných návštevníkov gymu,
- progressive overload,
- sledovanie tréningového objemu,
- históriu výkonov,
- jednoduché zapisovanie počas tréningu.

Hlavná filozofia UX:

**Používateľ má počas tréningu čo najmenej klikať.**

Najdôležitejší flow:

`Home → Start Workout → Exercise → Log Set → Rest Timer → Next Set → Finish Workout → Summary`

Logging jednej série musí byť extrémne rýchly.

## 3. Navrhovaná architektúra

Oddel logiku aplikácie približne na tieto domény:

- auth
- exercises
- workouts
- workout templates
- workout sessions
- sets
- progress
- personal records
- body metrics
- analytics
- settings

Nepchaj business logic priamo do UI komponentov.

Preferuj:

```text
UI components
↓
hooks/services/domain logic
↓
repository/API layer
↓
database/backend
````

Ak aktuálny projekt používa inú rozumnú architektúru, nemusíš ju meniť len kvôli tomuto návrhu.

## 4. Exercise database

Každý cvik by mal mať minimálne:

```ts
interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  category: string;
  movementType: string;
  instructions?: string;
  imageUrl?: string;
  videoUrl?: string;
  isCustom: boolean;
  createdBy?: string;
}
```

Príklady `equipment`:

* barbell
* dumbbell
* machine
* cable
* bodyweight
* smith_machine
* plate_loaded_machine
* other

Príklady muscle groups:

* chest
* back
* lats
* traps
* front_delts
* side_delts
* rear_delts
* biceps
* triceps
* forearms
* quads
* hamstrings
* glutes
* calves
* abs
* lower_back

Používateľ musí vedieť:

* vyhľadať cvik,
* filtrovať podľa muscle group,
* filtrovať podľa equipment,
* vytvoriť custom exercise,
* upraviť svoj custom exercise.

Nevytváraj custom cviky ako obyčajný string v workoute. Musia mať normálne ID, aby sa na nich dala sledovať história.

## 5. Workout templates

Používateľ musí vedieť vytvoriť template, napr.:

### Pull

1. Lat Pulldown
2. Seated Row
3. Reverse Pec Deck
4. EZ Bar Curl
5. Hammer Curl

Template model približne:

```ts
interface WorkoutTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  exercises: TemplateExercise[];
  createdAt: Date;
  updatedAt: Date;
}
```

Každý cvik v template:

```ts
interface TemplateExercise {
  id: string;
  exerciseId: string;
  order: number;
  targetSets?: number;
  repRangeMin?: number;
  repRangeMax?: number;
  targetRir?: number;
  restSeconds?: number;
  notes?: string;
}
```

Používateľ musí vedieť:

* vytvoriť template,
* editovať ho,
* premenovať ho,
* meniť poradie cvikov,
* odstrániť cvik,
* duplikovať template,
* spustiť workout z template.

## 6. Active workout / workout session

Toto je najdôležitejšia časť aplikácie.

Workout session:

```ts
interface WorkoutSession {
  id: string;
  userId: string;
  templateId?: string;
  name: string;
  startedAt: Date;
  finishedAt?: Date;
  duration?: number;
  notes?: string;
  exercises: WorkoutExercise[];
}
```

Session exercise:

```ts
interface WorkoutExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  notes?: string;
  sets: WorkoutSet[];
}
```

Set:

```ts
interface WorkoutSet {
  id: string;
  workoutExerciseId: string;

  type:
    | "warmup"
    | "normal"
    | "drop"
    | "failure";

  weight: number;
  reps: number;
  rir?: number;
  rpe?: number;
  completed: boolean;

  createdAt: Date;
}
```

Pri každom sete používateľ vidí:

* číslo setu,
* previous performance,
* weight,
* reps,
* RIR/RPE podľa nastavenia,
* checkbox/button na dokončenie.

Príklad:

| Set | Previous |   kg | Reps |
| --- | -------- | ---: | ---: |
| 1   | 45 × 10  | 47.5 |   10 |
| 2   | 45 × 9   | 47.5 |    9 |
| 3   | 45 × 8   | 47.5 |    8 |

Po označení setu ako `completed`:

1. uložiť set,
2. spustiť rest timer,
3. pripraviť ďalší set.

## 7. Previous workout data

Pri každom cviku v aktívnom workoute zobraz výkon z posledného relevantného workoutu.

Príklad:

```text
Last workout

50 kg × 10
50 kg × 9
45 kg × 11
```

Toto musí byť získané podľa:

* `userId`,
* `exerciseId`,
* poslednej completed workout session.

Ak neexistuje história, zobraz neutral state.

## 8. Rest timer

Po completed sete automaticky spusti rest timer.

Defaulty napr.:

* compound exercises: 180 s
* isolation exercises: 90 s

Timer musí byť nastaviteľný per exercise/template.

Požiadavky:

* pause,
* resume,
* +30 sec,
* -30 sec,
* skip,
* notification/vibration podľa možností platformy.

Timer nesmie zablokovať ostatné používanie aplikácie.

Používateľ musí vedieť medzičasom editovať ďalší set.

## 9. Finish workout

Pri ukončení workoutu zobraz summary.

Summary:

* workout name,
* duration,
* number of exercises,
* total sets,
* working sets,
* total volume,
* PRs,
* prípadne comparison with previous session.

Príklad:

```text
Pull Day Completed

Duration: 1h 07m
Exercises: 6
Working sets: 18
Volume: 8,420 kg

2 new PRs
```

## 10. Personal records

Automaticky deteguj PR.

Minimálne:

* highest weight,
* highest reps at given weight,
* highest estimated 1RM,
* highest set volume,
* highest session volume for exercise.

Estimated 1RM môže používať napr. Epley formula:

```text
1RM = weight × (1 + reps / 30)
```

PR logika musí byť oddelená od UI.

Ideálne:

```ts
calculatePersonalRecords(...)
```

alebo samostatný domain service.

Pri novom PR zobraz:

```text
New PR

Iso Bench Press
72.5 kg × 7
Estimated 1RM: 89.4 kg
```

## 11. Progressive overload

Implementuj základný systém progressive overload.

Template exercise môže mať:

```ts
repRangeMin
repRangeMax
targetSets
```

Príklad:

```text
3 × 8–12
```

Ak používateľ dokončí:

```text
50 × 12
50 × 12
50 × 12
```

appka môže pri ďalšom tréningu navrhnúť:

```text
Suggested weight: 52.5 kg
```

Návrh nesmie automaticky prepísať používateľovi váhu bez možnosti zmeny.

Vytvor business logic napr.:

```ts
getProgressionSuggestion()
```

Podporuj minimálne simple double progression.

Neskôr sa môže rozšíriť o:

* RIR,
* RPE,
* performance trend,
* fatigue.

## 12. Training volume

Počítaj minimálne:

```text
volume = weight × reps
```

Pre workout:

```text
totalVolume = sum(all completed working sets)
```

Pre muscle group počítaj hlavne hard/working sets.

Muscle analytics musia vedieť povedať napr.:

```text
This week

Chest       12 sets
Back        16 sets
Biceps       8 sets
Triceps      7 sets
Side Delts   9 sets
Quads       10 sets
```

Warm-up sets sa nemajú počítať do hypertrophy volume sets.

## 13. Muscle involvement

Exercise môže mať:

```ts
primaryMuscle
secondaryMuscles[]
```

Na začiatok môže platiť:

* primary muscle = 1 full set,
* secondary muscle = buď ignorovať alebo počítať oddelene.

Nevytváraj príliš komplikovaný fractional set systém, pokiaľ to nie je potrebné.

Architektúra však má umožniť jeho budúce pridanie.

## 14. Workout history

Vytvor history screen.

Používateľ vidí chronologický zoznam workoutov:

```text
August 14
Pull
1h 03m
18 sets

August 12
Push
58m
16 sets

August 10
Legs
1h 11m
15 sets
```

Po kliknutí sa zobrazí kompletný workout.

Musí byť možné:

* otvoriť workout,
* pozrieť všetky sety,
* editovať workout,
* delete workout,
* duplicate/repeat workout.

Pri delete používaj confirmation.

## 15. Calendar

Pridaj calendar view.

Workout dni budú označené.

Po kliknutí na deň:

* workout name,
* duration,
* exercises,
* volume.

Prípadne podpor:

* planned workout,
* completed workout,
* rest day.

Nerob zatiaľ komplikovaný scheduling engine.

## 16. Exercise progress

Každý exercise detail má mať progress page.

Zobraz:

* last workout,
* current best,
* estimated 1RM,
* training frequency,
* workout history.

Grafy:

1. maximum weight over time,
2. estimated 1RM over time,
3. volume over time.

Používateľ má vedieť zmeniť timeframe:

* 1 month,
* 3 months,
* 6 months,
* 1 year,
* all time.

## 17. Dashboard / Home

Home screen nemá byť preplnený.

Navrhujem:

### Today's / next workout

```text
Pull Day

6 exercises
18 target sets

Start workout
```

### Recent performance

```text
Last workout

Push
Yesterday
17 sets
7,840 kg
```

### Weekly stats

```text
Workouts: 4
Sets: 67
Volume: 31,420 kg
```

### Muscle activity

Jednoduchý muscle breakdown.

### Recent PR

```text
Iso Bench Press
70 kg × 8
2 days ago
```

## 18. Body metrics

Používateľ môže zapisovať:

```ts
interface BodyMetric {
  id: string;
  userId: string;
  date: Date;
  bodyWeight?: number;
  bodyFat?: number;
  waist?: number;
  chest?: number;
  armLeft?: number;
  armRight?: number;
  thighLeft?: number;
  thighRight?: number;
}
```

Minimum pre prvú implementáciu:

* body weight,
* date.

Dashboard/progress:

```text
81.2 kg
↓ 0.8 kg in last 30 days
```

## 19. Settings

Pridaj settings minimálne pre:

* kg / lb,
* RIR / RPE / disabled,
* default rest timer,
* theme,
* notifications,
* start-of-week,
* confirmation before deleting workout.

Ak aplikácia už settings má, integruj ich.

## 20. UX počas workoutu

Workout screen musí byť optimalizovaný pre mobil.

Dôležité:

* veľké klikateľné plochy,
* minimum modalov,
* minimum page reloadov,
* input váhy a reps dostupný okamžite,
* numeric keyboard na mobile,
* dokončenie setu jedným tapom,
* posledné hodnoty môžu byť predvyplnené,
* scroll position sa nemá po update resetovať.

Nepoužívaj komplikované animácie, ktoré spomaľujú logging.

## 21. Auto-fill

Keď začne nový workout, môže sa použiť previous workout na predvyplnenie:

```text
Last:
50 × 10

Input:
50 | 10
```

Používateľ potom iba upraví číslo, ak treba.

Toto výrazne zrýchľuje workout logging.

## 22. Offline / unreliable network

Ak je aplikácia web/mobile a architektúra to umožňuje, navrhni workout logging tak, aby strata internetu počas tréningu nespôsobila stratu setov.

Aspoň:

* optimistic UI,
* local temporary state,
* retry save.

Neimplementuj komplikovaný offline-first systém, ak by si kvôli tomu musel prerobiť celý projekt.

## 23. Data integrity

Dávaj pozor na:

* unfinished workouts,
* duplicated sets,
* accidental double submit,
* delete workout,
* workout bez setov,
* custom exercises,
* null bodyweight,
* 0 kg bodyweight exercises,
* bodyweight movements,
* unilateral exercises.

Nevaliduj zbytočne agresívne.

Napr. reps `0` alebo weight `0` môže mať v niektorých prípadoch význam počas editácie.

## 24. Bodyweight exercises

Model musí vedieť reprezentovať:

```text
Pull-up
Bodyweight
10 reps
```

a neskôr napr.:

```text
Bodyweight + 15 kg
8 reps
```

Preto zváž:

```ts
type WeightMode =
  | "external"
  | "bodyweight"
  | "bodyweight_plus";
```

Nevynucuj toto, ak existujúci model rieši problém lepšie.

## 25. Supersets

Podpor jednoduché grupovanie exercises.

Napr.:

```text
A1 Lateral Raise
A2 Triceps Pushdown
```

Môže existovať:

```ts
supersetGroupId?: string;
```

Nemusíš robiť zložitý superset engine.

Ide hlavne o UI grouping a workflow.

## 26. Set types

Vizualizačne rozlíš:

* W = warmup
* normal
* D = drop set
* F = failure

Napr.:

```text
W  20 kg × 12
W  30 kg × 8
1  40 kg × 10
2  40 kg × 9
D  30 kg × 12
```

## 27. Notes

Podpor exercise notes:

```text
Seat position 4
Use neutral grip
```

Workout notes:

```text
Low energy today
```

Ideálne si exercise note vie používateľ preniesť do budúceho workoutu.

## 28. Analytics architecture

Nevypočítavaj komplikované analytics priamo v React komponentoch alebo template view.

Používaj napr.:

```text
analytics/
  calculateVolume
  calculateWeeklySets
  calculateEstimated1RM
  calculatePRs
  calculateExerciseProgress
  calculateMuscleVolume
```

Tieto funkcie musia byť testovateľné.

## 29. Testing

Pridaj testy hlavne pre business logic.

Priority:

1. total volume,
2. estimated 1RM,
3. PR detection,
4. progressive overload suggestion,
5. weekly muscle set calculation,
6. previous workout lookup.

Netestuj zbytočne každý jednoduchý UI wrapper.

## 30. Refactor strategy

Projekt neprepisuj jedným veľkým commitom.

Postupuj iteratívne.

### Phase 1 – Cleanup

* analyzuj projekt,
* odstráň obvious dead code,
* oprav naming,
* rozdeľ extrémne veľké komponenty,
* centralizuj types,
* centralizuj API/database calls,
* oprav kritické bugs.

### Phase 2 – Core workout tracking

* exercise model,
* workout templates,
* workout session,
* sets,
* start workout,
* complete workout,
* history.

### Phase 3 – Workout UX

* previous performance,
* auto-fill,
* rest timer,
* notes,
* set types,
* supersets.

### Phase 4 – Progress

* PRs,
* volume,
* estimated 1RM,
* exercise history,
* graphs.

### Phase 5 – Advanced

* progressive overload suggestions,
* weekly muscle volume,
* body metrics,
* dashboard improvements.

Neskáč rovno na AI coaching.

Najprv musí byť perfektný workout logger.

## 31. Database migrations

Ak musíš zmeniť database schema:

* používaj migrations,
* nemaž existujúce používateľské dáta,
* neprerábaj ID bez dôvodu,
* zachovaj backward compatibility tam, kde je rozumná.

Pred schema change zisti, aké dáta projekt aktuálne používa.

## 32. Type safety

Ak projekt používa TypeScript:

* nepoužívaj `any`, pokiaľ to nie je nutné,
* vytvor explicitné domain types,
* API response types,
* nullable fields označ správne,
* používaj enums/unions pre stabilné hodnoty.

Napr.:

```ts
type SetType =
  | "warmup"
  | "normal"
  | "drop"
  | "failure";
```

## 33. Error handling

UX nesmie skončiť iba:

```text
Something went wrong
```

Pre workout logging:

* lokálne zachovať zadané dáta,
* zobraz retry,
* nezmazať používateľovi set pri API errore.

## 34. Performance

Dávaj pozor hlavne na active workout screen.

Nerob pri každom stlačení čísla:

* fetch celej workout history,
* recompute všetkých analytics,
* reload celej session.

Oddel:

* live workout state,
* historical analytics.

## 35. UI consistency

Použi existujúci design system projektu.

Ak neexistuje, vytvor malé množstvo reusable primitives:

* Button
* Input
* NumberInput
* Card
* Modal/Dialog
* Tabs
* Badge
* Sheet/Drawer

Nepíš 10 rôznych implementácií toho istého tlačidla.

## 36. Responsive design

Primárny use case je telefón počas tréningu.

Optimalizuj najprv približne:

```text
360–430 px width
```

Desktop môže mať širší layout.

Active workout nesmie vyžadovať horizontal scroll.

## 37. Future features – zatiaľ iba priprav architektúru

Neimplementuj ich hneď, ale nevytvor architektúru, ktorá ich znemožní:

* AI workout coach,
* automatic deload detection,
* fatigue/readiness,
* Apple Health,
* Health Connect,
* wearable integration,
* social profiles,
* challenges,
* workout sharing,
* trainer/client accounts,
* nutrition tracking.

## 38. Čomu sa vyhnúť

Nevytváraj z gym aplikácie generický fitness lifestyle produkt.

Priority sú:

1. workout logging,
2. progression,
3. history,
4. analytics,
5. planning.

Nepotrebujem zatiaľ:

* recepty,
* calorie counter,
* social feed,
* AI chatbot,
* meditation,
* step tracker.

## 39. Po každej väčšej zmene

Po implementácii každej väčšej feature:

1. skontroluj TypeScript/compiler errors,
2. spusť lint,
3. spusť tests,
4. skontroluj build,
5. oprav regresie.

Nevypínaj lint rules alebo TypeScript errors len preto, aby build prešiel.

## 40. Ako máš postupovať

Neimplementuj všetkých 40 bodov naraz.

Najprv:

1. analyzuj repository,
2. zhrň aktuálnu architektúru,
3. identifikuj najväčšie technické problémy,
4. identifikuj už existujúce gym features,
5. vytvor konkrétny implementačný plán podľa aktuálneho projektu.

Potom začni **Phase 1**.

Pri každom kroku preferuj:

* malé reviewable changes,
* zachovanie funkčnosti,
* reusable business logic,
* clean types,
* jednoduchý UX.

Ak narazíš na nejasnosť, najprv sa pokús rozhodnúť podľa existujúcej architektúry a conventions projektu namiesto vytvárania úplne nového patternu.

## Hlavná priorita

Najvyššia priorita celej aplikácie je:

> **Používateľ otvorí workout, zapisuje série extrémne rýchlo, vidí minulý výkon a okamžite vie, či sa oproti minulému tréningu zlepšuje.**

```
```
