# B15 Error-Rate Audit — Worksheet: votes:baseline

**Stratum:** votes × baseline transition  
**Population:** 143,585  
**Sampled:** 39  
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

## Row 1/39 · CSH.id: cmqyilu4b1upfsanvbarzjcjp

**Claim (first 200 chars):** The U.S. House of Representatives voted 36-35 on "TO AGREE TO THE SENATE AMENDMENT TO H.R. 7, TO PAY TO ALL OFFICERS MENTALLY U..." (Congress 7, Roll Call 33, 1802-03-08) — passed.  
**Claim ID:** cmq5kxzxr073wsal8le5oi6y2  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmpputufz02jasapmyyflbyl4  
**Transition:** (entry) → RECORDED  
**Date:** 1802-03-08 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 2/39 · CSH.id: cmqyj2fs61btvsamsai2grueo

**Claim (first 200 chars):** The U.S. Senate voted 42-55 on "To provide a date on which the authority of the section relating to the incre..." (Congress 110, Roll Call 200, 2007-06-06) — failed.  
**Claim ID:** cmq5l1b2h6a2jsal8bh3d530y  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuv80w44ytsapmobq2tehw  
**Transition:** (entry) → RECORDED  
**Date:** 2007-06-06 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 3/39 · CSH.id: cmqyzlrmn51zi8ovkeq3bohuf

**Claim (first 200 chars):** Outside groups spent opposing ELLIOTT, JOYCE ANN SENATOR — $1,764,781 in independent expenditures in the 2020 cycle  
**Claim ID:** cmpvbt1g9015dsarwz5nus3gx  
**Pipeline:** openfec_ie_v1  
**External ID:** openfec_ie_v1-H0AR02206-2020-O  
**Transition:** (entry) → RECORDED  
**Date:** 2020-01-01 (precision: YEAR)  
**Community:** INSTITUTIONAL  
**Reason:** Independent expenditure officially recorded by the FEC.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 4/39 · CSH.id: cmqyilz4o21oqsanvtj9s50qh

**Claim (first 200 chars):** The U.S. House of Representatives voted 75-87 on "TO ORDER ENGROSSMENT AND THIRD READING OF S.J.R. 16." (Congress 26, Roll Call 547, 1840-07-09) — failed.  
**Claim ID:** cmq5kybnu0rz7sal8hblt52dv  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmpputzjn0gglsapmrxpkeu8d  
**Transition:** (entry) → RECORDED  
**Date:** 1840-07-09 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 5/39 · CSH.id: cmqyj2mgj1mpvsamsh8d2aky8

**Claim (first 200 chars):** The U.S. House of Representatives voted 266-153 on "DHS Restrictions on Confucius Institutes and Chinese Entities of Concern Act" (Congress 119, Roll Call 119, 2025-05-07) — passed.  
**Claim ID:** cmq5l1u9f77c3sal8694zr62e  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuvf0g4qprsapm20vvaxl6  
**Transition:** (entry) → RECORDED  
**Date:** 2025-05-07 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 6/39 · CSH.id: cmqyj0xn202kzsamsh6h5826a

**Claim (first 200 chars):** The U.S. House of Representatives voted 82-124 on "TO ADJOURN, MOTION MADE DURING CONSIDERATION OF THE BILL H.R. 10881.  (P. 35-1)" (Congress 51, Roll Call 418, 1890-12-02) — failed.  
**Claim ID:** cmq5kza772ijnsal8lasislgt  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuud531m71sapm7ym6kl4s  
**Transition:** (entry) → RECORDED  
**Date:** 1890-12-02 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 7/39 · CSH.id: cmqyj2flb1b2msamsac9kqria

**Claim (first 200 chars):** The U.S. House of Representatives voted 417-0 on "KIDS Act of 2007" (Congress 110, Roll Call 1085, 2007-11-14) — passed.  
**Claim ID:** cmq5l1agh68jisal8v8nbuhsp  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuv7jc43fssapmwcc2xsq4  
**Transition:** (entry) → RECORDED  
**Date:** 2007-11-14 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 8/39 · CSH.id: cmqyj1ajk0672samswrn1m9m9

**Claim (first 200 chars):** The U.S. House of Representatives voted 128-142 on "TO AMEND H.R. 32010, BY PROVIDING THAT 2 OF THE 5 MEMBERS ON THE TARIFF BOARD..." (Congress 61, Roll Call 150, 1911-01-30) — failed.  
**Claim ID:** cmq5kzfyi2tvisal81hg9abk0  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuug321to0sapmo6brd038  
**Transition:** (entry) → RECORDED  
**Date:** 1911-01-30 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 9/39 · CSH.id: cmqyilqan1qiosanvjqejnyeo

