import Link from "next/link";

type FieldEntry = {
  slug: string;
  name: string;
  blurb: string;
  families: number;
};

type FieldGroup = {
  name: string;
  tagline: string;
  fields: FieldEntry[];
};

const GROUPS: FieldGroup[] = [
  {
    name: "Formal Sciences",
    tagline: "Abstract structures, formal systems, and computation.",
    fields: [
      { slug: "mathematics",      name: "Mathematics",      blurb: "Number, structure, space, and change — from algebra to analysis.",                  families: 18 },
      { slug: "statistics",       name: "Statistics",       blurb: "Inference, estimation, and probabilistic reasoning under uncertainty.",            families: 26 },
      { slug: "logic",            name: "Logic",            blurb: "Formal systems of reasoning — propositional, predicate, modal, and beyond.",       families: 18 },
      { slug: "computer-science", name: "Computer Science", blurb: "Algorithms, complexity, systems, languages, and machine learning.",                families: 22 },
    ],
  },
  {
    name: "Natural Sciences",
    tagline: "The empirical study of the physical universe.",
    fields: [
      { slug: "physics",         name: "Physics",         blurb: "Classical mechanics through quantum field theory and cosmology.",         families: 24 },
      { slug: "chemistry",       name: "Chemistry",       blurb: "Matter, bonding, reactions, thermodynamics, and the periodic table.",     families: 21 },
      { slug: "biology",         name: "Biology",         blurb: "Life from molecules to ecosystems — cell, genetics, evolution, ecology.", families: 20 },
      { slug: "neuroscience",    name: "Neuroscience",    blurb: "Nervous systems, cognition, and the biological basis of behavior.",       families: 19 },
      { slug: "physiology",      name: "Physiology",      blurb: "Mechanisms of life — homeostasis, organ-system function, and integrative regulation.", families: 18 },
      { slug: "astronomy",       name: "Astronomy",       blurb: "Stars, galaxies, planets, cosmology, and observational techniques.",      families: 21 },
      { slug: "earth-sciences",  name: "Earth Sciences",  blurb: "Atmosphere, oceans, climate, and the Earth system.",                      families: 18 },
      { slug: "geology",         name: "Geology",         blurb: "Minerals, tectonics, deep time, and the solid Earth.",                    families: 24 },
    ],
  },
  {
    name: "Social Sciences",
    tagline: "Human behavior, societies, and economies.",
    fields: [
      { slug: "psychology",   name: "Psychology",   blurb: "Cognition, perception, development, personality, and clinical practice.",   families: 22 },
      { slug: "sociology",    name: "Sociology",    blurb: "Social structures, institutions, stratification, and collective action.",   families: 22 },
      { slug: "anthropology", name: "Anthropology", blurb: "Human cultures, archaeology, kinship, and biological anthropology.",        families: 16 },
      { slug: "linguistics",  name: "Linguistics",  blurb: "Phonology, syntax, semantics, historical and computational linguistics.",   families: 22 },
      { slug: "economics",    name: "Economics",    blurb: "Markets, incentives, macroeconomic aggregates, and behavioral economics.",  families: 22 },
      { slug: "finance",      name: "Finance",      blurb: "Asset pricing, corporate finance, derivatives, and portfolio theory.",      families: 20 },
    ],
  },
  {
    name: "Applied & Professional",
    tagline: "Engineered systems, medicine, law, and governance.",
    fields: [
      { slug: "engineering", name: "Engineering", blurb: "Mechanical, electrical, civil, chemical, and systems engineering.", families: 24 },
      { slug: "medicine",    name: "Medicine",    blurb: "Clinical specialties from cardiology to oncology and public health.", families: 20 },
      { slug: "law",         name: "Law",         blurb: "Constitutional, criminal, civil, and procedural law.",                families: 22 },
      { slug: "tax-law",     name: "Tax Law",     blurb: "Income, corporate, estate, international, and procedural tax law.",    families: 20 },
      { slug: "ip-law",      name: "IP Law",      blurb: "Patents, trademarks, copyright, trade secrets, and licensing.",        families: 20 },
      { slug: "governance",  name: "Governance",  blurb: "Institutional design, elections, regulation, and accountability.",     families: 21 },
      { slug: "sports",      name: "Sports & Sport Science", blurb: "Sports families A–E plus Section F on the physiology, biomechanics, and methodology of athletic performance.", families: 19 },
    ],
  },
  {
    name: "Humanities",
    tagline: "Texts, traditions, and the long arc of human thought.",
    fields: [
      { slug: "philosophy", name: "Philosophy", blurb: "Metaphysics, epistemology, ethics, philosophy of mind and language.",   families: 21 },
      { slug: "history",    name: "History",    blurb: "Periods, regions, methodology, and historiography.",                    families: 24 },
      { slug: "ideologies", name: "Ideologies", blurb: "Political and economic worldviews — liberalism, conservatism, and the rest.", families: 20 },
    ],
  },
];

export default function FieldsHubPage() {
  const totalFields = GROUPS.reduce((s, g) => s + g.fields.length, 0);
  const totalFamilies = GROUPS.reduce(
    (s, g) => s + g.fields.reduce((ss, f) => ss + f.families, 0),
    0,
  );

  return (
    <div className="space-y-10">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Fields — Working Taxonomies</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          Hand-built field guides to {totalFields} disciplines, each organized into families
          and entries with key facts, formulas, and examples. These taxonomies anchor the
          claim-receipt system in a stable reference layer so case-study claims can
          cross-reference foundational concepts rather than redefining them.
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {totalFields} fields · {totalFamilies} families · {GROUPS.length} groupings
        </p>
      </div>

      {GROUPS.map((group) => (
        <section key={group.name} className="space-y-4">
          <div className="border-l-2 border-gray-700 pl-4">
            <h2 className="text-lg font-semibold text-gray-100">{group.name}</h2>
            <p className="mt-1 text-xs text-gray-500">{group.tagline}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.fields.map((f) => (
              <Link
                key={f.slug}
                href={`/${f.slug}`}
                className="block rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3 hover:border-gray-600 hover:bg-gray-900/70 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white group-hover:text-gray-100">
                      {f.name}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500 leading-relaxed">{f.blurb}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-mono text-gray-600">
                      <span className="text-gray-400">{f.families}</span> families
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
