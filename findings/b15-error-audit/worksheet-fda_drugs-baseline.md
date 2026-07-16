# B15 Error-Rate Audit — Worksheet: fda_drugs:baseline

**Stratum:** fda_drugs × baseline transition  
**Population:** 133,737  
**Sampled:** 37  
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

## Row 1/37 · CSH.id: cmqyjbdt49rc1samsm6vi2gjp

**Claim (first 200 chars):** QUALITY CHOICE SALINE (SODIUM CHLORIDE): Purpose Moisturizer  
**Claim ID:** cmpivbtei55l6plo72qwtlnw7  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_3c27ec7f-10c3-f5aa-e063-6394a90a04ac  
**Transition:** (entry) → RECORDED  
**Date:** 2025-08-12 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 2/37 · CSH.id: cmqyill3r1e86sanvi1nn8ftd

**Claim (first 200 chars):** FDA Original Approval: ESOMEPRAZOLE MAGNESIUM (ESOMEPRAZOLE MAGNESIUM), CAPSULE, DELAYED REL PELLETS;ORAL EQ 20MG BASE. Application ANDA 211977 by HETERO LABS LTD III. Approved 2020-06-02.  
**Claim ID:** cmq40ib3x0tomsa8sz2jotrzp  
**Pipeline:** drugsatfda_v1  
**External ID:** drugsatfda:211977:001:2020-06-02  
**Transition:** (entry) → SETTLED  
**Date:** 2020-06-02 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** FDA granted NDA approval, establishing institutional consensus on safety and efficacy.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 3/37 · CSH.id: cmqyjb63y9fgbsamsxw2kt37y

**Claim (first 200 chars):** LIDOCAINE (LIDOCAINE): Purpose Topical Anesthetic  
**Claim ID:** cmpitl7pl36auplo7codk58gy  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_2c5051f6-6d79-ac85-e063-6394a90a04a5  
**Transition:** (entry) → RECORDED  
**Date:** 2025-01-22 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 4/37 · CSH.id: cmqyjbeis9strsamso05wa9mh

**Claim (first 200 chars):** Itch Eraser Gel (DIPHENHYDRAMINE HCL): Purpose Topical Analgesic  
**Claim ID:** cmpivizzn5ejiplo78y8zwgwv  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_43d209a7-4944-c3a7-e063-6394a90a2512  
**Transition:** (entry) → RECORDED  
**Date:** 2025-11-17 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 5/37 · CSH.id: cmqyjbpv8adq1sams1e1qowgc

**Claim (first 200 chars):** Clear Anti-Itch (PRAMOXINE HCL, ZINC ACETATE): Purpose External analgesic Skin protectant  
**Claim ID:** cmpiyg2bu8vx6plo72y502yhe  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_4cd76fc9-059c-e0b5-e063-6394a90a9f51  
**Transition:** (entry) → RECORDED  
**Date:** 2026-03-12 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 6/37 · CSH.id: cmqyjaubu8zj6samsl5r0jtq4

**Claim (first 200 chars):** INON (ALUMINUM HYDROXIDE, MAGNESIUM CARBONATE, SODIUM BICARBONATE): Purpose Aluminum hydroxide Antacid Magnesium carbonate Antacid Sodium bicarbonate Antacid  
**Claim ID:** cmpir9icf0is0plo7l5r3ct3p  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_0bb8901e-89d2-b026-e063-6294a90ae77a  
**Transition:** (entry) → RECORDED  
**Date:** 2023-12-04 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 7/37 · CSH.id: cmqyjbf6z9tr7samsyum1z10h

**Claim (first 200 chars):** Tinted Replenishing Daily Protection (ZINC OXIDE): (no purpose or indication on label)  
**Claim ID:** cmpivnv325k46plo7xl4ydp5s  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_461454cc-aecf-9c71-e063-6394a90a247d  
**Transition:** (entry) → RECORDED  
**Date:** 2025-12-16 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 8/37 · CSH.id: cmqyjbe1o9rqdsamsv7b43e8y

