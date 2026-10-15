# Screen inventory

Each row is something a person can see on that screen. The choice is one of:

- **Keep** — it earns its place on the first screen.
- **Move behind tap** — collapse, More, or a sheet.
- **Combine** — merge with a neighbor so two blocks become one.
- **Remove** — it does not help this screen.

Reasons are one line. Shared chrome is listed once, then each screen.

The five densest screens are Home, Calendar, Progress, Learn, and the logger. Mockups for those are in `screens/after/` and `screens/compare/`.

## Shared chrome

On a 390px phone the top bar (Home, Train, Fuel, Learn, Coach) is hidden. It is in the code for desktop widths only. These pieces sit on Home, Train, Calendar, Progress, Fuel, Learn, and Profile. The day view, the logger, the finished-workout screen, and onboarding use a different header.

| Element | Choice | Why |
| --- | --- | --- |
| Logo mark | Keep | It is the brand and a way home. |
| Book | Move behind tap | Booking is rare. It belongs with the account, not on every screen. |
| Shop | Move behind tap | Merch is not the training job. |
| Plus button | Move behind tap | Start and Log food already live on Home. A global plus is a second door to the same actions. |
| Progress | Move behind tap | Useful, and not one of the five daily tabs. Reach it from Home or Train. |
| Profile | Move behind tap | Settings are not a daily tab. The name on Home can open them. |
| Floating coach photo, lower left | Remove | Coach becomes a tab. A second button covers the corner on every screen. The coach screen itself stays with the in-flight coach work. |
| Home / Train / Fuel / Learn / Coach | Keep | This is the phone bar. Show it at 390px. It is hidden there today. |

## Home

First screen is the lime welcome, a profile prompt, Fight camp, Form check, and the start of eight photos. The bag session that should be the action is below the readiness form. Full page is about 3,700px.

| Element | Choice | Why |
| --- | --- | --- |
| “Let’s go” | Combine | Fold it into the welcome line. Two kickers say hello. |
| “Welcome Alex” | Keep | The greeting is the brand moment. |
| “SVG Performance · Get stronger for training” | Combine | The goal can sit under the name. The product name is already on the logo. |
| “Optional 2-minute deeper profile. Add details” | Remove | A recruiting link on the first screen. Profile can ask later. |
| “Performance” heading | Remove | A section label for two upsell cards. |
| Fight camp card, PRO pill, “week-by-week camp…” | Move behind tap | Camp is a setup, not today’s action. |
| Form check card, PRO pill, “two clips a month…” | Move behind tap | Same. A row under More is enough. |
| Photo tile Train, “Today’s work” | Remove | The Train tab replaces it. |
| Photo tile Mobility, “Hips and holds” | Move behind tap | Mobility is the warm-up inside the session, not a home tile. |
| Photo tile Coach, “Ask SVG Coach” | Remove | The Coach tab replaces it. |
| Photo tile Learn, “Technique” | Remove | The Learn tab replaces it. |
| Photo tile Progress, “PRs + photos” | Move behind tap | Progress is a destination, not a home tile. |
| Photo tile Fuel, “Log food” | Remove | The Fuel tab, plus one calorie line on Home, replaces it. |
| Photo tile Calendar, “This week” | Remove | The week lives on Train. |
| Photo tile Timer, “Rounds” | Move behind tap | The round timer belongs on the training day. |
| Readiness title and the 1-to-5 explanation | Move behind tap | A form with three boxes, heart rate, and a save button is a second app on Home. |
| Sleep, Soreness, Energy fields | Move behind tap | Same form. |
| Resting heart rate field | Move behind tap | Heart rate already has its own screen. |
| “Save readiness” | Move behind tap | Goes with the form. |
| Credit line, Joel Jamieson and Andy Galpin | Remove | A source credit does not belong under a check-in. One Sources row on Profile is enough. |
| “Today’s plan” and View all | Combine | The session card is the plan. “View all” can be the “2 more today” row. |
| “Block B · Level changes and entries” | Move behind tap | The block name is useful on Train. On Home the session title is enough. |
| Round timer link | Move behind tap | It belongs on the session, not between the heading and the workout. |
| Week strip (Mon–Sun) | Keep | The other change owns these chips. Home can show the day, and the strip stays on Train. |
| Session A card, bag, 56 min, 5 exercises, Start | Keep | This is the primary action. |
| Session B card, posterior chain, Start | Combine | Second session of the same day. One “2 more today” row. |
| Session C card, tempo bike, Start | Combine | Same. |
| Daily quote teaser and the Performance+ upgrade | Remove | A locked quote plus an upgrade pitch. People who have the quote can see one line. |
| “Nutrition today” and Log food | Combine | One line: 0 / 2,200 cal, and Log food. |
| Four rings (calories, protein, carbs, fat) | Combine | Four dials for zeros. The calorie line is the glance. The rings live on Fuel. |
| “Check the new SVG & CO collection” and the shorts tile | Remove | Shop is not the training home. The Shop link in the account list is enough. |
| “Ask a coach” disclosure and the help form | Remove | Coach is a tab. A second human-request form on Home is a third coach door. |

