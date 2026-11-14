import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LOGO_BADGE_SRC } from "@/components/Logo";
import { supportEmail } from "@/lib/support";
import styles from "./public-home.module.css";

/**
 * Signed-out homepage. Phone frames are stand-ins until final screen
 * captures land: home uses the app's own tile photos; the other frames
 * are brand chrome with no stats.
 */

const DAY_TILES = [
  { src: "/tiles/train.webp", label: "Train" },
  { src: "/tiles/bagwork.webp", label: "Bagwork" },
  { src: "/tiles/coach.webp", label: "Coach" },
  { src: "/tiles/progress.webp", label: "Progress" },
] as const;

function cn(...names: Array<string | false | undefined>) {
  return names.filter(Boolean).join(" ");
}

function Brand({ priority = false }: { priority?: boolean }) {
  return (
    <Link href="/" className={styles.brand}>
      <span className={styles.brandMark}>
        <Image
          src={LOGO_BADGE_SRC}
          alt=""
          fill
          priority={priority}
          sizes="36px"
          className={styles.logoImg}
        />
      </span>
      <span>
        SVG <b>Performance</b>
      </span>
    </Link>
  );
}

function PhoneFrame({
  label,
  small = false,
  children,
}: {
  label: string;
  small?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn(styles.phone, small && styles.phoneSm)} role="img" aria-label={label}>
      {children}
    </div>
  );
}

function ScreenBar() {
  return (
    <span className={styles.screenBar}>
      <b>SVG</b>
      <i />
    </span>
  );
}

function CoachScreen() {
  return (
    <div className={styles.screen} aria-hidden="true">
      <ScreenBar />
      <span className={styles.screenKicker}>Coach</span>
      <span className={styles.bubbles}>
        <span className={styles.bubble} />
        <span className={cn(styles.bubble, styles.bubbleOut)} />
        <span className={styles.bubble} />
      </span>
      <span className={styles.ask}>Ask</span>
    </div>
  );
}

function BagScreen() {
  return (
    <div className={styles.screen} aria-hidden="true">
      <ScreenBar />
      <div className={styles.ringWrap}>
        <div className={styles.ring}>
          <b>Focus</b>
          <strong>Jab</strong>
        </div>
      </div>
    </div>
  );
}

function PlanScreen() {
  return (
    <div className={styles.screen} aria-hidden="true">
      <ScreenBar />
      <span className={styles.screenKicker}>Week</span>
      <span className={styles.days}>
        <i>M</i>
        <i className={styles.on}>T</i>
        <i>W</i>
        <i>T</i>
        <i>F</i>
        <i>S</i>
        <i>S</i>
      </span>
      <span className={styles.block} />
      <span className={cn(styles.block, styles.blockShort)} />
    </div>
  );
}

function LoggerScreen() {
  return (
    <div className={styles.screen} aria-hidden="true">
      <ScreenBar />
      <span className={styles.screenKicker}>RIR</span>
      <span className={styles.block} />
      <span className={styles.block} />
      <span className={cn(styles.block, styles.blockShort)} />
    </div>
  );
}

function ProgressScreen() {
  return (
    <div className={styles.screen} aria-hidden="true">
      <ScreenBar />
      <span className={styles.metric}>Streak</span>
      <svg className={styles.chart} viewBox="0 0 120 48" preserveAspectRatio="none" aria-hidden="true">
        <polyline
          points="0,40 18,34 36,36 54,22 72,26 90,14 120,8"
          fill="none"
          stroke="#CBF805"
          strokeWidth="3"
        />
      </svg>
      <span className={styles.metric}>Weigh-in</span>
      <span className={styles.metric}>Sessions</span>
    </div>
  );
}

function DayScreen() {
  return (
    <div className={cn(styles.screen, styles.screenDay)} aria-hidden="true">
      {DAY_TILES.map((tile) => (
        <div key={tile.label} className={styles.dayTile}>
          <Image src={tile.src} alt="" fill sizes="160px" className={styles.logoImg} />
          <span className={styles.dayShade} />
          <span className={styles.dayLabel}>{tile.label}</span>
        </div>
      ))}
    </div>
  );
}

