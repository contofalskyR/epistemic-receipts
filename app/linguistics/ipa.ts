import type { IpaSymbol, LanguageFamily } from "./types";

// Pulmonic consonant chart (IPA 2020). Columns = places of articulation; rows = manners; pairs = (voiceless, voiced).
// We include the standard inventory; "—" cells (impossible articulations) are omitted from the data.

export const CONSONANT_PLACES = [
  "bilabial",
  "labiodental",
  "dental",
  "alveolar",
  "postalveolar",
  "retroflex",
  "palatal",
  "velar",
  "uvular",
  "pharyngeal",
  "glottal",
] as const;

export const CONSONANT_MANNERS = [
  "plosive",
  "nasal",
  "trill",
  "tap",
  "fricative",
  "lateral-fricative",
  "approximant",
  "lateral-approximant",
] as const;

export const VOWEL_HEIGHTS = ["close", "near-close", "close-mid", "mid", "open-mid", "near-open", "open"] as const;
export const VOWEL_BACKNESS = ["front", "central", "back"] as const;

export const IPA_SYMBOLS: IpaSymbol[] = [
  // ─── Plosives ─────────────────────────────────────────────
  { ipa: "p", name: "voiceless bilabial plosive", type: "consonant", category: "plosive", place: "bilabial", voicing: "voiceless", example: "English 'pat' [pæt]", description: "Stop made by closing both lips, no vocal-fold vibration during the closure." },
  { ipa: "b", name: "voiced bilabial plosive", type: "consonant", category: "plosive", place: "bilabial", voicing: "voiced", example: "English 'bat' [bæt]", description: "Bilabial closure with simultaneous vocal-fold vibration." },
  { ipa: "t", name: "voiceless alveolar plosive", type: "consonant", category: "plosive", place: "alveolar", voicing: "voiceless", example: "English 'top' [tʰɒp]", description: "Tongue-tip closure on the alveolar ridge; English /t/ is aspirated word-initially." },
  { ipa: "d", name: "voiced alveolar plosive", type: "consonant", category: "plosive", place: "alveolar", voicing: "voiced", example: "English 'dog' [dɒɡ]", description: "Voiced counterpart of [t]." },
  { ipa: "ʈ", name: "voiceless retroflex plosive", type: "consonant", category: "plosive", place: "retroflex", voicing: "voiceless", example: "Hindi 'टमाटर' [ʈəmaːʈər]", description: "Tongue-tip curls back to strike the post-alveolar/palatal region." },
  { ipa: "ɖ", name: "voiced retroflex plosive", type: "consonant", category: "plosive", place: "retroflex", voicing: "voiced", example: "Hindi 'डर' [ɖər]", description: "Voiced retroflex stop." },
  { ipa: "c", name: "voiceless palatal plosive", type: "consonant", category: "plosive", place: "palatal", voicing: "voiceless", example: "Hungarian 'tyúk' [cuːk]", description: "Stop with closure between the tongue body and the hard palate." },
  { ipa: "ɟ", name: "voiced palatal plosive", type: "consonant", category: "plosive", place: "palatal", voicing: "voiced", example: "Hungarian 'gyár' [ɟaːr]", description: "Voiced palatal stop." },
  { ipa: "k", name: "voiceless velar plosive", type: "consonant", category: "plosive", place: "velar", voicing: "voiceless", example: "English 'cat' [kʰæt]", description: "Tongue-body closure on the soft palate." },
  { ipa: "ɡ", name: "voiced velar plosive", type: "consonant", category: "plosive", place: "velar", voicing: "voiced", example: "English 'go' [ɡoʊ]", description: "Voiced velar stop." },
  { ipa: "q", name: "voiceless uvular plosive", type: "consonant", category: "plosive", place: "uvular", voicing: "voiceless", example: "Arabic 'قَلْب' [qalb]", description: "Stop made by tongue-body closure at the uvula." },
  { ipa: "ɢ", name: "voiced uvular plosive", type: "consonant", category: "plosive", place: "uvular", voicing: "voiced", example: "Inuktitut 'iglu' [iɢlu]", description: "Voiced uvular stop." },
  { ipa: "ʔ", name: "glottal plosive", type: "consonant", category: "plosive", place: "glottal", voicing: "voiceless", example: "English 'uh-oh' [ʔʌʔoʊ]", description: "Complete closure of the glottis; the catch in 'uh-oh'." },

  // ─── Nasals ───────────────────────────────────────────────
  { ipa: "m", name: "bilabial nasal", type: "consonant", category: "nasal", place: "bilabial", voicing: "voiced", example: "English 'man' [mæn]", description: "Bilabial closure with airflow through the nasal cavity." },
  { ipa: "ɱ", name: "labiodental nasal", type: "consonant", category: "nasal", place: "labiodental", voicing: "voiced", example: "English 'symphony' [sɪɱfəni]", description: "Lower lip touches upper teeth; an allophone of /m/ before /f, v/ in English." },
  { ipa: "n", name: "alveolar nasal", type: "consonant", category: "nasal", place: "alveolar", voicing: "voiced", example: "English 'no' [noʊ]", description: "Alveolar closure with nasal airflow." },
  { ipa: "ɳ", name: "retroflex nasal", type: "consonant", category: "nasal", place: "retroflex", voicing: "voiced", example: "Tamil 'பெண்' [peɳ]", description: "Retroflex closure with nasal airflow." },
  { ipa: "ɲ", name: "palatal nasal", type: "consonant", category: "nasal", place: "palatal", voicing: "voiced", example: "Spanish 'año' [aɲo]", description: "The 'ñ' sound." },
  { ipa: "ŋ", name: "velar nasal", type: "consonant", category: "nasal", place: "velar", voicing: "voiced", example: "English 'sing' [sɪŋ]", description: "Velar closure with nasal airflow." },
  { ipa: "ɴ", name: "uvular nasal", type: "consonant", category: "nasal", place: "uvular", voicing: "voiced", example: "Japanese 'にほん' [nihoɴ]", description: "Uvular closure with nasal airflow; word-final 'n' in Japanese." },

  // ─── Trills & taps ────────────────────────────────────────
  { ipa: "ʙ", name: "bilabial trill", type: "consonant", category: "trill", place: "bilabial", voicing: "voiced", example: "Titan (Papuan) [ʙu]", description: "Rapid vibration of the lips." },
  { ipa: "r", name: "alveolar trill", type: "consonant", category: "trill", place: "alveolar", voicing: "voiced", example: "Spanish 'perro' [pero]", description: "Multiple rapid tongue-tip taps on the alveolar ridge." },
  { ipa: "ʀ", name: "uvular trill", type: "consonant", category: "trill", place: "uvular", voicing: "voiced", example: "Standard French 'roi' [ʀwa] (one variant)", description: "Vibration of the uvula against the tongue back." },
  { ipa: "ⱱ", name: "labiodental tap", type: "consonant", category: "tap", place: "labiodental", voicing: "voiced", example: "Mono (Bantu) [ⱱa]", description: "Single quick contact of lower lip on upper teeth." },
  { ipa: "ɾ", name: "alveolar tap", type: "consonant", category: "tap", place: "alveolar", voicing: "voiced", example: "American English 'butter' [bʌɾɚ]", description: "Single quick alveolar contact; the 'flap' in American English." },
  { ipa: "ɽ", name: "retroflex flap", type: "consonant", category: "tap", place: "retroflex", voicing: "voiced", example: "Hindi 'बड़ा' [bəɽaː]", description: "Retroflex flap." },

  // ─── Fricatives ───────────────────────────────────────────
  { ipa: "ɸ", name: "voiceless bilabial fricative", type: "consonant", category: "fricative", place: "bilabial", voicing: "voiceless", example: "Japanese 'ふ' [ɸɯ]", description: "Friction between the lips without closure." },
  { ipa: "β", name: "voiced bilabial fricative", type: "consonant", category: "fricative", place: "bilabial", voicing: "voiced", example: "Spanish 'haba' [aβa]", description: "Voiced bilabial friction." },
  { ipa: "f", name: "voiceless labiodental fricative", type: "consonant", category: "fricative", place: "labiodental", voicing: "voiceless", example: "English 'fish' [fɪʃ]", description: "Friction between lower lip and upper teeth." },
  { ipa: "v", name: "voiced labiodental fricative", type: "consonant", category: "fricative", place: "labiodental", voicing: "voiced", example: "English 'van' [væn]", description: "Voiced labiodental friction." },
  { ipa: "θ", name: "voiceless dental fricative", type: "consonant", category: "fricative", place: "dental", voicing: "voiceless", example: "English 'thin' [θɪn]", description: "Tongue tip between or behind the upper teeth; the 'th' in 'thin'." },
  { ipa: "ð", name: "voiced dental fricative", type: "consonant", category: "fricative", place: "dental", voicing: "voiced", example: "English 'this' [ðɪs]", description: "Voiced dental friction; the 'th' in 'this'." },
  { ipa: "s", name: "voiceless alveolar fricative", type: "consonant", category: "fricative", place: "alveolar", voicing: "voiceless", example: "English 'sea' [siː]", description: "Friction at the alveolar ridge." },
  { ipa: "z", name: "voiced alveolar fricative", type: "consonant", category: "fricative", place: "alveolar", voicing: "voiced", example: "English 'zoo' [zuː]", description: "Voiced alveolar friction." },
  { ipa: "ʃ", name: "voiceless postalveolar fricative", type: "consonant", category: "fricative", place: "postalveolar", voicing: "voiceless", example: "English 'ship' [ʃɪp]", description: "Friction behind the alveolar ridge with the tongue raised toward the palate." },
  { ipa: "ʒ", name: "voiced postalveolar fricative", type: "consonant", category: "fricative", place: "postalveolar", voicing: "voiced", example: "English 'measure' [mɛʒɚ]", description: "Voiced postalveolar friction." },
  { ipa: "ʂ", name: "voiceless retroflex fricative", type: "consonant", category: "fricative", place: "retroflex", voicing: "voiceless", example: "Mandarin '是' [ʂɻ̩˥]", description: "Retroflex friction." },
  { ipa: "ʐ", name: "voiced retroflex fricative", type: "consonant", category: "fricative", place: "retroflex", voicing: "voiced", example: "Russian 'жук' [ʐuk]", description: "Voiced retroflex friction." },
  { ipa: "ç", name: "voiceless palatal fricative", type: "consonant", category: "fricative", place: "palatal", voicing: "voiceless", example: "German 'ich' [ɪç]", description: "Friction between the tongue body and the hard palate." },
  { ipa: "ʝ", name: "voiced palatal fricative", type: "consonant", category: "fricative", place: "palatal", voicing: "voiced", example: "Spanish 'mayo' [maʝo] (some dialects)", description: "Voiced palatal friction." },
  { ipa: "x", name: "voiceless velar fricative", type: "consonant", category: "fricative", place: "velar", voicing: "voiceless", example: "German 'Bach' [bax]", description: "Velar friction; Scottish 'loch'." },
  { ipa: "ɣ", name: "voiced velar fricative", type: "consonant", category: "fricative", place: "velar", voicing: "voiced", example: "Greek 'γάλα' [ɣala]", description: "Voiced velar friction." },
  { ipa: "χ", name: "voiceless uvular fricative", type: "consonant", category: "fricative", place: "uvular", voicing: "voiceless", example: "Arabic 'خ' [χ]", description: "Uvular friction." },
  { ipa: "ʁ", name: "voiced uvular fricative", type: "consonant", category: "fricative", place: "uvular", voicing: "voiced", example: "French 'rouge' [ʁuʒ]", description: "Standard French 'r'." },
  { ipa: "ħ", name: "voiceless pharyngeal fricative", type: "consonant", category: "fricative", place: "pharyngeal", voicing: "voiceless", example: "Arabic 'حروف' [ħuruːf]", description: "Friction in the pharynx." },
  { ipa: "ʕ", name: "voiced pharyngeal fricative", type: "consonant", category: "fricative", place: "pharyngeal", voicing: "voiced", example: "Arabic 'ع' [ʕ]", description: "Voiced pharyngeal sound; arguably an approximant cross-linguistically." },
  { ipa: "h", name: "voiceless glottal fricative", type: "consonant", category: "fricative", place: "glottal", voicing: "voiceless", example: "English 'hat' [hæt]", description: "Aspiration through an open glottis." },
  { ipa: "ɦ", name: "voiced glottal fricative", type: "consonant", category: "fricative", place: "glottal", voicing: "voiced", example: "Czech 'hrad' [ɦrat]", description: "Voiced glottal fricative; breathy onset." },

  // ─── Lateral fricatives ───────────────────────────────────
  { ipa: "ɬ", name: "voiceless alveolar lateral fricative", type: "consonant", category: "lateral-fricative", place: "alveolar", voicing: "voiceless", example: "Welsh 'llan' [ɬan]", description: "Lateral airflow with friction; the Welsh 'll'." },
  { ipa: "ɮ", name: "voiced alveolar lateral fricative", type: "consonant", category: "lateral-fricative", place: "alveolar", voicing: "voiced", example: "Zulu 'dlala' [ɮala]", description: "Voiced lateral friction." },

  // ─── Approximants ─────────────────────────────────────────
  { ipa: "ʋ", name: "labiodental approximant", type: "consonant", category: "approximant", place: "labiodental", voicing: "voiced", example: "Dutch 'wat' [ʋɑt]", description: "Lower lip approaches upper teeth without friction." },
  { ipa: "ɹ", name: "alveolar approximant", type: "consonant", category: "approximant", place: "alveolar", voicing: "voiced", example: "English 'red' [ɹɛd]", description: "English 'r'." },
  { ipa: "ɻ", name: "retroflex approximant", type: "consonant", category: "approximant", place: "retroflex", voicing: "voiced", example: "Tamil 'அழகு' [aɻaɡu]", description: "Retroflex approximant." },
  { ipa: "j", name: "palatal approximant", type: "consonant", category: "approximant", place: "palatal", voicing: "voiced", example: "English 'yes' [jɛs]", description: "The 'y' glide; very close to [i] but consonantal." },
  { ipa: "ɰ", name: "velar approximant", type: "consonant", category: "approximant", place: "velar", voicing: "voiced", example: "Spanish 'agua' [aɰwa] (some dialects)", description: "Velar approximant; like [u] without lip rounding." },

  // ─── Lateral approximants ─────────────────────────────────
  { ipa: "l", name: "alveolar lateral approximant", type: "consonant", category: "lateral-approximant", place: "alveolar", voicing: "voiced", example: "English 'lip' [lɪp]", description: "Lateral airflow around an alveolar closure." },
  { ipa: "ɭ", name: "retroflex lateral approximant", type: "consonant", category: "lateral-approximant", place: "retroflex", voicing: "voiced", example: "Tamil 'பழம்' [paɭam]", description: "Retroflex lateral." },
  { ipa: "ʎ", name: "palatal lateral approximant", type: "consonant", category: "lateral-approximant", place: "palatal", voicing: "voiced", example: "Catalan 'colla' [ˈkoʎə]", description: "Palatal lateral; the 'gl' in Italian 'figlio'." },
  { ipa: "ʟ", name: "velar lateral approximant", type: "consonant", category: "lateral-approximant", place: "velar", voicing: "voiced", example: "Mid-Waghi [ʟaʟam]", description: "Velar lateral." },

  // ─── Vowels (cardinal vowel chart) ───────────────────────
  { ipa: "i", name: "close front unrounded vowel", type: "vowel", category: "vowel", height: "close", backness: "front", rounded: false, example: "English 'see' [siː]", description: "Tongue maximally high and forward, lips spread." },
  { ipa: "y", name: "close front rounded vowel", type: "vowel", category: "vowel", height: "close", backness: "front", rounded: true, example: "French 'tu' [ty]", description: "Same tongue position as [i] but with rounded lips." },
  { ipa: "ɨ", name: "close central unrounded vowel", type: "vowel", category: "vowel", height: "close", backness: "central", rounded: false, example: "Russian 'мы' [mɨ]", description: "Close central unrounded." },
  { ipa: "ʉ", name: "close central rounded vowel", type: "vowel", category: "vowel", height: "close", backness: "central", rounded: true, example: "Norwegian 'hus' [hʉːs]", description: "Close central rounded." },
  { ipa: "ɯ", name: "close back unrounded vowel", type: "vowel", category: "vowel", height: "close", backness: "back", rounded: false, example: "Japanese 'ふく' [ɸɯkɯ]", description: "Same tongue position as [u] but lips unrounded." },
  { ipa: "u", name: "close back rounded vowel", type: "vowel", category: "vowel", height: "close", backness: "back", rounded: true, example: "English 'boot' [buːt]", description: "Tongue maximally high and back, lips rounded." },
  { ipa: "ɪ", name: "near-close near-front unrounded vowel", type: "vowel", category: "vowel", height: "near-close", backness: "front", rounded: false, example: "English 'bit' [bɪt]", description: "Slightly lower and centralized from [i]." },
  { ipa: "ʏ", name: "near-close near-front rounded vowel", type: "vowel", category: "vowel", height: "near-close", backness: "front", rounded: true, example: "German 'füllt' [fʏlt]", description: "Rounded counterpart of [ɪ]." },
  { ipa: "ʊ", name: "near-close near-back rounded vowel", type: "vowel", category: "vowel", height: "near-close", backness: "back", rounded: true, example: "English 'put' [pʊt]", description: "Slightly lower and centralized from [u]." },
  { ipa: "e", name: "close-mid front unrounded vowel", type: "vowel", category: "vowel", height: "close-mid", backness: "front", rounded: false, example: "Spanish 'pero' [peɾo]", description: "Mid-high front unrounded." },
  { ipa: "ø", name: "close-mid front rounded vowel", type: "vowel", category: "vowel", height: "close-mid", backness: "front", rounded: true, example: "French 'feu' [fø]", description: "Rounded counterpart of [e]." },
  { ipa: "ɘ", name: "close-mid central unrounded vowel", type: "vowel", category: "vowel", height: "close-mid", backness: "central", rounded: false, example: "Paicĩ [tɘ]", description: "Close-mid central unrounded." },
  { ipa: "ɵ", name: "close-mid central rounded vowel", type: "vowel", category: "vowel", height: "close-mid", backness: "central", rounded: true, example: "Swedish 'bot' [bɵt]", description: "Close-mid central rounded." },
  { ipa: "ɤ", name: "close-mid back unrounded vowel", type: "vowel", category: "vowel", height: "close-mid", backness: "back", rounded: false, example: "Mandarin '哥' [kɤ]", description: "Close-mid back unrounded." },
  { ipa: "o", name: "close-mid back rounded vowel", type: "vowel", category: "vowel", height: "close-mid", backness: "back", rounded: true, example: "Spanish 'lo' [lo]", description: "Mid-high back rounded." },
  { ipa: "ə", name: "mid central vowel (schwa)", type: "vowel", category: "vowel", height: "mid", backness: "central", rounded: false, example: "English 'about' [əˈbaʊt]", description: "Neutral central vowel; the most frequent vowel in English." },
  { ipa: "ɛ", name: "open-mid front unrounded vowel", type: "vowel", category: "vowel", height: "open-mid", backness: "front", rounded: false, example: "English 'bed' [bɛd]", description: "Lower-mid front unrounded." },
  { ipa: "œ", name: "open-mid front rounded vowel", type: "vowel", category: "vowel", height: "open-mid", backness: "front", rounded: true, example: "French 'sœur' [sœʁ]", description: "Rounded counterpart of [ɛ]." },
  { ipa: "ɜ", name: "open-mid central unrounded vowel", type: "vowel", category: "vowel", height: "open-mid", backness: "central", rounded: false, example: "British 'bird' [bɜːd]", description: "Open-mid central unrounded." },
  { ipa: "ɞ", name: "open-mid central rounded vowel", type: "vowel", category: "vowel", height: "open-mid", backness: "central", rounded: true, example: "Irish English 'bird' [bɞːd] (one variant)", description: "Open-mid central rounded." },
  { ipa: "ʌ", name: "open-mid back unrounded vowel", type: "vowel", category: "vowel", height: "open-mid", backness: "back", rounded: false, example: "English 'cut' [kʌt]", description: "Open-mid back unrounded." },
  { ipa: "ɔ", name: "open-mid back rounded vowel", type: "vowel", category: "vowel", height: "open-mid", backness: "back", rounded: true, example: "British 'thought' [θɔːt]", description: "Open-mid back rounded." },
  { ipa: "æ", name: "near-open front unrounded vowel", type: "vowel", category: "vowel", height: "near-open", backness: "front", rounded: false, example: "English 'cat' [kæt]", description: "Near-open front unrounded." },
  { ipa: "ɐ", name: "near-open central vowel", type: "vowel", category: "vowel", height: "near-open", backness: "central", rounded: false, example: "German 'oder' [ˈoːdɐ]", description: "Near-open central." },
  { ipa: "a", name: "open front unrounded vowel", type: "vowel", category: "vowel", height: "open", backness: "front", rounded: false, example: "Spanish 'casa' [kasa]", description: "Open front unrounded; the 'a' of most Romance languages." },
  { ipa: "ɶ", name: "open front rounded vowel", type: "vowel", category: "vowel", height: "open", backness: "front", rounded: true, example: "Austrian Bavarian 'i hått' [hɶt]", description: "Rare cardinal vowel." },
  { ipa: "ɑ", name: "open back unrounded vowel", type: "vowel", category: "vowel", height: "open", backness: "back", rounded: false, example: "American 'father' [ˈfɑðɚ]", description: "Open back unrounded." },
  { ipa: "ɒ", name: "open back rounded vowel", type: "vowel", category: "vowel", height: "open", backness: "back", rounded: true, example: "British 'lot' [lɒt]", description: "Open back rounded; British 'hot'." },

  // ─── Non-pulmonic & specials ──────────────────────────────
  { ipa: "ʘ", name: "bilabial click", type: "consonant", category: "click", place: "bilabial", voicing: "voiceless", example: "Khoekhoegowab 'ʘhî' (click)", description: "Click made by sucking inward against bilabial closure." },
  { ipa: "ǀ", name: "dental click", type: "consonant", category: "click", place: "dental", voicing: "voiceless", example: "Zulu 'cela' [ǀela]", description: "The 'tsk-tsk' disapproval click." },
  { ipa: "ǃ", name: "(post)alveolar click", type: "consonant", category: "click", place: "postalveolar", voicing: "voiceless", example: "Xhosa 'iqaqa' [iǃaːǃa]", description: "Sharp alveolar 'pop' click." },
  { ipa: "ǂ", name: "palatal click", type: "consonant", category: "click", place: "palatal", voicing: "voiceless", example: "Nǁng [ǂu]", description: "Palatal click." },
  { ipa: "ǁ", name: "lateral click", type: "consonant", category: "click", place: "alveolar", voicing: "voiceless", example: "Khoekhoegowab 'ǁgam' [ǁɢam]", description: "The horse-giddyup lateral click." },
  { ipa: "ɓ", name: "voiced bilabial implosive", type: "consonant", category: "implosive", place: "bilabial", voicing: "voiced", example: "Sindhi 'ɓəɓ' [ɓəɓ]", description: "Implosive: airstream produced by downward glottal motion." },
  { ipa: "ɗ", name: "voiced alveolar implosive", type: "consonant", category: "implosive", place: "alveolar", voicing: "voiced", example: "Hausa 'ɗan' [ɗan]", description: "Voiced alveolar implosive." },
  { ipa: "ʄ", name: "voiced palatal implosive", type: "consonant", category: "implosive", place: "palatal", voicing: "voiced", example: "Sindhi 'ʄəlʄələ' [ʄəlʄələ]", description: "Voiced palatal implosive." },
  { ipa: "ɠ", name: "voiced velar implosive", type: "consonant", category: "implosive", place: "velar", voicing: "voiced", example: "Sindhi 'ɠəɽh' [ɠəɽh]", description: "Voiced velar implosive." },
  { ipa: "ʛ", name: "voiced uvular implosive", type: "consonant", category: "implosive", place: "uvular", voicing: "voiced", example: "Mam 'ʛaːl' [ʛaːl]", description: "Voiced uvular implosive." },
  { ipa: "ɧ", name: "sj-sound", type: "consonant", category: "fricative", place: "postalveolar", voicing: "voiceless", example: "Swedish 'sjuk' [ɧʉːk]", description: "Coarticulated voiceless fricative unique to Swedish; place of articulation debated." },
  { ipa: "ʍ", name: "voiceless labio-velar approximant", type: "consonant", category: "approximant", place: "velar", voicing: "voiceless", example: "Scottish English 'which' [ʍɪtʃ]", description: "The 'wh' sound where preserved." },
  { ipa: "w", name: "voiced labio-velar approximant", type: "consonant", category: "approximant", place: "velar", voicing: "voiced", example: "English 'we' [wiː]", description: "Lip-rounded velar approximant; like [u] but consonantal." },
];