## Train

The hub. **Start today** is on screen, which is right. Under it the page rebuilds the whole day, then a link list. Full page is about 2,800px. Week chips stay as they are.

| Element | Choice | Why |
| --- | --- | --- |
| “Training” | Keep | Page title. |
| “Today’s session. Not a custom fight camp.” | Remove | A disclaimer under the title. The DEMO badge already says this is the template. |
| Block B line | Keep | One line of context under the title. The focus control itself is the other change. |
| DEMO badge | Keep | Honest label. One badge, not a sentence. |
| Start today (lime) | Keep | Primary action. |
| Week strip | Keep | Owned by the week-chip work. Do not restyle it here. |
| “Where you can train” paragraph | Move behind tap | Two sentences plus a Gym / No gym switch. The switch can be a single line. |
| Gym and weights / No gym or weights | Move behind tap | Same control. It changes the list, so it stays reachable, not as a paragraph. |
| “Today · Thursday…” and “Bag + lift + bike” | Keep | The day title. |
| Session A card, thumbs, mobility chips, Preview | Combine | One row: name, minutes, Open. Thumbs and mobility chips wait inside the day. |
| “Before the clinch / After the clinch” mobility chips | Move behind tap | They repeat on the day page. |
| Session B card and its mobility chips | Combine | Same treatment as session A. |
| Session C card and its mobility chips | Combine | Same. |
| Session details (warm-up, zones, gear) | Move behind tap | Already a disclosure. Leave it closed, and do not also show the gear on this page. |
| Finish · Mobility / cooldown | Move behind tap | The cooldown is the end of the day page, not a third card on the hub. |
| More links: Calendar, history, round timer, testing, travel day, mobility, hip drills, fight camp | Move behind tap | Eight destinations under the workout. One More list. |
| Fighter conditioning disclosure and the $49 / $59 line | Move behind tap | A plan pitch at the bottom of training. Pricing can carry it. |

## Train day

The overview you open before Start. Start is near the top, then a weight essay, a mobility pair, session details, and five exercises with notes. Full page is about 2,000px.

| Element | Choice | Why |
| --- | --- | --- |
| Close (×) | Keep | Leaves the day. |
| Program title, “DEMO — Combat skills” | Combine | One short title. The DEMO badge covers the template label. |
| DEMO badge | Keep | One badge. |
| “First” kicker | Remove | A phase label. The title is the phase. |
| Day title, “Boxing into knees…” | Keep | The name of the work. |
| Weight-access paragraph | Move behind tap | Two sentences before the switch. The switch is the control. |
| Gym and weights / No gym or weights | Move behind tap | Same switch as the hub. Once per day is enough, inside details. |
| “Scaled for intermediate” | Remove | A second scale label. The prescription already shows the minutes and rounds. |
| Skill · est. 56 min · 5 exercises | Keep | The three facts that decide “do I have time.” |
| Start Now | Keep | Primary action. It also sticks to the bottom, so it appears twice. |
| Second Start Now, stuck to the bottom | Combine | One Start. The top button is enough when the list is short. The sticky bar can remain only after the member scrolls. |
| Before / after mobility chips (Kicker’s hips, Grappler’s neck) | Move behind tap | Warm-up and cooldown already have their own rows. |
| Session details disclosure | Keep | The right place for warm-up, bike zone, and gear. |
| Exercise row (thumb, name, prescription) × 5 | Keep | Shadowbox 1, shadowbox 2, punch into the clinch knee, bag rounds, easy cool-down. This is the list. |
| Coach credit under a move | Remove | A byline between the name and the set. Sources live on Profile. |
| Extra cue paragraph under the name | Move behind tap | The bag and clinch notes are long. They belong under the notes chip. |
| “Video pending coach review” when it shows | Keep | Honest, and only on moves that have no film. |
| Notes chip | Move behind tap | Fine as a chip. It should not sit on every row above the fold of the logger. On the day list, one notes affordance per row is enough if the cue paragraph is inside it. |
| “Finish” and Mobility / cooldown | Move behind tap | End of the session, after the list, not a rival to Start. |

