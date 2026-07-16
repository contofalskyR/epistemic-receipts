# B15 Error-Rate Audit — Worksheet: openalex:enrichment

**Stratum:** openalex × enrichment transition  
**Population:** 11,228  
**Sampled:** 10  
**Cutoff:** 2026-07-16T18:16:44.042Z  
**Seed:** 1814377032  

## Verdict guide

| Code | Meaning |
|------|---------|
| CORRECT | Date, axis, community, and source all check out against the live source |
| WRONG_DATE | Source supports the event but not the recorded date or precision |
| WRONG_AXIS | Event is real but status classification is unsupportable |
| SOURCE_MISMATCH | Cited source does not support the transition at all |
| IDENTITY_MISMATCH | Claim text does not match the work its DOI/OpenAlex anchor resolves to |
| UNVERIFIABLE | Source dead/paywalled; no substitute found (reported separately, not counted as error) |

*Secondary flags (may co-occur with verdict): DEAD_LINK, PRECISION_SHARPENING*

---

## Row 1/10 · CSH.id: b50efee0-dfc7-4714-9311-56624c52ccd1:retraction:1

**Claim (first 200 chars):** RETRACTED: The role of applied problems in the training of future mathematics teachers in the 21st century  
**Claim ID:** b50efee0-dfc7-4714-9311-56624c52ccd1  
**Pipeline:** openalex_v1  
**External ID:** openalex_W3200938039  
**Transition:** RECORDED → REVERSED  
**Date:** 2022-10-04 (precision: DAY)  
**Community:** EXPERT_LITERATURE  
**Reason:** Compromised Peer Review  
**Source URL:** https://doi.org/10.1016/j.tsc.2021.100945  
**Source name:** Retraction: "The role of applied problems in the training of future mathematics teachers in t" — Thinking Skills and Creativity  

**Pre-fetched evidence snippet:**

> Handle Redirect https://linkinghub.elsevier.com/retrieve/pii/S1871187121001607

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 2/10 · CSH.id: 23aaf58d-2a93-4dd0-889f-5cb34ab8df0e-REVERSED-2021-06-10

**Claim (first 200 chars):** WITHDRAWN: Qualitative estimation for groundwater: A case study for Al-Mahaweel city in Iraq  
**Claim ID:** 23aaf58d-2a93-4dd0-889f-5cb34ab8df0e  
**Pipeline:** openalex_v1  
**External ID:** openalex_W3170399858  
**Transition:** RECORDED → REVERSED  
**Date:** 2021-06-10 (precision: DAY)  
**Community:** EXPERT_LITERATURE  
**Reason:** Retracted per CrossRef's publisher-reported retraction record for this paper in Materials Today: Proceedings (DOI 10.1016/j.matpr.2021.05.444), dated 2021-06-10. Marker: the crossref_retractions_v1 claim's own source record for this DOI.  
**Source URL:** https://doi.org/10.1016/j.matpr.2021.05.444  
**Source name:** Retraction: "Qualitative estimation for groundwater: A case study for Al-Mahaweel city in Ira" — Materials Today: Proceedings  

**Pre-fetched evidence snippet:**

> Handle Redirect https://linkinghub.elsevier.com/retrieve/pii/S221478532104044X

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 3/10 · CSH.id: ccd248f4-b7d2-436f-82ea-1ee0ea4bdcd2:retraction:1

**Claim (first 200 chars):** RETRACTED: Annexin A7 modulates BAG4 and BAG4-binding proteins in mitochondrial apoptosis  
**Claim ID:** ccd248f4-b7d2-436f-82ea-1ee0ea4bdcd2  
**Pipeline:** openalex_v1  
**External ID:** openalex_W841173951  
**Transition:** RECORDED → REVERSED  
**Date:** 2023-10-11 (precision: DAY)  
**Community:** EXPERT_LITERATURE  
**Reason:** Concerns/Issues about Image  
**Source URL:** https://doi.org/10.1016/j.biopha.2015.06.005  
**Source name:** Retraction: "Annexin A7 modulates BAG4 and BAG4-binding proteins in mitochondrial apoptosis" — Biomedicine &amp; Pharmacotherapy  

**Pre-fetched evidence snippet:**