// Major language families — curated. Counts are approximate L1+L2 speakers (Ethnologue 27th ed. style).

export const LANGUAGE_FAMILIES: LanguageFamily[] = [
  {
    slug: "indo-european",
    name: "Indo-European",
    approxSpeakers: 3200000000,
    notes: "Largest family by speaker count. ~445 living languages. Established as a single family by Sir William Jones in 1786.",
    branches: [
      {
        name: "Germanic",
        languages: [
          { name: "English", family: "Indo-European", branch: "Germanic", speakers: 1500000000, iso639: "eng" },
          { name: "German", family: "Indo-European", branch: "Germanic", speakers: 132000000, iso639: "deu" },
          { name: "Dutch", family: "Indo-European", branch: "Germanic", speakers: 25000000, iso639: "nld" },
          { name: "Swedish", family: "Indo-European", branch: "Germanic", speakers: 10000000, iso639: "swe" },
          { name: "Norwegian", family: "Indo-European", branch: "Germanic", speakers: 5300000, iso639: "nor" },
          { name: "Danish", family: "Indo-European", branch: "Germanic", speakers: 6000000, iso639: "dan" },
          { name: "Icelandic", family: "Indo-European", branch: "Germanic", speakers: 350000, iso639: "isl" },
          { name: "Yiddish", family: "Indo-European", branch: "Germanic", speakers: 600000, iso639: "yid" },
          { name: "Afrikaans", family: "Indo-European", branch: "Germanic", speakers: 17500000, iso639: "afr" },
        ],
      },
      {
        name: "Romance (Italic)",
        languages: [
          { name: "Spanish", family: "Indo-European", branch: "Romance", speakers: 590000000, iso639: "spa" },
          { name: "Portuguese", family: "Indo-European", branch: "Romance", speakers: 260000000, iso639: "por" },
          { name: "French", family: "Indo-European", branch: "Romance", speakers: 310000000, iso639: "fra" },
          { name: "Italian", family: "Indo-European", branch: "Romance", speakers: 68000000, iso639: "ita" },
          { name: "Romanian", family: "Indo-European", branch: "Romance", speakers: 25000000, iso639: "ron" },
          { name: "Catalan", family: "Indo-European", branch: "Romance", speakers: 10000000, iso639: "cat" },
          { name: "Latin", family: "Indo-European", branch: "Romance", speakers: 0, iso639: "lat", notes: "Classical, liturgical use only" },
        ],
      },
      {
        name: "Slavic",
        languages: [
          { name: "Russian", family: "Indo-European", branch: "Slavic", speakers: 258000000, iso639: "rus" },
          { name: "Polish", family: "Indo-European", branch: "Slavic", speakers: 45000000, iso639: "pol" },
          { name: "Ukrainian", family: "Indo-European", branch: "Slavic", speakers: 40000000, iso639: "ukr" },
          { name: "Czech", family: "Indo-European", branch: "Slavic", speakers: 10700000, iso639: "ces" },
          { name: "Bulgarian", family: "Indo-European", branch: "Slavic", speakers: 8000000, iso639: "bul" },
          { name: "Serbo-Croatian", family: "Indo-European", branch: "Slavic", speakers: 17000000, iso639: "hbs" },
        ],
      },
      {
        name: "Indo-Iranian",
        languages: [
          { name: "Hindi-Urdu", family: "Indo-European", branch: "Indo-Aryan", speakers: 600000000, iso639: "hin" },
          { name: "Bengali", family: "Indo-European", branch: "Indo-Aryan", speakers: 273000000, iso639: "ben" },
          { name: "Punjabi", family: "Indo-European", branch: "Indo-Aryan", speakers: 113000000, iso639: "pan" },
          { name: "Marathi", family: "Indo-European", branch: "Indo-Aryan", speakers: 99000000, iso639: "mar" },
          { name: "Gujarati", family: "Indo-European", branch: "Indo-Aryan", speakers: 62000000, iso639: "guj" },
          { name: "Persian (Farsi)", family: "Indo-European", branch: "Iranian", speakers: 110000000, iso639: "fas" },
          { name: "Pashto", family: "Indo-European", branch: "Iranian", speakers: 60000000, iso639: "pus" },
          { name: "Kurdish", family: "Indo-European", branch: "Iranian", speakers: 30000000, iso639: "kur" },
          { name: "Sanskrit", family: "Indo-European", branch: "Indo-Aryan", speakers: 0, iso639: "san", notes: "Classical, liturgical" },
        ],
      },
      {
        name: "Hellenic",
        languages: [{ name: "Greek", family: "Indo-European", branch: "Hellenic", speakers: 13500000, iso639: "ell" }],
      },
      {
        name: "Celtic",
        languages: [
          { name: "Irish", family: "Indo-European", branch: "Celtic", speakers: 1700000, iso639: "gle" },
          { name: "Welsh", family: "Indo-European", branch: "Celtic", speakers: 880000, iso639: "cym" },
          { name: "Scottish Gaelic", family: "Indo-European", branch: "Celtic", speakers: 57000, iso639: "gla" },
          { name: "Breton", family: "Indo-European", branch: "Celtic", speakers: 210000, iso639: "bre" },
        ],
      },
      {
        name: "Armenian",
        languages: [{ name: "Armenian", family: "Indo-European", branch: "Armenian", speakers: 7000000, iso639: "hye" }],
      },
      {
        name: "Albanian",
        languages: [{ name: "Albanian", family: "Indo-European", branch: "Albanian", speakers: 7500000, iso639: "sqi" }],
      },
      {
        name: "Baltic",
        languages: [
          { name: "Lithuanian", family: "Indo-European", branch: "Baltic", speakers: 3000000, iso639: "lit" },
          { name: "Latvian", family: "Indo-European", branch: "Baltic", speakers: 1750000, iso639: "lav" },
        ],
      },
    ],
  },
  {
    slug: "sino-tibetan",
    name: "Sino-Tibetan",
    approxSpeakers: 1500000000,
    notes: "Second-largest family by L1 speakers; comprises Sinitic (Chinese) and Tibeto-Burman branches.",
    branches: [
      {
        name: "Sinitic",
        languages: [
          { name: "Mandarin Chinese", family: "Sino-Tibetan", branch: "Sinitic", speakers: 1138000000, iso639: "cmn" },
          { name: "Yue (Cantonese)", family: "Sino-Tibetan", branch: "Sinitic", speakers: 85000000, iso639: "yue" },
          { name: "Wu (Shanghainese)", family: "Sino-Tibetan", branch: "Sinitic", speakers: 80000000, iso639: "wuu" },
          { name: "Min Nan (Hokkien)", family: "Sino-Tibetan", branch: "Sinitic", speakers: 49000000, iso639: "nan" },
          { name: "Hakka", family: "Sino-Tibetan", branch: "Sinitic", speakers: 44000000, iso639: "hak" },
        ],
      },
      {
        name: "Tibeto-Burman",
        languages: [
          { name: "Burmese", family: "Sino-Tibetan", branch: "Tibeto-Burman", speakers: 43000000, iso639: "mya" },
          { name: "Tibetan", family: "Sino-Tibetan", branch: "Tibeto-Burman", speakers: 6000000, iso639: "bod" },
          { name: "Karen", family: "Sino-Tibetan", branch: "Tibeto-Burman", speakers: 7000000, iso639: "kar" },
          { name: "Meitei", family: "Sino-Tibetan", branch: "Tibeto-Burman", speakers: 1800000, iso639: "mni" },
        ],
      },
    ],
  },
  {
    slug: "afro-asiatic",
    name: "Afro-Asiatic",
    approxSpeakers: 600000000,
    notes: "Spans North Africa, Horn of Africa, Middle East. Includes Semitic, Berber, Cushitic, Chadic, Omotic, Egyptian.",
    branches: [
      {
        name: "Semitic",
        languages: [
          { name: "Arabic (MSA)", family: "Afro-Asiatic", branch: "Semitic", speakers: 422000000, iso639: "ara" },
          { name: "Amharic", family: "Afro-Asiatic", branch: "Semitic", speakers: 57000000, iso639: "amh" },
          { name: "Hebrew", family: "Afro-Asiatic", branch: "Semitic", speakers: 9000000, iso639: "heb" },
          { name: "Tigrinya", family: "Afro-Asiatic", branch: "Semitic", speakers: 9000000, iso639: "tir" },
          { name: "Maltese", family: "Afro-Asiatic", branch: "Semitic", speakers: 520000, iso639: "mlt" },
          { name: "Aramaic", family: "Afro-Asiatic", branch: "Semitic", speakers: 580000, iso639: "arc" },
        ],
      },
      {
        name: "Cushitic",
        languages: [
          { name: "Oromo", family: "Afro-Asiatic", branch: "Cushitic", speakers: 45000000, iso639: "orm" },
          { name: "Somali", family: "Afro-Asiatic", branch: "Cushitic", speakers: 22000000, iso639: "som" },
        ],
      },
      {
        name: "Chadic",
        languages: [{ name: "Hausa", family: "Afro-Asiatic", branch: "Chadic", speakers: 80000000, iso639: "hau" }],
      },
      {
        name: "Berber",
        languages: [{ name: "Tamazight (Berber)", family: "Afro-Asiatic", branch: "Berber", speakers: 25000000, iso639: "ber" }],
      },
    ],
  },
  {
    slug: "niger-congo",
    name: "Niger-Congo (Atlantic-Congo)",
    approxSpeakers: 700000000,
    notes: "Largest family by number of languages (~1,540). Bantu sub-branch dominates by speakers.",
    branches: [
      {
        name: "Bantu",
        languages: [
          { name: "Swahili", family: "Niger-Congo", branch: "Bantu", speakers: 200000000, iso639: "swa" },
          { name: "Zulu", family: "Niger-Congo", branch: "Bantu", speakers: 28000000, iso639: "zul" },
          { name: "Xhosa", family: "Niger-Congo", branch: "Bantu", speakers: 19000000, iso639: "xho" },
          { name: "Lingala", family: "Niger-Congo", branch: "Bantu", speakers: 40000000, iso639: "lin" },
          { name: "Kinyarwanda", family: "Niger-Congo", branch: "Bantu", speakers: 12000000, iso639: "kin" },
          { name: "Shona", family: "Niger-Congo", branch: "Bantu", speakers: 14000000, iso639: "sna" },
        ],
      },
      {
        name: "West Atlantic",
        languages: [
          { name: "Yoruba", family: "Niger-Congo", branch: "Volta-Niger", speakers: 47000000, iso639: "yor" },
          { name: "Igbo", family: "Niger-Congo", branch: "Volta-Niger", speakers: 31000000, iso639: "ibo" },
          { name: "Fula", family: "Niger-Congo", branch: "Atlantic", speakers: 40000000, iso639: "ful" },
          { name: "Wolof", family: "Niger-Congo", branch: "Atlantic", speakers: 12000000, iso639: "wol" },
          { name: "Akan", family: "Niger-Congo", branch: "Kwa", speakers: 22000000, iso639: "aka" },
        ],
      },
    ],
  },
  {
    slug: "austronesian",
    name: "Austronesian",
    approxSpeakers: 386000000,
    notes: "~1,250 languages from Madagascar to Easter Island; Taiwan is the urheimat.",
    branches: [
      {
        name: "Malayo-Polynesian",
        languages: [
          { name: "Indonesian/Malay", family: "Austronesian", branch: "Malayo-Polynesian", speakers: 290000000, iso639: "ind" },
          { name: "Javanese", family: "Austronesian", branch: "Malayo-Polynesian", speakers: 82000000, iso639: "jav" },
          { name: "Tagalog", family: "Austronesian", branch: "Malayo-Polynesian", speakers: 82000000, iso639: "tgl" },
          { name: "Cebuano", family: "Austronesian", branch: "Malayo-Polynesian", speakers: 21000000, iso639: "ceb" },
          { name: "Malagasy", family: "Austronesian", branch: "Malayo-Polynesian", speakers: 25000000, iso639: "mlg" },
          { name: "Hawaiian", family: "Austronesian", branch: "Polynesian", speakers: 24000, iso639: "haw" },
          { name: "Maori", family: "Austronesian", branch: "Polynesian", speakers: 186000, iso639: "mri" },
          { name: "Tongan", family: "Austronesian", branch: "Polynesian", speakers: 187000, iso639: "ton" },
        ],
      },
      {
        name: "Formosan",
        languages: [{ name: "Amis", family: "Austronesian", branch: "Formosan", speakers: 200000, iso639: "ami" }],
      },
    ],
  },
  {
    slug: "dravidian",
    name: "Dravidian",
    approxSpeakers: 250000000,
    notes: "~70 languages, primarily Southern India and Sri Lanka.",
    branches: [
      {
        name: "South Dravidian",
        languages: [
          { name: "Tamil", family: "Dravidian", branch: "South Dravidian", speakers: 86000000, iso639: "tam" },
          { name: "Kannada", family: "Dravidian", branch: "South Dravidian", speakers: 56000000, iso639: "kan" },
          { name: "Malayalam", family: "Dravidian", branch: "South Dravidian", speakers: 36000000, iso639: "mal" },
        ],
      },
      {
        name: "South-Central Dravidian",
        languages: [{ name: "Telugu", family: "Dravidian", branch: "South-Central", speakers: 96000000, iso639: "tel" }],
      },
    ],
  },
  {
    slug: "turkic",
    name: "Turkic",
    approxSpeakers: 200000000,
    notes: "~35 languages stretching from Turkey to Siberia.",
    branches: [
      {
        name: "Oghuz",
        languages: [
          { name: "Turkish", family: "Turkic", branch: "Oghuz", speakers: 88000000, iso639: "tur" },
          { name: "Azerbaijani", family: "Turkic", branch: "Oghuz", speakers: 24000000, iso639: "aze" },
          { name: "Turkmen", family: "Turkic", branch: "Oghuz", speakers: 7000000, iso639: "tuk" },
        ],
      },
      {
        name: "Karluk / Kipchak / Siberian",
        languages: [
          { name: "Uzbek", family: "Turkic", branch: "Karluk", speakers: 34000000, iso639: "uzb" },
          { name: "Kazakh", family: "Turkic", branch: "Kipchak", speakers: 13000000, iso639: "kaz" },
          { name: "Uyghur", family: "Turkic", branch: "Karluk", speakers: 10000000, iso639: "uig" },
          { name: "Kyrgyz", family: "Turkic", branch: "Kipchak", speakers: 5000000, iso639: "kir" },
        ],
      },
    ],
  },
  {
    slug: "japonic",
    name: "Japonic",
    approxSpeakers: 128000000,
    notes: "Japanese and the endangered Ryukyuan languages.",
    branches: [
      {
        name: "Japanese-Ryukyuan",
        languages: [
          { name: "Japanese", family: "Japonic", branch: "Japanese", speakers: 125000000, iso639: "jpn" },
          { name: "Okinawan", family: "Japonic", branch: "Ryukyuan", speakers: 100000, iso639: "ryu" },
        ],
      },
    ],
  },
  {
    slug: "koreanic",
    name: "Koreanic",
    approxSpeakers: 81000000,
    notes: "Korean and Jeju. Sometimes proposed to be part of the Altaic macro-family (disputed).",
    branches: [
      {
        name: "Koreanic",
        languages: [
          { name: "Korean", family: "Koreanic", branch: "Koreanic", speakers: 81000000, iso639: "kor" },
          { name: "Jeju", family: "Koreanic", branch: "Koreanic", speakers: 5000, iso639: "jje" },
        ],
      },
    ],
  },
  {
    slug: "uralic",
    name: "Uralic",
    approxSpeakers: 25000000,
    notes: "Finno-Ugric and Samoyedic. Historical link with Altaic/Indo-European hypothesized but unproven.",
    branches: [
      {
        name: "Finno-Ugric",
        languages: [
          { name: "Hungarian", family: "Uralic", branch: "Finno-Ugric", speakers: 13000000, iso639: "hun" },
          { name: "Finnish", family: "Uralic", branch: "Finno-Ugric", speakers: 5400000, iso639: "fin" },
          { name: "Estonian", family: "Uralic", branch: "Finno-Ugric", speakers: 1100000, iso639: "est" },
          { name: "Sami", family: "Uralic", branch: "Finno-Ugric", speakers: 25000, iso639: "smi" },
        ],
      },
    ],
  },
  {
    slug: "tai-kadai",
    name: "Tai-Kadai (Kra-Dai)",
    approxSpeakers: 93000000,
    notes: "Mainland Southeast Asia; tonal.",
    branches: [
      {
        name: "Tai",
        languages: [
          { name: "Thai", family: "Tai-Kadai", branch: "Tai", speakers: 60000000, iso639: "tha" },
          { name: "Lao", family: "Tai-Kadai", branch: "Tai", speakers: 30000000, iso639: "lao" },
          { name: "Zhuang", family: "Tai-Kadai", branch: "Tai", speakers: 16000000, iso639: "zha" },
        ],
      },
    ],
  },
  {
    slug: "austroasiatic",
    name: "Austroasiatic",
    approxSpeakers: 117000000,
    notes: "Vietnamese and Khmer are the major members; many smaller languages in India and Indochina.",
    branches: [
      {
        name: "Mon-Khmer",
        languages: [
          { name: "Vietnamese", family: "Austroasiatic", branch: "Vietic", speakers: 86000000, iso639: "vie" },
          { name: "Khmer", family: "Austroasiatic", branch: "Khmeric", speakers: 17000000, iso639: "khm" },
          { name: "Mon", family: "Austroasiatic", branch: "Monic", speakers: 850000, iso639: "mnw" },
        ],
      },
      {
        name: "Munda",
        languages: [{ name: "Santali", family: "Austroasiatic", branch: "Munda", speakers: 7600000, iso639: "sat" }],
      },
    ],
  },
  {
    slug: "isolates",
    name: "Language isolates & misc.",
    approxSpeakers: 6000000,
    notes: "Languages with no demonstrated genetic relatives.",
    branches: [
      {
        name: "Isolates",
        languages: [
          { name: "Basque", family: "Isolate", speakers: 750000, iso639: "eus", notes: "Pre-Indo-European Iberian survivor" },
          { name: "Korean", family: "Isolate / Koreanic", speakers: 81000000, iso639: "kor", notes: "Often analyzed as its own micro-family" },
          { name: "Ainu", family: "Isolate", speakers: 10, iso639: "ain", notes: "Critically endangered (Japan/Russia)" },
          { name: "Burushaski", family: "Isolate", speakers: 96000, iso639: "bsk", notes: "Spoken in Hunza, Pakistan" },
          { name: "Mapudungun", family: "Isolate?", speakers: 250000, iso639: "arn", notes: "Mapuche, Chile/Argentina" },
        ],
      },
    ],
  },
];