**Claim (first 200 chars):** H.R. 3250 (111th Congress) enacted — To designate the facility of the United States Postal Service located at 1210 West Main Street in Riverhead, New York, as the "Private First Class Garfield M. Lang…  
**Claim ID:** cmpcvea1o100jpls2ia4o85dd  
**Pipeline:** congress_v1  
**External ID:** congress_law_111_hr_3250  
**Transition:** (entry) → SETTLED  
**Date:** 2010-06-09 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Bill enacted into law, entering the settled US legal record.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 10/39 · CSH.id: cmqyj28li10c4samsftuhhp81

**Claim (first 200 chars):** The U.S. House of Representatives voted 96-325 on "(HOUSE REJECTED THE BURTON OF INDIANA AMENDMENT THAT SOUGHT TO CUT BY 2.99567..." (Congress 103, Roll Call 255, 1993-06-24) — failed.  
**Claim ID:** cmq5l0srp5c78sal8b943hqse  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuv0nw3hwesapm8il3hmzp  
**Transition:** (entry) → RECORDED  
**Date:** 1993-06-24 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 11/39 · CSH.id: cmqyj1wqj0kfpsamskhjys0e6

**Claim (first 200 chars):** The U.S. Senate voted 85-0 on "TO PASS H.R. 9271, 1972 APPROPRIATIONS FOR THE TREASURY, EXECUTIVE OFFICE, AN..." (Congress 92, Roll Call 116, 1971-07-09) — passed.  
**Claim ID:** cmq5l02wq3zw5sal8mhberqvk  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuupg72lsnsapm0bqvdriz  
**Transition:** (entry) → RECORDED  
**Date:** 1971-07-09 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 12/39 · CSH.id: cmqyj1zse0nvosamse4cypuwx

**Claim (first 200 chars):** The U.S. Senate voted 26-59 on "TO TABLE SEN. HELMS' AMENDMENT TO S. 622, PROHIBITING STATE AND LOCAL GOVERNM..." (Congress 94, Roll Call 135, 1975-04-10) — failed.  
**Claim ID:** cmq5l08o44aa4sal8kvh5sjxi  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuurx92t3isapmfbwcmg2v  
**Transition:** (entry) → RECORDED  
**Date:** 1975-04-10 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 13/39 · CSH.id: cmqyj2gzs1dk2samssqhemw6a

**Claim (first 200 chars):** The U.S. Senate voted 56-41 on "To express the sense of the Senate regarding the Federal income tax charitabl..." (Congress 111, Roll Call 112, 2009-03-26) — passed.  
**Claim ID:** cmq5l1dx86fnmsal8n8o637fl  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuv98i488ksapmcswuz5lv  
**Transition:** (entry) → RECORDED  
**Date:** 2009-03-26 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 14/39 · CSH.id: cmqyj2drq184jsamsm0sdrs1a

**Claim (first 200 chars):** The U.S. House of Representatives voted 129-291 on "On Agreeing to the Amendment" (Congress 108, Roll Call 1016, 2004-07-08) — failed.  
**Claim ID:** cmq5l15fd5zf7sal8ao7f1dtm  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuv5ue3xelsapmrs9t7cdm  
**Transition:** (entry) → RECORDED  
**Date:** 2004-07-08 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 15/39 · CSH.id: cmqyj1wdf0jzksamsbb9x6ul2

**Claim (first 200 chars):** The U.S. House of Representatives voted 186-183 on "TO ADOPT BRADEMAS' AMENDMENT TO H.R. 10351." (Congress 92, Roll Call 184, 1971-09-30) — passed.  
**Claim ID:** cmq5l02ac3yo8sal8jlvxsu0f  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuup192kkqsapm73ndvlfo  
**Transition:** (entry) → RECORDED  
**Date:** 1971-09-30 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 16/39 · CSH.id: cmqyj266t0xhxsamsyjwg32ji

**Claim (first 200 chars):** The U.S. Senate voted 93-2 on "TO AMEND THE HELMS, NC AMENDMENT TO SJ RES 194, THE WAR POWERS COMPLIANCE RES..." (Congress 100, Roll Call 340, 1987-10-20) — passed.  
**Claim ID:** cmq5l0nsr536tsal8xci5xrfa  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuuyjt3bz3sapmcfnh9zgo  
**Transition:** (entry) → RECORDED  
**Date:** 1987-10-20 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 17/39 · CSH.id: cmqyiltu41udesanvg7w3t0j6