> Handle Redirect https://linkinghub.elsevier.com/retrieve/pii/S0753332215001389

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 4/10 · CSH.id: 61e097bb-bc08-4f27-97cb-f7ec7e0d3db9-REVERSED-2022-07-24

**Claim (first 200 chars):** RETRACTED ARTICLE: Characterization and optimization of duplex stainless steel welded by activated tungsten inert gas welding process  
**Claim ID:** 61e097bb-bc08-4f27-97cb-f7ec7e0d3db9  
**Pipeline:** openalex_v1  
**External ID:** openalex_W4286801122  
**Transition:** RECORDED → REVERSED  
**Date:** 2022-07-24 (precision: DAY)  
**Community:** EXPERT_LITERATURE  
**Reason:** Retracted per CrossRef's publisher-reported retraction record for this paper in International Journal on Interactive Design and Manufacturing (IJIDeM) (DOI 10.1007/s12008-022-00977-z), dated 2022-07-24. Marker: the crossref_retractions_v1 claim's own source record for this DOI.  
**Source URL:** https://doi.org/10.1007/s12008-022-00977-z  
**Source name:** Retraction: "RETRACTED ARTICLE: Characterization and optimization of duplex stainless steel w" — International Journal on Interactive Design and Manufacturing (IJIDeM)  

**Pre-fetched evidence snippet:**

> Handle Redirect https://link.springer.com/10.1007/s12008-022-00977-z

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 5/10 · CSH.id: db0f67fc-4a90-4e80-9abe-a088c25a83c9-REVERSED-2021-12-07

**Claim (first 200 chars):** WITHDRAWN: Effect of mixed ions of (Zr+2 and Ti+2) on the physical properties of B2O3-SiO2-P2O5-Na2O-CaO as bioactive glass system  
**Claim ID:** db0f67fc-4a90-4e80-9abe-a088c25a83c9  
**Pipeline:** openalex_v1  
**External ID:** openalex_W4200616458  
**Transition:** RECORDED → REVERSED  
**Date:** 2021-12-07 (precision: DAY)  
**Community:** EXPERT_LITERATURE  
**Reason:** Retracted per CrossRef's publisher-reported retraction record for this paper in Journal of Non-Crystalline Solids (DOI 10.1016/j.jnoncrysol.2021.121324), dated 2021-12-07. Marker: the crossref_retractions_v1 claim's own source record for this DOI.  
**Source URL:** https://doi.org/10.1016/j.jnoncrysol.2021.121324  
**Source name:** Retraction: "Effect of mixed ions of (Zr+2 and Ti+2) on the physical properties of B2O3-SiO2-" — Journal of Non-Crystalline Solids  

**Pre-fetched evidence snippet:**

> Handle Redirect https://linkinghub.elsevier.com/retrieve/pii/S0022309321006852

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 6/10 · CSH.id: d52f823f-cd04-4da1-a822-39479ca61dbb:retraction:1

**Claim (first 200 chars):** NOTICE OF RETRACTION: While investigating potential publication-related misconduct in connection with the ICIMTech 2021 Conference Proceedings, serious concerns were raised that cast doubt on the inte…  
**Claim ID:** d52f823f-cd04-4da1-a822-39479ca61dbb  
**Pipeline:** openalex_v1  
**External ID:** openalex_W3193758002  
**Transition:** RECORDED → REVERSED  
**Date:** 2022-02-24 (precision: DAY)  
**Community:** EXPERT_LITERATURE  
**Reason:** Compromised Peer Review  
**Source URL:** https://doi.org/10.1145/3465631.3465737  
**Source name:** Retraction: "<i>Retracted on February 24, 2022</i>
                    : Review of Research o" — The Sixth International Conference on Information Management and Technology  

**Pre-fetched evidence snippet:**

> Handle Redirect https://dl.acm.org/doi/10.1145/3465631.3465737

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 7/10 · CSH.id: dec770cd-74b6-48c1-8c36-d949f9ae5108:retraction:1