**Claim (first 200 chars):** Bupivacaine Hydrochloride (BUPIVACAINE HYDROCHLORIDE): 1 INDICATIONS AND USAGE Bupivacaine hydrochloride injection is indicated in adults for the production of local or regional anesthesia or analgesi…  
**Claim ID:** cmpivdqej57z6plo7m17usjjq  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_4ab54553-749b-6bc7-e063-6394a90ad9fc  
**Transition:** (entry) → RECORDED  
**Date:** 2025-11-28 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 9/37 · CSH.id: cmqyjaoei8svksamse1310hfz

**Claim (first 200 chars):** Tension Headache Pain Relieving Aid (ACETAMINOPHEN,CAFFEINE): Purposes Pain reliever Pain reliever aid  
**Claim ID:** cmpiofy6b17j6pl9wj6mqizmf  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_0bb01cb6-e97d-773c-e063-6294a90af15f  
**Transition:** (entry) → RECORDED  
**Date:** 2023-12-15 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 10/37 · CSH.id: cmqyilfzp12o8sanv0r73icnq

**Claim (first 200 chars):** FDA Original Approval: ALPRAZOLAM (ALPRAZOLAM), TABLET;ORAL 0.25MG. Application ANDA 090248 by STRIDES PHARMA INTL. Approved 2010-09-17.  
**Claim ID:** cmq3zsv860i4osa8sib9uhp15  
**Pipeline:** drugsatfda_v1  
**External ID:** drugsatfda:090248:001:2010-09-17  
**Transition:** (entry) → SETTLED  
**Date:** 2010-09-17 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** FDA granted NDA approval, establishing institutional consensus on safety and efficacy.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 11/37 · CSH.id: cmqyjb63z9fi3sams7t94oq5l

**Claim (first 200 chars):** Exchange Select Ibuprofen PM (DIPHENHYDRAMINE CITRATE, IBUPROFEN): Purposes Nighttime sleep-aid Pain reliever  
**Claim ID:** cmpitlhzf36liplo7jurgbb5s  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_ff4cf209-fd6a-469c-99b0-7c1731772615  
**Transition:** (entry) → RECORDED  
**Date:** 2025-04-21 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 12/37 · CSH.id: cmqyjbh7k9x6psamsxnw7siqu

**Claim (first 200 chars):** Aconitum e tub. 30 (ACONITUM E TUB. 30): Use: Temporary relief of headache  
**Claim ID:** cmpiw64pq64p6plo7juzuxoul  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_42f33cb7-d6d8-783a-e063-6294a90a3794  
**Transition:** (entry) → RECORDED  
**Date:** 2025-11-06 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 13/37 · CSH.id: cmqyjast28xowsamsrapajen8

**Claim (first 200 chars):** Fluoxetine (FLUOXETINE HYDROCHLORIDE): 1 INDICATIONS AND USAGE Fluoxetine is indicated for the treatment of: Acute and maintenance treatment of Major Depressive Disorder [see Clinical Studies (14.1) ]…  
**Claim ID:** cmpiqzs1v07qcplo7mc1ir4uv  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_d58637fe-31d4-41e1-a52c-6c5075b461da  
**Transition:** (entry) → RECORDED  
**Date:** 2023-08-05 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 14/37 · CSH.id: cmqyilhun16kwsanvfoq84jkc

**Claim (first 200 chars):** FDA Original Approval: PRAVASTATIN SODIUM (PRAVASTATIN SODIUM), TABLET;ORAL 20MG. Application ANDA 203367 by AUROBINDO PHARMA. Approved 2017-02-02.  
**Claim ID:** cmq401gh10m1csa8snz1fs0mw  
**Pipeline:** drugsatfda_v1  
**External ID:** drugsatfda:203367:002:2017-02-02  
**Transition:** (entry) → SETTLED  
**Date:** 2017-02-02 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** FDA granted NDA approval, establishing institutional consensus on safety and efficacy.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 15/37 · CSH.id: cmqyjamif8qjcsamseuk26ip2

**Claim (first 200 chars):** Sodium Sulfacetamide 10 % and Sulfur 2 % Cleanser (SODIUM SULFACETAMIDE AND SULFUR): INDICATIONS: Sulfacetamide Sodium and Sulfur Cleanser is indicated in the topical control of acne vulgaris, acne ro…  
**Claim ID:** cmpio2gfq0thupl9wz77s8oq4  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_67acba09-6267-4139-ad2b-e6b7849752a9  
**Transition:** (entry) → RECORDED  
**Date:** 2023-05-03 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 16/37 · CSH.id: cmqyilnor1k1isanvxhilzm5k