**Claim (first 200 chars):** The U.S. Senate voted 9-17 on "TO ORDER THIRD READING OF S. 19, A BILL TO ENABLE THE PRESIDENT, UNDER CERTAI..." (Congress 5, Roll Call 18, 1797-06-22) — failed.  
**Claim ID:** cmq5kxzah0603sal83ubqj7u2  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmpputtpd01fhsapmwc825n9p  
**Transition:** (entry) → RECORDED  
**Date:** 1797-06-22 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 18/39 · CSH.id: cmqyj205v0o18samssddkkrw3

**Claim (first 200 chars):** The U.S. Senate voted 67-15 on "TO OVERRIDE PRESIDENT'S VETO OF S. 66, EXTENDING AND REVISING NURSES TRAINING..." (Congress 94, Roll Call 337, 1975-07-26) — passed.  
**Claim ID:** cmq5l096h4b7gsal8rf2ygxaq  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuurxb2t92sapm80eabvrm  
**Transition:** (entry) → RECORDED  
**Date:** 1975-07-26 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 19/39 · CSH.id: cmqyj1vz10ji7sams3mhpjwvs

**Claim (first 200 chars):** The U.S. Senate voted 34-57 on "TO TABLE FULBRIGHT AMENDMENT TO H.R. 15149, FISCAL 1970 APPROPRIATIONS FOR TH..." (Congress 91, Roll Call 227, 1969-12-18) — failed.  
**Claim ID:** cmq5l01qm3xf3sal8l9k34ik7  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuup132k3dsapmvac3fx0v  
**Transition:** (entry) → RECORDED  
**Date:** 1969-12-18 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 20/39 · CSH.id: cmqyj23gu0t2bsams0ear9g86

**Claim (first 200 chars):** The U.S. House of Representatives voted 253-151 on "TO OVERRIDE PRESIDENT'S VETO OF H.R. 5922, A BILL MAKING HIGHER SUPPLEMENTAL ..." (Congress 97, Roll Call 518, 1982-06-24) — passed.  
**Claim ID:** cmq5l0gqn4q9nsal8u3jmasac  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuuvd532wtsapmlu0h201r  
**Transition:** (entry) → RECORDED  
**Date:** 1982-06-24 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 21/39 · CSH.id: cmqyim0s4245ssanv2cervh8e

**Claim (first 200 chars):** The U.S. Senate voted 27-25 on "TO AMEND IN THE COMMITTEE OF THE WHOLE, H.J.R.46, AMENDMENT BEING THAT IF THE..." (Congress 28, Roll Call 270, 1845-02-27) — passed.  
**Claim ID:** cmq5kyftq0z2xsal8ao81hj01  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuu12f0l8zsapm912ng5yb  
**Transition:** (entry) → RECORDED  
**Date:** 1845-02-27 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 22/39 · CSH.id: cmqyj16op0517samst503jcox

**Claim (first 200 chars):** The U.S. House of Representatives voted 103-98 on "TO MOVE THE PREVIOUS QUESTION ON THE H. RES. REGARDING THE RIGHT OF MALE CITI..." (Congress 56, Roll Call 105, 1901-01-04) — passed.  
**Claim ID:** cmq5kze982qebsal8hzu0edjo  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuuesp1qylsapm92j5url0  
**Transition:** (entry) → RECORDED  
**Date:** 1901-01-04 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 23/39 · CSH.id: cmqyj17ya05mbsamsfy5lsaln

**Claim (first 200 chars):** The U.S. House of Representatives voted 199-7 on "THAT THE HOUSE RESOLVE INTO THE COMMITTEE OF THE WHOLE, FOR THE CONSIDERATION..." (Congress 59, Roll Call 72, 1906-05-28) — passed.  
**Claim ID:** cmq5kzeus2rr7sal88no4ljr9  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuufhz1sbhsapm8n7qa43f  
**Transition:** (entry) → RECORDED  
**Date:** 1906-05-28 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 24/39 · CSH.id: cmqyj240o0txdsams35e2ymom

