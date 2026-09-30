# Context for the log below

I'm building **Epistemic Receipts**, a database that tracks the *status* of factual
claims over time — not whether a claim is true, but when it was first recorded,
contested, or settled. Example: the trajectory of "cigarette smoking causes lung
cancer" from the first 1939 case-control study to 1964 institutional consensus.

The block at the bottom is **raw, unedited stdout** from a read-only diagnostic
script (`scripts/inspect-whitepaper-claims.ts`). It writes nothing to the database
— it just prints two claim rows cited in my whitepaper (Surgeon General 1964 [1]
and Müller 1939 [2]) plus a de-duplication scan of existing smoking/tobacco claims.
Every field is printed verbatim from a database column.

Two things in it look contradictory. Here's the real reason for each — please
verify against `prisma/schema.prisma` rather than taking my word for it:

- **`currentStatus: DISPUTED` next to `epistemicAxis: SETTLED` on the smoking rows.**
  `epistemicAxis` is the live status field (`RECORDED | SETTLED | CONTESTED | OPEN |
  UNRESOLVABLE`) and reads **SETTLED**, which is authoritative. `currentStatus` is a
  **deprecated** column: the schema comments it `// DEPRECATED — use epistemicAxis`
  and declares `@default("DISPUTED")`. These seed rows never set it, so it's showing
  that default. It is **not** a claim that the smoking–cancer link is scientifically
  disputed — that link is settled consensus. If that story doesn't match the schema,
  call it out.

- **`RETRACTED` / `WITHDRAWN` prefixes in the sibling list.** Those are bibliographic
  tags my corpus indexes on purpose (I track retractions as first-class data). They're
  expected here, not an error.

**What I'd like from you** (replace with your real ask):
1. Sanity-check that the two claims are modeled and sourced correctly for publication,
   and flag any field that looks wrong or internally inconsistent.
2. From the ~60 sibling smoking/tobacco rows, tell me which — if any — are true
   duplicates of these two trajectories versus merely topically adjacent.

Ask me for anything you need — the schema, the script source, or a source record.

--- raw script output follows (verbatim; unmodified) ---