**Claim (first 200 chars):** FDA Original Approval: ROLVEDON (EFLAPEGRASTIM-XNST), INJECTABLE;SUBCUTANEOUS 13.2MG/0.6ML. Application BLA 761148 by SPECTRUM PHARMS. Approved 2022-09-09.  
**Claim ID:** cmq40v2t50zhysa8sbjvs27tl  
**Pipeline:** drugsatfda_v1  
**External ID:** drugsatfda:761148:001:2022-09-09  
**Transition:** (entry) → SETTLED  
**Date:** 2022-09-09 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** FDA granted NDA approval, establishing institutional consensus on safety and efficacy.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 17/37 · CSH.id: cmqyjbhvx9yhxsams159omdnu

**Claim (first 200 chars):** Sucralfate (SUCRALFATE ORAL): INDICATIONS AND USAGE Sucralfate Oral Suspension is indicated in the short-term (up to 8 weeks) treatment of active duodenal ulcer.  
**Claim ID:** cmpiwcv7z6ckiplo7xlla91av  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_45107b4b-d201-c653-e063-6294a90a122d  
**Transition:** (entry) → RECORDED  
**Date:** 2025-12-03 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 18/37 · CSH.id: cmqyil8k50n4bsanvhsp2cczt

**Claim (first 200 chars):** FDA Original Approval: POTASSIUM CHLORIDE 0.075% IN DEXTROSE 10% AND SODIUM CHLORIDE 0.9% IN PLASTIC CONTAINER (DEXTROSE; POTASSIUM CHLORIDE; SODIUM CHLORIDE), INJECTABLE;INJECTION 10GM/100ML;75MG/100…  
**Claim ID:** cmq3yut3402krsa8seaglho3l  
**Pipeline:** drugsatfda_v1  
**External ID:** drugsatfda:019630:044:1988-02-17  
**Transition:** (entry) → SETTLED  
**Date:** 1988-02-17 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** FDA granted NDA approval, establishing institutional consensus on safety and efficacy.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 19/37 · CSH.id: cmqyjbiqu9zx8samsb4thgjh7

**Claim (first 200 chars):** Extra Strength (ANTACID TABLETS): Purpose Antacid  
**Claim ID:** cmpiwk2f36l4cplo7e9kxfua8  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_45209427-76bb-04ec-e063-6294a90ae533  
**Transition:** (entry) → RECORDED  
**Date:** 2025-12-04 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 20/37 · CSH.id: cmqyjbh7l9x93samsljje58ve

**Claim (first 200 chars):** NITROGEN (NITROGEN): (no purpose or indication on label)  
**Claim ID:** cmpiw6i2d653iplo7639bzeeq  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_42ccd2bb-cbba-64b4-e063-6294a90a6d5d  
**Transition:** (entry) → RECORDED  
**Date:** 2025-11-04 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 21/37 · CSH.id: cmqyjb5sc9f0rsams2mni4731

**Claim (first 200 chars):** hair regrowth treatment (MINOXIDIL): Purpose Hair regrowth treatment for men  
**Claim ID:** cmpitiniy33piplo7f8g4rrr9  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_1de6e8c9-5b9a-44d3-ac42-d351319e4867  
**Transition:** (entry) → RECORDED  
**Date:** 2025-02-05 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 22/37 · CSH.id: cmqyjawf892jjsamsqazjxpjm

**Claim (first 200 chars):** AZITHROMYCIN (AZITHROMYCIN): 1 INDICATIONS AND USAGE Azithromycin for oral suspension USP is a macrolide antibacterial drug indicated for the treatment of patients with mild to moderate infections cau…  
**Claim ID:** cmpirph5110u6plo7d1spai1e  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_1adc57cf-712e-75b9-e063-6294a90a0de0  
**Transition:** (entry) → RECORDED  
**Date:** 2024-06-14 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 23/37 · CSH.id: cmqyjbceq9ozhsamsyjuqkudk