## Logger

This is the between-sets screen. The header has Cancel, “exercise 1 of 5,” “set 1 of 1,” a running clock, Notes, and More. The first move then explains itself in a paragraph. The number fields are short. Full page is about 3,600px across five moves, plus Save at the end. The floating coach photo also forces the Save buttons to indent.

| Element | Choice | Why |
| --- | --- | --- |
| Cancel | Keep | The way out. |
| “Exercise 1 of 5” and “Set 1 of 1” | Combine | One line, “1 / 5”. The set count sits on the row. |
| Elapsed clock | Keep | Small, next to the count. |
| Notes | Combine | Notes and More are two text buttons. One More. |
| More | Keep | Insert exercise, notes, and cues live here. Swap and remove stay with the other change. |
| “Start rest 30s” | Keep | Make it the big lime button, the height of a thumb. |
| Exercise name | Keep | One line, large. |
| “Log the work time in seconds. Not a weight lift — no lbs.” | Remove | A paragraph under every timed move. The field label “Seconds” says the same thing. |
| Round cue (“Round 1, empty hands…”) | Move behind tap | Coaching copy. More holds it. |
| Notes chip, again | Combine | Same as the header Notes. One place. |
| “Rest between each set 30s” | Combine | The rest button already says 0:30. |
| Previous column | Move behind tap | A narrow column that is empty the first time. Last time can be ghost text inside the big field. |
| Seconds / reps / pounds fields | Keep | One big field for the number that matters. A second field (pounds on the hand-weight round) sits beside it, just as tall. |
| “+ Add new set” | Move behind tap | Rare between sets. More can hold it. |
| The next exercises, stacked in full | Move behind tap | One “Next” line. The rest of the list is a swipe or More, so the current set fills the glass. |
| Save | Keep | Sticky, full width, when the work is done. |
| Save draft | Move behind tap | Leaving the screen can keep the draft. A second text button under Save is easy to miss and easy to hit by mistake. |

## Calendar

The densest duplicate. A long explanation, week navigation, the week chips, a Move tutorial, then the same three session cards as Train, then mobility, then a missed-workout essay, then the week listed again. Full page is about 4,100px.

| Element | Choice | Why |
| --- | --- | --- |
| Back to Training | Remove | Train and Calendar are the same job. One of them should be the week. |
| “Calendar” | Keep | If this screen remains, the title is “This week.” |
| Paragraph: tap Move, hold to swap, not a live coach calendar, not Watch sync, not Gymdesk | Remove | Three instructions and three denials before the week. Move on the row is the instruction. |
| DEMO badge | Keep | One badge for the template. |
| Previous / This week / Next | Keep | Week paging. |
| Week strip | Keep | Owned by the week-chip work. |
| “Tap Move… hold a day to swap” line under the strip | Remove | Repeats the paragraph above. |
| “Today · Thursday · Logged · Block B…” | Combine | “Today · Thu” on the single today card. |
| “Bag + lift + bike” | Keep | The today summary. |
| “Logged this day…” subtitle, repeated on every card | Combine | One “logged” on Thursday’s row. The same sentence is copied onto the lift and the bike. |
| Three session cards, thumbs, Preview, mobility chips | Remove | They already live on the day you open. The week list is this screen. |
| Session details and Cool-down | Remove | Same cards as Train. |
| Black “Missed a workout?” panel | Remove | Move on Monday’s row already says the day can slide. A speech about it is a second block. |
| “This week” list (Mon–Sun, each workout, Move) | Keep | This is the screen. One row per day: name, Move or Done. |
| Weekly SVG report row on Sunday | Keep | One row. |