// Category styles for IPA chart cells

export const CATEGORY_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  plosive: { bg: "#3b4252", border: "#5e81ac", text: "#eceff4", label: "plosive" },
  nasal: { bg: "#4c566a", border: "#88c0d0", text: "#eceff4", label: "nasal" },
  trill: { bg: "#3a3f55", border: "#81a1c1", text: "#eceff4", label: "trill" },
  tap: { bg: "#3a3f55", border: "#81a1c1", text: "#eceff4", label: "tap/flap" },
  fricative: { bg: "#5d4e3a", border: "#ebcb8b", text: "#eceff4", label: "fricative" },
  "lateral-fricative": { bg: "#5d4e3a", border: "#d08770", text: "#eceff4", label: "lateral fricative" },
  approximant: { bg: "#3b5e4a", border: "#a3be8c", text: "#eceff4", label: "approximant" },
  "lateral-approximant": { bg: "#3b5e4a", border: "#a3be8c", text: "#eceff4", label: "lateral approximant" },
  vowel: { bg: "#5b3d52", border: "#b48ead", text: "#eceff4", label: "vowel" },
  click: { bg: "#3a4252", border: "#bf616a", text: "#eceff4", label: "click" },
  implosive: { bg: "#3a4252", border: "#bf616a", text: "#eceff4", label: "implosive" },
  ejective: { bg: "#3a4252", border: "#bf616a", text: "#eceff4", label: "ejective" },
};
