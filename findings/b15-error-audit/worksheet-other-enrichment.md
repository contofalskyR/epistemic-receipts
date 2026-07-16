# B15 Error-Rate Audit — Worksheet: other:enrichment

**Stratum:** other × enrichment transition  
**Population:** 13,255  
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

## Row 1/10 · CSH.id: cmpd61gz9017qplqcphl4kiba-SETTLED-2011-09-20

**Claim (first 200 chars):** Regeling van een grondslag voor de heffing van rechten voor de Nederlandse identiteitskaart  
**Claim ID:** cmpd61gz9017qplqcphl4kiba  
**Pipeline:** tweedekamer_v1  
**External ID:** tweedekamer_zaak_d5e4358b-eb67-4869-842a-3e8efc4d28bb  
**Transition:** RECORDED → SETTLED  
**Date:** 2011-09-20 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Roll-call result certified in the official parliamentary record — the recorded outcome is institutionally settled.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 2/10 · CSH.id: csh:trajectory:holmes-puerperal-fever-contagion-1843:1

**Claim (first 200 chars):** In an essay read before the Boston Society for Medical Improvement and published in April 1843 ("The Contagiousness of Puerperal Fever," New England Quarterly Journal of Medicine and Surgery), Oliver …  
**Claim ID:** cmqythq4s0007sa998e46d14o  
**Pipeline:** seed:human-history-trajectories  
**External ID:** trajectory:holmes-puerperal-fever-contagion-1843  
**Transition:** CONTESTED → SETTLED  
**Date:** 1884-01-01 (precision: YEAR)  
**Community:** EXPERT_LITERATURE  
**Reason:** Bacteriology supplied the mechanism Holmes had inferred from clinical pattern alone. In 1884 Friedrich Julius Rosenbach isolated and named Streptococcus pyogenes — the major cause of puerperal fever in mothers and infection in newborns — giving the physician-borne childbed-fever transmission a concrete microbial agent and settling the once-rejected contagion claim within the germ theory of disease.  
**Source URL:** https://en.wikipedia.org/wiki/Streptococcus_pyogenes  
**Source name:** Rosenbach FJ. Streptococcus pyogenes (Rosenbach 1884) — a major cause of puerperal fever.  

**Pre-fetched evidence snippet:**

> Please set a user-agent and respect our robot policy https://w.wiki/4wJS. See also https://phabricator.wikimedia.org/T400119.

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 3/10 · CSH.id: csh:trajectory:edward-viii-abdication-1936:1

**Claim (first 200 chars):** On 11 December 1936 King Edward VIII abdicated the British throne — given legal effect by His Majesty's Declaration of Abdication Act 1936 — in order to marry the twice-divorced American Wallis Simpso…  
**Claim ID:** cmqltmt4e0229sakozqargpv3  
**Pipeline:** seed:human-history-trajectories  
**External ID:** trajectory:edward-viii-abdication-1936  
**Transition:** RECORDED → SETTLED  
**Date:** 2024-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** His Majesty's Declaration of Abdication Act 1936 remains on the statute book as a preserved primary document, and the accession of George VI on 11 December 1936 is an uncontested constitutional fact. The abdication is settled history, recorded identically across British official records, parliamentary archives, and historiography.  
**Source URL:** https://en.wikipedia.org/wiki/Edward_VIII  
**Source name:** Edward VIII — reigned 20 January to 11 December 1936; abdicated and was succeeded by his brother George VI.  

**Pre-fetched evidence snippet:**

> Please set a user-agent and respect our robot policy https://w.wiki/4wJS. See also https://phabricator.wikimedia.org/T400119.

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 4/10 · CSH.id: cmpd7w0v4026aplaw2imu372w-SETTLED-2012-12-13

**Claim (first 200 chars):** A second Act to implement certain provisions of the budget tabled in Parliament on March 29, 2012 and other measures  
**Claim ID:** cmpd7w0v4026aplaw2imu372w  
**Pipeline:** canada_bills_v1  
**External ID:** canada_bill_41_1_C-45  
**Transition:** RECORDED → SETTLED  
**Date:** 2012-12-13 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Bill received Royal Assent and was enacted into Canadian law.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 5/10 · CSH.id: cmpe5bt9l051zplw4qvcc8p6s-SETTLED-2022-01-20

**Claim (first 200 chars):** Numerical strength of the standing committees  
**Claim ID:** cmpe5bt9l051zplw4qvcc8p6s  
**Pipeline:** eu_parliament_v1  
**External ID:** ep_adopted_TA-9-2022-0001  
**Transition:** RECORDED → SETTLED  
**Date:** 2022-01-20 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Roll-call result certified in the official parliamentary record — the recorded outcome is institutionally settled.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 6/10 · CSH.id: cmpd6358o0302plqcshee3ceh-SETTLED-2017-11-16