**Claim (first 200 chars):** This article has been retracted: please see Elsevier Policy on Article Withdrawal (https://www.elsevier.com/about/our-business/policies/article-withdrawal). This article has been retracted at the requ…  
**Claim ID:** dec770cd-74b6-48c1-8c36-d949f9ae5108  
**Pipeline:** openalex_v1  
**External ID:** openalex_W2942478825  
**Transition:** RECORDED → REVERSED  
**Date:** 2022-01-11 (precision: DAY)  
**Community:** EXPERT_LITERATURE  
**Reason:** Paper Mill  
**Source URL:** https://doi.org/10.1016/j.biopha.2019.108885  
**Source name:** Retraction: "Ginkgolides B alleviates hypoxia-induced PC-12 cell injury by up-regulation of P" — Biomedicine &amp; Pharmacotherapy  

**Pre-fetched evidence snippet:**

> Handle Redirect https://linkinghub.elsevier.com/retrieve/pii/S0753332219304068

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 8/10 · CSH.id: 77956d8b-a2f1-40c8-b98b-59f3d26546ae-REVERSED-2021-02-12

**Claim (first 200 chars):** WITHDRAWN: Heterogeneous ensemble stacking with minority upliftment (HESMU) for churn prediction on imbalanced telecom data  
**Claim ID:** 77956d8b-a2f1-40c8-b98b-59f3d26546ae  
**Pipeline:** openalex_v1  
**External ID:** openalex_W3131131454  
**Transition:** RECORDED → REVERSED  
**Date:** 2021-02-12 (precision: DAY)  
**Community:** EXPERT_LITERATURE  
**Reason:** Retracted per CrossRef's publisher-reported retraction record for this paper in Materials Today: Proceedings (DOI 10.1016/j.matpr.2020.12.893), dated 2021-02-12. Marker: the crossref_retractions_v1 claim's own source record for this DOI.  
**Source URL:** https://doi.org/10.1016/j.matpr.2020.12.893  
**Source name:** Retraction: "Heterogeneous ensemble stacking with minority upliftment (HESMU) for churn predi" — Materials Today: Proceedings  

**Pre-fetched evidence snippet:**

> Handle Redirect https://linkinghub.elsevier.com/retrieve/pii/S221478532040611X

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 9/10 · CSH.id: 4822e914-4028-40c7-9322-42ba998fb000-REVERSED-2021-02-26

**Claim (first 200 chars):** WITHDRAWN: Strength and behaviour of roller compacted concrete using crushed dust  
**Claim ID:** 4822e914-4028-40c7-9322-42ba998fb000  
**Pipeline:** openalex_v1  
**External ID:** openalex_W3134349466  
**Transition:** RECORDED → REVERSED  
**Date:** 2021-02-26 (precision: DAY)  
**Community:** EXPERT_LITERATURE  
**Reason:** Retracted per CrossRef's publisher-reported retraction record for this paper in Materials Today: Proceedings (DOI 10.1016/j.matpr.2020.12.875), dated 2021-02-26. Marker: the crossref_retractions_v1 claim's own source record for this DOI.  
**Source URL:** https://doi.org/10.1016/j.matpr.2020.12.875  
**Source name:** Retraction: "Strength and behaviour of roller compacted concrete using crushed dust" — Materials Today: Proceedings  

**Pre-fetched evidence snippet:**

> Handle Redirect https://linkinghub.elsevier.com/retrieve/pii/S2214785320405930

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 10/10 · CSH.id: 9b1018cb-39b7-424e-9872-bc4620b23db9:retraction:1

**Claim (first 200 chars):** RETRACTED: Epigenetic modification of the oxytocin gene is associated with gray matter volume and trait empathy in mothers  
**Claim ID:** 9b1018cb-39b7-424e-9872-bc4620b23db9  
**Pipeline:** openalex_v1  
**External ID:** openalex_W3094069678  
**Transition:** RECORDED → REVERSED  
**Date:** 2022-07-26 (precision: DAY)  
**Community:** EXPERT_LITERATURE  
**Reason:** Compromised Peer Review  
**Source URL:** https://doi.org/10.1016/j.psyneuen.2020.105026  
**Source name:** Retraction: "Epigenetic modification of the oxytocin gene is associated with gray matter volu" — Psychoneuroendocrinology  

**Pre-fetched evidence snippet:**

> Handle Redirect https://linkinghub.elsevier.com/retrieve/pii/S0306453020304492

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

