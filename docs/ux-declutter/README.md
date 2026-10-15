# Simplify the phone screens

The phone UI follows this list. Home keeps the photo tiles, and adds the member’s current body weight on the same screen. Week chips, plan generation, exercise swap/remove, and the coach thread are unchanged.

People open this app between sets and between classes. Each screen should have one main action, about five blocks on the first screen, and everything else one tap away. Headers should match. Badges, credit lines, and legal sentences should get out of the way. Tap targets should be large enough for sweaty hands.

## What we are leaving alone

Three other changes are already in flight. This list does not touch them:

- Exercise swap and remove stay as they are. Calendar keeps **Move**.
- Training-focus controls and the week chips stay as they are.
- The coach screen (topics, art picker, thread) stays as it is.

## How these shots were taken

Local app, DEMO programs seeded, Thursday 15 Oct 2026 (Block B — level changes and entries).

- Member **Alex** (`demo.member@svg.test`), intermediate, MMA, gym weights, Mon / Wed / Fri, coach Skye. Home, Train, Calendar, Progress, and Profile are this account on the free plan, before any trial banner.
- Fuel and Coach are the same account after the 7-day trial, because the free plan only shows an upgrade card on those two. The shots are the tools, which is what a member sees after one tap.
- Onboarding is a second account, **Jordan**, stopped on step 1 of the survey.
- One session was saved (bag day, hand-weight shadow at 40 lb) so the logger, the finished-workout screen, and a logged calendar day are real.
- Splash was skipped the way a return visit skips it. Motion was reduced so the finish screen sat still.

## Do these first

**P0. Home keeps the photo tiles and adds body weight.** Tiles stay. Fight camp, form check, the shop block, the deeper-profile prompt, and the locked quote upgrade are off this screen. Readiness sits behind a row. Today is one session and Start. Fuel is one calorie line. Body weight is a number you type and save.

**P0. The bottom bar does not repeat the tiles.** Train, Fuel, Learn, Coach, and Progress are tiles. The phone bar is Book, Shop, and Profile. The plus menu is gone. The round timer stays a tile.

**P0. Calendar is one week list.** The top half repeats Train: three session cards, mobility chips, and gear notes. Under that, the same days are listed again with Move. Keep the week chips and Move. Delete the second copy of the sessions and the paragraph about Watch sync and Gymdesk.

**P0. Progress opens on the streak, the last session, and body weight.** The first screen is a wall of badge tiles (lifting, cardio, martial arts, grind). Heart rate, photos, and weight are below it. Badges become one row.

**P0. The logger is a big number and a big rest button.** Between sets the member sees a paragraph (“not a weight lift…”), a notes chip, a Previous column, and small second fields. One seconds (or reps, or pounds) field, **Start rest**, and **Set done**. Notes, cues, and insert-exercise sit under More.

**P0. Learn opens on a seminar.** Search, an upgrade card, a category row, a level row, and a Seminars / clips switch all sit above the first film. Keep search, Seminars or Library, and one art row. Level and clips go under Filters. A lock on the card replaces the upgrade banner.

## Do these next

**P1. Train day keeps Start at the top and shortens the preamble.** The weight-access paragraph, “scaled for intermediate,” and the before/after mobility cards can live under Session details. The exercise names stay.

**P1. The Train page should not repeat Calendar.** Keep **Start today** and the day title. History, round timer, travel day, hip drills, and fight camp go under More. Leave the week chips alone.

**P1. Profile opens as a short list.** Training, Reminders, and Account. Coach faces, nutrition targets, the password form, and the academy-records paragraph open when that row is tapped.

**P1. The survey asks three things, then lets the person train.** Name, goal, and days. Equipment, limitations, diet, and allergies can wait until Profile. Step 2 (pick a coach) can stay, since the coach work owns that picker.

