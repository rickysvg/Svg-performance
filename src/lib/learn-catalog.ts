/**
 * Curated Learn technique library.
 * YouTube references from reputable coaches — not SVG-produced film.
 */

import { isYoutubeFormUrl } from "@/lib/form-videos";

export type LearnCatalogEntry = {
  slug: string;
  title: string;
  youtubeTitle: string;
  channel: string;
  url: string;
  pending: boolean;
  skillLevel: "beginner" | "intermediate" | "advanced";
  topic: "mma" | "muay-thai" | "boxing" | "wrestling" | "jiu-jitsu" | "cagework";
  summary: string;
  technicalDescription: string;
  keyDetails: string;
  drills: string;
  notes: string;
  equipment: string;
  needsSupervision: boolean;
  supervisedNote: string;
  status: "published" | "draft";
};

export const LEARN_CATALOG: LearnCatalogEntry[] = [
  {
    slug: "demo-jab-cue",
    title: "Boxing jab",
    youtubeTitle: "Beginner Boxing Tutorial: 6 Ways to Throw the Jab",
    channel: "eBoxing Academy",
    url: "https://www.youtube.com/watch?v=Z0a_XVJDV-g",
    pending: false,
    skillLevel: "beginner",
    topic: "boxing",
    summary: "Six ways to throw a jab without reaching with your chin. A measuring tool first, a punch second.",
    technicalDescription:
      "Drive off the rear foot so the jab is a full-body shot, not an arm flick. Fist finishes palm-down; the lead shoulder covers the chin. Snap the hand home — do not leave it hanging in their face. Common mistake: chasing range with the head. Keep the chin down and step the lead foot if you need the extra inch.",
    keyDetails:
      "Drive off the rear foot — the jab is a full-body punch.\nFist finishes palm-down; lead shoulder covers the chin.\nSnap the hand home. Do not leave it hanging.\nChin stays down; do not chase range with the face.",
    drills: "10 jabs, walk back, reset. Three easy sets on air or a bag.",
    notes: "Watch the shoulder cover and the snap-back. Pause and shadow one variation at a time.",
    equipment: "Open mat or bag",
    needsSupervision: true,
    supervisedNote: "Do this on the bag or with a coach. Do not spar this drill unsupervised.",
    status: "published",
  },
  {
    slug: "demo-boxing-fundamentals",
    title: "Boxing stance and first punches",
    youtubeTitle: "How to Box 101 | Complete Boxing Tutorial for Beginners",
    channel: "Tony Jeffries",
    url: "https://www.youtube.com/watch?v=D8DouKeOkfI",
    pending: false,
    skillLevel: "beginner",
    topic: "boxing",
    summary: "A full beginner map: stance, guard, jab, and cross. Long-form fundamentals from an Olympic medalist.",
    technicalDescription:
      "Feet staggered, weight on the balls, hands high, elbows in. The jab measures; the cross turns the rear heel and hip together. Do not lean the chest after the rear hand. Recover both hands to the face before you admire the combo. Common mistake: squared-up feet and a dropping rear hand.",
    keyDetails:
      "Staggered stance, chin tucked, eyes up.\nJab lands first; rear heel is already starting to turn for the cross.\nNon-punching hand stays on the face.\nReset the guard before the next idea.",
    drills: "Shadow 3 rounds of 1 minute: stance, jab, 1-2, step out.",
    notes: "Use this as the first boxing tape if someone has never stood in a stance.",
    equipment: "Open mat or bag",
    needsSupervision: true,
    supervisedNote: "Bag or pads. No unsupervised sparring.",
    status: "published",
  },
  {
    slug: "demo-boxing-one-two",
    title: "Jab–cross (1–2)",
    youtubeTitle: "How to Throw a 1 - 2 / Jab - Cross in Boxing",
    channel: "Tony Jeffries",
    url: "https://www.youtube.com/watch?v=vyTaKpylOcU",
    pending: false,
    skillLevel: "intermediate",
    topic: "boxing",
    summary: "How the 1-2 actually lands: jab that measures, then a cross that travels with the feet.",
    technicalDescription:
      "The jab is not a dummy punch — it sets range and hides the rear heel turn. Step and punch so the foot and fist land together. Do not push the bag after the cross; sit down on the punch and recover. Common mistake: a reaching jab that leaves the cross with nowhere honest to land.",
    keyDetails:
      "Jab lands and the rear heel is already starting to turn.\nCross hip and shoulder travel together — no arm-only right hand.\nChin stays behind the punching shoulder on both shots.\nRecover both hands to guard before you admire the combo.",
    drills: "6 easy 1-2s, step out, reset. Three rounds of one minute.",
    notes: "Watch the step-and-punch timing. If the jab is a reach, stop and fix that first.",
    equipment: "Bag or coach",
    needsSupervision: true,
    supervisedNote: "Bag or pads. No unsupervised sparring of this combo.",
    status: "published",
  },
  {
    slug: "demo-boxing-cross",
    title: "Rear cross",
    youtubeTitle: "Boxing Basics with Tony Jeffries: How to throw a cross punch | SANABUL",
    channel: "Tony Jeffries / Sanabul",
    url: "https://www.youtube.com/watch?v=4ps3eNnnGCM",
    pending: false,
    skillLevel: "intermediate",
    topic: "boxing",
    summary: "The rear cross as a weight-transfer punch. Exhale, rotate, and bring the hand home.",
    technicalDescription:
      "The punch leaves the face and returns to the face. Weight starts even, then shifts toward the lead leg as the rear heel turns — about 60/40, not a fall. Exhale on the shot; holding the breath kills speed. Common mistakes: dropping the lead hand, leaning back to load, and telegraphing the rear shoulder before the fist moves.",
    keyDetails:
      "Hand leaves the face and comes home to the face.\nRear heel and hip turn together.\nLead hand stays up.\nExhale. Do not lean back to load.",
    drills: "8 slow crosses on the bag. Check the lead hand after every shot.",
    notes: "Pause on the finish position. If the lead hand is down, the tape is not done.",
    equipment: "Bag or pads",
    needsSupervision: true,
    supervisedNote: "Bag or pads with a coach nearby.",
    status: "published",
  },
  {
    slug: "demo-boxing-slip",
    title: "Slip and counter",
    youtubeTitle: "Make ‘em Miss... Make ‘em Pay — The “SLIP & RIP”",
    channel: "fightTIPS",
    url: "https://www.youtube.com/watch?v=M0BVSpxzfXI",
    pending: false,
    skillLevel: "advanced",
    topic: "boxing",
    summary: "Slip the straight punch to the outside, keep the hands up, then step in and rip the counter.",
    technicalDescription:
      "Take the head off the center line by compressing the upper body, not by rolling the neck. Slip to the outside of their jab or cross so you are not walking into the other hand. Hands stay high — a low slip is a counterweight, not a defense. Common mistake: slipping inside a cross and eating the rear hand. Foot moves with the slip so you can rip an uppercut or hook on the way back in.",
    keyDetails:
      "Head off the center line; eyes stay on them.\nSlip outside the punch, not into the other hand.\nHands stay up while the torso bends.\nStep with the slip if you want the counter to land.",
    drills: "Partner or coach throws slow jabs. Slip outside, return a 1 or a lead hook. 2 minutes easy.",
    notes: "This is a counter lesson. Do not start slipping live punches without a coach.",
    equipment: "Open mat + partner",
    needsSupervision: true,
    supervisedNote: "Slow partner work or a coach on the pads. Not a living-room drill.",
    status: "published",
  },
  {
    slug: "demo-teep-cue",
    title: "Muay Thai teep",
    youtubeTitle: "Learn the Muay Thai Teep in 11 minutes! Step-by-Step Tutorial for ALL Levels!",
    channel: "Kingdom Martial Arts Academy",
    url: "https://www.youtube.com/watch?v=2nTKWDvZptk",
    pending: false,
    skillLevel: "beginner",
    topic: "muay-thai",
    summary: "The push kick as a measuring tool. Eleven minutes of chamber, push, and recover.",
    technicalDescription:
      "Chamber the knee before the foot travels. Push through the ball of the foot with the hips behind the kick — this is not a soccer punt. Hands stay up. Recover the foot to stance; do not hop into the pocket after you score. Common mistake: leaning the chest back so far you cannot punch after.",
    keyDetails:
      "Chamber the knee before the foot travels.\nPush through the ball of the foot, hips behind the kick.\nHands stay up while the kick goes.\nRecover the foot to stance — do not hop into the pocket.",
    drills: "8 easy teeps each side on air or a bag. Walk back, reset, two more sets.",
    notes: "Watch the chamber and the recover. The teep is a jab for the legs.",
    equipment: "Open mat or bag",
    needsSupervision: true,
    supervisedNote: "Bag or coach eyes. No live kicking of a partner without pads and a coach.",
    status: "published",
  },
  {
    slug: "demo-teep-fagan",
    title: "Teep details and balance",
    youtubeTitle: "How To Throw A Teep/Push Kick Tutorial - Basic Muay Thai Techniques",
    channel: "Sean “Muay Thai Guy” Fagan",
    url: "https://www.youtube.com/watch?v=7rlAj7pyvnE",
    pending: false,
    skillLevel: "intermediate",
    topic: "muay-thai",
    summary: "Hip extension, posted-foot pivot, and the opposite-hand guard that keep a teep honest.",
    technicalDescription:
      "Push up on the ball of the posted foot. Bring the knee high enough to clear their hands, then extend like you are kicking a door — hips on, not just the lower leg. Opposite hand stays on the face; the same-side arm can swing for leverage. Common mistake: a bent, hopping teep that never puts the hip through the target.",
    keyDetails:
      "Posted foot on the ball, slight pivot.\nKnee high, then hips through the target.\nOpposite hand stays on the face.\nReturn the foot on the same line it left.",
    drills: "6 teeps each side, freeze on the finish, check the guard. Two sets.",
    notes: "Use this after the Kingdom tape if the hip is still lazy.",
    equipment: "Bag or pads",
    needsSupervision: true,
    supervisedNote: "Bag or pads. No unsupervised partner teeps.",
    status: "published",
  },
  {
    slug: "demo-roundhouse",
    title: "Muay Thai roundhouse",
    youtubeTitle: "Muay Thai Kick LIKE A PRO! step-by-step guide",
    channel: "Paul Banasiak @MuayThaiTechnician",
    url: "https://www.youtube.com/watch?v=J9dK0uIEXIM",
    pending: false,
    skillLevel: "advanced",
    topic: "muay-thai",
    summary: "Entry angle, hip pull, and a kick that finishes past the center line — not a shin slap.",
    technicalDescription:
      "Step the lead foot 45° out so the ankle opens toward the bag. The rear arm swings back to pull the hip through; do not open the chest and throw a wheel. At impact the whole body is past the center line of the target. Common mistakes: kicking from a square stance, slapping with the foot, and leaving the hands low on the swing.",
    keyDetails:
      "45° lead step; ankle opens to the target.\nRear arm pulls the hip; chest stays closed.\nShin or instep, not a floppy foot.\nLand past the center line, then recover the guard.",
    drills: "5 slow roundhouses each side on a bag. Film the hip. Two sets.",
    notes: "This is a power-kick tape. Build it after the teep is clean.",
    equipment: "Heavy bag + coach",
    needsSupervision: true,
    supervisedNote: "Bag or pads with a coach. Do not throw this live without supervision.",
    status: "published",
  },
  {
    slug: "demo-hip-escape",
    title: "Hip escape (shrimp)",
    youtubeTitle: "10 Ways to Shrimp and Improve Hip Mobility on the Ground",
    channel: "Stephan Kesting",
    url: "https://www.youtube.com/watch?v=TQ4gJ7E6Xis",
    pending: false,
    skillLevel: "beginner",
    topic: "jiu-jitsu",
    summary: "The shrimp as a hip move, not a leg kick. Space first, then frames.",
    technicalDescription:
      "Plant one foot, lift the hips, then push the hips away — do not just bicycle the legs. Look over the far shoulder so the neck stays long. Frame before you shrimp so you are escaping into a shelf, not into their chest. Common mistake: a flat back and a neck that cranks toward the ceiling.",
    keyDetails:
      "Plant one foot, lift the hips, then push the hips away.\nLook over the far shoulder so the neck stays long.\nCreate a frame before you shrimp.\nStop if anything in the neck or shoulder feels wrong.",
    drills: "8 hip escapes each side, rest, repeat twice.",
    notes: "Slow is fine. This is class homework, not a live escape test.",
    equipment: "Open mat",
    needsSupervision: true,
    supervisedNote: "Practice with a partner or coach so someone can watch your neck and shoulders.",
    status: "published",
  },
  {
    slug: "demo-side-escape",
    title: "Side control escape to guard",
    youtubeTitle: "BJJ Beginners Tutorial - Side Control Escape to Closed Guard",
    channel: "Chess Club Jiu-Jitsu",
    url: "https://www.youtube.com/watch?v=GLqJOhLn_PQ",
    pending: false,
    skillLevel: "beginner",
    topic: "jiu-jitsu",
    summary: "Frames, a hip escape, then the knee in the hip pocket so you are not mounted on the way out.",
    technicalDescription:
      "Near-side frames first. Point a knee at them so the mount is a hurdle, not a free gift. Push the hips away to make the inch you need, then insert the knee into the hip pocket and connect elbow to knee. Common mistake: turning away and giving the back, or bridging with no frame so they ride the escape.",
    keyDetails:
      "Frames on the near side before you move.\nKnee pointed at them to delay the mount.\nHip escape to make space, then knee in the hip pocket.\nElbow connects to the knee — a V-frame against the hip.",
    drills: "Partner side-control starts. Frame, shrimp, insert the knee. 6 each side.",
    notes: "Watch the V-frame. If the elbow and knee never meet, the escape is a hope.",
    equipment: "Open mat + partner",
    needsSupervision: true,
    supervisedNote: "Partner or coach. Watch necks and shoulders.",
    status: "published",
  },
  {
    slug: "demo-shrimp-frames",
    title: "Shrimp under pressure",
    youtubeTitle: "Make Your Hip Escape (Shrimp) Unstoppable by Henry Akins",
    channel: "Henry Akins / Bernardo Faria BJJ Fanatics",
    url: "https://www.youtube.com/watch?v=4fyMiLey6rI",
    pending: false,
    skillLevel: "intermediate",
    topic: "jiu-jitsu",
    summary: "Under a decent top player the shrimp is frame-then-hip. Kicking the legs alone is not enough.",
    technicalDescription:
      "Frame first — elbow and forearm make the shelf. Bridge to create the first inch, then shrimp into that space. Turn the hips, not just the feet. Re-guard or knee-in as soon as the space appears. Common mistake: shrimping forever while they follow you around the mat.",
    keyDetails:
      "Frame first — elbow and forearm make the shelf.\nBridge to create the first inch, then shrimp into that space.\nTurn the hips, not just the feet.\nRe-guard or knee-in as soon as the space appears.",
    drills: "Partner side-control starts. Bridge, shrimp, recover guard. 6 each side.",
    notes: "Use this after the basic shrimp is familiar.",
    equipment: "Open mat + partner",
    needsSupervision: true,
    supervisedNote: "Partner or coach. Watch necks and shoulders.",
    status: "published",
  },
  {
    slug: "demo-closed-guard",
    title: "Closed guard principles",
    youtubeTitle: "BJJ Closed Guard Principles",
    channel: "Stephan Kesting",
    url: "https://www.youtube.com/watch?v=KKxD5kdOkk0",
    pending: false,
    skillLevel: "intermediate",
    topic: "jiu-jitsu",
    summary: "Closed guard is posture, grips, and hips — not a dead hug on your back.",
    technicalDescription:
      "Control posture with the legs and at least one honest upper-body grip (overhook, underhook, or head). Hips are rarely flat; they tilt to create an angle or start the path to the back. Foot on the hip, then turn, is still closed-guard work even if the ankles uncross. Common mistake: both shoulders and both hips glued to the mat while you wait for them to make a mistake.",
    keyDetails:
      "Break or control posture before you hunt a sweep.\nOverhook or underhook plus a head control beats empty hands.\nHips tilt; a flat back is a dead position.\nFoot on the hip is how you make the angle.",
    drills: "Closed guard, break posture, tilt the hips, recover. 4 minutes easy.",
    notes: "This is a principles tape. Pair it with one attack (collar choke) after.",
    equipment: "Open mat + partner",
    needsSupervision: true,
    supervisedNote: "Partner or coach. No cranking necks.",
    status: "published",
  },
  {
    slug: "demo-collar-choke",
    title: "Cross-collar choke from guard",
    youtubeTitle: "BJJ Beginners Tutorial - Cross Collar Choke from Closed Guard",
    channel: "Chess Club Jiu-Jitsu",
    url: "https://www.youtube.com/watch?v=1rV1AZeJdxQ",
    pending: false,
    skillLevel: "beginner",
    topic: "jiu-jitsu",
    summary: "A gi choke from closed guard: deep first grip, expose the far side, then curl.",
    technicalDescription:
      "The first hand must be deep — behind the neck, not on the collarbone. Use the legs to pinch and turn so the far side of the neck becomes visible. Second hand finds the crease you created, palm down, forearm under the neck. Curl the wrists. Common mistake: two shallow grips and a hope squeeze that only cranks the jaw.",
    keyDetails:
      "First grip is deep, behind the neck.\nLegs pinch and turn to expose the far side.\nSecond hand on the crease, forearm under the neck.\nCurl. Do not smash the jaw.",
    drills: "Partner in closed guard. Set the grips slowly. 5 attempts each, no finishing cranks.",
    notes: "Gi only. Tap early. This is not a no-gi lesson.",
    equipment: "Gi + partner",
    needsSupervision: true,
    supervisedNote: "Coach or experienced partner. Tap early. No cranking.",
    status: "published",
  },
  {
    slug: "demo-knee-slice",
    title: "Stopping the knee-slice pass",
    youtubeTitle: "How to Stop a Knee Slice Pass with Half Guard in BJJ",
    channel: "Chewjitsu",
    url: "https://www.youtube.com/watch?v=4vl5B2WMWfo",
    pending: false,
    skillLevel: "advanced",
    topic: "jiu-jitsu",
    summary: "When they stand in your half guard to knee-cut, pummel the legs shin-to-shin and kick the slice out.",
    technicalDescription:
      "As they stand, the bottom hook pummels under and the outside shin meets their shin. If the knee drives in, extend that leg and kick the slice offline, then return to the underhook. Same idea from a coyote / outside hook. Common mistake: holding only the gi collar while their knee already owns the center.",
    keyDetails:
      "Pummel the bottom hook as they stand.\nShin-to-shin on the outside leg.\nKick the slice out, then recover the underhook.\nDo not wait until the knee is already on your chest.",
    drills: "Partner starts in half guard and stands to knee-cut. Pummel, kick, recover. 6 reps.",
    notes: "Half-guard players: this is the standing-pass answer, not a sweep catalog.",
    equipment: "Open mat + partner",
    needsSupervision: true,
    supervisedNote: "Partner who understands half guard. Coach in the room if you are new to it.",
    status: "published",
  },
  {
    slug: "demo-double-leg",
    title: "Double-leg entry",
    youtubeTitle: "How to PROPERLY Finish the DOUBLE LEG! (Drill)",
    channel: "TeachMeGrappling Coach Brian",
    url: "https://www.youtube.com/watch?v=KhEdji8BuQ0",
    pending: false,
    skillLevel: "beginner",
    topic: "wrestling",
    summary: "Level change, cheek to the ribs, hands behind the knees. A drill cue — not a green light to blast a teammate.",
    technicalDescription:
      "Hips drop under the shoulders before the trail knee moves. Do not dive with a straight spine. Head stays up on the side of the body, not in the middle of the chest. Hands clasp behind the knees, then stand and turn the corner. Common mistake: shooting from the waist with the head down.",
    keyDetails:
      "Level change first — hips drop under your shoulders.\nTrail the back knee; do not dive with a straight spine.\nHead stays up on the side of the body, not the middle of the chest.\nHands clasp behind the knees, then stand and turn the corner.",
    drills: "5 slow technical stand-up entries each side. No live blasting.",
    notes: "This is a finish-and-posture drill. Keep it slow.",
    equipment: "Open mat",
    needsSupervision: true,
    supervisedNote: "Drill with a coach or a willing partner who knows you are going slow.",
    status: "published",
  },
  {
    slug: "demo-single-leg",
    title: "Single-leg finishes",
    youtubeTitle: "How to Finish a Single Leg Takedown | The School of Wrestling Technique",
    channel: "The School of Wrestling",
    url: "https://www.youtube.com/watch?v=eElwaCkzB6E",
    pending: false,
    skillLevel: "intermediate",
    topic: "wrestling",
    summary: "Once you have the single, stay on one knee, keep the head up, and pick a finish instead of stalling.",
    technicalDescription:
      "Do not sit on two knees. One knee up, circle, pressure forward. Head at the hip, hand above the knee. If they sprawl, run the feet, hide the ankles, or limp the arm through and rotate. Common mistake: hugging the ankle with a rounded back while they cross-face you to the mat.",
    keyDetails:
      "One knee up — do not flatten to two knees.\nHead up at the hip; control above the knee.\nCircle and pressure; pick a finish.\nIf they sprawl, run the feet or switch the grip — do not freeze.",
    drills: "Partner gives a held single. Finish high, finish to the mat, reset. 4 each.",
    notes: "Finish tape. Pair it with a clean entry on another day.",
    equipment: "Open mat + partner",
    needsSupervision: true,
    supervisedNote: "Willing partner or coach. No live blasting.",
    status: "published",
  },
  {
    slug: "demo-stance-base",
    title: "MMA stance and sprawl",
    youtubeTitle: "BJJ Beginners Tutorial - How to Sprawl",
    channel: "Chess Club Jiu-Jitsu",
    url: "https://www.youtube.com/watch?v=NmqVOswRpW4",
    pending: false,
    skillLevel: "beginner",
    topic: "mma",
    summary: "A beginner MMA stance checklist plus the first sprawl: hips down, legs back, chest over the shot.",
    technicalDescription:
      "Feet about shoulder width, hands up, chin down, weight on the balls of the feet. First defensive step on a shot: hips drop, legs whip back, chest covers their shoulders. Reset the stance after every sprawl. Common mistake: sprawling with a high hip and a head that looks at the ceiling.",
    keyDetails:
      "Weight on the balls of the feet, not the heels.\nHands frame the face — elbows in.\nFirst defensive step: hips down, legs back, chest over their shot.\nReset the stance after every sprawl.",
    drills: "Shadow 3 rounds of 1 minute: step in, step out, reset. Then 8 easy sprawls.",
    notes: "Class homework. Not a replacement for live coaching.",
    equipment: "Open mat",
    needsSupervision: false,
    supervisedNote: "",
    status: "published",
  },
  {
    slug: "demo-mma-sprawl",
    title: "Sprawl and head control",
    youtubeTitle: "Wrestling Moves - Sprawl by Ben Askren",
    channel: "Ben Askren / BJJ Fanatics",
    url: "https://www.youtube.com/watch?v=J0kcsLXX1Ms",
    pending: false,
    skillLevel: "intermediate",
    topic: "mma",
    summary: "Askren’s sprawl: hips and hands cover the head, then slide back. Hands on the hips do not stop the shot.",
    technicalDescription:
      "The sprawl is hips down and back with their head facing the mat. Cover the head — hips if you can, hands if you must. Hands above the knees beat hands on the hips; the hip grab does not stop their drive. Slide back toward a front headlock. Common mistake: standing tall after the first contact and giving the shot back.",
    keyDetails:
      "Hips down and back; their head faces the mat.\nCover the head with hips or hands.\nHands above the knees, not on the hips.\nSlide back. Do not stand up and gift the restart.",
    drills: "Partner shoots slow. Sprawl, cover the head, slide back. 8 reps.",
    notes: "MMA wrestlers: this is the defensive tape after the basic sprawl.",
    equipment: "Open mat + partner",
    needsSupervision: true,
    supervisedNote: "Slow partner shots. Coach in the room if you are new to sprawling.",
    status: "published",
  },
  {
    slug: "demo-cage-clinch",
    title: "Clinch on the fence",
    youtubeTitle: "MMA Training - Clinching against the Cage with Greg Jackson",
    channel: "Stuart Tomlinson / Greg Jackson",
    url: "https://www.youtube.com/watch?v=qMEXLKeMv_U",
    pending: false,
    skillLevel: "beginner",
    topic: "cagework",
    summary: "Posture on the fence before you try to lift. Shoulder pressure, inside position, then a level change.",
    technicalDescription:
      "Shoulder pressure first — do not reach around empty air. Win inside hand position before the lift. Level change under their hips; do not yank them down the fence. Turn them off the cage only when your feet are set. Common mistake: grabbing the waist with a broken posture and hoping the lift appears.",
    keyDetails:
      "Shoulder pressure first — do not reach around empty air.\nInside hand position before the lift.\nLevel change under their hips; do not pull them down the fence.\nTurn them off the cage only when your feet are set.",
    drills: "3 slow positional starts on the wall. Reset after each.",
    notes: "Cage or wall. This is posture, not a slam highlight.",
    equipment: "Cage or wall + coach",
    needsSupervision: true,
    supervisedNote: "Cage or wall work needs a coach in the room. Do not invent this at home.",
    status: "published",
  },
  {
    slug: "demo-cage-exit",
    title: "Fence exit and circle off",
    youtubeTitle: "",
    channel: "",
    url: "",
    pending: true,
    skillLevel: "intermediate",
    topic: "cagework",
    summary: "Getting stuck on the fence is a posture problem first. Video is pending coach review.",
    technicalDescription:
      "Create a frame, drop your level, and circle toward the open side. Do not spin blindly into the underhook. Hands on hips or biceps — not around the waist with a broken posture. Step the trail foot out before you walk the circle. Head stays off the fence. If you cannot circle, pummel for the underhook and wait for the coach cue.",
    keyDetails:
      "Hands on hips or biceps — not around the waist with a broken posture.\nStep the trail foot out before you try to walk the circle.\nHead stays off the fence; do not grind your own face into the mesh.\nIf you cannot circle, pummel for the underhook and wait for the coach cue.",
    drills: "3 wall starts. Frame, step, circle off. Reset.",
    notes: "Written notes stand until a public tape meets the quality bar.",
    equipment: "Cage or wall + coach",
    needsSupervision: true,
    supervisedNote: "Coach in the room. This is not a living-room drill.",
    status: "published",
  },
  {
    slug: "demo-cage-pressure",
    title: "Cage pressure and wrist control",
    youtubeTitle: "JON JONES: THE ULTIMATE TECHNIQUE BREAKDOWN",
    channel: "Thomas Kincaid MMA",
    url: "https://www.youtube.com/watch?v=t0XGMRDjxhA",
    pending: false,
    skillLevel: "advanced",
    topic: "cagework",
    summary: "A long Jones breakdown. Use the cage-tactics chapter: walk them to the fence, win a wrist, then attack.",
    technicalDescription:
      "Get them to the cage before you hunt the highlight. Wrist control is a hold, then a break into the next attack — not a dead grip. Do not abandon inside position to chase a spinning elbow. Common mistake: treating this tape as a move list. It is film study. Steal one cage habit (wrist, walk, or exit), then drill that with a coach.",
    keyDetails:
      "Walk them to the fence on purpose.\nWrist control is a hold, then an attack.\nDo not invent spinning elbows from the clip.\nSteal one habit. Drill that one.",
    drills: "Watch the cage chapter. Then 4 wall walks: underhook, wrist, reset. Coach eyes.",
    notes: "Film study, not SVG instruction. Skip the highlight hunting.",
    equipment: "Cage or wall + coach",
    needsSupervision: true,
    supervisedNote: "Study tape, then drill with a coach. Do not copy fight clips live.",
    status: "published",
  },
  {
    slug: "demo-draft-only",
    title: "Draft only (members should not see this)",
    youtubeTitle: "",
    channel: "",
    url: "",
    pending: true,
    skillLevel: "intermediate",
    topic: "wrestling",
    summary: "Unpublished draft used to test admin publishing.",
    technicalDescription: "If you can read this as a member, publishing is broken.",
    keyDetails: "Drafts stay hidden.",
    drills: "None.",
    notes: "If you can read this as a member, publishing is broken.",
    equipment: "None",
    needsSupervision: false,
    supervisedNote: "",
    status: "draft",
  },
];