export function PublicHome({ deleted = false }: { deleted?: boolean }) {
  const email = supportEmail();

  return (
    <div className={styles.publicHome} data-public-home>
      <header className={styles.top}>
        <div className={styles.in}>
          <Brand priority />
          <nav className={styles.nav} aria-label="Primary">
            <Link className={styles.lnk} href="#how">
              How it works
            </Link>
            <Link className={styles.lnk} href="/waitlist">
              Waitlist
            </Link>
            <Link className={cn(styles.btn, styles.btnPrimary)} href="/login">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {deleted ? (
          <section className={styles.deleted} data-account-deleted>
            <div className={styles.in}>
              <p className={styles.kicker}>Account deleted</p>
              <p className={styles.deletedTitle}>Your account is gone</p>
              <p>
                We erased your SVG Performance data and signed you out. You can create a new
                preview account anytime.
              </p>
            </div>
          </section>
        ) : null}

        <section className={cn(styles.sec, styles.hero)}>
          <div className={styles.in}>
            <div className={styles.logo}>
              <Image
                src={LOGO_BADGE_SRC}
                alt="SVG Performance logo, lime ring on black"
                fill
                priority
                sizes="(max-width: 759px) 170px, 400px"
                className={styles.logoImg}
              />
            </div>
            <div>
              <span className={styles.kicker}>SVG Performance</span>
              <h1 className={styles.h1}>
                Stay <span>ready.</span>
              </h1>
              <p className={styles.hook}>
                Strength, conditioning and fight training built for combat athletes. A structured
                plan between classes, tracked set by set.
                <strong>Train smarter. Fight sharper.</strong>
              </p>
              <div className={styles.status}>
                <div className={styles.statusChip}>
                  <b>WEB</b>
                  <small>Live</small>
                </div>
                <div className={styles.statusTxt}>
                  <b>Sign in and train today.</b>
                  <em>iPhone + Android very soon</em>
                </div>
              </div>
              <div className={styles.btns}>
                <Link className={cn(styles.btn, styles.btnPrimary)} href="/login">
                  Sign in
                </Link>
                <Link className={cn(styles.btn, styles.btnSecondary)} href="/waitlist">
                  Join the waitlist
                </Link>
              </div>
              <p className={styles.webLine}>
                Train on the web. Open it on your phone, no download needed.
              </p>
            </div>
          </div>
        </section>

        <section className={cn(styles.sec, styles.alt)} id="how">
          <div className={styles.in}>
            <span className={styles.kicker}>How it works</span>
            <h2>
              Four steps to <span>ready.</span>
            </h2>
            <ol className={styles.path}>
              <li>
                <b>1</b>
                <h3>Sign in on the web</h3>
                <p>Open svgperformance.app on your phone or computer.</p>
              </li>
              <li>
                <b>2</b>
                <h3>Follow the plan</h3>
                <p>Structured strength and conditioning built around your class days.</p>
              </li>
              <li>
                <b>3</b>
                <h3>Track it</h3>
                <p>Log every set. Watch the numbers climb.</p>
              </li>
              <li>
                <b>4</b>
                <h3>Level up</h3>
                <p>Stronger, fitter, sharper. On the mats and off.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className={styles.sec}>
          <div className={styles.in}>
            <span className={styles.kicker}>What you get</span>
            <h2>
              Structure that gets <span>results.</span>
            </h2>
            <ul className={styles.tiles}>
              <li>
                <h3>No more guesswork</h3>
                <p>
                  Strength and conditioning programs that change every 3 weeks, so you keep
                  progressing.
                </p>
              </li>
              <li>
                <h3>Know how heavy to go</h3>
                <p>
                  Every lift comes with a reps-in-reserve (RIR) target. Push hard, skip the
                  burnout.
                </p>
              </li>
              <li>
                <h3>See your progress</h3>
                <p>Log sets in seconds and track your lifts, weight and streak.</p>
              </li>
              <li>
                <h3>Fits your week</h3>
                <p>Add your class days and your plan works around them.</p>
              </li>
            </ul>

            <div className={cn(styles.feature, styles.coach)}>
              <div>
                <span className={cn(styles.badge, styles.badgeLime)}>AI coaches</span>
                <p>
                  Text chat with five AI coaches, each with their own personality, including Coach
                  Ricky.
                </p>
                <small className={styles.cap}>
                  Ask training questions, understand each session and keep moving toward your
                  goals.
                </small>
              </div>
              <PhoneFrame small label="Preview of AI coach chat">
                <CoachScreen />
              </PhoneFrame>
            </div>

            <div className={cn(styles.feature, styles.fight)}>
              <div>
                <span className={cn(styles.badge, styles.badgeWhite)}>For fighters</span>
                <p>
                  <b>Fight camp mode:</b> set a fight date and your plan builds toward it.
                </p>
                <p>
                  <b>Themed rounds:</b> bag and shadowboxing with one focus each (jab, hooks, body
                  work, combo flow).
                </p>
                <p>
                  <b>Check-ins:</b> flag a rough sparring session or a sore body and your training
                  eases off.
                </p>
                <small className={styles.cap}>
                  Themed bag rounds. Clock’s running. Punch to hide the kick.
                </small>
              </div>
              <PhoneFrame small label="Preview of a themed bag-round timer">
                <BagScreen />
              </PhoneFrame>
            </div>

            <ul className={styles.phones} aria-label="A look inside the app">
              <li>
                <PhoneFrame label="Preview of a training week">
                  <PlanScreen />
                </PhoneFrame>
                <span className={styles.lbl}>Your plan</span>
                <span className={styles.sub}>
                  Fighter-first programming. A new training block every 3 weeks so your body never
                  gets comfortable.
                </span>
              </li>
              <li>
                <PhoneFrame label="Preview of the set logger with an RIR target">
                  <LoggerScreen />
                </PhoneFrame>
                <span className={styles.lbl}>Know how heavy</span>
                <span className={styles.sub}>
                  Every set has a target. RIR tells you how hard to go. No guessing, no ego
                  lifting.
                </span>
              </li>
              <li>
                <PhoneFrame label="Preview of progress">
                  <ProgressScreen />
                </PhoneFrame>
                <span className={styles.lbl}>Your progress</span>
                <span className={styles.sub}>
                  Streaks, weigh-ins, sessions. The scoreboard doesn’t lie.
                </span>
              </li>
              <li>
                <PhoneFrame label="Preview of the home screen">
                  <DayScreen />
                </PhoneFrame>
                <span className={styles.lbl}>Your day</span>
                <span className={styles.sub}>Walk in. Check your numbers. Get to work.</span>
              </li>
            </ul>
            <p className={styles.swipe}>Swipe for a look inside →</p>
          </div>
        </section>

        <section className={cn(styles.sec, styles.alt)}>
          <div className={styles.in}>
            <span className={styles.kicker}>Made at SVG MMA Academy</span>
            <h2>Built by fighters, for fighters and combat sports athletes.</h2>
            <p className={styles.quote}>
              Most fitness apps don’t know you sparred last night or have a fight in 8 weeks.{" "}
              <span>This one does.</span>
            </p>
            <p className={styles.body}>
              A real fight team coach built it: SVG’s own Coach Ricky “Savage Diamond”, for
              everyone who trains, from first class to fight night.
            </p>
          </div>
        </section>

        <section className={cn(styles.sec, styles.apps)}>
          <div className={styles.in}>
            <span className={styles.kicker}>Apps coming soon</span>
            <h2>iPhone and Android. Very soon.</h2>
            <p className={styles.bandLead}>
              iPhone and Android apps are on the way. Join the waitlist and we’ll email you the
              moment they’re ready.
            </p>
            <ul className={styles.cards}>
              <li>
                <b>Right now</b>
                <strong>
                  The full app runs in your phone’s browser. Add it to your Home Screen for one-tap
                  access.
                </strong>
              </li>
              <li>
                <b>Very soon</b>
                <strong>iPhone and Android apps. Waitlist members hear first, by email.</strong>
              </li>
            </ul>
            <div className={styles.btns}>
              <Link className={cn(styles.btn, styles.btnPrimary)} href="/waitlist">
                Join the waitlist
              </Link>
              <Link className={cn(styles.btn, styles.btnSecondary)} href="/login">
                Sign in on the web
              </Link>
            </div>
            <p className={styles.small}>No spam. Unsubscribe anytime.</p>
          </div>
        </section>

        <section className={cn(styles.sec, styles.final)}>
          <div className={styles.in}>
            <span className={styles.kicker}>Ready when you are</span>
            <h2>
              Your next session is <span>waiting.</span>
            </h2>
            <p className={styles.lead}>
              Sign in on the web and pick up your plan today. Not ready yet? Join the waitlist and
              we’ll let you know when the iPhone and Android apps land.
            </p>
            <div className={styles.btns}>
              <Link className={cn(styles.btn, styles.btnPrimary)} href="/login">
                Sign in
              </Link>
              <Link className={cn(styles.btn, styles.btnSecondary)} href="/waitlist">
                Join the waitlist
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.in}>
          <div>
            <Brand />
            <p className={styles.footerNote}>Made at SVG MMA Academy, El Paso, TX.</p>
          </div>
          <div>
            <p>
              Questions?{" "}
              <a className={styles.mail} href={`mailto:${email}`}>
                {email}
              </a>
            </p>
          </div>
          <div>
            <ul>
              <li>
                <Link href="/login">Sign in</Link>
              </li>
              <li>
                <Link href="/waitlist">Waitlist</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy</Link>
              </li>
              <li>
                <Link href="/terms">Terms</Link>
              </li>
            </ul>
            <p className={styles.footerCopy}>© 2026 SVG Performance</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