## Progress

The first screen is badges: lifting, a 135 lb lift, cardio, bike rounds, a one-minute hold, martial-arts rounds, a grind streak. The numbers a person came for are below that wall. Full page is about 5,000px. There is also a second records board further down.

| Element | Choice | Why |
| --- | --- | --- |
| “Progress” | Keep | Title. |
| “1 / N earned” pill | Combine | Becomes the Badges row, not a second heading. |
| Records / Streaks / Badges chips | Remove | Three destinations that repeat sections already on this page. |
| Badge grid (Lifting, Cardio, Martial arts, Grind) | Move behind tap | The whole first screen. One Badges row opens it. |
| Heart rate chip and Settings chip | Combine | Heart rate is one row. Settings is Profile. |
| Streaks heading and “Badges and board” link | Combine | The big streak number is the heading. |
| Streak hero | Keep | The one number on this screen. |
| Personal records heading and Charts link | Combine | Last session plus the one new load (40 lb hand weights) is enough. Charts open from that card. |
| Records list | Keep | One line, not a second board. |
| Resting heart rate tile | Move behind tap | Empty lecture (“import Apple Health…”). The Heart rate row opens it. |
| Last workout HR tile | Move behind tap | Same. |
| Sleep tile | Move behind tap | Empty, “coming soon.” |
| Caloric intake tile | Move behind tap | Fuel already shows today. |
| Body weight tile | Keep | The one body number, with Log. |
| Lean mass tile | Move behind tap | Empty. |
| Body fat tile | Move behind tap | Empty. |
| Progress photos heading, privacy paragraph, empty state, file picker, date, caption | Move behind tap | A whole uploader. One Photos row. |
| Log a body metric form (kind, value, unit, when, notes) | Move behind tap | The Log action on body weight opens a short sheet. |
| Second personal-records board (streak days, load PRs) | Remove | Repeats the streak and the record line above. |
| Workout history heading and the volume explanation | Combine | “Last session” already names the workout. |
| Sessions count and Last session cards | Combine | One last-session card. |
| Share card link | Move behind tap | Lives on the finished-workout screen. |
| Session volume chart, or the Performance charts paywall | Move behind tap | A chart or an upgrade card under history. Open it from the last-session card. |

## Fuel

Free plan, before the trial: a title and one upgrade card (“Food tracking is in Performance”). That card is already simple.

After the trial, the tool is a lecture, then a food list, then a long form. Full page is about 2,200px. The calorie field is below the food list.

| Element | Choice | Why |
| --- | --- | --- |
| “Nutrition” | Keep | Call the screen Fuel, to match the tab. |
| Disclaimer: manual entries, not medical advice, verify allergies | Move behind tap | True, and it pushes the form down. One line under More. |
| Preferences / allergies banner (when the profile has them) | Move behind tap | A reminder on the food log. The allergy note can sit on the save sheet. |
| “Today (manual estimates)” and the kcal / P / C / F line | Combine | One line at the top: today’s calories. |
| “Log a meal or snack” | Keep | The action. |
| “Source is always manual estimate…” | Remove | Repeats the disclaimer. |
| Search, “Chicken, rice, yogurt…” | Keep | The fast path. |
| DEMO food rows, shown before a search | Move behind tap | The list is open on an empty search, so the calorie field is below four foods. Show matches after a letter is typed. |
| DEMO badge on each food | Remove | The section is already the short demo list. A badge on every row is noise. |
| Name | Keep | Required. |
| Meal (breakfast / lunch / …) | Move behind tap | A default of “meal” is enough. |
| Servings and serving label | Move behind tap | Default 1 serving. Change it in More. |
| Calories | Keep | The number that matters. |
| Protein, carbs, fat | Move behind tap | More, next to calories when someone wants them. |
| When | Move behind tap | Default to now. |
| Notes | Move behind tap | Rare. |
| Save | Keep | Primary button. |
| “Save a meal you repeat” form (name, ingredients, four numbers) | Move behind tap | A second form under the first. |
| Meal-prep link | Move behind tap | A tool, not part of logging lunch. |
| “Your log” and the empty state | Keep | Under the form, the meals of the day. Quiet when empty. |