**Claim (first 200 chars):** Allergy Relief Childrens (DIPHENHYDRAMINE HCL): Purpose Antihistamine  
**Claim ID:** cmpiuz7b44rhuplo7iyd6sy1g  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_a5540d64-0e78-458c-80e4-89cbc4ba617f  
**Transition:** (entry) → RECORDED  
**Date:** 2025-06-19 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 24/37 · CSH.id: cmqyjbf6y9toysamszkcwe7l8

**Claim (first 200 chars):** Mineral Tinted SPF40 with ceramides (ZINC OXIDE): (no purpose or indication on label)  
**Claim ID:** cmpivnkgw5jqoplo7htv5zjgd  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_4603ef22-a5ad-d346-e063-6294a90a4aa3  
**Transition:** (entry) → RECORDED  
**Date:** 2025-12-15 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 25/37 · CSH.id: cmqyjb5999eausamsnayiijn0

**Claim (first 200 chars):** PredniSONE (PREDNISONE): INDICATIONS Prednisone tablets and solutions are indicated in the following conditions: 1. Endocrine Disorders Primary or secondary adrenocortical insufficiency (hydrocortison…  
**Claim ID:** cmpitezgs2ze0plo7fk7jq8yb  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_523ad364-8d95-4679-9290-446d61f36eb5  
**Transition:** (entry) → RECORDED  
**Date:** 2025-04-22 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 26/37 · CSH.id: cmqyjbcvp9q0xsamslv1pz2ru

**Claim (first 200 chars):** Lidocaine (LIDOCAINE): DESCRIPTION Lidocaine patch 5% is comprised of an adhesive material containing 5% lidocaine, USP, which is applied to a white non-woven polyethylene terephthalate (PET) material…  
**Claim ID:** cmpiv4lmw4xqiplo78h9qgwbc  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_e0683309-89ba-4804-887f-12fcaf59a2ca  
**Transition:** (entry) → RECORDED  
**Date:** 2025-08-26 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 27/37 · CSH.id: cmqyjaqag8v95samsmv93ok8i

**Claim (first 200 chars):** Bone Liquescence (TARAXACUM OFFICINALE, TRIFOLIUM PRATENSE, CALCAREA MURIATICA, EQUISETUM ARVENSE, JUGLANS NIGRA, SESAME OIL, CALCAREA SULPHURICA, HEPAR SUIS, KIDNEY (SUIS), MEDULLA OSSIS SUIS, MENADI…  
**Claim ID:** cmpiordhf1lsopl9wmgeuz0z7  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_b8ad4a3d-b9ff-4b7a-87ee-5057abb71fa7  
**Transition:** (entry) → RECORDED  
**Date:** 2023-11-17 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 28/37 · CSH.id: cmqyiljve1bjesanvxf1h90v1

**Claim (first 200 chars):** FDA Original Approval: AMLODIPINE AND OLMESARTAN MEDOXOMIL (AMLODIPINE BESYLATE; OLMESARTAN MEDOXOMIL), TABLET;ORAL EQ 10MG BASE;40MG. Application ANDA 209042 by ALKEM LABS LTD. Approved 2017-08-14.  
**Claim ID:** cmq40cd280qzusa8sd7v1imuh  
**Pipeline:** drugsatfda_v1  
**External ID:** drugsatfda:209042:004:2017-08-14  
**Transition:** (entry) → SETTLED  
**Date:** 2017-08-14 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** FDA granted NDA approval, establishing institutional consensus on safety and efficacy.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 29/37 · CSH.id: cmqyjbj5ua0p8samsq6ptuxty

**Claim (first 200 chars):** GNP Vapor Steam camphor (synthetic) (CAMPHOR (SYNTHETIC)): Purpose Cough suppressant  
**Claim ID:** cmpiwnvfu6pscplo7prqbfj9p  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_494e38d6-8c9a-bb60-e063-6294a90aead8  
**Transition:** (entry) → RECORDED  
**Date:** 2026-01-26 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 30/37 · CSH.id: cmqyjb1p4997bsams5p57hlt6

**Claim (first 200 chars):** signature care hemorrhoidal (MINERAL OIL, PETROLATUM, PHENYLEPHRINE HCL): Purposes Protectant Vasoconstrictor  
**Claim ID:** cmpisooxl24suplo7a16sct5h  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_2449453b-3289-4a3e-bcae-3b8627168a3b  
**Transition:** (entry) → RECORDED  
**Date:** 2024-10-17 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 31/37 · CSH.id: cmqyjb3wf9ch5samsomrjuu1o

**Claim (first 200 chars):** Phytonadione (PHYTONADIONE): INDICATIONS AND USAGE Phytonadione injectable emulsion is indicated in the following coagulation disorders which are due to faulty formation of factors II, VII, IX and X w…  
**Claim ID:** cmpit6bm92ofuplo7ilazw3zy  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_114b1330-6f03-476c-8678-8cd0da189bce  
**Transition:** (entry) → RECORDED  
**Date:** 2025-04-26 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 32/37 · CSH.id: cmqyilf2z10i8sanvkybmsdfh

**Claim (first 200 chars):** FDA Original Approval: BENZONATATE (BENZONATATE), CAPSULE;ORAL 200MG. Application ANDA 081297 by BIONPHARMA. Approved 1993-01-29.  
**Claim ID:** cmq3zo50a0fyosa8si2skhl1m  
**Pipeline:** drugsatfda_v1  
**External ID:** drugsatfda:081297:002:1993-01-29  
**Transition:** (entry) → SETTLED  
**Date:** 1993-01-29 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** FDA granted NDA approval, establishing institutional consensus on safety and efficacy.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 33/37 · CSH.id: cmqyjapd58tr8samsekklm897

**Claim (first 200 chars):** Mineffect cold remedy (CALCAREA FLOURICA, FERRUM METALLICUM, FERRUM PHOSPHORICUM, PHOSPHORUS, SILICEA, SULPHUR, ZINCUM METALLICUM): Purpose Throat Pain Cough, Sneezing Cough, Sore Chest Sore Throat Co…  
**Claim ID:** cmpiokcdk1ct6pl9wsmxu6v3w  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_0906ab71-cd97-8a1f-e063-6394a90ab610  
**Transition:** (entry) → RECORDED  
**Date:** 2023-10-31 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 34/37 · CSH.id: cmqyjb8gf9ixdsams1dye5uok

**Claim (first 200 chars):** Bestmade Natural Products BM6 (AGRIMONIAD6, ALUMINAD12, HYDRASTISD4, KALI BICHD6, PULSATILLAD5, SEPIAD4): Temporarily relieves occasional burning, creamy, and transparent vaginal discharge, a congeste…  
**Claim ID:** cmpiu35043r56plo79nledngv  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_2c4ee581-8823-b4b9-e063-6294a90accec  
**Transition:** (entry) → RECORDED  
**Date:** 2025-01-22 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 35/37 · CSH.id: cmqyjbn97a8jwsamstkj0zsyt

**Claim (first 200 chars):** Prednisone (PREDNISONE): INDICATIONS AND USAGE Prednisone tablets, USP are indicated in the following conditions: Endocrine Disorders Primary or secondary adrenocortical insufficiency (hydrocortisone …  
**Claim ID:** cmpixpe0680wcplo7zdf9xamm  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_48e6a648-15ff-32b8-e063-6394a90a6f60  
**Transition:** (entry) → RECORDED  
**Date:** 2026-01-01 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 36/37 · CSH.id: cmqyjbjdya14psamsmz40pabj

**Claim (first 200 chars):** Smart Care VANILLA HEAVEN HAND SANITIZER (ETHYL ALCOHOL): Purpose Antiseptic  
**Claim ID:** cmpiwptbf6sd6plo7c7fsp9hg  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_313c0b20-34d3-4fc6-aade-f6dc5b1bcd07  
**Transition:** (entry) → RECORDED  
**Date:** 2026-02-17 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 37/37 · CSH.id: cmqyjayi29568samsk7o5rxmf

**Claim (first 200 chars):** Toms Wicked Fresh Cool Peppermint fresh breath / cavity protection (SODIUM MONOFLUOROPHOSPHATE): Purpose Anticavity  
**Claim ID:** cmpis2bj11gmcplo7479k7ege  
**Pipeline:** openfda_labels_v1  
**External ID:** openfda_label_3d6ec4f5-dfc9-4504-96ed-26d5ebbd5126  
**Transition:** (entry) → RECORDED  
**Date:** 2024-10-24 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Drug label officially recorded in FDA drug labeling database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