**Claim (first 200 chars):** Samenvoeging van de gemeenten Nuth, Onderbanken en Schinnen  
**Claim ID:** cmpd6358o0302plqcshee3ceh  
**Pipeline:** tweedekamer_v1  
**External ID:** tweedekamer_zaak_4c5fc3e6-7a41-4a6e-bf43-a4e9f3e81217  
**Transition:** RECORDED → SETTLED  
**Date:** 2017-11-16 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Roll-call result certified in the official parliamentary record — the recorded outcome is institutionally settled.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 7/10 · CSH.id: csh:trajectory:whi-low-fat-no-benefit-2006:1

**Claim (first 200 chars):** The Women's Health Initiative Dietary Modification Trial, published February 8, 2006 in JAMA, found that an 8-year low-fat dietary intervention (reducing fat to 20% of calories) did not significantly …  
**Claim ID:** cmqj851290011sa5bd09cs0jb  
**Pipeline:** seed:nutrition-trajectories  
**External ID:** trajectory:whi-low-fat-no-benefit-2006  
**Transition:** RECORDED → SETTLED  
**Date:** 2015-01-07 (precision: DAY)  
**Community:** EXPERT_LITERATURE  
**Reason:** The 2015 USDA Dietary Guidelines Advisory Committee Report (January 7, 2015) drops the dietary cholesterol limit of 300 mg/day, stating "cholesterol is not a nutrient of concern for overconsumption." The 2015 guidelines also no longer define an upper limit for total dietary fat. These changes formalize what the WHI and multiple subsequent meta-analyses showed: dietary fat restriction per se is not the key modifiable CHD risk factor.  
**Source URL:** https://health.gov/our-work/nutrition-physical-activity/dietary-guidelines/previous-dietary-guidelines/2015  
**Source name:** USDA/HHS Dietary Guidelines Advisory Committee. Scientific Report of the 2015 Dietary Guidelines Advisory Committee. January 7, 2015.  

**Pre-fetched evidence snippet:**

> 302 Found Found The document has moved here .

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 8/10 · CSH.id: cmpe5876500n7plw42vdgk9p3-SETTLED-2025-11-27

**Claim (first 200 chars):** Rule of law and human rights situation in Tunisia, particularly the case of Sonia Dahmani  
**Claim ID:** cmpe5876500n7plw42vdgk9p3  
**Pipeline:** eu_parliament_v1  
**External ID:** ep_adopted_TA-10-2025-0304  
**Transition:** RECORDED → SETTLED  
**Date:** 2025-11-27 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Roll-call result certified in the official parliamentary record — the recorded outcome is institutionally settled.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 9/10 · CSH.id: csh:trajectory:thomas-more-executed-1535:1

**Claim (first 200 chars):** On 6 July 1535, Sir Thomas More was beheaded at Tower Hill in London for refusing to acknowledge Henry VIII as Supreme Head of the Church of England.  
**Claim ID:** cmqio1a7n02kpsat7eikbj9op  
**Pipeline:** seed:human-history-trajectories  
**External ID:** trajectory:thomas-more-executed-1535  
**Transition:** RECORDED → SETTLED  
**Date:** 2015-01-01 (precision: YEAR)  
**Community:** EXPERT_LITERATURE  
**Reason:** More's execution on 6 July 1535 is attested by Roper's contemporary biography and corroborated by Tudor state records of his trial and attainder. The date and circumstances are settled in modern historiography; More was later canonized by the Catholic Church in 1935.  
**Source URL:** https://en.wikipedia.org/wiki/Thomas_More  
**Source name:** Wikipedia, "Thomas More" — executed 6 July 1535 at Tower Hill.  

**Pre-fetched evidence snippet:**

> Please set a user-agent and respect our robot policy https://w.wiki/4wJS. See also https://phabricator.wikimedia.org/T400119.

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 10/10 · CSH.id: cmqyzk9gm1egj8ovkbq458jno

**Claim (first 200 chars):** Plants Act 1970  
**Claim ID:** cmpeqfbpx0awyplfyq0kwcnya  
**Pipeline:** nz_repealed_acts_v1  
**External ID:** nz_repealed_acts_1970_151  
**Transition:** SETTLED → REVERSED  
**Date:** 1993-10-01 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Repealed on 1993-10-01, by section 167(1) of the Biosecurity Act 1993 — repeal notice recorded on the New Zealand Legislation website (https://www.legislation.govt.nz/act/public/1970/151/en/latest/). Re-dated from the Layer-1 enactment-year placeholder to the actual repeal date.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