## Learn

Seminars from UFC champions. The first screen is an intro, two tabs, an upgrade card, search, a category row, a level row, and a Seminars / clips switch. Then a “Start here” rail, then a very long card list (the full page is about 26,000px because the catalog is long). The catalog can stay long. The chrome above it should not.

| Element | Choice | Why |
| --- | --- | --- |
| “Learn” | Keep | Title. |
| Intro sentence about UFC champions | Remove | The first card shows the coach. The sentence is a second title. |
| Seminars / Technique library | Keep | The two libraries. |
| Upgrade card, “Beginner seminars are free…” | Remove | A banner before search. A lock on a locked card says the same thing. |
| Search | Keep | Primary way in when you know the name. |
| Search button | Combine | Search as you type. A separate button is a second step. |
| Category: All, MMA, Boxing, Muay Thai, Wrestling, and the rest | Keep | One row. This is the filter people use. |
| Level: All levels, Beginner, Intermediate, Advanced | Move behind tap | A second chip row. Filters holds it. |
| Cage / wall work chip (when MMA is on) | Move behind tap | A special case. Filters holds it. |
| Seminars / Technique clips switch | Move behind tap | Clips live inside the seminar. A second switch repeats the library tab. |
| “Start here” rail | Combine | The same seminars repeat in the list under the rail. The list can lead with them. |
| Seminar card (thumb, coach, level, art, clip count) | Keep | The content. One card, then the next. The write-up waits inside the seminar. |

## Coach

Left as-is for the in-flight coach work. Inventory only, so a later pass does not “help” by adding more.

Free plan, before the trial: title plus one upgrade card.

After the trial, the first screen is already close to right. Three topic cards, then a clips link.

| Element | Choice | Why |
| --- | --- | --- |
| Coach photo | Keep | The face they picked. |
| “SVG Coach” and the name (Skye) | Keep | Header. |
| One-line vibe | Keep | One line of personality. |
| Style line (“Supportive style”) | Move behind tap | A second caption. Profile already stores the style. |
| AI disclaimer | Keep | Safety belongs here, in one sentence. |
| Martial art card | Keep | The choice that starts the thread. |
| Conditioning card | Keep | Same. |
| Mental card | Keep | Same. |
| “Timestamped training clips (Fighter Development+)” | Move behind tap | A plan feature under the topic list. Profile or More. |
| Art chips, once Martial art is open | Keep | Part of the coach flow the other change owns. |
| Thread, once a topic is open | Keep | The conversation. Do not add chrome around it. |

## Profile

A settings scroll of about 7,500px. The first screen is sound effects, the leaderboard opt-in, and a paragraph about hashed academy phones. The name is far below that.

| Element | Choice | Why |
| --- | --- | --- |
| “Profile” and the email line | Keep | Title and whose account. |
| Sound effects toggle and its explanation | Move behind tap | A preference. One row inside Account. |
| Monthly leaderboard opt-in and its explanation | Move behind tap | Off by default. One row. |
| Academy membership heading | Move behind tap | A status row: verified or not. |
| “Not verified for member pricing yet.” | Combine | That status row. |
| Confirm-email link, when it shows | Move behind tap | Inside the academy row. |
| Paragraph on hashed emails, phones, and Gymdesk | Remove | Legal detail. It does not help someone change their days. |
| “Your SVG Coach” and the four faces (Skye, Maya, Mateo, Cole) | Move behind tap | A picker. One row shows the current face. The picker itself stays, because the coach work owns it. |
| Coaching style, four radios with blurbs | Move behind tap | Same sheet as the face. |
| Display name | Keep | The one identity field on the first screen, inside Training. |
| Phone | Move behind tap | Only used to suggest an academy match. |
| Main goal | Keep | Training row. |
| “More about that goal” | Move behind tap | Optional. |
| Experience | Keep | Training row. |
| Primary martial art | Keep | Training row. |
| Striker / grappler emphasis, plus the Lachlan James credit | Move behind tap | A programming tweak. The credit leaves the form. |
| Equipment checkboxes (10) | Move behind tap | Open the Training sheet. |
| Days you can train | Keep | They build the week. Worth seeing. |
| Sessions per week | Move behind tap | The day chips already imply it. |
| Hours per week | Move behind tap | Optional. |
| Weight units sentence | Remove | The app is pounds. A field that cannot change is a caption. |
| Time zone | Move behind tap | Set once. |
| Training limitations, food preferences, allergies | Move behind tap | Optional notes, each with a warning sentence. |
| Deeper profile: weight, goal weight, session length, location, competition, tone, obstacles | Move behind tap | The skipped second survey. One row. |
| Nutrition targets (calories and three macros) | Move behind tap | Fuel’s More sheet. |
| “I train at SVG” checkbox and the adult-confirmed note | Move behind tap | The academy status row. The checkbox still must not grant a price. |
| Reminders (four toggles, hour, SMTP note) | Move behind tap | One Reminders row. |
| Change password (three fields) | Move behind tap | Account. |
| Send feedback | Move behind tap | Account. |
| Log out | Keep | Account, visible, hard to miss. |
| Download data and Delete account | Move behind tap | Account, with delete a step further in. |
| More links: fight camp, form check, progress, heart rate, paths, journal, weekly report, plan, book, pricing | Move behind tap | This list is the overflow for the whole app. Good place for it. It should not also be tiles on Home. |