**P1. The finished-workout screen keeps Done on the glass.** On this phone, **Done** sits at about 1,295px down an 844px screen, under the crest, five sentences of difficulty, the stats, and the recap. Headline and Done stay put. Difficulty is five numbers. Stats are one line. Share and feedback stay, quieter.

**P1. Fuel asks for a name and calories.** The disclaimer, the “manual estimate” lecture, and the open food list come before the calorie box. Search can stay. Protein, carbs, fat, the saved-meal form, and meal-prep go under More.

**P1. Credit lines move to one Sources row on Profile.** Readiness names Joel Jamieson and Andy Galpin. The emphasis control names Lachlan James. Plyo names a landing credit. Those sentences do not help the next set.

**P1. Home stops recruiting on the first screen.** The optional deeper-profile link and the locked daily-quote upgrade leave Home. The quote line can stay for people who already have it.

**P1. Coach is one door.** The Coach photo tile stays. The “Ask a coach” block and the floating coach photo are gone. The coach screen itself is unchanged.

## Pictures

Before shots, 390×844, first screen of each page:

| Screen | Path |
| --- | --- |
| Home | `docs/ux-declutter/screens/before/home.png` |
| Train | `docs/ux-declutter/screens/before/train.png` |
| Train day | `docs/ux-declutter/screens/before/train-day.png` |
| Logger | `docs/ux-declutter/screens/before/train-logger.png` |
| Calendar | `docs/ux-declutter/screens/before/calendar.png` |
| Progress | `docs/ux-declutter/screens/before/progress.png` |
| Fuel | `docs/ux-declutter/screens/before/fuel.png` |
| Learn | `docs/ux-declutter/screens/before/learn.png` |
| Coach | `docs/ux-declutter/screens/before/coach.png` |
| Profile | `docs/ux-declutter/screens/before/profile.png` |
| Onboarding | `docs/ux-declutter/screens/before/onboarding.png` |
| Workout complete | `docs/ux-declutter/screens/before/workout-complete.png` |

After shots are the running app at 390×844, signed in as Alex, with the photo tiles still on Home. Side-by-side pairs are in `docs/ux-declutter/screens/compare/`. The HTML in `prototypes/after.html` was the earlier mockup and is not the built UI.

| Screen | After | Side by side |
| --- | --- | --- |
| Home | `docs/ux-declutter/screens/after/home.png` | `docs/ux-declutter/screens/compare/home-before-after.png` |
| Train | `docs/ux-declutter/screens/after/train.png` | `docs/ux-declutter/screens/compare/train-before-after.png` |
| Train day | `docs/ux-declutter/screens/after/train-day.png` | `docs/ux-declutter/screens/compare/train-day-before-after.png` |
| Logger | `docs/ux-declutter/screens/after/train-logger.png` | `docs/ux-declutter/screens/compare/train-logger-before-after.png` |
| Calendar | `docs/ux-declutter/screens/after/calendar.png` | `docs/ux-declutter/screens/compare/calendar-before-after.png` |
| Progress | `docs/ux-declutter/screens/after/progress.png` | `docs/ux-declutter/screens/compare/progress-before-after.png` |
| Fuel | `docs/ux-declutter/screens/after/fuel.png` | `docs/ux-declutter/screens/compare/fuel-before-after.png` |
| Learn | `docs/ux-declutter/screens/after/learn.png` | `docs/ux-declutter/screens/compare/learn-before-after.png` |
| Coach | `docs/ux-declutter/screens/after/coach.png` | `docs/ux-declutter/screens/compare/coach-before-after.png` |
| Profile | `docs/ux-declutter/screens/after/profile.png` | `docs/ux-declutter/screens/compare/profile-before-after.png` |
| Onboarding | `docs/ux-declutter/screens/after/onboarding.png` | `docs/ux-declutter/screens/compare/onboarding-before-after.png` |
| Workout complete | `docs/ux-declutter/screens/after/workout-complete.png` | `docs/ux-declutter/screens/compare/workout-complete-before-after.png` |

The element-by-element list is in [audit.md](audit.md).