**Claim (first 200 chars):** The U.S. Senate voted 38-61 on "TO AMEND S. 2222 TO PREVENT THE TRANSFER OF UNUSED VISAS FROM ONE CONTIGUOUS ..." (Congress 97, Roll Call 825, 1982-08-17) — failed.  
**Claim ID:** cmq5l0i1y4so9sal8wbm7r1fa  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuuvu934jnsapm53gs7oi5  
**Transition:** (entry) → RECORDED  
**Date:** 1982-08-17 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 25/39 · CSH.id: cmqyilp8x1nxssanvkdjix3we

**Claim (first 200 chars):** H.R. 2527 (104th Congress) enacted — To amend the Federal Election Campaign Act of 1971 to improve the electoral process by permitting electronic filing and preservation of Federal Election Commission…  
**Claim ID:** cmpcv13ij0kj7pls2nyfujt8g  
**Pipeline:** congress_v1  
**External ID:** congress_law_104_hr_2527  
**Transition:** (entry) → SETTLED  
**Date:** 1995-12-28 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Bill enacted into law, entering the settled US legal record.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 26/39 · CSH.id: cmqyj1ygc0lqnsams5i99veq0

**Claim (first 200 chars):** The U.S. House of Representatives voted 341-40 on "TO SUSPEND THE RULES AND PASS H.R. 13377, PROVIDING HOSPITAL AND MEDICAL CARE..." (Congress 93, Roll Call 852, 1974-08-05) — passed.  
**Claim ID:** cmq5l05ed44a7sal8h1f7raw3  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuuqdk2on5sapmm29jfmyc  
**Transition:** (entry) → RECORDED  
**Date:** 1974-08-05 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 27/39 · CSH.id: cmqyj2lgo1kzssamsk09lak6b

**Claim (first 200 chars):** The U.S. Senate voted 51-42 on "Justin Reed Walker, of Kentucky, to be United States Circuit Judge for the Di..." (Congress 116, Roll Call 551, 2020-06-18) — passed.  
**Claim ID:** cmq5l1qqp71r4sal86c5qzgjf  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuvdcd4mmasapm1ynyupib  
**Transition:** (entry) → RECORDED  
**Date:** 2020-06-18 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 28/39 · CSH.id: cmqyim9512fwbsanv7w6ebpxx

**Claim (first 200 chars):** The U.S. House of Representatives voted 81-88 on "TO PASS H.R. 2197, A BILL ENCOURAGING THE PLANTING OF TREES AND THE PRESERVAT..." (Congress 42, Roll Call 268, 1872-04-30) — failed.  
**Claim ID:** cmq5kyzj61yqksal8aguinc31  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuu8k318k6sapmngloxzim  
**Transition:** (entry) → RECORDED  
**Date:** 1872-04-30 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 29/39 · CSH.id: cmqyj29oe1209samsos3ky3p7

**Claim (first 200 chars):** The U.S. House of Representatives voted 255-156 on "H.RES.207  BY LINDER (R-GA) -- PROCEDURAL RESOLUTION - H.R. 1555 (HOUSE PASSE..." (Congress 104, Roll Call 602, 1995-08-03) — passed.  
**Claim ID:** cmq5l0v755gyhsal80cgvsx6u  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuv1tr3l43sapmyxan48u9  
**Transition:** (entry) → RECORDED  
**Date:** 1995-08-03 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 30/39 · CSH.id: cmqyj1mz90b2osamskpahri2m

**Claim (first 200 chars):** The U.S. Senate voted 45-23 on "TO PASS S. J. RES. 49, PROVIDING FOR THE NATIONAL DEFENSE BY THE CREATION OF ..." (Congress 71, Roll Call 298, 1930-04-04) — passed.  
**Claim ID:** cmq5kzngd380gsal85ixpti58  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuuja5236asapma8ewst8w  
**Transition:** (entry) → RECORDED  
**Date:** 1930-04-04 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 31/39 · CSH.id: cmqyj2f0f1afwsamskwsncmgb

**Claim (first 200 chars):** The U.S. House of Representatives voted 420-0 on "Supporting the goals and ideals of National Community College Month" (Congress 110, Roll Call 269, 2007-05-01) — passed.  
**Claim ID:** cmq5l193e66d8sal8n7rv0etz  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuv709421asapmzhjneswh  
**Transition:** (entry) → RECORDED  
**Date:** 2007-05-01 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 32/39 · CSH.id: cmqyj100x033osamsmwj5y83b

