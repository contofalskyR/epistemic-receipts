# B15 Error-Rate Audit — Worksheet: other:baseline

**Stratum:** other × baseline transition  
**Population:** 236,573  
**Sampled:** 65  
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

## Row 1/65 · CSH.id: cmqyj3dr11ve2sams9b1h50e5

**Claim (first 200 chars):** In 2017, life expectancy at birth in Sudan was 69.0 years (WHO GHO)  
**Claim ID:** cmq57zmpl06tqsaf76cyq6md6  
**Pipeline:** who_gho_v1  
**External ID:** who_gho_WHOSIS_000001_SDN_2017  
**Transition:** (entry) → RECORDED  
**Date:** 2017-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Health indicator officially recorded by WHO Global Health Observatory.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 2/65 · CSH.id: cmqyzlicj4ezq8ovk5b0zqgau

**Claim (first 200 chars):** NIH awarded grant 1R01HL163680-01 to STANFORD UNIVERSITY for "Elucidating ECM Signaling in Cardiac Organoids with Machine Learning and Single-cell Multiomics" totaling $628,643, PI: Joseph C. Wu (FY20…  
**Claim ID:** cmpm8xpwi12qysaj2hnpd4lty  
**Pipeline:** nih_reporter_v1  
**External ID:** nih_grant_1R01HL163680-01  
**Transition:** (entry) → RECORDED  
**Date:** 2022-05-09 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** NIH research grant officially awarded and recorded in NIH Reporter.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 3/65 · CSH.id: cmqyjdrgieljasamsf9s0pnnv

**Claim (first 200 chars):** Pakistan: National Commission on the Status of Women Act, 2012 (VIII of 2012)  
**Claim ID:** cmq4nqpqg01lvsazsj1hrigj8  
**Pipeline:** pakistan_code_v1  
**External ID:** pak_code_UY2FqaJw1-apaUY2Fqa-apaUY2Npa5pm-sg-jjjjjjjjjjjjj  
**Transition:** (entry) → SETTLED  
**Date:** 2012-03-10 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Legislation encoded in Pakistani legal code.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 4/65 · CSH.id: cmqyzl6h63m6k8ovk2qpvl8vq

**Claim (first 200 chars):** UN Security Council adopted Resolution 474 on 1980-06-17 concerning on renewal of the mandate of the UN Interim Force in Lebanon. Vote: 12-0-2 (total 15 members).  
**Claim ID:** cmp2ygmpt03l3xnuog2zzsn6x  
**Pipeline:** un_sc_resolutions_v1  
**External ID:** S/RES/474(1980)  
**Transition:** (entry) → SETTLED  
**Date:** 1980-06-17 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** UN Security Council resolution adopted — binding on all member states.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 5/65 · CSH.id: cmqyzloh34tro8ovkuu2yxhv1

**Claim (first 200 chars):** James Tobin was awarded The Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel 1981 "for his analysis of financial markets and their relations to expenditure decisions, employment,…  
**Claim ID:** cmpbri4xm02edplbck1mpxrqd  
**Pipeline:** nobel_v1  
**External ID:** nobel_laureate_695_economics_1981  
**Transition:** (entry) → SETTLED  
**Date:** 1981-10-13 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Nobel Prize awarded — highest institutional recognition of scientific contribution.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 6/65 · CSH.id: cmqyzlgkh4afh8ovkrcuthap8

**Claim (first 200 chars):** NIH awarded grant 1R01NR021234-01 to UNIVERSITY OF PENNSYLVANIA for "Differences in Hospital Nursing Resources among Black-Serving Hospitals as a Driver of Patient Outcomes Disparities" totaling $406,…  
**Claim ID:** cmpm7j7de06m3saj2p9t08mw7  
**Pipeline:** nih_reporter_v1  
**External ID:** nih_grant_1R01NR021234-01  
**Transition:** (entry) → RECORDED  
**Date:** 2023-09-01 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** NIH research grant officially awarded and recorded in NIH Reporter.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 7/65 · CSH.id: cmqyzlb5m3xw38ovkhvt1flrp

**Claim (first 200 chars):** CIGS's discussion with Prime Minister of Canada, General Eisenhower and President Truman on defence organisation...  
**Claim ID:** cmpixcm8j0dyrplq8re40ymgn  
**Pipeline:** uk_national_archives_v1  
**External ID:** uk_nta_C200441  
**Transition:** (entry) → RECORDED  
**Date:** 1946-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Document catalogued in the UK National Archives.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 8/65 · CSH.id: cmr2ub3sv1sd4sa5bjs9r4dsl

**Claim (first 200 chars):** "7368 009%20fila%20213 223" — CNSAS (CNSAS documents)  
**Claim ID:** cmpizk66f094xplqtxxzgdfb8  
**Pipeline:** romania_cnsas_v1  
**External ID:** cnsas_documente_acte_normative_7368_009_20fila_20213-223  
**Transition:** (entry) → RECORDED  
**Date:** 1970-01-01 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Document declassified and catalogued by Romania's CNSAS (secret police archives).  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 9/65 · CSH.id: cmqyzlthw563p8ovk41tb4zip

**Claim (first 200 chars):** A magnitude 8.0 MW earthquake struck 1949 Haida Gwaii Earthquake on 1949-08-22.  
**Claim ID:** cmpasue2d078lplbf092e9csl  
**Pipeline:** usgs_eq_v1  
**External ID:** usgs_eq_official19490822040118000_10  
**Transition:** (entry) → RECORDED  
**Date:** 1949-08-22 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Earthquake event officially recorded by the USGS seismic network.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 10/65 · CSH.id: cmrbi165101ctfssyulwdi5px

**Claim (first 200 chars):** Vorinostat is defined by NIH MeSH as: A hydroxamic acid and anilide derivative that acts as a HISTONE DEACETYLASE inhibitor. It is used in the treatment of CUTANEOUS T-CELL LYMPHOMA and SEZARY SYNDROM…  
**Claim ID:** cmph7e23n05eppl1x1nddtzc9  
**Pipeline:** mesh_v1  
**External ID:** mesh_D000077337  
**Transition:** (entry) → SETTLED  
**Date:** 2019-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Medical concept officially indexed in the NLM MeSH controlled vocabulary.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 11/65 · CSH.id: cmqyzkwfq2x058ovkf3sakj4v

**Claim (first 200 chars):** CASE OF GAWEDA v. POLAND  
**Claim ID:** cmpe5sjpm09m3plh8gr7he8ur  
**Pipeline:** echr_judgments_v1  
**External ID:** echr_001-60325  
**Transition:** (entry) → SETTLED  
**Date:** 2002-03-14 (precision: DAY)  
**Community:** JUDICIAL  
**Reason:** European Court of Human Rights issued binding judgment.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 12/65 · CSH.id: cmqyzko2o2dn58ovk084hpsdy

**Claim (first 200 chars):** Kosovo enacted: AKTVENDIM NR. 2024:216309 (Gjykata Themelore e Ferizajit).  
**Claim ID:** cmpexm7ca06m3pl8yl5vb3byw  
**Pipeline:** western_balkans_v1  
**External ID:** western_balkans_v1_xk_116304  
**Transition:** (entry) → SETTLED  
**Date:** 2022-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Legislation enacted into Western Balkans national law.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 13/65 · CSH.id: cmr2ub41u1t0ssa5bofoxjamd

**Claim (first 200 chars):** "PIUCO CONSTANTIN" — CNSAS (Securitate cadres registry)  
**Claim ID:** cmpizt1zt03xdpllzjmyica1x  
**Pipeline:** romania_cnsas_v1  
**External ID:** cnsas_documente_cadrele_securitatii_PIUCO_CONSTANTIN  
**Transition:** (entry) → RECORDED  
**Date:** 1970-01-01 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Document declassified and catalogued by Romania's CNSAS (secret police archives).  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 14/65 · CSH.id: csh:trajectory:steve-biko-death-1977:0

**Claim (first 200 chars):** On 12 September 1977 the Black Consciousness leader Steve Biko died in South African police custody from brain injuries inflicted during interrogation — a death the apartheid state first attributed to…  
**Claim ID:** cmqnkcn1c044n8otm6u5hw2bg  
**Pipeline:** seed:human-history-trajectories  
**External ID:** trajectory:steve-biko-death-1977  
**Transition:** (entry) → RECORDED  
**Date:** 1977-09-12 (precision: DAY)  
**Community:** PUBLIC  
**Reason:** Steve Biko, detained under the Terrorism Act and held in Port Elizabeth, dies on 12 September 1977 after being driven naked and unconscious to Pretoria. Police minister Jimmy Kruger publicly suggests his death followed a hunger strike. The death of the prominent activist in detention is announced and reported worldwide.  
**Source URL:** https://en.wikipedia.org/wiki/Steve_Biko  
**Source name:** Death of Steve Biko in police custody, 12 September 1977 (encyclopedic synthesis of contemporary accounts).  

**Pre-fetched evidence snippet:**

> Please set a user-agent and respect our robot policy https://w.wiki/4wJS. See also https://phabricator.wikimedia.org/T400119.

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 15/65 · CSH.id: cmqyj3ke326mbsamshgk5hjlv

**Claim (first 200 chars):** In 2023, prevalence of obesity among adults (bmi ≥ 30) in Malaysia was 22.7 % (WHO GHO)  
**Claim ID:** cmq5809e014pgsaf7v1a64i7y  
**Pipeline:** who_gho_v1  
**External ID:** who_gho_NCD_BMI_30A_MYS_2023  
**Transition:** (entry) → RECORDED  
**Date:** 2023-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Health indicator officially recorded by WHO Global Health Observatory.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 16/65 · CSH.id: cmrf933z405n1fsxdl8imd6pd

**Claim (first 200 chars):** Entity: LIMITED LIABILITY COMPANY MORSKOI PORT SUKHODOL (OFAC SDN) — Specially Designated National under program RUSSIA-EO14024. Designated under authority of See Section 11 of Executive Order 14024..…  
**Claim ID:** cmq011vzo1kgrsathde9k5sz9  
**Pipeline:** ofac_sdn_v1  
**External ID:** ofac_sdn_52015  
**Transition:** (entry) → RECORDED  
**Date:** 2025-01-10 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Entity designated on OFAC Specially Designated Nationals list.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 17/65 · CSH.id: cmr2u9e1n04vesa5bv3qmjvlb

**Claim (first 200 chars):** Entity: GTS GRUPP (OFAC SDN) — Specially Designated National under program RUSSIA-EO14024. Designated under authority of See Section 11 of Executive Order 14024..  
**Claim ID:** cmq00npzc19uvsathmubeq3ux  
**Pipeline:** ofac_sdn_v1  
**External ID:** ofac_sdn_47597  
**Transition:** (entry) → RECORDED  
**Date:** 2014-01-01 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Entity designated on OFAC Specially Designated Nationals list.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 18/65 · CSH.id: cmqyzl6b13lmn8ovkosklp6v0

**Claim (first 200 chars):** Discharge 2013: European Monitoring Centre for Drugs and Drug Addiction (EMCDDA)  
**Claim ID:** cmpe5i9wn0cm7plw4ceugm5k7  
**Pipeline:** eu_parliament_v1  
**External ID:** ep_adopted_TA-8-2015-0148  
**Transition:** (entry) → RECORDED  
**Date:** 2015-04-29 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** European Parliament vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 19/65 · CSH.id: cmqyzkwqp2xtg8ovkrj6wz0qr

**Claim (first 200 chars):** CASE OF FEDERICI v. ITALY  
**Claim ID:** cmpe5v2au0cvbplh8fcgsemp7  
**Pipeline:** echr_judgments_v1  
**External ID:** echr_001-61342  
**Transition:** (entry) → SETTLED  
**Date:** 2003-10-09 (precision: DAY)  
**Community:** JUDICIAL  
**Reason:** European Court of Human Rights issued binding judgment.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 20/65 · CSH.id: cmqyzk5yh15j48ovkw0llnue6

**Claim (first 200 chars):** Ausländerbeschäftigungsgesetz und Niederlassungs- und Aufenthaltsgesetz — Beschluss des Nationalrates 873/BNR (XXVII. GP)  
**Claim ID:** cmpd6d6le0102pldyvjabq05v  
**Pipeline:** nationalrat_v1  
**External ID:** nationalrat_bnr_XXVII_873  
**Transition:** (entry) → SETTLED  
**Date:** 2023-12-14 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Legislation passed by the Austrian Nationalrat.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 21/65 · CSH.id: cmqyzlbox3z7d8ovk608be19f

**Claim (first 200 chars):** Dispute between International Publishing Corporation (IPC) and Daily Mirror journalists in Manchester; possiblilty of dispute...  
**Claim ID:** cmpixkkg00lulplq8ii17i0qr  
**Pipeline:** uk_national_archives_v1  
**External ID:** uk_nta_C11229809  
**Transition:** (entry) → RECORDED  
**Date:** 1974-02-19 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Document catalogued in the UK National Archives.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 22/65 · CSH.id: cmqyj3nyr2dvesamsxqihbf49

**Claim (first 200 chars):** In 2009, total alcohol per capita consumption (age 15+) in Netherlands (Kingdom of the) was 10.0 litres of pure alcohol (WHO GHO)  
**Claim ID:** cmq580kdi1pwxsaf72ultnlal  
**Pipeline:** who_gho_v1  
**External ID:** who_gho_SA_0000001688_NLD_2009  
**Transition:** (entry) → RECORDED  
**Date:** 2009-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Health indicator officially recorded by WHO Global Health Observatory.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 23/65 · CSH.id: cmqyzloc14tfk8ovkh0op4o1h

**Claim (first 200 chars):** Richard Willstätter was awarded The Nobel Prize in Chemistry 1915 "for his researches on plant pigments, especially chlorophyll".  
**Claim ID:** cmpbrfy3y00dpplbcpntide33  
**Pipeline:** nobel_v1  
**External ID:** nobel_laureate_176_chemistry_1915  
**Transition:** (entry) → SETTLED  
**Date:** 1915-11-11 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Nobel Prize awarded — highest institutional recognition of scientific contribution.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 24/65 · CSH.id: cmqyzll214m1h8ovkco5qjlvb

**Claim (first 200 chars):** Launch 1970-009 from V on 1970-02-04 by LERC/SAMSO on Thorad SLV-2G Agena D carried 1.524t orbital payload to LEO.  
**Claim ID:** cmplq9h5t0463sar8ptkdi2mf  
**Pipeline:** space_missions_v1  
**External ID:** space_mission_1970-009  
**Transition:** (entry) → RECORDED  
**Date:** 1970-02-04 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Space mission officially recorded in the international space mission registry.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 25/65 · CSH.id: cmqyzlq884y6r8ovkvt0b4r0p

**Claim (first 200 chars):** S&P/Case-Shiller U.S. National Home Price Index (FRED series CSUSHPINSA) was 159.663 index (January 2000=100, not seasonally adjusted) in September 2013.  
**Claim ID:** cmpypssrk0jfrsad16um2msjs  
**Pipeline:** fred_v1  
**External ID:** fred_CSUSHPINSA_2013-09-01  
**Transition:** (entry) → RECORDED  
**Date:** 2013-09-01 (precision: MONTH)  
**Community:** INSTITUTIONAL  
**Reason:** Economic indicator officially recorded in the Federal Reserve FRED database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 26/65 · CSH.id: cmqyzlb0l3xci8ovkjhl6ybkm

**Claim (first 200 chars):** The King: Proposed visit to India  
**Claim ID:** cmpix950b0ajlplq8g4n96rh0  
**Pipeline:** uk_national_archives_v1  
**External ID:** uk_nta_C199176  
**Transition:** (entry) → RECORDED  
**Date:** 1938-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Document catalogued in the UK National Archives.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 27/65 · CSH.id: cmrbi156300affssy4l4wig6l

**Claim (first 200 chars):** Parasite Encystment is defined by NIH MeSH as: Process by which certain parasites such as GIARDIA and ENTAMOEBA convert from the TROPHOZOITE to SCHIZONT when exposed to stress.  
**Claim ID:** cmph79vla0155pl1xze2bd0pl  
**Pipeline:** mesh_v1  
**External ID:** mesh_D000069289  
**Transition:** (entry) → SETTLED  
**Date:** 2016-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Medical concept officially indexed in the NLM MeSH controlled vocabulary.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 28/65 · CSH.id: cmqyj3edg1w8esamsg08cl8si

**Claim (first 200 chars):** In 2015, healthy life expectancy at birth in Haiti was 16.0 years (WHO GHO)  
**Claim ID:** cmq57zohq09aesaf7kyxxhcpl  
**Pipeline:** who_gho_v1  
**External ID:** who_gho_WHOSIS_000015_HTI_2015  
**Transition:** (entry) → RECORDED  
**Date:** 2015-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Health indicator officially recorded by WHO Global Health Observatory.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 29/65 · CSH.id: cmqyzlmmt4qlr8ovkro7ls5j4

**Claim (first 200 chars):** Launch 2025-119 from CC on 2025-06-03 by SPX on Falcon 9 carried 16.500t orbital payload to LEO.  
**Claim ID:** cmplqw8zt0qzhsar8ui4y7128  
**Pipeline:** space_missions_v1  
**External ID:** space_mission_2025-119  
**Transition:** (entry) → RECORDED  
**Date:** 2025-06-03 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Space mission officially recorded in the international space mission registry.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 30/65 · CSH.id: cmqyzl5j53jds8ovkpgeglawx

**Claim (first 200 chars):** Availability of fertilisers in the EU  
**Claim ID:** cmpe5anwh03mrplw40ttlk852  
**Pipeline:** eu_parliament_v1  
**External ID:** ep_adopted_TA-9-2023-0059  
**Transition:** (entry) → RECORDED  
**Date:** 2023-02-16 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** European Parliament vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 31/65 · CSH.id: cmqyj3p8x2gj7samsodpth194

**Claim (first 200 chars):** In 2020, population using safely managed sanitation services in Switzerland was 99.6 % (WHO GHO)  
**Claim ID:** cmq580okl1yh6saf7p9ffgoxf  
**Pipeline:** who_gho_v1  
**External ID:** who_gho_WSH_SANITATION_SAFELY_MANAGED_CHE_2020  
**Transition:** (entry) → RECORDED  
**Date:** 2020-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Health indicator officially recorded by WHO Global Health Observatory.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 32/65 · CSH.id: cmqyzlpe14w1d8ovkqigtx5j2

**Claim (first 200 chars):** Consumer Price Index for All Urban Consumers: All Items (FRED series CPIAUCSL) was 29.37 index (1982-1984=100, seasonally adjusted) in January 1960.  
**Claim ID:** cmpypgup106jfsad1xd13ctji  
**Pipeline:** fred_v1  
**External ID:** fred_CPIAUCSL_1960-01-01  
**Transition:** (entry) → RECORDED  
**Date:** 1960-01-01 (precision: MONTH)  
**Community:** INSTITUTIONAL  
**Reason:** Economic indicator officially recorded in the Federal Reserve FRED database.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 33/65 · CSH.id: cmrf934d1068dfsxdlw4wu6xr

**Claim (first 200 chars):** Entity: GRAND LEGEND INTERNATIONAL ASSET MANAGEMENT GROUP CO. LTD. (OFAC SDN) — Specially Designated National under program TCO. Listed under OFAC sanctions program TCO.  
**Claim ID:** cmq019vvc1qt5sathfljgfpkc  
**Pipeline:** ofac_sdn_v1  
**External ID:** ofac_sdn_55940  
**Transition:** (entry) → RECORDED  
**Date:** 2025-10-14 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Entity designated on OFAC Specially Designated Nationals list.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 34/65 · CSH.id: csh:trajectory:todaiji-great-buddha-eye-opening-752:0

**Claim (first 200 chars):** The eye-opening (kaigen) consecration of the Great Buddha (Daibutsu) at Tōdai-ji in Nara was held on the ninth day of the fourth month of 752 CE (9 April 752), the Indian monk Bodhisena painting in th…  
**Claim ID:** cmqjdrsv2002msaupmuujocgw  
**Pipeline:** seed:human-history-trajectories  
**External ID:** trajectory:todaiji-great-buddha-eye-opening-752  
**Transition:** (entry) → RECORDED  
**Date:** 0752-04-09 (precision: DAY)  
**Community:** PUBLIC  
**Reason:** The retired Emperor Shōmu, the reigning Empress Kōken, and a reported ten thousand monks gather as Bodhisena, brush in hand, opens the eyes of the great gilt-bronze Vairocana. The official court chronicle records the day, calling it "the most glorious event seen in this land since Buddhism arrived in the east."  
**Source URL:** https://en.wikipedia.org/wiki/T%C5%8Ddai-ji  
**Source name:** Shoku Nihongi (続日本紀), entry for the eye-opening ceremony of the Tōdai-ji Great Buddha, Tenpyō-shōhō 4 (752 CE). (compiled 797)  

**Pre-fetched evidence snippet:**

> Please set a user-agent and respect our robot policy https://w.wiki/4wJS. See also https://phabricator.wikimedia.org/T400119.

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 35/65 · CSH.id: cmqyzldbs437z8ovkqrilhiom

**Claim (first 200 chars):** 「本府荐任人員甄審」 — 彰化縣政府，檔號 A376470000A/0036/033.1/1，起訖 民國37年03月04日 ~ 民國37年11月06日  
**Claim ID:** cmpizsoei013qplb9qw19jsua  
**Pipeline:** taiwan_archives_v1  
**External ID:** taiwan_archives_0000010482  
**Transition:** (entry) → RECORDED  
**Date:** 1948-03-04 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Document catalogued in Taiwan's official archives.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 36/65 · CSH.id: cmqyzla8q3vhb8ovky3o9fcst

**Claim (first 200 chars):** Qatar military expenditure in 2005 was $1,520 million (constant 2024 US dollars), per SIPRI.  
**Claim ID:** cmplrujkl1272saki7t0giz62  
**Pipeline:** sipri_milex_v1  
**External ID:** sipri_milex_qatar_2005  
**Transition:** (entry) → RECORDED  
**Date:** 2005-12-31 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Military expenditure data recorded by SIPRI.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 37/65 · CSH.id: cmqyzl6h53m4n8ovk8mg3ujca

**Claim (first 200 chars):** UN Security Council adopted Resolution 405 on 1977-04-14 concerning condemning the armed aggression against Benin of 16 January 1977. Vote: 15-0-0 (total 15 members).  
**Claim ID:** cmp2yggwz039lxnuomxsra5hh  
**Pipeline:** un_sc_resolutions_v1  
**External ID:** S/RES/405(1977)  
**Transition:** (entry) → SETTLED  
**Date:** 1977-04-14 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** UN Security Council resolution adopted — binding on all member states.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 38/65 · CSH.id: cmqyzlqtg4zr28ovk5o8hdz4w

**Claim (first 200 chars):** LOFGREN, ZOE (DEMOCRATIC PARTY, CA, House) raised $1,733,955 and spent $1,872,385 in the 2018 election cycle  
**Claim ID:** cmq4mekiz06pzsabc3oeifkdw  
**Pipeline:** fec_finance_v1  
**External ID:** fec_finance_v1-H4CA16049-2018  
**Transition:** (entry) → RECORDED  
**Date:** 2018-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Campaign finance disclosure officially recorded by the FEC.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 39/65 · CSH.id: cmqyzld1i42qp8ovkaghl79pp

**Claim (first 200 chars):** europeana19141918:agent/0ed35f02f4412a5fd6e09d23103f338a: Fotopostkarte  von Alfons Fenzel  
**Claim ID:** cmpj0yh7y16o8plnojaj5vcr7  
**Pipeline:** europeana_wwi_v1  
**External ID:** europeana_wwi_2020601_https___1914_1918_europeana_eu_contributions_2758  
**Transition:** (entry) → RECORDED  
**Date:** 1914-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** WWI-era document or artefact catalogued in Europeana.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 40/65 · CSH.id: cmqyzlbas3xzk8ovkvp87e0fk

**Claim (first 200 chars):** Decision to suspend activities of the Boundary Commission.  
**Claim ID:** cmpixd7cj0ejlplq8rxgf86vp  
**Pipeline:** uk_national_archives_v1  
**External ID:** uk_nta_C201291  
**Transition:** (entry) → RECORDED  
**Date:** 1949-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Document catalogued in the UK National Archives.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 41/65 · CSH.id: cmqyj3d1h1tissamsppxcabjd

**Claim (first 200 chars):** In 2000, life expectancy at birth in Romania was 71.1 years (WHO GHO)  
**Claim ID:** cmq57zjtw01agsaf7vz8qfmk5  
**Pipeline:** who_gho_v1  
**External ID:** who_gho_WHOSIS_000001_ROU_2000  
**Transition:** (entry) → RECORDED  
**Date:** 2000-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Health indicator officially recorded by WHO Global Health Observatory.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 42/65 · CSH.id: cmqyzlh694c038ovkdk6wflib

**Claim (first 200 chars):** NIH awarded grant 1R01DK132008-01A1 to UNIVERSITY OF MICHIGAN AT ANN ARBOR for "Defining roles for area postrema neuron cell types in food intake and nausea" totaling $688,229, PI: Martin G Myers (FY2…  
**Claim ID:** cmpm80vwe0i2psaj2s7jd2069  
**Pipeline:** nih_reporter_v1  
**External ID:** nih_grant_1R01DK132008-01A1  
**Transition:** (entry) → RECORDED  
**Date:** 2023-03-10 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** NIH research grant officially awarded and recorded in NIH Reporter.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 43/65 · CSH.id: cmqyj3ovt2fmtsamsnxo3m8pd

**Claim (first 200 chars):** In 2022, population using safely managed sanitation services in Lesotho was 41.8 % (WHO GHO)  
**Claim ID:** cmq580mtl1v9gsaf74hy0mjbf  
**Pipeline:** who_gho_v1  
**External ID:** who_gho_WSH_SANITATION_SAFELY_MANAGED_LSO_2022  
**Transition:** (entry) → RECORDED  
**Date:** 2022-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Health indicator officially recorded by WHO Global Health Observatory.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 44/65 · CSH.id: cmr2u9e1o04xosa5boadkkrmk

**Claim (first 200 chars):** Entity: MIRAN LLC (OFAC SDN) — Specially Designated National under program RUSSIA-EO14024. Designated under authority of See Section 11 of Executive Order 14024..  
**Claim ID:** cmq00o2uu1a43sathvz17q0e7  
**Pipeline:** ofac_sdn_v1  
**External ID:** ofac_sdn_47690  
**Transition:** (entry) → RECORDED  
**Date:** 2014-01-01 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Entity designated on OFAC Specially Designated Nationals list.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 45/65 · CSH.id: cmqyzlt2p55748ovkk7wso9vc

**Claim (first 200 chars):** A magnitude 6.9 MW earthquake struck 203 km WSW of Adak, Alaska on 1913-03-31.  
**Claim ID:** cmpasqmly01t3plbfjhll8tha  
**Pipeline:** usgs_eq_v1  
**External ID:** usgs_eq_iscgem914049  
**Transition:** (entry) → RECORDED  
**Date:** 1913-03-31 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Earthquake event officially recorded by the USGS seismic network.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 46/65 · CSH.id: csh:trajectory:ocrelizumab-ocrevus-first-primary-progressive-ms-drug-2017:0

**Claim (first 200 chars):** On 28 March 2017, the U.S. FDA approved ocrelizumab (Ocrevus), the first therapy ever shown to slow disability progression in primary progressive multiple sclerosis, a form of MS for which no disease-…  
**Claim ID:** cmqjolqgg00j7sac44j9sk5pz  
**Pipeline:** seed:medicine-trajectories  
**External ID:** trajectory:ocrelizumab-ocrevus-first-primary-progressive-ms-drug-2017  
**Transition:** (entry) → RECORDED  
**Date:** 2016-12-21 (precision: DAY)  
**Community:** EXPERT_LITERATURE  
**Reason:** The ORATORIO phase 3 trial, published in the New England Journal of Medicine, randomized 732 primary progressive MS patients and found that the anti-CD20 antibody ocrelizumab significantly reduced the proportion with confirmed disability progression versus placebo. This was the first positive pivotal trial in a disease subtype that had defeated every prior disease-modifying candidate.  
**Source URL:** https://pubmed.ncbi.nlm.nih.gov/28002688/  
**Source name:** Montalban X, Hauser SL, Kappos L, et al. Ocrelizumab versus Placebo in Primary Progressive Multiple Sclerosis. N Engl J Med. 2017;376(3):209-220.  

**Pre-fetched evidence snippet:** *(fetch failed — candidate UNVERIFIABLE if no archive found)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 47/65 · CSH.id: cmr2u9eq906lqsa5b0327xqpr

**Claim (first 200 chars):** Entity: ELM KIMYA ITHALAT IHRACAT SANAYI VE TICARET ANONIM SIRKETI (OFAC SDN) — Specially Designated National under program IRAN-EO13846. Listed under OFAC sanctions program IRAN-EO13846.  
**Claim ID:** cmq01813w1pbvsath6uxak5bx  
**Pipeline:** ofac_sdn_v1  
**External ID:** ofac_sdn_55000  
**Transition:** (entry) → RECORDED  
**Date:** 1979-01-01 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Entity designated on OFAC Specially Designated Nationals list.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 48/65 · CSH.id: cmqyzk5yh15j08ovkk70jq36c

**Claim (first 200 chars):** Emissionszertifikategesetz 2011 und CBAM-Vollzugsgesetz 2023 — Beschluss des Nationalrates 883/BNR (XXVII. GP)  
**Claim ID:** cmpd6d67t00zmpldywba2w25n  
**Pipeline:** nationalrat_v1  
**External ID:** nationalrat_bnr_XXVII_883  
**Transition:** (entry) → SETTLED  
**Date:** 2023-12-15 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Legislation passed by the Austrian Nationalrat.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 49/65 · CSH.id: cmqyj3hbv21hzsamsfesjlt4w

**Claim (first 200 chars):** In 2013, infant mortality rate in Suriname was 121.2 per 1,000 live births (WHO GHO)  
**Claim ID:** cmq57zw9f0oozsaf7323j0oh5  
**Pipeline:** who_gho_v1  
**External ID:** who_gho_MDG_0000000026_SUR_2013  
**Transition:** (entry) → RECORDED  
**Date:** 2013-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Health indicator officially recorded by WHO Global Health Observatory.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 50/65 · CSH.id: cmrbi18my05qtfssyywoz2n28

**Claim (first 200 chars):** Diet Fads is defined by NIH MeSH as: Diets which become fashionable, but which are not necessarily nutritious.(Lehninger 1982, page 484)  
**Claim ID:** cmph7v3rk0myppl1xp05gvqg4  
**Pipeline:** mesh_v1  
**External ID:** mesh_D004033  
**Transition:** (entry) → SETTLED  
**Date:** 1966-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Medical concept officially indexed in the NLM MeSH controlled vocabulary.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 51/65 · CSH.id: cmqyj3hkg21nzsams83zsdi4r

**Claim (first 200 chars):** In 2021, infant mortality rate in Yemen was 155.9 per 1,000 live births (WHO GHO)  
**Claim ID:** cmq57zwoz0pmrsaf7k2lnj0lm  
**Pipeline:** who_gho_v1  
**External ID:** who_gho_MDG_0000000026_YEM_2021  
**Transition:** (entry) → RECORDED  
**Date:** 2021-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Health indicator officially recorded by WHO Global Health Observatory.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 52/65 · CSH.id: cmqyzkwfq2wzj8ovkwneea0tg

**Claim (first 200 chars):** CASE OF SANTAGATA v. ITALY  
**Claim ID:** cmpe5shvd09jnplh8rtqged3h  
**Pipeline:** echr_judgments_v1  
**External ID:** echr_001-60294  
**Transition:** (entry) → SETTLED  
**Date:** 2002-02-28 (precision: DAY)  
**Community:** JUDICIAL  
**Reason:** European Court of Human Rights issued binding judgment.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 53/65 · CSH.id: cmqyzl5nw3jmt8ovk5hbianih

**Claim (first 200 chars):** Discharge 2020: European Union Agency for the Operational Management of Large-Scale IT Systems in the Area of Freedom, Security and Justice (eu-LISA)  
**Claim ID:** cmpe5bglu04mvplw4348gi1ka  
**Pipeline:** eu_parliament_v1  
**External ID:** ep_adopted_TA-9-2022-0185  
**Transition:** (entry) → RECORDED  
**Date:** 2022-05-04 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** European Parliament vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 54/65 · CSH.id: cmqyzlr1w50h08ovktihdtf47

**Claim (first 200 chars):** JOYCE, DAVID P (REPUBLICAN PARTY, OH, House) raised $2,606,248 and spent $1,442,817 in the 2022 election cycle  
**Claim ID:** cmq4mjuqo0a7zsabch65vv7sn  
**Pipeline:** fec_finance_v1  
**External ID:** fec_finance_v1-H2OH14064-2022  
**Transition:** (entry) → RECORDED  
**Date:** 2022-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Campaign finance disclosure officially recorded by the FEC.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 55/65 · CSH.id: cmqyj2oib1po7samslxj168yz

**Claim (first 200 chars):** The CMS published "Medicare Program; Prior Determination for Certain Items and Services" as a final rule on 2008-02-22, effective 2008-03-24. This final rule establishes a process for Medicare contrac…  
**Claim ID:** cmpa35lgk07tnplxgy66phzli  
**Pipeline:** fr_rules_v1  
**External ID:** fr_rule_E8-2811  
**Transition:** (entry) → SETTLED  
**Date:** 2008-02-22 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Federal rule finalized through EO 12866 regulatory review process.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 56/65 · CSH.id: cmrbi155z002ifssywd9pg5v9

**Claim (first 200 chars):** Rehabilitation Research is defined by NIH MeSH as: Studies and research concerning the psychological, educational, social, vocational, industrial, and economic aspects of REHABILITATION.  
**Claim ID:** cmph78xyt009hpl1x2jb7qsl5  
**Pipeline:** mesh_v1  
**External ID:** mesh_D000066768  
**Transition:** (entry) → SETTLED  
**Date:** 2016-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Medical concept officially indexed in the NLM MeSH controlled vocabulary.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 57/65 · CSH.id: cmr2ub1bj1lyfsa5bnyacn4g3

**Claim (first 200 chars):** Sergent al Armatei Germane  
**Claim ID:** cmpj03m1l0bzeplnowolcv0r0  
**Pipeline:** europeana_wwi_v1  
**External ID:** europeana_wwi_952_Culturalia_8be69a0b_000e_4dd5_b52d_8963eb98ca2f  
**Transition:** (entry) → RECORDED  
**Date:** 1915-01-01 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** WWI-era document or artefact catalogued in Europeana.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 58/65 · CSH.id: cmqyj3klo27awsamsgzitkzi9

**Claim (first 200 chars):** In 2007, prevalence of obesity among adults (bmi ≥ 30) in United States of America was 33.8 % (WHO GHO)  
**Claim ID:** cmq580anj16vfsaf7wx279ckk  
**Pipeline:** who_gho_v1  
**External ID:** who_gho_NCD_BMI_30A_USA_2007  
**Transition:** (entry) → RECORDED  
**Date:** 2007-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Health indicator officially recorded by WHO Global Health Observatory.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 59/65 · CSH.id: cmqyjdrbuelhnsamsyrq2r1tm

**Claim (first 200 chars):** Pakistan: Maritime Security Agency, Act, 1994 (X of 1994)  
**Claim ID:** cmq4nqhxh01fbsazs2f92pk4l  
**Pipeline:** pakistan_code_v1  
**External ID:** pak_code_UY2FqaJw1-apaUY2Fqa-apaUY2Npa5tp-sg-jjjjjjjjjjjjj  
**Transition:** (entry) → SETTLED  
**Date:** 1994-12-01 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Legislation encoded in Pakistani legal code.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 60/65 · CSH.id: cmr2u9cpb01cfsa5bplpxl4sr

**Claim (first 200 chars):** Entity: GAZPROM VNIIGAZ, OOO (OFAC SDN) — Specially Designated National under program UKRAINE-EO13662, RUSSIA-EO14024. Designated under authority of Ukraine-/Russia-Related Sanctions Regulations, 31 C…  
**Claim ID:** cmpzzf5xy0c3jsathhhbhzigi  
**Pipeline:** ofac_sdn_v1  
**External ID:** ofac_sdn_19653  
**Transition:** (entry) → RECORDED  
**Date:** 2014-01-01 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Entity designated on OFAC Specially Designated Nationals list.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 61/65 · CSH.id: cmqyj3ja624z0samstxcjuavh

**Claim (first 200 chars):** In 2007, under-5 mortality rate in Samoa was 19.3 per 1,000 live births (WHO GHO)  
**Claim ID:** cmq5803dy0zwnsaf7c6456hmy  
**Pipeline:** who_gho_v1  
**External ID:** who_gho_MDG_0000000007_WSM_2007  
**Transition:** (entry) → RECORDED  
**Date:** 2007-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Health indicator officially recorded by WHO Global Health Observatory.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 62/65 · CSH.id: cmqyj3mxz2bmisamsrskburzd

**Claim (first 200 chars):** In 2019, annual mean pm2.5 concentration in United Republic of Tanzania was 14.5 μg/m³ (WHO GHO)  
**Claim ID:** cmq580gxt1jl7saf7x0l6cnsx  
**Pipeline:** who_gho_v1  
**External ID:** who_gho_SDGPM25_TZA_2019  
**Transition:** (entry) → RECORDED  
**Date:** 2019-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Health indicator officially recorded by WHO Global Health Observatory.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 63/65 · CSH.id: cmqyzl7113nqk8ovkesjg8l8q

**Claim (first 200 chars):** UN Security Council adopted Resolution 2490 on 2019-09-20 concerning on extension of the mandate of the Special Adviser and the UN Investigative Team to Promote Accountability for Crimes Committed by …  
**Claim ID:** cmp2ynnup06y7xn4npjf6xclq  
**Pipeline:** un_sc_resolutions_v1  
**External ID:** S/RES/2490 (2019)  
**Transition:** (entry) → SETTLED  
**Date:** 2019-09-20 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** UN Security Council resolution adopted — binding on all member states.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 64/65 · CSH.id: cmrf9335x03ycfsxdaak5xear

**Claim (first 200 chars):** Entity: ALBATROS OOO (OFAC SDN) — Specially Designated National under program RUSSIA-EO14024. Designated under authority of See Section 11 of Executive Order 14024..  
**Claim ID:** cmq00j41u16hvsathfbefs9g7  
**Pipeline:** ofac_sdn_v1  
**External ID:** ofac_sdn_45709  
**Transition:** (entry) → RECORDED  
**Date:** 2024-02-23 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Entity designated on OFAC Specially Designated Nationals list.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 65/65 · CSH.id: cmqyzk63g160s8ovkaesbovkm

**Claim (first 200 chars):** Gesundheits- und Krankenpflegegesetz, MTD-Gesetz, Bundespflegegeldgesetz, Kraftfahrgesetz 1967, Führerscheingesetz und 2. COVID-19-Justiz-Begleitgesetz — Beschluss des Nationalrates 233/BNR (XXVII. GP…  
**Claim ID:** cmpd6ervk02yqpldyoqev5i6m  
**Pipeline:** nationalrat_v1  
**External ID:** nationalrat_bnr_XXVII_233  
**Transition:** (entry) → SETTLED  
**Date:** 2021-02-24 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Legislation passed by the Austrian Nationalrat.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