```text

==============================================================================
paper ref [1] — Surgeon General 1964
claims/cmqwoxe6l07dy8o0y6xrs8xnv
==============================================================================
text            : On 11 January 1964 the US Surgeon General's Advisory Committee released "Smoking and Health," the first federal report officially concluding that cigarette smoking is a cause of lung cancer in men and a probable cause of other diseases.
externalId      : trajectory:surgeon-general-smoking-report-1964
claimType       : EMPIRICAL   epistemicAxis: SETTLED   epistemicStatus: null
currentStatus   : DISPUTED   verificationStatus: null
humanReviewed   : false (confidence=null, at=null, by=null)
claimEmergedAt  : 1964-01-11 (DAY)
ingestedBy      : seed:human-history-trajectories   autoApproved: true   deleted: false   createdAt: 2026-06-27
metadata        : null

-- statusHistory (2 rows) --
  seq=1  ∅ → RECORDED  @ 1964-01-11 (DAY)  [INSTITUTIONAL]
      reason : Although epidemiological studies through the 1950s had linked smoking to lung cancer, the question remained publicly contested and disputed by the tobacco industry. Surgeon General Luther Terry's Advisory Committee reviewed more than 7,000 studies and released its report on a Saturday to limit stock-market disruption, officially concluding that cigarette smoking causes lung cancer in men — with smokers facing a nine- to ten-fold risk and heavy smokers at least a twenty-fold risk — and is the most important cause of chronic bronchitis. The federal government thereby placed the smoking–cancer link on the official record.
      marker : src:surgeon-general-smoking-health-1964 | Smoking and Health: Report of the Advisory Committee to the Surgeon General, 11 January 1964 — US National Library of Medicine. | https://profiles.nlm.nih.gov/spotlight/nn/feature/smoking | pub=1964-01-11 | primary
  seq=2  RECORDED → SETTLED  @ 1965-07-27 (DAY)  [INSTITUTIONAL]
      reason : The report prompted direct legislative and regulatory action: the Federal Cigarette Labeling and Advertising Act of 27 July 1965 mandated health warnings on cigarette packages, and belief in the smoking–cancer link rose from 44% of Americans in 1958 to 78% by 1968. The conclusion that smoking causes lung cancer has been reaffirmed by every subsequent Surgeon General and is settled biomedical and public-health consensus.
      marker : src:cigarette-labeling-act-1965 | Federal Cigarette Labeling and Advertising Act of 1965 mandating package health warnings. | https://en.wikipedia.org/wiki/Federal_Cigarette_Labeling_and_Advertising_Act | pub=1965-07-27 | derivative

-- edges (2, non-deleted) --
  FOR/EVIDENTIARY  ingestedBy=manual  humanReviewed=false  edgeId=cmqwoxe8p07e18o0yj89a0fmv
      source : src:surgeon-general-smoking-health-1964 | Smoking and Health: Report of the Advisory Committee to the Surgeon General, 11 January 1964 — US National Library of Medicine. | https://profiles.nlm.nih.gov/spotlight/nn/feature/smoking | pub=1964-01-11 | primary | reviewed=false
  FOR/EVIDENTIARY  ingestedBy=manual  humanReviewed=false  edgeId=cmqwoxeax07e48o0y7dbe0lc3
      source : src:cigarette-labeling-act-1965 | Federal Cigarette Labeling and Advertising Act of 1965 mandating package health warnings. | https://en.wikipedia.org/wiki/Federal_Cigarette_Labeling_and_Advertising_Act | pub=1965-07-27 | derivative | reviewed=false

-- thresholdEvents (0) --

==============================================================================
paper ref [2] — Müller 1939
claims/cmqoappnu03yxsadpa90nu942
==============================================================================
text            : Franz Hermann Müller published in 1939 in Zeitschrift für Krebsforschung the first case-control epidemiological study reporting that lung-cancer patients had smoked far more heavily than matched controls, the earliest statistical evidence that cigarette smoking causes lung cancer.
externalId      : trajectory:muller-case-control-smoking-lung-cancer-1939
claimType       : EMPIRICAL   epistemicAxis: SETTLED   epistemicStatus: null
currentStatus   : DISPUTED   verificationStatus: null
humanReviewed   : false (confidence=null, at=null, by=null)
claimEmergedAt  : 1939-01-01 (YEAR)
ingestedBy      : seed:medicine-trajectories   autoApproved: true   deleted: false   createdAt: 2026-06-21
metadata        : null

-- statusHistory (2 rows) --
  seq=1  ∅ → RECORDED  @ 1939-01-01 (YEAR)  [EXPERT_LITERATURE]
      reason : Müller, a Cologne physician, compared 86 lung-cancer cases with a like number of controls and found the cases had consumed roughly twice as much tobacco, concluding that the 'extraordinary rise' in lung carcinoma was attributable to tobacco abuse. This recorded the first case-control statistical association between smoking and lung cancer — over a decade before the better-known Anglo-American studies — but received little international attention amid wartime Germany.
      marker : src:muller-tabakmissbrauch-lungencarcinom-1939 | Müller FH. Tabakmißbrauch und Lungencarcinom. Zeitschrift für Krebsforschung. 1939;49:57–85. | https://doi.org/10.1007/BF01633114 | pub=1939-01-01 | primary
  seq=2  RECORDED → SETTLED  @ 1950-09-30 (MONTH)  [EXPERT_LITERATURE]
      reason : Independent large case-control studies — Doll & Hill in the BMJ and Wynder & Graham in JAMA, both in 1950 — confirmed the strong dose-dependent smoking/lung-cancer association that Müller had first recorded, after which the causal claim moved from an isolated, ignored report to settled expert consensus (later institutionalised by the 1964 US Surgeon General report). Schultz's 2012 reassessment documents the originality and substantial vindication of Müller's 1939 priority.
      marker : src:schultz-mueller-1939-reassessment-2012 | Schultz M. Quality, originality, and significance of the 1939 'Tobacco consumption and lung carcinoma' article by Mueller, including translation of a section of the paper. Cancer Epidemiology. 2012;36(6):e387–e389. | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3640840/ | pub=2012-12-01 | derivative

-- edges (2, non-deleted) --
  FOR/EVIDENTIARY  ingestedBy=manual  humanReviewed=false  edgeId=cmqoapppt03z0sadp05wtul00
      source : src:muller-tabakmissbrauch-lungencarcinom-1939 | Müller FH. Tabakmißbrauch und Lungencarcinom. Zeitschrift für Krebsforschung. 1939;49:57–85. | https://doi.org/10.1007/BF01633114 | pub=1939-01-01 | primary | reviewed=false
  FOR/EVIDENTIARY  ingestedBy=manual  humanReviewed=false  edgeId=cmqoapprv03z3sadppn86l3mh
      source : src:schultz-mueller-1939-reassessment-2012 | Schultz M. Quality, originality, and significance of the 1939 'Tobacco consumption and lung carcinoma' article by Mueller, including translation of a section of the paper. Cancer Epidemiology. 2012;36(6):e387–e389. | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3640840/ | pub=2012-12-01 | derivative | reviewed=false

-- thresholdEvents (0) --

==============================================================================
SIBLING SCAN — existing smoking/tobacco claims (dedup guard)
==============================================================================
found 60 (showing ≤60; transitions in parens)
  (1) 00047a48-384b-4c0f-8b43-6362631febac  openalex_W2985393199  reviewed=false  via=openalex_v1
      OBJECTIVE: Recently, long non-coding ribonucleic acids (lncRNAs) have attracted more attention for their roles…
  (1) 00b9770b-1354-424d-a7a0-1b5498a533b0  openalex_W1975640406  reviewed=false  via=openalex_v1
      Pemetrexed is approved for first-line and maintenance treatment of patients with advanced or metastatic non-sm…
  (1) 00eba089-d4de-45ed-af69-71169f2f5ca9  openalex_W2738526714  reviewed=false  via=openalex_v1
      RETRACTED: MiR-101-3p inhibits the growth and metastasis of non-small cell lung cancer through blocking PI3K/A…
  (1) 01263108-eb93-4aed-9e20-27c74e728099  openalex_W2168911329  reviewed=false  via=openalex_journals_v1
      Lower IQ is associated with earlier death, but the cause of the relationship is unknown. In the present study,…
  (2) 01bb8fb6-9632-45d0-b584-d146ec0ef3d5  openalex_W2884216036  reviewed=false  via=openalex_v1
      The above article from the Journal of Cellular Biochemistry, published online on 27 January 2018 in Wiley Onli…
  (1) 022d4087-cef1-4d25-9468-9a2447797e04  openalex_W4206681931  reviewed=false  via=openalex_v1
      At present, the diagnosis and treatment of lung cancer have always been one of the research hotspots in the me…
  (1) 036a1172-4679-45f8-93c6-1b2f58d7040e  openalex_W2948227062  reviewed=false  via=openalex_v1
      Lung cancer is one of the most common malignancies and is an increasing cause of cancer-related deaths. In our…
  (1) 049f4337-2c4d-4f29-a6f8-ad66cbe11839  openalex_W4229913640  reviewed=false  via=openalex_v1
      Retraction: 'LncRNA H19 promotes epithelial-mesenchymal transition (EMT) by targeting miR-484 in human lung ca…
  (1) 06203f51-ff1a-494f-ae35-efb5560260ce  openalex_W2588491876  reviewed=false  via=openalex_v1
      Re: Ling Y-H, Li T, Yuan Z, Haigentz M, Jr., Weber TK, and Perez-Soler R (2007) Erlotinib, an Effective Epider…
  (1) 0622ce95-adf6-4ee4-b738-3c717b55b940  openalex_W2978041893  reviewed=false  via=openalex_v1
      Introduction: Nicotine is the most important alkaloid compound in tobacco and is a major risk factor in the de…
  (1) 075d7223-fb8f-4a5f-ba57-007a31c5ec62  openalex_W3026632171  reviewed=false  via=openalex_journals_v1
      Studies of the interaction of psychological and pharmacological determinants of smoking: V. Psychological and …
  (1) 095d5217-4b15-47c0-9efd-ffc36c839876  openalex_W2991511743  reviewed=false  via=openalex_v1
      The role of linc00472 in lung cancer (LC) has been rarely reported. We aimed to study the role of linc00472 in…
  (1) 0b2eaf7c-b8c0-4eb0-9615-032d55ae4ba3  openalex_W4304588489  reviewed=false  via=openalex_v1
      Human lung cancer (LC) cells A549/H358, normal lung epithelial cells BEAS-2B, and lung normal fibroblasts (NFs…
  (1) 0b32bcf0-6b3d-44eb-ae5e-ef61151a54da  openalex_W4391310202  reviewed=false  via=openalex_v1
      Importance: Electronic cigarettes (ECs) are often used by smokers as an aid to stopping smoking, but evidence …
  (1) 0d6501d2-69ef-47c1-b6ca-53060e334f60  openalex_W2347652418  reviewed=false  via=openalex_v1
      Although treatment of BRAF V600E-mutant non-small cell lung cancer (NSCLC(V600E)) with GSK2118436 has shown an…
  (1) 0d88b321-be57-4027-b9fe-f3f6428107b6  openalex_W4224951782  reviewed=false  via=openalex_v1
      This article refers to:RETRACTED ARTICLE: Repression of lncRNA-SVUGP2 mediated by EZH2 contributes to the deve…
  (1) 0e57ecc8-f8eb-4af1-b871-94bb7c9755d6  openalex_W2987161714  reviewed=false  via=openalex_v1
      BACKGROUND: Accumulating evidence supports the involvement of microRNAs (miRNAs) in the progression of human c…
  (1) 0ef55cb0-50e0-41c6-9d09-432c76fb2cf7  openalex_W4312956094  reviewed=false  via=openalex_v1
      The leading cause of death in the world is lung cancer. Routine screening is important because it improves out…
  (1) 0f325a2c-b1f3-4ef4-9d39-6eb4b80b8c51  openalex_W2998999015  reviewed=false  via=openalex_v1
      The aim of the present study was to explore the anti‑cancer effects of total flavonoids (TF) on lung cancer an…
  (1) 0f68d975-855f-435b-bb80-5f58ecdac13f  openalex_W4237437145  reviewed=false  via=openalex_v1
      Retraction: ''MicroRNA-198 inhibition of HGF/c-MET signaling pathway overcomes resistance to radiotherapy and …
  (1) 0fc53a03-6dc8-420b-a063-e1467af7bb21  openalex_W4322625693  reviewed=false  via=openalex_v1
      WITHDRAWN: Copper oxide and ferrous oxide nanoparticles stabilized in Arabic gum biopolymer: Synthesis, charac…
  (2) 104068f9-e7ea-4a1e-9171-17a9f349c949  openalex_W4205205022  reviewed=false  via=openalex_v1
      RETRACTED ARTICLE: Research on accurate estimation of economic benefits of tobacco enterprises based on multi …
  (1) 107104f3-fedd-4d8e-ad62-762bcc64f27a  openalex_W3013525035  reviewed=false  via=openalex_v1
      RETRACTED ARTICLE: Near Infrared Light-Actuated PEG Wrapping Carbon Nanodots Loaded Cisplatin for Targeted The…
  (1) 10e6cd31-8de9-410b-8697-0f89dcd0ffc0  openalex_W2050163762  reviewed=false  via=openalex_journals_v1
      Studies of the interaction of psychological and pharmacological determinants of smoking: IV. Effects of stress…
  (2) 112de36b-bb6c-4a2a-93f2-acef28e37dea  openalex_W2773670245  reviewed=false  via=openalex_v1
      Development of a nanoliposomal formulation of erlotinib for lung cancer and in vitro/in vivo antitumoral evalu…
  (1) 1274a73b-1de7-49f9-a783-9abc743e32b6  openalex_W2022813849  reviewed=false  via=openalex_journals_v1
      Studies of the interaction of psychological and pharmacological determinants of smoking: Some Replies to Schnu…
  (1) 12dbaa99-ff58-489a-8048-1c4eff8ec9d7  openalex_W3087548629  reviewed=false  via=openalex_journals_v1
      The effectiveness of plain packaging in discouraging tobacco consumption in Australia
  (1) 135f8ba6-47fb-444a-b805-01e687af632e  openalex_W4280625529  reviewed=false  via=openalex_v1
      Background: Lovastatin is an inhibitor of 3-hydroxy-3-methylglutaryl-CoA reductase, effectively inhibiting cho…
  (1) 13afbea1-1f49-4416-a7ec-4166cb9289b9  openalex_W2965225249  reviewed=false  via=openalex_v1
      BACKGROUND: Circular RNAs (circRNAs) have been considered as key regulators of cancer biology. However, the fu…
  (1) 141a8839-4057-4946-8e13-1ee85504ed00  openalex_W3128816757  reviewed=false  via=openalex_v1
      The mortality rate of non-small-cell lung cancer (NSCLC) remains high worldwide. Although cisplatin-based chem…
  (1) 1575529b-7765-4500-be84-4505486194a6  openalex_W2799919708  reviewed=false  via=openalex_v1
      Lung cancer is a commonly diagnosed disease with poor prognosis. Novel therapeutic targets and deep understand…
  (1) 15c74240-864e-41eb-9c9b-da2f85cd30e5  openalex_W3128657256  reviewed=false  via=openalex_v1
      RETRACTED ARTICLE: Two Co(II) coordination polymers: treatment activity on non-small cell lung cancer by induc…
  (1) 161e9c63-e6ee-4abd-b933-062fd3329cc4  openalex_W3121948843  reviewed=false  via=openalex_v1
      The involvement of fibroblast growth factor-2 (FGF-2) in the biology of small cell lung cancer (SCLC) has not …
  (1) 163a19dd-094f-41d4-90cd-d829244a4b98  openalex_W3120109347  reviewed=false  via=openalex_v1
      OBJECTIVE: To study the effect and potential mechanism of LKB1 on non-small cell lung cancer (NSCLC) A549 cell…
  (1) 16ab0ad7-1b38-41b3-84b3-fc2c8cea8f6f  openalex_W4289783522  reviewed=false  via=openalex_journals_v1
      Rare genetic variants explain missing heritability in smoking
  (1) 172b1366-0528-49de-b746-0e81a50c930b  openalex_W4315836480  reviewed=false  via=openalex_v1
      There is a lot of information in the medical services industry. With such a big amount of data, the illness ca…
  (1) 17f579c5-d30c-4049-9d0e-6e2991102534  openalex_W4221084466  reviewed=false  via=openalex_v1
      Retraction notice to “Kaempferol suppresses proliferation but increases apoptosis and autophagy by up-regulati…
  (1) 1873cc38-3748-4662-8316-dd7d5168fe2c  openalex_W4224994328  reviewed=false  via=openalex_v1
      The flavoring process ensures the quality of cigarettes by endowing them with special tastes. In this process,…
  (1) 1abfb400-e685-49a2-b948-1a0df8b1428d  openalex_W2896904817  reviewed=false  via=openalex_v1
      BACKGROUND: A growing number of microRNAs have been proved to play significant roles in limiting tumor growth …
  (1) 1bb6579d-11f0-4fad-9e73-8d64e5808a19  openalex_W2006261269  reviewed=false  via=openalex_v1
      RETRACTED: PIM1 kinase inhibitors induce radiosensitization in non-small cell lung cancer cells
  (1) 1c0f1659-c683-4389-95b0-4ecb0b34290d  openalex_W3023198060  reviewed=false  via=openalex_v1
      Recently, microRNA-367 (miR-367) has been reported to function as both tumor suppressor and oncogene in severa…
  (1) 1c0f3f64-b2b8-4b26-a9c6-36b1b886b5c3  openalex_W2898108270  reviewed=false  via=openalex_v1
      RETRACTED ARTICLE: Lung cancer prediction using higher-order recurrent neural network based on glowworm swarm …
  (1) 1c2122b2-79a2-4b21-95cf-10cf7404c08a  openalex_W4382053714  reviewed=false  via=openalex_v1
      Alcohol and cigarette use are both rising annually. Alcohol and tobacco are portrayed in movies as symbols of …
  (1) 1c5b664f-7d63-439f-8dea-8289dc892f40  openalex_W2791270153  reviewed=false  via=openalex_v1
      Propofol has been widely used in lung cancer resections. Some studies have demonstrated that the effects of pr…
  (1) 1cdcfc60-3461-4b5f-a3ba-f334d6bf41df  openalex_W4285819106  reviewed=false  via=openalex_v1
      Previous studies have shown that sevoflurane has an inhibitory effect on tumor cells. So far, the effect of se…
  (1) 1d7171ae-693e-4b84-b29a-e854a9a3dd3a  openalex_W4220781239  reviewed=false  via=openalex_v1
      In the current study, two new Co(II) coordination polymers (CPs) with the chemical formulae of {[Co2(H3L)2(2,2…
  (1) 1dd2176c-1435-4657-ae4a-ef2fe9c9241c  openalex_W2127845314  reviewed=false  via=openalex_v1
      Conspiracist ideation has been repeatedly implicated in the rejection of scientific propositions, although emp…
  (1) 1f175910-0fc0-4242-8ede-8be0de220d40  openalex_W2974436066  reviewed=false  via=openalex_v1
      OBJECTIVE: The aim of this study was to clarify the function of long noncoding ribonucleic acids (lncRNAs) sma…
  (1) 1f20c362-0a5a-4aba-a775-0b6333270e0e  openalex_W2919722460  reviewed=false  via=openalex_v1
      A novel series of 1,4‐disubstituted‐1,2,3‐triazole derivatives 3a – l and 5a – i were one‐pot synthesized via …
  (1) 1fa433c6-63b8-42fa-95be-d843c06a5d27  openalex_W2468673868  reviewed=false  via=openalex_v1
      Non-small cell lung cancer (NSCLC) is the leading cause of cancer-related mortality worldwide. However, there …
  (1) 20432332-c6d3-4bf0-8fb3-4a0d2ae644d2  openalex_W3127708940  reviewed=false  via=openalex_v1
      Lung cancer is one of the major cause for high-death rate all over the world, due to increased metastasize and…
  (1) 206cf973-454f-4f93-96ef-8c126bde3771  openalex_W2124945157  reviewed=false  via=openalex_v1
      Worldwide, lung cancer is the most common form of cancer. Saffron has been used in folk medicine for centuries…
  (1) 21697eb7-9424-4702-be95-279b28f3baa7  openalex_W1969493581  reviewed=false  via=openalex_journals_v1
      Studies of the interaction of psychological and pharmacological determinants of smoking: III. Social life, cig…
  (1) 2170d2cf-d9ba-4805-9d46-388044b4964c  openalex_W2768551833  reviewed=false  via=openalex_v1
      BACKGROUND: Recent studies have indicated that microRNAs (miRNAs) are closely related to lung cancer. However,…
  (1) 219716c6-973d-4166-9d13-6553b7ea8bdc  openalex_W2345149783  reviewed=false  via=openalex_v1
      Recent studies have demonstrated that acquisition of epithelial-mesenchymal transition (EMT) is associated wit…
  (2) 21c8a192-1c59-4ab0-ad7a-70d279120b8c  openalex_W3194012250  reviewed=false  via=openalex_v1
      RETRACTED: Enhanced AC133-specific CAR T cell therapy induces durable remissions in mice with metastatic small…
  (1) 227c68c8-2605-429d-9f24-11340901139d  openalex_W2955216069  reviewed=false  via=openalex_v1
      BACKGROUND: In non-small cell lung cancer, response rates to chemotherapy given after immune checkpoint inhibi…
  (1) 255c2e44-de51-4ec9-b816-34d8bb55c11c  openalex_W4386563550  reviewed=false  via=openalex_v1
      BACKGROUND: Provisional fixed dental prosthesis (FDP) plays an important role during fixed prosthodontic thera…
  (1) 25ec3802-3aa9-4ceb-b74f-206309a5a166  openalex_W4206769360  reviewed=false  via=openalex_v1
      Non-small-cell lung cancer (NSCLC) is defined as the most universally diagnosed class of lung cancer. Cisplati…
  (1) 2745427b-7f5a-4deb-9ebe-99638267f282  openalex_W2025937740  reviewed=false  via=openalex_v1
      BACKGROUND: Thymidylate synthase (TS), a key enzyme in the de novo synthesis of thymidine, is an important che…

Done (read-only — nothing written).
```