export function catalogEntryForSlug(slug: string) {
  return LEARN_CATALOG.find((entry) => entry.slug === slug) ?? null;
}

export function publishedLearnCatalog() {
  return LEARN_CATALOG.filter((entry) => entry.status === "published");
}

export function lessonSeedFromCatalog(entry: LearnCatalogEntry) {
  return {
    slug: entry.slug,
    title: entry.title,
    summary: entry.summary,
    technicalDescription: entry.technicalDescription,
    skillLevel: entry.skillLevel,
    topic: entry.topic,
    coachName: entry.channel || "SVG coaching staff",
    equipment: entry.equipment,
    notes: entry.notes,
    drills: entry.drills,
    keyDetails: entry.keyDetails,
    youtubeUrl: entry.pending ? "" : entry.url,
    videoPending: entry.pending,
    needsSupervision: entry.needsSupervision,
    supervisedNote: entry.supervisedNote,
    status: entry.status,
    isDemo: true,
  };
}

export function learnCatalogIssues() {
  const issues: string[] = [];
  const slugs = new Set<string>();
  for (const entry of LEARN_CATALOG) {
    if (slugs.has(entry.slug)) issues.push(`duplicate slug ${entry.slug}`);
    slugs.add(entry.slug);
    if (!entry.summary.trim()) issues.push(`${entry.slug} missing summary`);
    if (!entry.technicalDescription.trim()) issues.push(`${entry.slug} missing technicalDescription`);
    if (entry.pending) {
      if (entry.url) issues.push(`${entry.slug} pending but has a url`);
      continue;
    }
    if (!isYoutubeFormUrl(entry.url)) issues.push(`${entry.slug} needs a watch URL, not Shorts`);
    if (!entry.channel.trim()) issues.push(`${entry.slug} missing channel`);
    if (!entry.youtubeTitle.trim()) issues.push(`${entry.slug} missing youtubeTitle`);
  }
  return issues;
}
