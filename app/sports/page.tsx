"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type ColorKey =
  | "gray"
  | "blue"
  | "green"
  | "purple"
  | "amber"
  | "orange"
  | "teal"
  | "rose"
  | "violet"
  | "indigo"
  | "sky"
  | "cyan"
  | "lime"
  | "pink"
  | "fuchsia"
  | "red"
  | "yellow"
  | "zinc"
  | "slate"
  | "emerald"
  | "stone"
  | "neutral";

type SectionKey = "A" | "B" | "C" | "D" | "E" | "F";

type SportEntry = {
  kind: "sport";
  name: string;
  description: string;
  objective: string;
  format: string;
  origin: string;
  gov: string;
  olympic: string;
  lineage?: string;
  tags: string[];
};

type ScienceEntry = {
  kind: "science";
  name: string;
  description: string;
  keyInsight: string;
  tags: string[];
};

type Entry = SportEntry | ScienceEntry;

type Family = {
  slug: string;
  name: string;
  blurb: string;
  color: ColorKey;
  section: SectionKey;
  entries: Entry[];
};

type Section = {
  key: SectionKey;
  title: string;
  blurb: string;
};

const COLOR_STYLES: Record<
  ColorKey,
  {
    headerBg: string;
    headerBorder: string;
    headerText: string;
    chipBg: string;
    chipText: string;
    cardBorder: string;
    cardHover: string;
    accent: string;
  }
> = {
  gray: { headerBg: "bg-gray-900/60", headerBorder: "border-gray-700", headerText: "text-gray-200", chipBg: "bg-gray-800", chipText: "text-gray-400", cardBorder: "border-gray-800", cardHover: "hover:border-gray-600", accent: "text-gray-400" },
  blue: { headerBg: "bg-blue-950/40", headerBorder: "border-blue-900", headerText: "text-blue-200", chipBg: "bg-blue-950/60", chipText: "text-blue-300", cardBorder: "border-blue-950/70", cardHover: "hover:border-blue-700", accent: "text-blue-400" },
  green: { headerBg: "bg-emerald-950/40", headerBorder: "border-emerald-900", headerText: "text-emerald-200", chipBg: "bg-emerald-950/60", chipText: "text-emerald-300", cardBorder: "border-emerald-950/70", cardHover: "hover:border-emerald-700", accent: "text-emerald-400" },
  purple: { headerBg: "bg-purple-950/40", headerBorder: "border-purple-900", headerText: "text-purple-200", chipBg: "bg-purple-950/60", chipText: "text-purple-300", cardBorder: "border-purple-950/70", cardHover: "hover:border-purple-700", accent: "text-purple-400" },
  amber: { headerBg: "bg-amber-950/40", headerBorder: "border-amber-900", headerText: "text-amber-200", chipBg: "bg-amber-950/60", chipText: "text-amber-300", cardBorder: "border-amber-950/70", cardHover: "hover:border-amber-700", accent: "text-amber-400" },
  orange: { headerBg: "bg-orange-950/40", headerBorder: "border-orange-900", headerText: "text-orange-200", chipBg: "bg-orange-950/60", chipText: "text-orange-300", cardBorder: "border-orange-950/70", cardHover: "hover:border-orange-700", accent: "text-orange-400" },
  teal: { headerBg: "bg-teal-950/40", headerBorder: "border-teal-900", headerText: "text-teal-200", chipBg: "bg-teal-950/60", chipText: "text-teal-300", cardBorder: "border-teal-950/70", cardHover: "hover:border-teal-700", accent: "text-teal-400" },
  rose: { headerBg: "bg-rose-950/40", headerBorder: "border-rose-900", headerText: "text-rose-200", chipBg: "bg-rose-950/60", chipText: "text-rose-300", cardBorder: "border-rose-950/70", cardHover: "hover:border-rose-700", accent: "text-rose-400" },
  violet: { headerBg: "bg-violet-950/40", headerBorder: "border-violet-900", headerText: "text-violet-200", chipBg: "bg-violet-950/60", chipText: "text-violet-300", cardBorder: "border-violet-950/70", cardHover: "hover:border-violet-700", accent: "text-violet-400" },
  indigo: { headerBg: "bg-indigo-950/40", headerBorder: "border-indigo-900", headerText: "text-indigo-200", chipBg: "bg-indigo-950/60", chipText: "text-indigo-300", cardBorder: "border-indigo-950/70", cardHover: "hover:border-indigo-700", accent: "text-indigo-400" },
  sky: { headerBg: "bg-sky-950/40", headerBorder: "border-sky-900", headerText: "text-sky-200", chipBg: "bg-sky-950/60", chipText: "text-sky-300", cardBorder: "border-sky-950/70", cardHover: "hover:border-sky-700", accent: "text-sky-400" },
  cyan: { headerBg: "bg-cyan-950/40", headerBorder: "border-cyan-900", headerText: "text-cyan-200", chipBg: "bg-cyan-950/60", chipText: "text-cyan-300", cardBorder: "border-cyan-950/70", cardHover: "hover:border-cyan-700", accent: "text-cyan-400" },
  lime: { headerBg: "bg-lime-950/40", headerBorder: "border-lime-900", headerText: "text-lime-200", chipBg: "bg-lime-950/60", chipText: "text-lime-300", cardBorder: "border-lime-950/70", cardHover: "hover:border-lime-700", accent: "text-lime-400" },
  pink: { headerBg: "bg-pink-950/40", headerBorder: "border-pink-900", headerText: "text-pink-200", chipBg: "bg-pink-950/60", chipText: "text-pink-300", cardBorder: "border-pink-950/70", cardHover: "hover:border-pink-700", accent: "text-pink-400" },
  fuchsia: { headerBg: "bg-fuchsia-950/40", headerBorder: "border-fuchsia-900", headerText: "text-fuchsia-200", chipBg: "bg-fuchsia-950/60", chipText: "text-fuchsia-300", cardBorder: "border-fuchsia-950/70", cardHover: "hover:border-fuchsia-700", accent: "text-fuchsia-400" },
  red: { headerBg: "bg-red-950/40", headerBorder: "border-red-900", headerText: "text-red-200", chipBg: "bg-red-950/60", chipText: "text-red-300", cardBorder: "border-red-950/70", cardHover: "hover:border-red-700", accent: "text-red-400" },
  yellow: { headerBg: "bg-yellow-950/40", headerBorder: "border-yellow-900", headerText: "text-yellow-200", chipBg: "bg-yellow-950/60", chipText: "text-yellow-300", cardBorder: "border-yellow-950/70", cardHover: "hover:border-yellow-700", accent: "text-yellow-400" },
  zinc: { headerBg: "bg-zinc-900/60", headerBorder: "border-zinc-700", headerText: "text-zinc-200", chipBg: "bg-zinc-800", chipText: "text-zinc-400", cardBorder: "border-zinc-800", cardHover: "hover:border-zinc-600", accent: "text-zinc-400" },
  slate: { headerBg: "bg-slate-900/60", headerBorder: "border-slate-700", headerText: "text-slate-200", chipBg: "bg-slate-800", chipText: "text-slate-400", cardBorder: "border-slate-800", cardHover: "hover:border-slate-600", accent: "text-slate-400" },
  emerald: { headerBg: "bg-emerald-950/40", headerBorder: "border-emerald-900", headerText: "text-emerald-200", chipBg: "bg-emerald-950/60", chipText: "text-emerald-300", cardBorder: "border-emerald-950/70", cardHover: "hover:border-emerald-700", accent: "text-emerald-400" },
  stone: { headerBg: "bg-stone-900/60", headerBorder: "border-stone-700", headerText: "text-stone-200", chipBg: "bg-stone-800", chipText: "text-stone-400", cardBorder: "border-stone-800", cardHover: "hover:border-stone-600", accent: "text-stone-400" },
  neutral: { headerBg: "bg-neutral-900/60", headerBorder: "border-neutral-700", headerText: "text-neutral-200", chipBg: "bg-neutral-800", chipText: "text-neutral-400", cardBorder: "border-neutral-800", cardHover: "hover:border-neutral-600", accent: "text-neutral-400" },
};

const SECTIONS: Section[] = [
  { key: "A", title: "Section A — Team Sports", blurb: "Two sides contest territory or alternate at bat-and-ball." },
  { key: "B", title: "Section B — Net, Wall & Racquet", blurb: "An object is sent over a net or off a wall; faults score for the opponent." },
  { key: "C", title: "Section C — Combat & Athletics", blurb: "One-on-one duels and the foundational running, jumping, and throwing events." },
  { key: "D", title: "Section D — Board, Wheel, Water & Snow", blurb: "Craft- and surface-based sports across water, snow, ice, asphalt, and air." },
  { key: "E", title: "Section E — Precision, Strength, Animal & Mind", blurb: "Target sports, maximal-strength contests, animal-partnered sports, and contested mind games." },
  { key: "F", title: "Section F — The Science of Sport", blurb: "The physiology, biomechanics, and methodology behind athletic performance." },
];