## Onboarding

Step 1 of 2, “A few vital questions.” The first screen is a long intro, then name, goal, goal note, experience, and the start of the art picker. Below that: ten equipment boxes, seven days, sessions per week, a units caption, three optional text areas, and “Next: pick your coach.” Full page is about 2,250px. Step 2 is the coach faces, which the coach work owns.

| Element | Choice | Why |
| --- | --- | --- |
| Logo and log out | Keep | A way out before an account is finished. |
| “A few vital questions” | Keep | The title. |
| Intro paragraph (Learn level, trial, not a custom Elite plan) | Remove | Four sentences before the first field. |
| “Intake · step 1 of 2” and the progress bar | Keep | Shows there is an end. |
| “Required first. Next you pick your SVG Coach.” | Remove | The button says “Next: pick your coach.” |
| “What should we call you?” | Keep | First question. |
| Main goal | Keep | Second question. |
| “More about that goal” | Move behind tap | Optional, and it looks required because it is in the first card. |
| Experience level | Move behind tap | Profile can ask after the first session. A default of beginner is safe. |
| Primary martial art | Keep | It picks the week. Ask it with the goal. |
| Equipment, ten checkboxes | Move behind tap | Default to gym. Change it on the day, where the switch already exists. |
| Days you can train | Keep | The week is built from this. |
| Sessions per week | Remove | The day chips are the answer. |
| “Pounds (lb)…” | Remove | Nothing to choose. |
| Training limitations, diet, allergies, and both warning sentences | Move behind tap | Profile, later. |
| “Next: pick your coach” | Keep | The one action on the step. |
| Step 2, four faces and four styles | Keep | Leave the picker to the coach work. Do not add fields around it. |

## Workout complete

A black celebration. Crest, date, “You put in the work,” then five difficulty rows with full sentences. **Done** was measured at about 1,295px on an 844px-tall phone, under the stats, the badge, and the recap. The primary action is off the glass.

| Element | Choice | Why |
| --- | --- | --- |
| Crest image | Combine | A mark next to the headline, not a 280px hero that pushes Done away. |
| “Thu Oct 15 · Session 1” | Keep | One quiet line. |
| “You put in the work.” | Keep | The headline. |
| “How hard was that?” and five labeled rows | Combine | Five numbers, 1 to 5. The sentences (“Too easy” through “Extremely difficult”) can be the selected number’s caption. |
| “Optional. One tap, or hit Done.” | Remove | If Done is on screen, the hint is unnecessary. |
| Time, sets / rounds, volume, new PRs | Combine | One line under the headline. |
| Badge earned | Move behind tap | A toast or the Badges row. It should not add a card before Done. |
| Session recap | Move behind tap | The share card can carry the detail. |
| Done | Keep | On the first screen, full width, lime. |
| Share session | Move behind tap | Under Done, as a text button. Fine once Done is visible. |
| Send feedback | Move behind tap | Profile already has feedback. A quiet link is enough. |