**Claim (first 200 chars):** The U.S. Senate voted 35-16 on "TO CONSIDER EXECUTIVE BUSINESS." (Congress 51, Roll Call 500, 1891-02-27) — passed.  
**Claim ID:** cmq5kzbhg2klwsal8b7jvetgs  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuudqj1nhisapmf35umjd5  
**Transition:** (entry) → RECORDED  
**Date:** 1891-02-27 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 33/39 · CSH.id: cmqyilu4d1uv4sanvjqajw7lf

**Claim (first 200 chars):** The U.S. House of Representatives voted 116-0 on "TO PASS THE HOUSE BILL TO PROVIDE FOR THE FURTHER PROTECTION OF THE SEAMEN AN..." (Congress 8, Roll Call 6, 1803-11-17) — passed.  
**Claim ID:** cmq5kxzxv079lsal89095nwpw  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmpputug102ozsapmcijarr09  
**Transition:** (entry) → RECORDED  
**Date:** 1803-11-17 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 34/39 · CSH.id: cmqyim9n22gs0sanvbtphtwvk

**Claim (first 200 chars):** The U.S. House of Representatives voted 167-80 on "TO ORDER ENGROSSMENT AND 3RD READING OF H.R. 1398." (Congress 43, Roll Call 91, 1874-03-23) — passed.  
**Claim ID:** cmq5kz0si215tsal80nr12hk2  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuu9341a7nsapm4gsst7k2  
**Transition:** (entry) → RECORDED  
**Date:** 1874-03-23 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 35/39 · CSH.id: cmqyim7tl2e7csanvkip85j49

**Claim (first 200 chars):** The U.S. Senate voted 20-25 on "TO ADJOURN, MOTION MADE DURING DEBATE H.R. 213.  (P. 533-2)" (Congress 40, Roll Call 164, 1868-01-15) — failed.  
**Claim ID:** cmq5kywk41t6psal8v4dni0sn  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuu7qb15bnsapm3k24tbfc  
**Transition:** (entry) → RECORDED  
**Date:** 1868-01-15 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 36/39 · CSH.id: cmqyj2l0q1kb9samsd5ykwqod

**Claim (first 200 chars):** The U.S. House of Representatives voted 396-27 on "On Agreeing to the Amendment" (Congress 116, Roll Call 620, 2019-11-15) — passed.  
**Claim ID:** cmq5l1pi66zj1sal8inqwvfjb  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuvdc34lxrsapm3g5jskmn  
**Transition:** (entry) → RECORDED  
**Date:** 2019-11-15 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 37/39 · CSH.id: cmqyim5552a4usanvo28tc464

**Claim (first 200 chars):** The U.S. House of Representatives voted 74-109 on "TO AMEND H.J. RES. 64, REPORTED FROM THE COMMITTEE OF 33, BY PROVIDING THAT I..." (Congress 36, Roll Call 401, 1861-02-27) — failed.  
**Claim ID:** cmq5kyq0t1hefsal8qrb9gph9  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuu51w0xe9sapmjv862btb  
**Transition:** (entry) → RECORDED  
**Date:** 1861-02-27 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 38/39 · CSH.id: cmqyilwcz1y06sanvlqs4b11n

**Claim (first 200 chars):** The U.S. House of Representatives voted 112-74 on "TO AMEND THE RETRENCHMENT RESOLUTION TO PROVIDE THAT A SELECT COMMITTEE BE AP..." (Congress 20, Roll Call 15, 1828-02-05) — passed.  
**Claim ID:** cmq5ky55i0gkvsal8r1em335a  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmpputwyp08x5sapm9gxxyzry  
**Transition:** (entry) → RECORDED  
**Date:** 1828-02-05 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

## Row 39/39 · CSH.id: cmqyj1zjp0n8zsamsa7l1h7q2

**Claim (first 200 chars):** The U.S. House of Representatives voted 222-196 on "TO AMEND H.R. 10979 BY STRIKING THE SECTION PROVIDING FOR COMMON CARRIERS TO ..." (Congress 94, Roll Call 592, 1975-12-17) — passed.  
**Claim ID:** cmq5l084j48vnsal8lu14r0di  
**Pipeline:** voteview_v1  
**External ID:** voteview_claim_cmppuurhd2rp1sapml5am63ij  
**Transition:** (entry) → RECORDED  
**Date:** 1975-12-17 (precision: DAY)  
**Community:** INSTITUTIONAL  
**Reason:** Congressional roll-call vote officially recorded.  
**Source:** *(no source URL recorded)*

**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  
**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  
**Notes:** _(optional)_

---