const FAMILIES: Family[] = [
  // ── SECTION A ─────────────────────────────────────────────────────────────
  {
    slug: "invasion-goal",
    name: "Family 1 — Invasion & Goal Sports",
    blurb: "Two teams contest territory and put an object into a goal or scoring zone.",
    color: "blue",
    section: "A",
    entries: [
      { kind: "sport", name: "Association football (soccer)", description: "The world's most-played invasion game.", objective: "Score more goals by putting the ball into the opponent's net.", format: "11 v 11, two 45-min halves.", origin: "England, codified 1863 (The FA).", gov: "FIFA.", olympic: "Yes.", lineage: "Folk football → association code.", tags: ["team", "ball", "global"] },
      { kind: "sport", name: "Basketball", description: "Court invasion game scoring through an elevated hoop.", objective: "Outscore the opponent via 1/2/3-point baskets.", format: "5 v 5, four quarters (NBA 12 min, FIBA 10).", origin: "USA, 1891 (James Naismith).", gov: "FIBA.", olympic: "Yes (3x3 added 2021).", tags: ["team", "ball", "court"] },
      { kind: "sport", name: "Rugby union", description: "Handling-and-running code with contested set pieces.", objective: "Score tries (5 pts) and goals.", format: "15 v 15, two 40-min halves.", origin: "England, Rugby School ~1845.", gov: "World Rugby.", olympic: "Former (15s 1900–1924).", lineage: "Rugby football.", tags: ["team", "contact", "oval-ball"] },
      { kind: "sport", name: "Rugby league", description: "A faster 13-a-side rugby code with limited tackles.", objective: "Score tries and goals; possession resets every six tackles.", format: "13 v 13, two 40-min halves.", origin: "Northern England, 1895 split.", gov: "International Rugby League.", olympic: "No.", lineage: "Rugby union → league.", tags: ["team", "contact", "oval-ball"] },
      { kind: "sport", name: "Rugby sevens", description: "Short-form Olympic rugby union.", objective: "Score tries/goals with seven players on a full field.", format: "7 v 7, two 7-min halves.", origin: "Scotland, 1883.", gov: "World Rugby.", olympic: "Yes (since 2016).", lineage: "Rugby union → sevens.", tags: ["team", "contact", "olympic"] },
      { kind: "sport", name: "American football (gridiron)", description: "Down-and-distance territorial code with set plays.", objective: "Advance the ball to the end zone for touchdowns/field goals.", format: "11 v 11, four 15-min quarters.", origin: "USA, 1869–1880s (Walter Camp).", gov: "IFAF.", olympic: "No.", lineage: "Rugby football → gridiron.", tags: ["team", "contact", "american"] },
      { kind: "sport", name: "Flag football", description: "Non-contact gridiron variant; flags replace tackles.", objective: "Reach the end zone; pulling flags instead of tackling.", format: "5 v 5, two 20-min halves (Olympic format).", origin: "USA, mid-20th c.", gov: "IFAF.", olympic: "Debut LA28.", lineage: "American football → flag.", tags: ["team", "non-contact", "olympic"] },
      { kind: "sport", name: "Canadian football", description: "Gridiron variant on a larger field with 12 a side.", objective: "Score touchdowns/field goals; three downs, deeper end zones.", format: "12 v 12, four quarters.", origin: "Canada, late 19th c.", gov: "Football Canada / CFL.", olympic: "No.", lineage: "Rugby football → gridiron.", tags: ["team", "contact", "american"] },
      { kind: "sport", name: "Australian rules football", description: "High-scoring 18-a-side code on an oval ground.", objective: "Kick the ball through central goals (6 pts) or behinds (1).", format: "18 v 18, four quarters.", origin: "Melbourne, 1858–59.", gov: "AFL.", olympic: "No.", tags: ["team", "contact", "oval-field"] },
      { kind: "sport", name: "Gaelic football", description: "Irish code mixing carrying, kicking, and hand-passing.", objective: "Goals (3 pts) into a net or points (1 pt) over the bar.", format: "15 v 15, two 35-min halves.", origin: "Ireland, codified 1887 (GAA).", gov: "GAA.", olympic: "No.", tags: ["team", "amateur", "irish"] },
      { kind: "sport", name: "Field hockey", description: "Stick-and-ball invasion game on turf.", objective: "Hit the ball into the goal with a hooked stick.", format: "11 v 11, four quarters.", origin: "Modern England, 19th c.", gov: "FIH.", olympic: "Yes.", tags: ["team", "stick", "turf"] },
      { kind: "sport", name: "Ice hockey", description: "Fast goal sport on skates with a puck.", objective: "Shoot the puck into the net more than the opponent.", format: "6 v 6 (with goalie), three 20-min periods.", origin: "Canada, Montreal 1875.", gov: "IIHF.", olympic: "Yes (Winter).", tags: ["team", "ice", "contact"] },
      { kind: "sport", name: "Handball (team)", description: "Indoor goal sport played by throwing.", objective: "Throw the ball into a 3 m goal past a keeper.", format: "7 v 7, two 30-min halves.", origin: "Denmark/Germany, early 20th c.", gov: "IHF.", olympic: "Yes.", tags: ["team", "indoor", "throwing"] },
      { kind: "sport", name: "Water polo", description: "Aquatic invasion game played while treading water.", objective: "Throw the ball into the opponent's goal.", format: "7 v 7, four quarters.", origin: "Britain, 1870s.", gov: "World Aquatics.", olympic: "Yes.", tags: ["team", "aquatic", "contact"] },
      { kind: "sport", name: "Lacrosse", description: "Stick game using a netted crosse to pass and shoot.", objective: "Shoot the ball into the goal with a long-handled net.", format: "Field 10 v 10; Olympic Sixes 6 v 6.", origin: "Indigenous North America; codified Canada 1860s.", gov: "World Lacrosse.", olympic: "Returns LA28 (Sixes).", tags: ["team", "stick", "indigenous"] },
      { kind: "sport", name: "Netball", description: "Non-contact passing game derived from early basketball.", objective: "Shoot into a netted ring; no dribbling, positional zones.", format: "7 v 7, four quarters.", origin: "England, 1890s.", gov: "World Netball.", olympic: "No.", lineage: "Basketball → netball.", tags: ["team", "non-contact", "women"] },
      { kind: "sport", name: "Futsal", description: "Five-a-side indoor football with a low-bounce ball.", objective: "Score goals on a hard court with a smaller, heavier ball.", format: "5 v 5, two 20-min halves.", origin: "Uruguay, 1930s.", gov: "FIFA.", olympic: "No.", lineage: "Association football → futsal.", tags: ["team", "indoor", "ball"] },
      { kind: "sport", name: "Ultimate (frisbee)", description: "Self-refereed flying-disc end-zone game.", objective: "Complete passes into the end zone; no running with the disc.", format: "7 v 7.", origin: "USA, 1968.", gov: "WFDF.", olympic: "No (IOC-recognized).", tags: ["team", "disc", "non-contact"] },
      { kind: "sport", name: "Polo", description: "Mounted team sport hitting a ball with a mallet.", objective: "Drive the ball through the opponent's goal on horseback.", format: "4 v 4, chukkas.", origin: "Central Asia, ancient; modern India/Britain 19th c.", gov: "FIP.", olympic: "Former (1900–1936).", tags: ["team", "equestrian", "mallet"] },
    ],
  },
  {
    slug: "bat-and-ball",
    name: "Family 2 — Bat-and-Ball & Striking Sports",
    blurb: "One side bats or strikes; the other fields, in alternating innings.",
    color: "indigo",
    section: "A",
    entries: [
      { kind: "sport", name: "Baseball", description: "Diamond bat-and-ball game of innings and bases.", objective: "Score runs by batting and circling four bases.", format: "9 v 9, nine innings.", origin: "USA, mid-19th c. (Knickerbocker rules 1845).", gov: "WBSC.", olympic: "Returns LA28.", lineage: "Rounders/cricket family.", tags: ["bat-ball", "american", "innings"] },
      { kind: "sport", name: "Cricket", description: "Bat-and-ball contest on a pitch with two wickets.", objective: "Score more runs; dismiss the batting side.", format: "11 v 11; Olympic format T20 (20 overs).", origin: "England, 16th–18th c.", gov: "ICC.", olympic: "Returns LA28 (T20).", tags: ["bat-ball", "pitch", "global"] },
      { kind: "sport", name: "Softball", description: "Underhand-pitch variant of baseball on a smaller field.", objective: "Score runs around the bases; larger ball, shorter game.", format: "9 v 9, seven innings.", origin: "USA, Chicago 1887.", gov: "WBSC.", olympic: "Returns LA28 (with baseball).", lineage: "Baseball → softball.", tags: ["bat-ball", "diamond"] },
      { kind: "sport", name: "Rounders", description: "English schoolyard bat-and-ball ancestor of baseball.", objective: "Score rounders by hitting and running the bases.", format: "Teams of up to 9.", origin: "England, recorded 18th c.", gov: "Rounders England / GAA (Irish variant).", olympic: "No.", tags: ["bat-ball", "heritage"] },
      { kind: "sport", name: "Pesapallo (Finnish baseball)", description: "Finland's national game with vertical pitching.", objective: "Score runs; the ball is pitched straight up and struck.", format: "9 v 9.", origin: "Finland, 1920s (Lauri Pihkala).", gov: "Pesapalloliitto.", olympic: "No.", lineage: "Baseball → pesapallo.", tags: ["bat-ball", "nordic"] },
    ],
  },

  // ── SECTION B ─────────────────────────────────────────────────────────────
  {
    slug: "net-racquet",
    name: "Family 3 — Net & Racquet Sports",
    blurb: "Players send an object over a net or off a wall; faults score for the opponent.",
    color: "sky",
    section: "B",
    entries: [
      { kind: "sport", name: "Tennis", description: "Racquet sport over a net on varied surfaces.", objective: "Win points where the opponent can't return the ball in bounds.", format: "Singles/doubles, best-of-3/5 sets.", origin: "England, lawn tennis 1873–74 (Wingfield).", gov: "ITF.", olympic: "Yes.", lineage: "Real (court) tennis → lawn tennis.", tags: ["racquet", "net", "court"] },
      { kind: "sport", name: "Table tennis", description: "Fast indoor racquet game on a table.", objective: "Win 11-point games; ball must bounce once each side.", format: "Singles/doubles/team, best-of-5/7.", origin: "England, 1880s.", gov: "ITTF.", olympic: "Yes.", lineage: "Tennis → table tennis.", tags: ["racquet", "indoor", "paddle"] },
      { kind: "sport", name: "Badminton", description: "Racquet sport with a shuttlecock; no bounce.", objective: "Land the shuttle in-court; rally ends if it touches the floor.", format: "Singles/doubles, best-of-3 to 21.", origin: "British India/England, 1870s.", gov: "BWF.", olympic: "Yes.", tags: ["racquet", "net", "shuttle"] },
      { kind: "sport", name: "Volleyball (indoor)", description: "Six-a-side rally sport over a high net.", objective: "Ground the ball on the opponent's court within three touches.", format: "6 v 6, best-of-5 sets to 25.", origin: "USA, 1895 (William Morgan).", gov: "FIVB.", olympic: "Yes.", tags: ["team", "net", "indoor"] },
      { kind: "sport", name: "Beach volleyball", description: "Two-a-side volleyball on sand.", objective: "Ground the ball on sand within three touches; smaller court.", format: "2 v 2, best-of-3 sets.", origin: "USA, 1920s (Santa Monica).", gov: "FIVB.", olympic: "Yes.", lineage: "Volleyball → beach.", tags: ["team", "sand", "olympic"] },
      { kind: "sport", name: "Squash", description: "Enclosed-court game striking a ball off the front wall.", objective: "Win rallies the opponent can't return before two bounces.", format: "Singles, best-of-5 to 11.", origin: "England, Harrow School ~1830s.", gov: "WSF.", olympic: "Debut LA28.", lineage: "Rackets → squash.", tags: ["racquet", "wall", "indoor"] },
      { kind: "sport", name: "Racquetball", description: "Fast walled-court racquet game; all walls live.", objective: "Win rallies; ceiling and all four walls are in play.", format: "Singles/doubles to 15.", origin: "USA, 1950 (Joe Sobek).", gov: "IRF.", olympic: "No.", lineage: "Squash/handball → racquetball.", tags: ["racquet", "wall"] },
      { kind: "sport", name: "Padel", description: "Enclosed doubles racquet sport with glass walls.", objective: "Win points; balls may rebound off walls, solid paddles.", format: "2 v 2, best-of-3 to 6 games.", origin: "Mexico, 1969 (Acapulco).", gov: "International Padel Federation.", olympic: "No.", lineage: "Tennis/squash → padel.", tags: ["racquet", "wall", "doubles"] },
      { kind: "sport", name: "Pickleball", description: "Paddle sport on a small court with a perforated ball.", objective: "Win rallies; kitchen no-volley zone, underhand serve.", format: "Singles/doubles to 11.", origin: "USA, 1965 (Bainbridge Island).", gov: "International Federation of Pickleball.", olympic: "No.", lineage: "Badminton/tennis/table tennis → pickleball.", tags: ["paddle", "net", "growing"] },
      { kind: "sport", name: "Sepak takraw", description: "Southeast Asian kick volleyball over a net.", objective: "Ground the ball using feet, knees, head — never hands.", format: "3 v 3 (regu).", origin: "SE Asia, traditional; codified 1960s.", gov: "ISTAF.", olympic: "No.", tags: ["team", "net", "kick"] },
      { kind: "sport", name: "Pelota / jai alai", description: "Basque wall games hurling a ball by hand or cesta.", objective: "Return the ball off the fronton wall before it's dead.", format: "Singles/doubles; many variants.", origin: "Basque Country, traditional.", gov: "FIPV.", olympic: "Former demonstration (1900).", tags: ["wall", "basque", "fast"] },
    ],
  },

  // ── SECTION C ─────────────────────────────────────────────────────────────
  {
    slug: "combat",
    name: "Family 4 — Combat & Martial Sports",
    blurb: "One-on-one contests decided by strikes, throws, holds, or points.",
    color: "red",
    section: "C",
    entries: [
      { kind: "sport", name: "Boxing", description: "Striking sport using only gloved fists.", objective: "Win by knockout or judges' points scoring legal punches.", format: "Rounds (amateur 3; pro up to 12).", origin: "Ancient; modern Queensberry rules 1867.", gov: "World Boxing (Olympic — after IBA's expulsion) [verify].", olympic: "Yes.", tags: ["combat", "striking", "gloves"] },
      { kind: "sport", name: "Wrestling (freestyle)", description: "Grappling using legs and the whole body.", objective: "Pin the opponent or win on points via takedowns/turns.", format: "Two 3-min periods.", origin: "Ancient; modern late 19th c.", gov: "United World Wrestling.", olympic: "Yes.", tags: ["combat", "grappling", "olympic"] },
      { kind: "sport", name: "Wrestling (Greco-Roman)", description: "Wrestling barred from holds below the waist.", objective: "Pin or outscore using upper-body throws only.", format: "Two 3-min periods.", origin: "19th-c. France/Europe.", gov: "United World Wrestling.", olympic: "Yes.", lineage: "Classical wrestling → Greco-Roman.", tags: ["combat", "grappling"] },
      { kind: "sport", name: "Judo", description: "Japanese throwing-and-grappling art.", objective: "Score ippon by a clean throw, pin, choke, or armlock.", format: "4-min bouts.", origin: "Japan, 1882 (Kano Jigoro).", gov: "IJF.", olympic: "Yes.", lineage: "Jujutsu → judo.", tags: ["combat", "grappling", "throws"] },
      { kind: "sport", name: "Karate", description: "Japanese/Okinawan striking art.", objective: "Score points (kumite) or judged forms (kata).", format: "3-min kumite; kata judged.", origin: "Okinawa → Japan, early 20th c.", gov: "WKF.", olympic: "Former (Tokyo 2020 only).", tags: ["combat", "striking", "kata"] },
      { kind: "sport", name: "Taekwondo", description: "Korean striking art emphasizing high, fast kicks.", objective: "Score points to trunk/head with kicks and punches.", format: "Three rounds, electronic scoring.", origin: "Korea, 1940s–50s.", gov: "World Taekwondo.", olympic: "Yes.", tags: ["combat", "striking", "kicks"] },
      { kind: "sport", name: "Mixed martial arts (MMA)", description: "Full-contact sport blending striking and grappling.", objective: "Win by KO, submission, or judges' decision.", format: "Three 5-min rounds (five for titles).", origin: "Modern, 1990s.", gov: "No single body (IMMAF aspires).", olympic: "No.", tags: ["combat", "hybrid", "cage"] },
      { kind: "sport", name: "Brazilian jiu-jitsu (BJJ)", description: "Ground-grappling art of control and submission.", objective: "Force submission via joint locks/chokes or win on points.", format: "Timed matches by belt.", origin: "Brazil, early-mid 20th c.", gov: "IBJJF (sport).", olympic: "No.", lineage: "Judo/jujutsu → BJJ.", tags: ["combat", "grappling", "ground"] },
      { kind: "sport", name: "Muay Thai", description: "Thai art of eight limbs striking sport.", objective: "KO or outscore using fists, elbows, knees, shins, clinch.", format: "Five 3-min rounds.", origin: "Thailand, traditional.", gov: "IFMA.", olympic: "No (IOC-recognized).", tags: ["combat", "striking", "clinch"] },
      { kind: "sport", name: "Fencing", description: "Sword sport with foil, epee, and sabre.", objective: "Score touches on valid target with electronic scoring.", format: "Bouts to 5/15 touches.", origin: "From dueling; modern 18th–19th c.", gov: "FIE.", olympic: "Yes.", tags: ["combat", "weapon", "olympic"] },
      { kind: "sport", name: "Kendo", description: "Japanese sword art using bamboo shinai and armor.", objective: "Score clean strikes to set targets with correct form and spirit.", format: "Timed bouts, two of three points.", origin: "Japan, from kenjutsu.", gov: "International Kendo Federation.", olympic: "No.", tags: ["combat", "weapon", "japanese"] },
      { kind: "sport", name: "Sambo", description: "Soviet grappling sport blending judo and wrestling.", objective: "Throw, pin, or submit; combat sambo adds strikes.", format: "Timed matches.", origin: "USSR, 1920s–30s.", gov: "FIAS.", olympic: "No (IOC-recognized).", lineage: "Judo/wrestling → sambo.", tags: ["combat", "grappling"] },
      { kind: "sport", name: "Sumo", description: "Japanese ceremonial wrestling in a circular ring.", objective: "Force the opponent out of the ring or to touch the ground.", format: "Single bouts, often seconds long.", origin: "Japan, ancient/Shinto.", gov: "International Sumo Federation.", olympic: "No.", tags: ["combat", "grappling", "ritual"] },
      { kind: "sport", name: "Kickboxing", description: "Striking sport combining punches and kicks.", objective: "KO or outscore with hand and foot strikes.", format: "Three-plus rounds by ruleset.", origin: "Mid-20th c. (Japan/US).", gov: "WAKO.", olympic: "No (IOC-recognized).", tags: ["combat", "striking"] },
    ],
  },
  {
    slug: "athletics",
    name: "Family 5 — Athletics (Track & Field)",
    blurb: "Running, jumping, and throwing disciplines under World Athletics.",
    color: "amber",
    section: "C",
    entries: [
      { kind: "sport", name: "Sprints (100/200/400 m)", description: "Maximal-velocity flat races.", objective: "Cover the distance in the least time.", format: "Lanes, blocks, heats to final.", origin: "Ancient (stadion); modern 19th c.", gov: "World Athletics.", olympic: "Yes.", tags: ["track", "speed", "olympic"] },
      { kind: "sport", name: "Middle distance (800/1500 m)", description: "Tactical races blending speed and endurance.", objective: "Fastest time; pace and positioning decide it.", format: "Mass start, multiple laps.", origin: "19th c.", gov: "World Athletics.", olympic: "Yes.", tags: ["track", "endurance"] },
      { kind: "sport", name: "Long distance (5000/10000 m)", description: "Sustained-pace track endurance races.", objective: "Fastest time over many laps.", format: "Mass start.", origin: "19th c.", gov: "World Athletics.", olympic: "Yes.", tags: ["track", "endurance"] },
      { kind: "sport", name: "Hurdles (110/100/400 m)", description: "Sprint races over evenly spaced barriers.", objective: "Fastest time clearing all hurdles.", format: "Lanes, fixed hurdle heights.", origin: "England, 19th c.", gov: "World Athletics.", olympic: "Yes.", tags: ["track", "technique"] },
      { kind: "sport", name: "Steeplechase (3000 m)", description: "Distance race with fixed barriers and a water jump.", objective: "Fastest time over barriers and water pit.", format: "Mass start, ~7.5 laps.", origin: "England, 19th c. (from horse racing).", gov: "World Athletics.", olympic: "Yes.", tags: ["track", "obstacle"] },
      { kind: "sport", name: "Relays (4x100 / 4x400 m)", description: "Team baton-passing sprints.", objective: "Fastest aggregate time; clean exchanges in the zone.", format: "Four runners, one baton.", origin: "Early 20th c.", gov: "World Athletics.", olympic: "Yes.", tags: ["track", "team", "baton"] },
      { kind: "sport", name: "Marathon", description: "42.195 km road endurance race.", objective: "Fastest time over the classic distance.", format: "Mass-start road race.", origin: "1896 Olympics (Pheidippides legend).", gov: "World Athletics.", olympic: "Yes.", tags: ["road", "endurance", "iconic"] },
      { kind: "sport", name: "Race walking (20/35 km)", description: "Judged endurance event with a contact rule.", objective: "Fastest time without losing ground contact or bending the knee.", format: "Road loop, judges enforce form.", origin: "19th-c. pedestrianism.", gov: "World Athletics.", olympic: "Yes.", tags: ["road", "judged"] },
      { kind: "sport", name: "Long jump", description: "Horizontal jump for distance after a sprint approach.", objective: "Jump the greatest horizontal distance from the board.", format: "Run-up, take-off board, sand pit.", origin: "Ancient Greece.", gov: "World Athletics.", olympic: "Yes.", tags: ["field", "jump"] },
      { kind: "sport", name: "Triple jump", description: "Hop-step-jump for distance.", objective: "Greatest distance via three linked phases.", format: "Run-up, board, pit.", origin: "Ancient/Gaelic origins.", gov: "World Athletics.", olympic: "Yes.", lineage: "Long jump → triple.", tags: ["field", "jump"] },
      { kind: "sport", name: "High jump", description: "Vertical leap over a horizontal bar.", objective: "Clear the highest bar without dislodging it.", format: "Curved approach, Fosbury flop.", origin: "19th c.", gov: "World Athletics.", olympic: "Yes.", tags: ["field", "jump"] },
      { kind: "sport", name: "Pole vault", description: "Vault over a high bar using a flexible pole.", objective: "Clear the highest bar with a planted pole.", format: "Run-up, plant box, mat.", origin: "19th c.", gov: "World Athletics.", olympic: "Yes.", tags: ["field", "jump", "technique"] },
      { kind: "sport", name: "Shot put", description: "Throwing a heavy metal ball for distance.", objective: "Put the shot the farthest from a circle.", format: "Glide or spin, ~7.26 kg (men).", origin: "Highland/ancient throwing.", gov: "World Athletics.", olympic: "Yes.", tags: ["field", "throw", "power"] },
      { kind: "sport", name: "Discus throw", description: "Spinning throw of a heavy disc.", objective: "Throw the discus the greatest distance.", format: "Rotational throw from a circle.", origin: "Ancient Greece.", gov: "World Athletics.", olympic: "Yes.", tags: ["field", "throw"] },
      { kind: "sport", name: "Javelin throw", description: "Throwing a spear for distance.", objective: "Throw the javelin farthest with a legal landing.", format: "Run-up and over-shoulder release.", origin: "Ancient Greece.", gov: "World Athletics.", olympic: "Yes.", tags: ["field", "throw"] },
      { kind: "sport", name: "Hammer throw", description: "Distance throw of a ball on a wire.", objective: "Throw the hammer farthest after rotations.", format: "Multiple turns from a circle/cage.", origin: "Scottish/Celtic games.", gov: "World Athletics.", olympic: "Yes.", tags: ["field", "throw", "power"] },
      { kind: "sport", name: "Decathlon", description: "Ten-event combined contest (men).", objective: "Most points across 10 track-and-field events over two days.", format: "Scored by performance tables.", origin: "Early 20th c.", gov: "World Athletics.", olympic: "Yes.", tags: ["combined", "endurance"] },
      { kind: "sport", name: "Heptathlon", description: "Seven-event combined contest (women).", objective: "Most points across 7 events over two days.", format: "Scored by tables.", origin: "1980s (replaced pentathlon).", gov: "World Athletics.", olympic: "Yes.", lineage: "Pentathlon → heptathlon.", tags: ["combined"] },
    ],
  },
  {
    slug: "endurance-multisport",
    name: "Family 6 — Endurance & Multi-Sport",
    blurb: "Long-duration and discipline-combining endurance events.",
    color: "orange",
    section: "C",
    entries: [
      { kind: "sport", name: "Triathlon", description: "Sequential swim-bike-run race.", objective: "Fastest combined time across three legs plus transitions.", format: "Olympic: 1.5 km swim / 40 km bike / 10 km run.", origin: "USA, 1970s (San Diego).", gov: "World Triathlon.", olympic: "Yes.", tags: ["endurance", "multisport"] },
      { kind: "sport", name: "Duathlon", description: "Run-bike-run multisport without the swim.", objective: "Fastest combined time across two runs and a ride.", format: "Run / bike / run.", origin: "USA, 1980s.", gov: "World Triathlon.", olympic: "No.", lineage: "Triathlon → duathlon.", tags: ["endurance", "multisport"] },
      { kind: "sport", name: "Modern pentathlon", description: "Five-discipline Olympic event.", objective: "Most points across fencing, swimming, riding (being replaced [verify]), laser-run.", format: "One-day competition.", origin: "1912 Olympics (Coubertin).", gov: "UIPM.", olympic: "Yes (re-included for LA28).", tags: ["combined", "olympic"] },
      { kind: "sport", name: "Ironman triathlon", description: "Long-course branded triathlon.", objective: "Fastest time over 3.86 km swim / 180 km bike / 42.2 km run.", format: "Single long day.", origin: "Hawaii, 1978.", gov: "World Triathlon / WTC (brand).", olympic: "No.", lineage: "Triathlon → Ironman.", tags: ["endurance", "ultra"] },
      { kind: "sport", name: "Ultrarunning", description: "Footraces longer than the marathon.", objective: "Finish/win distances of 50 km to 100+ miles, often on trails.", format: "Timed or fixed-distance, frequently mountainous.", origin: "19th-c. pedestrianism; modern boom 1970s+.", gov: "IAU.", olympic: "No.", tags: ["endurance", "trail", "ultra"] },
      { kind: "sport", name: "Adventure racing", description: "Multi-day off-road navigation across disciplines.", objective: "Fastest team time navigating trekking, paddling, biking checkpoints.", format: "Mixed-gender teams, expedition length.", origin: "Late 20th c.", gov: "IARU / ARWS.", olympic: "No.", tags: ["endurance", "team", "navigation"] },
      { kind: "sport", name: "Orienteering", description: "Timed cross-country navigation by map and compass.", objective: "Visit control points in order in the least time.", format: "Individual/relay, varied terrain.", origin: "Sweden, late 19th c.", gov: "IOF.", olympic: "No (IOC-recognized).", tags: ["navigation", "endurance"] },
    ],
  },

  // ── SECTION D ─────────────────────────────────────────────────────────────
  {
    slug: "aquatic",
    name: "Family 7 — Aquatic Sports",
    blurb: "Racing, judged, and craft-based sports in or on the water.",
    color: "teal",
    section: "D",
    entries: [
      { kind: "sport", name: "Freestyle swimming", description: "Fastest stroke, typically front crawl.", objective: "Fastest time; any stroke allowed.", format: "50–1500 m pool events.", origin: "Competitive 19th c.", gov: "World Aquatics.", olympic: "Yes.", tags: ["aquatic", "racing", "pool"] },
      { kind: "sport", name: "Backstroke", description: "Pool stroke swum on the back.", objective: "Fastest time face-up off a backstroke start.", format: "50–200 m.", origin: "Early 20th c.", gov: "World Aquatics.", olympic: "Yes.", tags: ["aquatic", "racing"] },
      { kind: "sport", name: "Breaststroke", description: "Symmetric frog-kick pool stroke.", objective: "Fastest time within strict stroke rules.", format: "50–200 m.", origin: "Oldest competitive stroke.", gov: "World Aquatics.", olympic: "Yes.", tags: ["aquatic", "racing"] },
      { kind: "sport", name: "Butterfly", description: "Powerful dual-arm dolphin-kick stroke.", objective: "Fastest time with simultaneous arm recovery.", format: "50–200 m.", origin: "1930s (from breaststroke).", gov: "World Aquatics.", olympic: "Yes.", lineage: "Breaststroke → butterfly.", tags: ["aquatic", "racing"] },
      { kind: "sport", name: "Individual medley", description: "Race across all four strokes in order.", objective: "Fastest time swimming fly, back, breast, free.", format: "200/400 m IM.", origin: "Mid-20th c.", gov: "World Aquatics.", olympic: "Yes.", tags: ["aquatic", "racing", "combined"] },
      { kind: "sport", name: "Diving", description: "Judged acrobatic entries from board or platform.", objective: "Highest scores for difficulty and execution into the water.", format: "Springboard (3 m), platform (10 m), synchro.", origin: "Early 20th c. (from gymnastics).", gov: "World Aquatics.", olympic: "Yes.", tags: ["aquatic", "judged", "acrobatic"] },
      { kind: "sport", name: "Artistic swimming", description: "Judged choreographed routines in water.", objective: "Highest scores for execution, difficulty, artistry.", format: "Solo/duet/team routines.", origin: "Early 20th c.", gov: "World Aquatics.", olympic: "Yes.", tags: ["aquatic", "judged", "artistic"] },
      { kind: "sport", name: "Open-water / marathon swimming", description: "Distance swimming in lakes and seas.", objective: "Fastest time over 10 km (Olympic) in natural water.", format: "Mass start, no lanes.", origin: "Traditional; Olympic 2008.", gov: "World Aquatics.", olympic: "Yes.", lineage: "Swimming → open water.", tags: ["aquatic", "endurance"] },
      { kind: "sport", name: "Rowing", description: "Boat racing with oars, sweep or sculling.", objective: "Fastest crew over the course (Olympic 2000 m).", format: "Singles to eights; sweep/scull.", origin: "Competitive 18th-c. England.", gov: "World Rowing (FISA).", olympic: "Yes.", tags: ["aquatic", "boat", "racing"] },
      { kind: "sport", name: "Canoe/kayak sprint", description: "Flatwater paddle racing in straight lanes.", objective: "Fastest time over 200–1000 m.", format: "Lanes, mass start.", origin: "Early 20th c.", gov: "ICF.", olympic: "Yes.", tags: ["aquatic", "paddle", "racing"] },
      { kind: "sport", name: "Canoe/kayak slalom", description: "Timed whitewater runs through gates.", objective: "Fastest time passing up/down gates without penalty.", format: "Whitewater course.", origin: "Mid-20th c.", gov: "ICF.", olympic: "Yes.", tags: ["aquatic", "paddle", "whitewater"] },
      { kind: "sport", name: "Sailing", description: "Wind-powered boat racing across classes.", objective: "Fastest or best-placed around the racecourse.", format: "Fleet, match, foiling classes.", origin: "Ancient; competitive 17th c.", gov: "World Sailing.", olympic: "Yes.", tags: ["aquatic", "wind", "tactical"] },
      { kind: "sport", name: "Water skiing", description: "Towed skiing across water.", objective: "Score in slalom, tricks, or jump.", format: "Boat-towed; cable variants.", origin: "USA, 1922.", gov: "IWWF.", olympic: "No (IOC-recognized).", tags: ["aquatic", "towed"] },
      { kind: "sport", name: "Dragon boat", description: "Long-boat paddling team race with a drummer.", objective: "Fastest crew, paddling in sync to the drum.", format: "10–20 paddlers + drummer + steerer.", origin: "China, ancient.", gov: "IDBF.", olympic: "No.", tags: ["aquatic", "team", "paddle"] },
    ],
  },
  {
    slug: "cycling",
    name: "Family 8 — Cycling",
    blurb: "Bicycle racing across road, track, and off-road disciplines.",
    color: "cyan",
    section: "D",
    entries: [
      { kind: "sport", name: "Road cycling", description: "Mass-start racing on open roads.", objective: "First across the line (road race) or fastest (time trial).", format: "Road races, ITT, stage races.", origin: "Late 19th c.", gov: "UCI.", olympic: "Yes.", tags: ["bike", "road", "endurance"] },
      { kind: "sport", name: "Track cycling", description: "Racing on a banked velodrome.", objective: "Win sprint or timed/points events on the boards.", format: "Sprint, keirin, pursuit, omnium, madison.", origin: "Late 19th c.", gov: "UCI.", olympic: "Yes.", tags: ["bike", "track", "velodrome"] },
      { kind: "sport", name: "Mountain biking (XCO)", description: "Off-road racing on rough terrain.", objective: "Fastest over a technical cross-country loop.", format: "Mass-start laps; also downhill, enduro.", origin: "USA, 1970s.", gov: "UCI.", olympic: "Yes.", tags: ["bike", "offroad"] },
      { kind: "sport", name: "BMX racing", description: "Sprint racing on a dirt jump track.", objective: "First to finish a short, jump-filled course.", format: "8-rider motos on a gated track.", origin: "USA, 1970s.", gov: "UCI.", olympic: "Yes.", tags: ["bike", "dirt", "sprint"] },
      { kind: "sport", name: "BMX freestyle", description: "Judged trick riding on parks/street.", objective: "Highest scores for difficulty/style/execution.", format: "Park runs, judged.", origin: "USA, 1980s.", gov: "UCI.", olympic: "Yes (since 2021).", lineage: "BMX racing → freestyle.", tags: ["bike", "tricks", "judged"] },
      { kind: "sport", name: "Cyclocross", description: "Off-road circuit racing with obstacles and dismounts.", objective: "Most laps/fastest on a muddy, barriered course.", format: "Timed laps in winter.", origin: "Early 20th c. Europe.", gov: "UCI.", olympic: "No.", tags: ["bike", "offroad", "winter"] },
      { kind: "sport", name: "Gravel cycling", description: "Long off-road racing on unpaved roads.", objective: "First/fastest over mixed-surface distance.", format: "Mass-start, long courses.", origin: "USA, 2010s.", gov: "UCI.", olympic: "No.", lineage: "Road/cyclocross → gravel.", tags: ["bike", "gravel", "endurance"] },
    ],
  },
  {
    slug: "winter-ice",
    name: "Family 9 — Winter & Ice Sports",
    blurb: "Snow and ice racing, judged, and sliding sports.",
    color: "violet",
    section: "D",
    entries: [
      { kind: "sport", name: "Alpine skiing", description: "Downhill racing through gates.", objective: "Fastest time down slalom/GS/super-G/downhill.", format: "Timed runs by discipline.", origin: "Alps, early 20th c.", gov: "FIS.", olympic: "Yes (Winter).", tags: ["snow", "racing", "gates"] },
      { kind: "sport", name: "Cross-country skiing", description: "Endurance skiing over varied terrain.", objective: "Fastest time, classic or skating technique.", format: "Sprints to 50 km, mass/interval start.", origin: "Ancient Scandinavia.", gov: "FIS.", olympic: "Yes (Winter).", tags: ["snow", "endurance", "nordic"] },
      { kind: "sport", name: "Freestyle skiing", description: "Judged/timed aerials, moguls, slopestyle, halfpipe, cross.", objective: "Highest scores or fastest (ski cross).", format: "Runs by event.", origin: "Late 20th c.", gov: "FIS.", olympic: "Yes (Winter).", tags: ["snow", "tricks", "judged"] },
      { kind: "sport", name: "Ski jumping", description: "Distance and style off a large jump.", objective: "Points from jump length plus judged style.", format: "Normal/large hill, team.", origin: "Norway, 19th c.", gov: "FIS.", olympic: "Yes (Winter).", tags: ["snow", "air", "judged"] },
      { kind: "sport", name: "Nordic combined", description: "Ski jumping plus cross-country in one event.", objective: "Jump score sets the start order for the pursuit race.", format: "Jump + XC race.", origin: "Norway, 19th c.", gov: "FIS.", olympic: "Yes (Winter).", tags: ["snow", "combined", "nordic"] },
      { kind: "sport", name: "Snowboarding", description: "Riding a single board down snow.", objective: "Highest trick scores (park) or fastest (cross/alpine).", format: "Halfpipe, slopestyle, big air, cross, parallel.", origin: "USA, 1960s–70s.", gov: "FIS.", olympic: "Yes (Winter, since 1998).", tags: ["snow", "board", "tricks"] },
      { kind: "sport", name: "Figure skating", description: "Judged artistic skating with jumps and spins.", objective: "Highest technical + program-component scores.", format: "Singles, pairs, ice dance, team.", origin: "18th–19th c.", gov: "ISU.", olympic: "Yes (Winter).", tags: ["ice", "judged", "artistic"] },
      { kind: "sport", name: "Speed skating", description: "Long-track timed racing on ice ovals.", objective: "Fastest time over 500–10000 m.", format: "Paired lanes, 400 m oval.", origin: "Netherlands, traditional.", gov: "ISU.", olympic: "Yes (Winter).", tags: ["ice", "racing"] },
      { kind: "sport", name: "Short track speed skating", description: "Pack racing on a small ice oval.", objective: "First to finish; tactical, contact-prone.", format: "Heats on a 111 m track.", origin: "20th c.", gov: "ISU.", olympic: "Yes (Winter).", lineage: "Speed skating → short track.", tags: ["ice", "racing", "pack"] },
      { kind: "sport", name: "Curling", description: "Strategic ice game sliding stones to a target.", objective: "Land more stones nearer the button than the opponent.", format: "Teams of 4, ends; sweeping steers stones.", origin: "Scotland, 16th c.", gov: "WCF.", olympic: "Yes (Winter).", tags: ["ice", "strategy", "precision"] },
      { kind: "sport", name: "Bobsled (bobsleigh)", description: "Crewed sled racing down an iced track.", objective: "Fastest time piloting a sled down the chute.", format: "2- or 4-person crews; monobob.", origin: "Switzerland, 1860s–1880s.", gov: "IBSF.", olympic: "Yes (Winter).", tags: ["ice", "sliding", "speed"] },
      { kind: "sport", name: "Luge", description: "Feet-first single/doubles sled racing.", objective: "Fastest time lying supine, feet-first.", format: "Singles/doubles, multiple runs.", origin: "Switzerland, 1880s.", gov: "FIL.", olympic: "Yes (Winter).", tags: ["ice", "sliding", "speed"] },
      { kind: "sport", name: "Skeleton", description: "Head-first solo sled racing.", objective: "Fastest time lying prone, head-first.", format: "Single rider, multiple runs.", origin: "St. Moritz, 1880s.", gov: "IBSF.", olympic: "Yes (Winter).", tags: ["ice", "sliding", "speed"] },
      { kind: "sport", name: "Biathlon", description: "Cross-country skiing plus rifle shooting.", objective: "Fastest time; missed shots add penalty time/loops.", format: "Ski legs interrupted by shooting bouts.", origin: "Nordic military patrol.", gov: "IBU.", olympic: "Yes (Winter).", tags: ["snow", "combined", "shooting"] },
    ],
  },
  {
    slug: "motorsports",
    name: "Family 10 — Motorsports",
    blurb: "Machine racing on circuits, tracks, and off-road; none are Olympic.",
    color: "slate",
    section: "D",
    entries: [
      { kind: "sport", name: "Formula 1", description: "Pinnacle open-wheel circuit racing.", objective: "Most championship points; win each Grand Prix.", format: "~20-car grid, ~305 km races.", origin: "World Championship from 1950.", gov: "FIA.", olympic: "No.", tags: ["motor", "open-wheel", "circuit"] },
      { kind: "sport", name: "IndyCar / open-wheel (US)", description: "American open-wheel racing on ovals and road courses.", objective: "Win races and the season title.", format: "Mixed ovals and circuits.", origin: "USA, early 20th c.", gov: "FIA/IndyCar.", olympic: "No.", lineage: "Open-wheel → IndyCar.", tags: ["motor", "open-wheel"] },
      { kind: "sport", name: "Rally (WRC)", description: "Stage racing against the clock on public roads.", objective: "Lowest cumulative stage time over a rally.", format: "Timed special stages, co-driver.", origin: "Early 20th c.", gov: "FIA.", olympic: "No.", tags: ["motor", "stage", "offroad"] },
      { kind: "sport", name: "Endurance racing (Le Mans / WEC)", description: "Long-distance sportscar racing.", objective: "Most distance/laps over fixed hours (e.g., 24 h).", format: "Driver crews, multi-class.", origin: "Le Mans 1923.", gov: "FIA/ACO.", olympic: "No.", tags: ["motor", "endurance", "sportscar"] },
      { kind: "sport", name: "Stock car (NASCAR)", description: "High-speed oval racing in stock-bodied cars.", objective: "Lead the most and finish first; season points.", format: "Large fields on ovals.", origin: "USA South, 1948.", gov: "NASCAR.", olympic: "No.", tags: ["motor", "oval", "american"] },
      { kind: "sport", name: "MotoGP / motorcycle GP", description: "Premier motorcycle circuit racing.", objective: "Win races and the riders' title.", format: "Prototype bikes, ~25-lap races.", origin: "FIM championship from 1949.", gov: "FIM.", olympic: "No.", tags: ["motor", "motorcycle", "circuit"] },
      { kind: "sport", name: "Karting", description: "Entry-level small-chassis circuit racing.", objective: "Fastest/first on tight kart circuits.", format: "Sprint and endurance classes.", origin: "USA, 1950s.", gov: "FIA/CIK.", olympic: "No.", tags: ["motor", "kart", "grassroots"] },
      { kind: "sport", name: "Drag racing", description: "Straight-line acceleration duels.", objective: "Fastest over a fixed straight (e.g., quarter-mile).", format: "Heads-up brackets.", origin: "USA, post-WWII.", gov: "NHRA/FIA.", olympic: "No.", tags: ["motor", "acceleration"] },
      { kind: "sport", name: "Motocross / supercross", description: "Off-road motorcycle racing on jumps and dirt.", objective: "First/most points over a dirt circuit.", format: "Motos on natural/stadium tracks.", origin: "UK/Europe, early-mid 20th c.", gov: "FIM.", olympic: "No.", tags: ["motor", "motorcycle", "dirt"] },
      { kind: "sport", name: "Formula E", description: "Electric open-wheel street racing.", objective: "Win races and the title; energy management matters.", format: "Battery cars on city circuits.", origin: "2014.", gov: "FIA.", olympic: "No.", lineage: "F1/open-wheel → Formula E.", tags: ["motor", "electric", "street"] },
    ],
  },
  {
    slug: "gymnastics-acrobatic",
    name: "Family 11 — Gymnastics & Acrobatic",
    blurb: "Judged whole-body acrobatic and movement disciplines under FIG.",
    color: "green",
    section: "D",
    entries: [
      { kind: "sport", name: "Artistic gymnastics", description: "Apparatus-based acrobatic competition.", objective: "Highest difficulty + execution scores per apparatus.", format: "Men 6 apparatus, women 4.", origin: "Modern Germany, early 19th c. (Jahn).", gov: "FIG.", olympic: "Yes.", tags: ["gymnastics", "judged", "apparatus"] },
      { kind: "sport", name: "Rhythmic gymnastics", description: "Apparatus-and-dance routines (women).", objective: "Highest scores with hoop, ball, clubs, ribbon.", format: "Individual and group routines.", origin: "Early-mid 20th c.", gov: "FIG.", olympic: "Yes.", tags: ["gymnastics", "judged", "dance"] },
      { kind: "sport", name: "Trampoline", description: "Judged aerial routines on a trampoline.", objective: "Highest difficulty/execution/time-of-flight scores.", format: "10-skill routines.", origin: "USA, 1930s.", gov: "FIG.", olympic: "Yes (since 2000).", tags: ["gymnastics", "air", "judged"] },
      { kind: "sport", name: "Power tumbling", description: "Explosive acrobatic passes on a sprung track.", objective: "Highest difficulty/execution over a fast tumbling run.", format: "Timed passes, judged.", origin: "20th c.", gov: "FIG.", olympic: "No.", lineage: "Artistic gymnastics → tumbling.", tags: ["gymnastics", "acrobatic"] },
      { kind: "sport", name: "Acrobatic gymnastics", description: "Partner balance-and-throw routines.", objective: "Highest scores for balance, dynamic, combined routines.", format: "Pairs/groups, judged.", origin: "20th c. (USSR).", gov: "FIG.", olympic: "No.", tags: ["gymnastics", "partner", "judged"] },
      { kind: "sport", name: "Aerobic gymnastics", description: "High-intensity choreographed routines.", objective: "Highest scores for complex aerobic patterns to music.", format: "Solo/pair/group, judged.", origin: "Late 20th c.", gov: "FIG.", olympic: "No.", tags: ["gymnastics", "fitness", "judged"] },
      { kind: "sport", name: "Parkour", description: "Efficient movement over urban/obstacle terrain.", objective: "Speed runs or judged freestyle over obstacles.", format: "Speed and freestyle formats.", origin: "France, 1980s–90s.", gov: "FIG (contested by community).", olympic: "No.", tags: ["movement", "obstacle", "urban"] },
    ],
  },
  {
    slug: "action-extreme",
    name: "Family 12 — Action & Extreme Sports",
    blurb: "Risk- and trick-oriented sports, many lifestyle-rooted.",
    color: "pink",
    section: "D",
    entries: [
      { kind: "sport", name: "Skateboarding", description: "Trick riding on a skateboard.", objective: "Highest trick scores in street or park runs.", format: "Judged runs/best-trick.", origin: "California, 1950s–60s.", gov: "World Skate.", olympic: "Yes (since 2021).", tags: ["board", "tricks", "judged"] },
      { kind: "sport", name: "Surfing", description: "Riding ocean waves on a board.", objective: "Highest scores for waves ridden in a heat.", format: "Judged heats, shortboard.", origin: "Ancient Polynesia/Hawaii.", gov: "ISA.", olympic: "Yes (since 2021).", tags: ["board", "wave", "judged"] },
      { kind: "sport", name: "Sport climbing", description: "Competitive climbing across formats.", objective: "Climb hardest/fastest in lead, bouldering, speed.", format: "Lead, boulder, speed (combined).", origin: "Late 20th c.", gov: "IFSC.", olympic: "Yes (since 2021).", tags: ["climbing", "wall", "strength"] },
      { kind: "sport", name: "Mountaineering", description: "Ascending peaks and high routes.", objective: "Summit safely; by fair means ethics, not scored.", format: "Expeditions, alpine/expedition style.", origin: "Alps, 18th–19th c.", gov: "UIAA.", olympic: "No.", tags: ["climbing", "altitude", "expedition"] },
      { kind: "sport", name: "Skydiving / parachuting", description: "Aerial freefall and canopy disciplines.", objective: "Accuracy, formation, freefly, or canopy performance.", format: "Judged/competitive sub-disciplines.", origin: "20th c.", gov: "FAI.", olympic: "No.", tags: ["air", "freefall"] },
      { kind: "sport", name: "Freediving", description: "Breath-hold diving for depth/distance/time.", objective: "Greatest depth, distance, or static apnea on one breath.", format: "Depth and pool disciplines.", origin: "Ancient; competitive 20th c.", gov: "AIDA / CMAS.", olympic: "No.", tags: ["aquatic", "apnea", "depth"] },
      { kind: "sport", name: "Wingsuit / BASE jumping", description: "Low-altitude flight from fixed objects.", objective: "Controlled flight/accuracy; events judge proximity/precision.", format: "Exhibition and judged events.", origin: "Late 20th c.", gov: "FAI (BASE largely self-governed).", olympic: "No.", lineage: "Skydiving → wingsuit/BASE.", tags: ["air", "risk"] },
      { kind: "sport", name: "Wakeboarding", description: "Towed board riding with jumps and tricks.", objective: "Highest trick scores behind a boat/cable.", format: "Judged runs.", origin: "USA, 1980s.", gov: "IWWF.", olympic: "No.", lineage: "Water skiing/surfing → wakeboarding.", tags: ["board", "towed", "tricks"] },
      { kind: "sport", name: "Kitesurfing (kiteboarding)", description: "Wind-powered board riding via a kite.", objective: "Fastest (Formula Kite racing) or highest-scoring freestyle/big-air.", format: "Racing and freestyle.", origin: "Late 20th c.", gov: "World Sailing (Formula Kite) / GKA.", olympic: "Yes (Formula Kite, since 2024).", tags: ["board", "wind"] },
      { kind: "sport", name: "Slacklining", description: "Balancing/tricks on a tensioned webbing line.", objective: "Tricklining scores or longest/highest (highline) crossings.", format: "Trickline, longline, highline.", origin: "Climbing culture, 1980s.", gov: "ISA (slackline).", olympic: "No.", tags: ["balance", "niche"] },
    ],
  },

  // ── SECTION E ─────────────────────────────────────────────────────────────
  {
    slug: "target-precision",
    name: "Family 13 — Target & Precision Sports",
    blurb: "Aim, control, and consistency — from arrows to bowls to billiards.",
    color: "yellow",
    section: "E",
    entries: [
      { kind: "sport", name: "Archery", description: "Shooting arrows at a target.", objective: "Most points hitting the target's gold center.", format: "Recurve (Olympic), compound; 70 m.", origin: "Ancient.", gov: "World Archery.", olympic: "Yes.", tags: ["precision", "aim", "target"] },
      { kind: "sport", name: "Rifle shooting", description: "Precision shooting with rifles.", objective: "Highest aggregate score on the target rings.", format: "10 m air, 50 m positions.", origin: "19th c.", gov: "ISSF.", olympic: "Yes.", tags: ["precision", "firearm", "target"] },
      { kind: "sport", name: "Pistol shooting", description: "Precision and rapid-fire pistol events.", objective: "Highest score; some events reward speed + accuracy.", format: "10 m air, 25 m rapid.", origin: "19th c.", gov: "ISSF.", olympic: "Yes.", tags: ["precision", "firearm"] },
      { kind: "sport", name: "Shotgun (clay target) shooting", description: "Shooting flying clay targets.", objective: "Break the most clays in trap/skeet.", format: "Trap, skeet.", origin: "19th c.", gov: "ISSF.", olympic: "Yes.", tags: ["precision", "firearm", "moving-target"] },
      { kind: "sport", name: "Darts", description: "Throwing darts at a numbered board.", objective: "Reduce a score (e.g., 501) to exactly zero on a double.", format: "Legs and sets.", origin: "England, late 19th c.", gov: "WDF / PDC.", olympic: "No.", tags: ["precision", "pub", "throwing"] },
      { kind: "sport", name: "Ten-pin bowling", description: "Rolling a ball to knock down pins.", objective: "Knock down all 10 pins per frame; strikes and spares.", format: "10 frames.", origin: "USA, 19th c.", gov: "International Bowling Federation.", olympic: "No.", tags: ["precision", "pins", "indoor"] },
      { kind: "sport", name: "Lawn bowls", description: "Rolling biased bowls toward a target jack.", objective: "Finish bowls nearer the jack than the opponent.", format: "Singles to fours; ends.", origin: "England, medieval.", gov: "World Bowls.", olympic: "No (Commonwealth Games staple).", tags: ["precision", "green", "strategy"] },
      { kind: "sport", name: "Snooker", description: "Cue sport on a large table with 22 balls.", objective: "Score more by potting reds then colours in sequence.", format: "Frames, best-of-N.", origin: "British India, 1870s.", gov: "WPBSA.", olympic: "No.", lineage: "Billiards → snooker.", tags: ["cue", "precision", "strategy"] },
      { kind: "sport", name: "Pool (pocket billiards)", description: "Cue games on smaller pocketed tables.", objective: "Pot object balls then the 8/9-ball per game.", format: "8-ball, 9-ball, 10-ball.", origin: "19th–20th c.", gov: "WPA.", olympic: "No.", lineage: "Billiards → pool.", tags: ["cue", "precision"] },
      { kind: "sport", name: "Carom billiards", description: "Pocketless cue game scoring by caroms.", objective: "Strike both object balls in one shot.", format: "Three-cushion and variants.", origin: "18th–19th c. Europe.", gov: "UMB.", olympic: "No.", lineage: "Billiards → carom.", tags: ["cue", "precision"] },
      { kind: "sport", name: "Golf", description: "Striking a ball into holes in fewest strokes.", objective: "Complete the course in fewest strokes (or win holes in match play).", format: "18 holes, stroke/match play.", origin: "Scotland, 15th c.", gov: "IGF (Olympic); R&A/USGA rules.", olympic: "Yes (since 2016).", tags: ["precision", "course", "outdoor"] },
      { kind: "sport", name: "Petanque", description: "French boules game tossing balls near a jack.", objective: "Place boules closest to the cochonnet; feet still.", format: "Singles/doubles/triples.", origin: "France, 1907 (Provence).", gov: "FIPJP.", olympic: "No.", lineage: "Boules → petanque.", tags: ["precision", "boules"] },
      { kind: "sport", name: "Bocce", description: "Italian boules game on a court.", objective: "Roll/throw balls closest to the pallino.", format: "Teams; court or open ground.", origin: "Italy, ancient roots.", gov: "Confederation Mondiale (CBI).", olympic: "No.", tags: ["precision", "boules"] },
      { kind: "sport", name: "Croquet", description: "Mallet game driving balls through hoops.", objective: "Run the hoops in order before the opponent.", format: "Association and golf croquet.", origin: "England/Ireland, 19th c.", gov: "World Croquet Federation.", olympic: "Former (1900).", tags: ["precision", "mallet", "lawn"] },
    ],
  },
  {
    slug: "strength",
    name: "Family 14 — Strength Sports",
    blurb: "Maximal-force contests across barbell, implement, and physique disciplines.",
    color: "rose",
    section: "E",
    entries: [
      { kind: "sport", name: "Olympic weightlifting", description: "Two-lift maximal barbell sport.", objective: "Lift the most total weight in snatch + clean and jerk.", format: "Three attempts per lift, by bodyweight class.", origin: "Ancient; modern 19th c.", gov: "IWF.", olympic: "Yes (re-included for LA28).", tags: ["strength", "barbell", "olympic"] },
      { kind: "sport", name: "Powerlifting", description: "Three-lift maximal strength sport.", objective: "Highest total in squat, bench press, deadlift.", format: "Three attempts each, by class.", origin: "USA/UK, mid-20th c.", gov: "IPF.", olympic: "No (Paralympic powerlifting exists).", lineage: "Weightlifting → powerlifting.", tags: ["strength", "barbell"] },
      { kind: "sport", name: "Strongman", description: "Varied heavy-implement strength events.", objective: "Most points across stones, yokes, log press, carries, etc.", format: "Multi-event contests.", origin: "Old-time strongmen; modern 1977.", gov: "Multiple promotions (no single body).", olympic: "No.", tags: ["strength", "events", "power"] },
      { kind: "sport", name: "Bodybuilding", description: "Judged muscular development and posing (contested as a sport).", objective: "Highest scores for muscularity, symmetry, conditioning.", format: "Judged rounds, posing routine.", origin: "Late 19th–20th c. (Eugen Sandow).", gov: "IFBB.", olympic: "No.", tags: ["physique", "judged", "contested"] },
      { kind: "sport", name: "Highland games (heavy events)", description: "Scottish strength contests.", objective: "Greatest distance/height in caber, stone, hammer, weights.", format: "Traditional implement events.", origin: "Scotland, traditional.", gov: "Regional associations.", olympic: "No.", tags: ["strength", "heritage", "throwing"] },
      { kind: "sport", name: "Arm wrestling", description: "One-on-one tabletop strength duel.", objective: "Pin the opponent's hand to the pad.", format: "Matches by hand/weight class.", origin: "Traditional; organized 1950s+.", gov: "WAF.", olympic: "No.", tags: ["strength", "duel"] },
    ],
  },
  {
    slug: "equestrian-animal",
    name: "Family 15 — Equestrian & Animal Sports",
    blurb: "Sports decided in partnership with — or contesting — animals.",
    color: "emerald",
    section: "E",
    entries: [
      { kind: "sport", name: "Dressage", description: "Judged precision horse-and-rider movements.", objective: "Highest scores for accuracy and harmony of set movements.", format: "Tests in an arena.", origin: "Classical riding traditions.", gov: "FEI.", olympic: "Yes.", tags: ["equestrian", "judged", "precision"] },
      { kind: "sport", name: "Show jumping", description: "Clearing fences against the clock.", objective: "Clear obstacles with fewest faults; fastest in jump-offs.", format: "Timed rounds over a course.", origin: "19th c.", gov: "FEI.", olympic: "Yes.", tags: ["equestrian", "jumping"] },
      { kind: "sport", name: "Eventing", description: "Three-phase equestrian triathlon.", objective: "Lowest combined penalties in dressage, cross-country, jumping.", format: "Multi-day three-test.", origin: "Military origins.", gov: "FEI.", olympic: "Yes.", tags: ["equestrian", "combined"] },
      { kind: "sport", name: "Flat horse racing", description: "Speed racing of horses on a level course.", objective: "First horse past the post.", format: "Sprints to staying distances.", origin: "Ancient; organized 17th–18th c. England.", gov: "National bodies (IFHA intl.).", olympic: "No.", tags: ["equestrian", "racing", "betting"] },
      { kind: "sport", name: "Harness racing", description: "Trotting/pacing while pulling a sulky.", objective: "Fastest while maintaining a legal gait.", format: "Standardbreds with sulkies.", origin: "19th-c. North America/Europe.", gov: "National bodies.", olympic: "No.", lineage: "Horse racing → harness.", tags: ["equestrian", "racing", "gait"] },
      { kind: "sport", name: "Rodeo", description: "Ranch-skill timed and judged events.", objective: "Score on roughstock rides or post fastest time (roping/barrels).", format: "Multiple events.", origin: "North American ranching, 19th c.", gov: "PRCA and others.", olympic: "No.", tags: ["animal", "ranch", "western"] },
      { kind: "sport", name: "Greyhound racing", description: "Dogs chasing a lure around a track.", objective: "First dog to finish (welfare-contested in many regions).", format: "Oval track sprints.", origin: "USA/UK, 1920s.", gov: "National bodies.", olympic: "No.", tags: ["animal", "racing", "contested"] },
      { kind: "sport", name: "Endurance riding", description: "Long-distance horse racing over terrain.", objective: "Finish first while passing veterinary fitness checks.", format: "40–160 km routes with vet gates.", origin: "20th c. (US cavalry tests).", gov: "FEI.", olympic: "No.", tags: ["equestrian", "endurance"] },
    ],
  },
  {
    slug: "mind-emerging",
    name: "Family 16 — Mind & Emerging Sports",
    blurb: "Cognitive contests and new-form competitions whose sport status is debated.",
    color: "purple",
    section: "E",
    entries: [
      { kind: "sport", name: "Chess", description: "Strategic board game of perfect information (sport status debated).", objective: "Checkmate the opponent's king.", format: "Classical/rapid/blitz; clocks.", origin: "India ~6th c. (chaturanga) through Persia to Europe.", gov: "FIDE.", olympic: "No (IOC-recognized; not on program).", tags: ["mind", "strategy", "contested"] },
      { kind: "sport", name: "Esports", description: "Organized competitive video gaming (sport status debated).", objective: "Win the match within each game's victory rules.", format: "Title-specific leagues and tournaments.", origin: "Late 20th c.; pro boom 2010s.", gov: "IESF / publishers.", olympic: "No (Olympic Esports Games initiative ongoing) [verify].", tags: ["digital", "competitive", "contested"] },
      { kind: "sport", name: "Poker", description: "Card game of incomplete information and wagering (skill-vs-luck and sport status debated).", objective: "Win chips via best hand or forcing folds.", format: "Tournament and cash; many variants.", origin: "USA, 19th c.", gov: "No single body.", olympic: "No.", tags: ["cards", "wagering", "contested"] },
      { kind: "sport", name: "Drone racing", description: "First-person-view racing of quadcopters.", objective: "Fastest pilot through a 3D gated course.", format: "Heats via FPV goggles.", origin: "2010s.", gov: "Multiple leagues (e.g., DRL).", olympic: "No.", tags: ["digital", "racing", "emerging"] },
      { kind: "sport", name: "Contract bridge", description: "Partnership trick-taking card game (IOC-recognized; sport status debated).", objective: "Bid and make contracts, scoring more than opponents.", format: "Duplicate pairs/teams.", origin: "Early 20th c. (from whist).", gov: "WBF.", olympic: "No (IOC-recognized).", tags: ["cards", "partnership", "mind"] },
      { kind: "sport", name: "Go (weiqi/baduk)", description: "Ancient territory-capture board game.", objective: "Control more board territory than the opponent.", format: "19x19 board, handicaps, clocks.", origin: "China, ancient (2500+ years).", gov: "International Go Federation.", olympic: "No.", tags: ["mind", "strategy", "ancient"] },
    ],
  },

  // ── SECTION F ─────────────────────────────────────────────────────────────
  {
    slug: "exercise-physiology",
    name: "Family 17 — Exercise Physiology",
    blurb: "How the body produces and sustains athletic work.",
    color: "gray",
    section: "F",
    entries: [
      { kind: "science", name: "VO2 max", description: "The ceiling of aerobic power.", keyInsight: "Maximal oxygen uptake (mL/kg/min) caps sustainable aerobic output; trainable but partly genetic.", tags: ["physiology", "aerobic", "endurance"] },
      { kind: "science", name: "Aerobic energy system", description: "Oxygen-fueled, sustainable ATP production.", keyInsight: "Oxidative phosphorylation supplies near-limitless ATP at low-to-moderate intensity but is rate-limited by oxygen delivery.", tags: ["physiology", "endurance"] },
      { kind: "science", name: "Anaerobic energy systems", description: "Fast ATP without oxygen.", keyInsight: "The ATP-PC and glycolytic systems power short, intense efforts but fatigue fast and accrue metabolic byproducts.", tags: ["physiology", "power"] },
      { kind: "science", name: "Lactate (anaerobic) threshold", description: "The intensity where lactate accumulates.", keyInsight: "The workload above which blood lactate rises sharply marks the limit of comfortably sustainable pace; a key endurance predictor.", tags: ["physiology", "threshold"] },
      { kind: "science", name: "EPOC (oxygen debt)", description: "Elevated post-exercise oxygen use.", keyInsight: "After hard effort the body keeps consuming extra oxygen to restore ATP/PC, clear lactate, and re-balance — the afterburn.", tags: ["physiology", "recovery"] },
      { kind: "science", name: "Muscle fiber types", description: "Slow- vs fast-twitch architecture.", keyInsight: "Type I fibers favor endurance/fatigue resistance; Type II favor force/speed but fatigue quickly; the mix shapes athletic aptitude.", tags: ["physiology", "muscle"] },
      { kind: "science", name: "Cardiac output", description: "Blood the heart pumps per minute.", keyInsight: "Output = heart rate x stroke volume; endurance training raises stroke volume, boosting oxygen delivery.", tags: ["physiology", "cardiovascular"] },
      { kind: "science", name: "Oxygen transport (hemoglobin)", description: "Carrying oxygen to working muscle.", keyInsight: "Hemoglobin mass and the oxygen dissociation curve set how much oxygen reaches tissue — why altitude and (illicitly) EPO matter.", tags: ["physiology", "blood"] },
      { kind: "science", name: "Thermoregulation", description: "Managing heat during exertion.", keyInsight: "Sweating and blood-flow redistribution dump heat; failure risks hyperthermia, making hydration and pacing performance-critical.", tags: ["physiology", "heat"] },
    ],
  },
  {
    slug: "biomechanics",
    name: "Family 18 — Biomechanics",
    blurb: "The mechanics of athletic motion — forces, levers, and trajectories.",
    color: "zinc",
    section: "F",
    entries: [
      { kind: "science", name: "Kinematics", description: "Describing motion without forces.", keyInsight: "Position, velocity, and acceleration characterize a movement's geometry — the basis of technique analysis.", tags: ["biomechanics", "motion"] },
      { kind: "science", name: "Kinetics", description: "The forces that cause motion.", keyInsight: "Newton's laws relate force, mass, and acceleration; net force/torque drives every athletic action.", tags: ["biomechanics", "force"] },
      { kind: "science", name: "Ground reaction force (GRF)", description: "The ground's push back on the athlete.", keyInsight: "By Newton's third law the ground returns the force you apply; magnitude/direction/timing govern sprinting and jumping.", tags: ["biomechanics", "force"] },
      { kind: "science", name: "Levers and moment arms", description: "The body as a system of levers.", keyInsight: "Torque = force x moment arm; limb geometry trades force for speed/range, explaining technique choices.", tags: ["biomechanics", "leverage"] },
      { kind: "science", name: "Aerodynamic and fluid drag", description: "Resistance from air or water.", keyInsight: "Drag scales with roughly the square of speed, so positioning/equipment to cut drag yields outsized gains in fast sports.", tags: ["biomechanics", "drag"] },
      { kind: "science", name: "Projectile motion", description: "Flight paths of bodies and implements.", keyInsight: "Release speed, angle, and height set the range of a jump or throw under gravity (ignoring drag).", tags: ["biomechanics", "flight"] },
      { kind: "science", name: "Center of mass and balance", description: "The body's effective mass point.", keyInsight: "Stability depends on keeping the center of mass over the base of support; athletes manipulate it to balance, turn, and clear bars.", tags: ["biomechanics", "balance"] },
      { kind: "science", name: "Angular momentum and rotation", description: "Spinning and somersaulting.", keyInsight: "Angular momentum is conserved in the air; tucking reduces the moment of inertia and speeds rotation — the diver's/gymnast's trick.", tags: ["biomechanics", "rotation"] },
      { kind: "science", name: "Stretch-shortening cycle", description: "Elastic pre-loading of muscle-tendon.", keyInsight: "A rapid eccentric stretch stores elastic energy that amplifies the following concentric action — the basis of plyometric power.", tags: ["biomechanics", "elastic"] },
    ],
  },
  {
    slug: "training-methodology",
    name: "Family 19 — Training Methodology",
    blurb: "Structuring effort, recovery, and peaking for performance.",
    color: "stone",
    section: "F",
    entries: [
      { kind: "science", name: "Periodization", description: "Structuring training in planned cycles.", keyInsight: "Organizing macro/meso/microcycles times fitness peaks and manages fatigue toward target competitions.", tags: ["training", "planning"] },
      { kind: "science", name: "Progressive overload", description: "Gradually increasing demand.", keyInsight: "Tissues adapt only to loads beyond habitual; systematic increases in volume/intensity drive continued gains.", tags: ["training", "overload"] },
      { kind: "science", name: "Specificity (SAID principle)", description: "Adaptation matches the stimulus.", keyInsight: "Specific Adaptation to Imposed Demands — train the energy systems, movements, and speeds the sport requires.", tags: ["training", "specificity"] },
      { kind: "science", name: "Supercompensation", description: "Rebounding above baseline after recovery.", keyInsight: "A stressor dips fitness, then recovery overshoots baseline; training the next stimulus at the peak builds fitness over time.", tags: ["training", "recovery"] },
      { kind: "science", name: "HIIT (high-intensity interval training)", description: "Alternating hard efforts and recovery.", keyInsight: "Short maximal efforts with rest produce VO2 max and anaerobic adaptations faster than steady-state in less total time.", tags: ["training", "intervals"] },
      { kind: "science", name: "Tapering", description: "Reducing load before competition.", keyInsight: "Cutting volume while maintaining intensity for 1–3 weeks before a peak event lets accumulated fatigue dissipate and form peak.", tags: ["training", "peaking"] },
      { kind: "science", name: "Plyometrics", description: "Jump/bound training for explosive power.", keyInsight: "Rapid stretch-shortening cycles train the neuromuscular system to generate force faster, improving rate of force development.", tags: ["training", "power"] },
      { kind: "science", name: "Recovery and regeneration", description: "Managing fatigue between sessions.", keyInsight: "Adaptation happens during recovery, not training; sleep, nutrition, and load management are performance levers.", tags: ["training", "recovery"] },
      { kind: "science", name: "Relative Energy Deficiency in Sport (RED-S)", description: "Under-fueling in athletes.", keyInsight: "Chronically inadequate caloric intake relative to expenditure impairs hormones, bone density, and performance across all systems.", tags: ["training", "nutrition", "health"] },
    ],
  },
];

