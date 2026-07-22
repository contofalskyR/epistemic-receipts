// Curated homepage trajectory slides — shared by HomeCarousel (the hero card
// deck) and HomeSurvivalFig (the Fig. 1 animation exemplars). Editorial
// constants: every entry summarizes a curated trajectory that exists on the
// site; `short` is the 3–6 word label the Fig. 1 pop-ups can render legibly.

export type Pt = [number, number]; // [x%, y%] — y: 0 = top (settled), 100 = bottom (reversed)

export type Slide = {
  tag: string; // editorial label: "THE REVERSAL" | "THE SETTLEMENT" | "THE CONTESTED"
  initialAxis: string; // actual epistemic axis at start of shown range
  finalAxis: string; // actual epistemic axis at end of shown range
  range: string;
  milestones: number;
  short: string; // compact label for Fig. 1 exemplar cards
  text: string;
  href: string;
  pts: Pt[];
  startYear: string;
  endYear: string;
};

export const SLIDES: Slide[] = [
  {
    tag: "THE REVERSAL",
    initialAxis: "SETTLED",
    finalAxis: "REVERSED",
    range: "1903 → 1962",
    milestones: 3,
    short: "Giles v. Harris",
    text: "In Giles v. Harris (189 U.S. 475), decided 27 April 1903, the U.S. Supreme Court declined to order Alabama to register Black voters disenfranchised under the state's 1901 constitution, holding that federal equity courts would not supervise state voting and that relief from such 'political wrongs' must come from the political branches.",
    href: "/reversals",
    pts: [[0, 8], [30, 10], [55, 14], [70, 45], [85, 72], [100, 86]],
    startYear: "1903",
    endYear: "1962",
  },
  {
    tag: "THE SETTLEMENT",
    initialAxis: "RECORDED",
    finalAxis: "SETTLED",
    range: "1900 → 2004",
    milestones: 3,
    short: "The Paquete Habana",
    text: "The U.S. Supreme Court held in The Paquete Habana, decided 8 January 1900, that customary international law is part of United States law and must be ascertained and applied by federal courts as questions of right depending on it arise.",
    href: "/settling-curve",
    pts: [[0, 72], [20, 68], [40, 60], [55, 65], [72, 42], [88, 20], [100, 9]],
    startYear: "1900",
    endYear: "2004",
  },
  {
    tag: "THE REVERSAL",
    initialAxis: "SETTLED",
    finalAxis: "REVERSED",
    range: "1984 → 1994",
    milestones: 4,
    short: "Ulcers: acid → H. pylori",
    text: "Peptic ulcers are caused by excess stomach acid and stress — not bacterial infection. This consensus held for decades until Barry Marshall and Robin Warren isolated Helicobacter pylori and demonstrated its role in ulcer disease, upending 80 years of gastroenterology.",
    href: "/stories/h-pylori",
    pts: [[0, 10], [40, 12], [58, 16], [70, 50], [85, 78], [100, 90]],
    startYear: "1984",
    endYear: "1994",
  },
  {
    tag: "THE SETTLEMENT",
    initialAxis: "RECORDED",
    finalAxis: "SETTLED",
    range: "1912 → 1968",
    milestones: 5,
    short: "Continental drift",
    text: "The continents move — once joined as Pangaea, they separate along tectonic boundaries at measurable rates. Alfred Wegener proposed continental drift in 1912 and was widely ridiculed. Seafloor spreading was confirmed in the 1960s and plate tectonics became the settled framework of geology.",
    href: "/search?q=plate+tectonics",
    pts: [[0, 78], [18, 72], [35, 68], [52, 55], [68, 35], [82, 16], [100, 8]],
    startYear: "1912",
    endYear: "1968",
  },
  {
    tag: "THE CONTESTED",
    initialAxis: "CONTESTED",
    finalAxis: "CONTESTED",
    range: "2015 → present",
    milestones: 6,
    short: "Dietary fat & heart disease",
    text: "Dietary fat — particularly saturated fat — is a primary driver of cardiovascular disease and should be minimized in a healthy diet. Decades of guidance built on this claim are now contested as evidence for different fatty acid types diverged sharply from the original hypothesis.",
    href: "/search?q=dietary+fat+cardiovascular",
    pts: [[0, 22], [14, 28], [28, 18], [42, 32], [56, 25], [70, 42], [84, 35], [100, 48]],
    startYear: "2015",
    endYear: "2026",
  },
  {
    tag: "THE REVERSAL",
    initialAxis: "RECORDED",
    finalAxis: "REVERSED",
    range: "2003 → 2012",
    milestones: 4,
    short: "Hwang stem-cell papers",
    text: "Hwang Woo-suk reported deriving human embryonic stem cells from cloned embryos — first in 2004, then with patient-matched lines in 2005. Both Science papers were retracted in 2006 after a fabrication investigation. The work had fooled journal editors, peer reviewers, and the global scientific press.",
    href: "/retraction-explorer",
    pts: [[0, 8], [45, 9], [58, 11], [68, 55], [80, 82], [100, 92]],
    startYear: "2003",
    endYear: "2012",
  },
  {
    tag: "THE REVERSAL",
    initialAxis: "RECORDED",
    finalAxis: "REVERSED",
    range: "1935 → 1967",
    milestones: 5,
    short: "Lobotomy abandoned",
    text: "Lobotomy — surgical severing of connections in the prefrontal cortex — was a legitimate and widely practiced psychiatric treatment for depression, schizophrenia, and anxiety. António Egas Moniz received the Nobel Prize in Physiology or Medicine in 1949 for developing the procedure. The practice was abandoned as antipsychotic drugs emerged and evidence of permanent harm accumulated.",
    href: "/search?q=lobotomy",
    pts: [[0, 30], [20, 22], [35, 15], [55, 18], [70, 42], [85, 68], [100, 84]],
    startYear: "1935",
    endYear: "1967",
  },
  {
    tag: "THE SETTLEMENT",
    initialAxis: "CONTESTED",
    finalAxis: "SETTLED",
    range: "1950 → 1964",
    milestones: 4,
    short: "Smoking causes lung cancer",
    text: "Cigarette smoking causes lung cancer. The link was long denied by tobacco companies and contested in scientific literature funded by the industry. The 1950 Doll-Hill and Wynder-Graham studies independently established the association. The U.S. Surgeon General's 1964 report formally settled the scientific consensus.",
    href: "/search?q=tobacco+lung+cancer",
    pts: [[0, 62], [18, 58], [32, 65], [48, 55], [62, 38], [78, 20], [100, 8]],
    startYear: "1950",
    endYear: "1964",
  },
  {
    tag: "THE REVERSAL",
    initialAxis: "RECORDED",
    finalAxis: "REVERSED",
    range: "1921 → 1986",
    milestones: 5,
    short: "Leaded gasoline",
    text: "Tetraethyl lead added to gasoline was safe at levels encountered in normal use. Industry-funded research maintained this position for decades while independent scientists documented neurological harm, especially in children. The EPA began phasing out leaded gasoline in 1973; the U.S. ban was complete by 1996.",
    href: "/search?q=leaded+gasoline",
    pts: [[0, 12], [20, 10], [38, 16], [55, 28], [72, 52], [88, 72], [100, 84]],
    startYear: "1921",
    endYear: "1986",
  },
  {
    tag: "THE SETTLEMENT",
    initialAxis: "RECORDED",
    finalAxis: "SETTLED",
    range: "1847 → 1900",
    milestones: 4,
    short: "Semmelweis vindicated",
    text: "Puerperal fever is caused by physicians carrying infectious material between the dissection room and the delivery ward. Ignaz Semmelweis demonstrated in 1847 that handwashing with chlorinated lime dramatically reduced mortality. His findings were dismissed and he died in an asylum, but Pasteur's germ theory vindicated him by 1900.",
    href: "/search?q=semmelweis+handwashing",
    pts: [[0, 62], [22, 68], [40, 72], [58, 55], [75, 30], [90, 12], [100, 6]],
    startYear: "1847",
    endYear: "1900",
  },
  {
    tag: "THE CONTESTED",
    initialAxis: "CONTESTED",
    finalAxis: "CONTESTED",
    range: "2018 → present",
    milestones: 7,
    short: "Social media & teen mental health",
    text: "Social media use causes depression, anxiety, and other mental health problems in adolescents, particularly girls. The 2018 Twenge et al. findings launched a major policy debate, but subsequent meta-analyses found effect sizes inconsistent and often small. Jonathan Haidt's 2023 synthesis renewed the case; the causal direction and magnitude remain disputed.",
    href: "/search?q=social+media+teen+mental+health",
    pts: [[0, 42], [12, 36], [25, 50], [38, 40], [52, 55], [65, 44], [78, 52], [92, 46], [100, 50]],
    startYear: "2018",
    endYear: "2026",
  },
  {
    tag: "THE REVERSAL",
    initialAxis: "RECORDED",
    finalAxis: "REVERSED",
    range: "1977 → 2000",
    milestones: 3,
    short: "Saccharin scare reversed",
    text: "Saccharin, the artificial sweetener, causes bladder cancer. A 1977 Canadian study showed bladder tumors in rats fed high doses of saccharin. The FDA proposed a ban; Congress instead required warning labels. Later research showed the rat mechanism does not apply to humans, and saccharin was removed from the U.S. list of anticipated carcinogens in 2000.",
    href: "/search?q=saccharin+bladder+cancer",
    pts: [[0, 24], [22, 22], [42, 30], [60, 50], [78, 68], [100, 76]],
    startYear: "1977",
    endYear: "2000",
  },
];

/** Years from emergence to the end of the shown range ("present" ranges use the endYear). */
export function slideAgeYears(s: Slide): number {
  return Number(s.endYear) - Number(s.startYear);
}