const ALL_SLUGS = FAMILIES.map(f => f.slug);

function entryMatches(entry: Entry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.description.toLowerCase().includes(q)) return true;
  if (entry.tags.some(t => t.toLowerCase().includes(q))) return true;
  if (entry.kind === "sport") {
    if (entry.objective.toLowerCase().includes(q)) return true;
    if (entry.format.toLowerCase().includes(q)) return true;
    if (entry.origin.toLowerCase().includes(q)) return true;
    if (entry.gov.toLowerCase().includes(q)) return true;
    if (entry.olympic.toLowerCase().includes(q)) return true;
    if (entry.lineage && entry.lineage.toLowerCase().includes(q)) return true;
  } else {
    if (entry.keyInsight.toLowerCase().includes(q)) return true;
  }
  return false;
}

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`|\[verify\])/g);
  return parts.map((p, i) => {
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code
          key={i}
          className="font-mono text-[11px] bg-gray-800/70 px-1 py-0.5 rounded text-gray-100"
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    if (p === "[verify]") {
      return (
        <span
          key={i}
          className="font-mono text-[10px] px-1 py-0.5 rounded bg-yellow-900/40 text-yellow-300 ml-1"
        >
          verify
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function tagHref(tag: string): string | null {
  if (tag === "xref:statistics") return "/statistics";
  if (tag === "xref:finance") return "/finance";
  return null;
}

export default function SportsPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return FAMILIES.map(f => ({
      ...f,
      entries: f.entries.filter(e => entryMatches(e, query)),
    })).filter(f => f.entries.length > 0);
  }, [query]);

  const totalEntries = FAMILIES.reduce((s, f) => s + f.entries.length, 0);
  const matchCount = filtered.reduce((s, f) => s + f.entries.length, 0);

  const toggleFamily = (slug: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleExpand = (key: string) => {
    setExpanded(prev => (prev === key ? null : key));
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(ALL_SLUGS));

  const filteredBySection = SECTIONS.map(s => ({
    section: s,
    families: filtered.filter(f => f.section === s.key),
  })).filter(g => g.families.length > 0);

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Sports &amp; Sport Science</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to the world&apos;s sports and the science of human performance —
          cross-linked to the claims database. Sections A–E catalog the sports themselves
          by family; Section F covers the underlying physiology, biomechanics, and training
          methodology. Click any card for the objective, format, origin, governing body,
          and Olympic status (or, for science entries, the key insight). Color codes the
          family; clicking a header collapses its section.
        </p>
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">
          Cross-references to the{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">
            statistics taxonomy
          </Link>{" "}
          and{" "}
          <Link href="/finance" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">
            finance taxonomy
          </Link>{" "}
          are noted via <span className="font-mono text-gray-400">xref:</span> tags where concepts overlap.
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {SECTIONS.length} sections · {FAMILIES.length} families · {totalEntries} entries
          {query && (
            <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>
          )}
        </p>
      </div>

      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by name, tag, governing body, origin… e.g. 'olympic', 'endurance', 'LA28'"
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        <div className="flex gap-2 text-xs">
          <button
            onClick={expandAll}
            className="px-3 py-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            Collapse all
          </button>
          {query && (
            <button
              onClick={() => setQuery("")}
              className="px-3 py-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {filteredBySection.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">
          No entries match &ldquo;{query}&rdquo;. Try a broader term.
        </p>
      ) : (
        <div className="space-y-10">
          {filteredBySection.map(({ section, families }) => (
            <div key={section.key} className="space-y-5">
              <div className="border-b border-gray-800/60 pb-2">
                <h2 className="text-lg font-semibold text-gray-200">{section.title}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{section.blurb}</p>
              </div>
              {families.map(family => {
                const c = COLOR_STYLES[family.color];
                const isCollapsed = collapsed.has(family.slug);
                const entryLabel = family.entries[0]?.kind === "science" ? "concept" : "sport";
                const entryLabelPlural = family.entries[0]?.kind === "science" ? "concepts" : "sports";
                return (
                  <section
                    key={family.slug}
                    className={`rounded-lg border ${c.headerBorder} overflow-hidden`}
                  >
                    <button
                      onClick={() => toggleFamily(family.slug)}
                      className={`w-full text-left px-5 py-3 ${c.headerBg} hover:brightness-125 transition-all flex items-baseline justify-between gap-4`}
                    >
                      <div className="min-w-0">
                        <h3 className={`text-base font-semibold ${c.headerText}`}>
                          {family.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-gray-500">{family.blurb}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-mono ${c.accent}`}>
                          {family.entries.length} {family.entries.length === 1 ? entryLabel : entryLabelPlural}
                        </span>
                        <span className={`text-xs ${c.accent}`}>
                          {isCollapsed ? "▸" : "▾"}
                        </span>
                      </div>
                    </button>
                    {!isCollapsed && (
                      <div className="bg-gray-950/40 p-4 grid gap-3 sm:grid-cols-2">
                        {family.entries.map(entry => {
                          const key = `${family.slug}::${entry.name}`;
                          const isExpanded = expanded === key;
                          return (
                            <div
                              key={entry.name}
                              role="button"
                              tabIndex={0}
                              aria-expanded={isExpanded}
                              onClick={() => toggleExpand(key)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleExpand(key);
                                }
                              }}
                              className={`block rounded border ${c.cardBorder} ${
                                isExpanded ? "border-gray-600" : c.cardHover
                              } bg-gray-900/40 px-4 py-3 transition-colors group cursor-pointer focus:outline-none focus:border-gray-500 sm:col-span-1 ${
                                isExpanded ? "sm:col-span-2" : ""
                              }`}
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <h4 className="text-sm font-semibold text-white group-hover:text-gray-100">
                                  {entry.name}
                                </h4>
                                <Link
                                  href={`/search?q=${encodeURIComponent(entry.name)}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`text-[10px] font-mono ${c.accent} opacity-60 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:underline`}
                                >
                                  search →
                                </Link>
                              </div>
                              <p className="mt-1 text-xs text-gray-400 leading-snug">
                                {entry.description}
                              </p>
                              {entry.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {entry.tags.map(tag => {
                                    const href = tagHref(tag);
                                    if (href) {
                                      return (
                                        <Link
                                          key={tag}
                                          href={href}
                                          onClick={(e) => e.stopPropagation()}
                                          className={`text-[10px] px-1.5 py-0.5 rounded ${c.chipBg} ${c.chipText} font-mono hover:underline`}
                                        >
                                          {tag}
                                        </Link>
                                      );
                                    }
                                    return (
                                      <span
                                        key={tag}
                                        className={`text-[10px] px-1.5 py-0.5 rounded ${c.chipBg} ${c.chipText} font-mono`}
                                      >
                                        {tag}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                              {isExpanded && (
                                <div className="mt-3 pt-3 -mx-4 -mb-3 px-4 pb-4 border-t border-gray-700/70 bg-gray-900/80 rounded-b space-y-3">
                                  {entry.kind === "sport" ? (
                                    <>
                                      <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-500">
                                          Objective
                                        </p>
                                        <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                                          {renderInline(entry.objective)}
                                        </p>
                                      </div>
                                      <div className="grid sm:grid-cols-2 gap-3">
                                        <div>
                                          <p className="text-[10px] uppercase tracking-widest text-gray-500">
                                            Format
                                          </p>
                                          <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                                            {renderInline(entry.format)}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] uppercase tracking-widest text-gray-500">
                                            Origin
                                          </p>
                                          <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                                            {renderInline(entry.origin)}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] uppercase tracking-widest text-gray-500">
                                            Governing body
                                          </p>
                                          <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                                            {renderInline(entry.gov)}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] uppercase tracking-widest text-gray-500">
                                            Olympic
                                          </p>
                                          <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                                            {renderInline(entry.olympic)}
                                          </p>
                                        </div>
                                      </div>
                                      {entry.lineage && (
                                        <div>
                                          <p className="text-[10px] uppercase tracking-widest text-gray-500">
                                            Lineage
                                          </p>
                                          <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                                            {renderInline(entry.lineage)}
                                          </p>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div>
                                      <p className="text-[10px] uppercase tracking-widest text-gray-500">
                                        Key insight
                                      </p>
                                      <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                                        {renderInline(entry.keyInsight)}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-gray-800 pt-6 mt-12 space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Note:</span> the <span className="font-mono">search →</span>{" "}
          link on each card runs a free-text match over claim + source text; precision varies — an
          entry appearing in a claim does not mean the claim is <em>about</em> that sport or concept,
          only that the term is present. Cross-references to the{" "}
          <Link href="/statistics" className="text-gray-400 hover:text-gray-300 underline underline-offset-2">statistics taxonomy</Link> and{" "}
          <Link href="/finance" className="text-gray-400 hover:text-gray-300 underline underline-offset-2">finance taxonomy</Link>{" "}
          are marked with &ldquo;xref:&rdquo; tags. Claim cross-references to specific Epistemic
          Receipts entries are pending — a claim-powered explorer linking sports/science concepts to
          the receipts that apply them is on the roadmap.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated June 2026 (last updated: June 2026) · {SECTIONS.length} sections ·{" "}
          {FAMILIES.length} families · {totalEntries} entries
        </p>
      </div>
    </div>
  );
}
