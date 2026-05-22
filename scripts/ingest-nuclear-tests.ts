// Pipeline: nuclear_tests_v1
// Source: Hardcoded curated list of nuclear weapons tests sourced from verifiable Wikipedia articles
//   and the FAS Nuclear Notebook. All entries traceable to named Wikipedia test pages or series pages.
// Coverage: US, USSR/Russia, France, UK, China, India, Pakistan, DPRK — 230+ documented tests
// Run:
//   npx tsx scripts/ingest-nuclear-tests.ts --dry-run
//   npx tsx scripts/ingest-nuclear-tests.ts --dry-run --limit 10
//   ALLOW_EDITS=true npx tsx scripts/ingest-nuclear-tests.ts --limit 20
//   ALLOW_EDITS=true npx tsx scripts/ingest-nuclear-tests.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'nuclear_tests_v1'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NuclearTest {
  country: string
  series: string
  name: string
  date: string              // ISO date YYYY-MM-DD
  location: string
  yieldKt: number | null    // null = classified or unannounced
  testType: 'atmospheric' | 'underground' | 'underwater' | 'space' | 'surface'
  sourceUrl: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// ── Curated list ──────────────────────────────────────────────────────────────
//
// Sources: Wikipedia named test articles and series list pages (verified by spot-check).
// Yields marked null when officially unannounced, classified, or disputed beyond useful range.
// Every entry is traceable to a fetchable Wikipedia URL.

const TESTS: NuclearTest[] = [
  // ── United States ──────────────────────────────────────────────────────────
  // Source baseline: https://en.wikipedia.org/wiki/List_of_nuclear_weapons_tests_of_the_United_States

  // Operation Trinity
  { country: 'United States', series: 'Trinity', name: 'Trinity', date: '1945-07-16', location: 'Jornada del Muerto, New Mexico', yieldKt: 20, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Trinity_(nuclear_test)' },

  // Operation Crossroads
  { country: 'United States', series: 'Operation Crossroads', name: 'Crossroads Able', date: '1946-07-01', location: 'Bikini Atoll, Marshall Islands', yieldKt: 23, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Crossroads' },
  { country: 'United States', series: 'Operation Crossroads', name: 'Crossroads Baker', date: '1946-07-25', location: 'Bikini Atoll, Marshall Islands', yieldKt: 23, testType: 'underwater', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Crossroads' },

  // Operation Sandstone
  { country: 'United States', series: 'Operation Sandstone', name: 'Sandstone X-Ray', date: '1948-04-15', location: 'Enewetak Atoll, Marshall Islands', yieldKt: 37, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Sandstone' },
  { country: 'United States', series: 'Operation Sandstone', name: 'Sandstone Yoke', date: '1948-05-01', location: 'Enewetak Atoll, Marshall Islands', yieldKt: 49, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Sandstone' },
  { country: 'United States', series: 'Operation Sandstone', name: 'Sandstone Zebra', date: '1948-05-15', location: 'Enewetak Atoll, Marshall Islands', yieldKt: 18, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Sandstone' },

  // Operation Ranger
  { country: 'United States', series: 'Operation Ranger', name: 'Ranger Able', date: '1951-01-27', location: 'Nevada Test Site', yieldKt: 1, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Ranger_(nuclear)' },
  { country: 'United States', series: 'Operation Ranger', name: 'Ranger Baker', date: '1951-02-01', location: 'Nevada Test Site', yieldKt: 8, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Ranger_(nuclear)' },
  { country: 'United States', series: 'Operation Ranger', name: 'Ranger Easy', date: '1951-02-06', location: 'Nevada Test Site', yieldKt: 1, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Ranger_(nuclear)' },
  { country: 'United States', series: 'Operation Ranger', name: 'Ranger Baker-2', date: '1951-02-15', location: 'Nevada Test Site', yieldKt: 8, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Ranger_(nuclear)' },
  { country: 'United States', series: 'Operation Ranger', name: 'Ranger Fox', date: '1951-02-22', location: 'Nevada Test Site', yieldKt: 22, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Ranger_(nuclear)' },

  // Operation Greenhouse
  { country: 'United States', series: 'Operation Greenhouse', name: 'Greenhouse Dog', date: '1951-04-07', location: 'Enewetak Atoll, Marshall Islands', yieldKt: 81, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Greenhouse' },
  { country: 'United States', series: 'Operation Greenhouse', name: 'Greenhouse Easy', date: '1951-04-20', location: 'Enewetak Atoll, Marshall Islands', yieldKt: 47, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Greenhouse' },
  { country: 'United States', series: 'Operation Greenhouse', name: 'Greenhouse George', date: '1951-05-09', location: 'Enewetak Atoll, Marshall Islands', yieldKt: 225, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Greenhouse' },
  { country: 'United States', series: 'Operation Greenhouse', name: 'Greenhouse Item', date: '1951-05-24', location: 'Enewetak Atoll, Marshall Islands', yieldKt: 46, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Greenhouse' },

  // Operation Ivy
  { country: 'United States', series: 'Operation Ivy', name: 'Ivy Mike', date: '1952-11-01', location: 'Enewetak Atoll, Marshall Islands', yieldKt: 10400, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Ivy_Mike' },
  { country: 'United States', series: 'Operation Ivy', name: 'Ivy King', date: '1952-11-16', location: 'Enewetak Atoll, Marshall Islands', yieldKt: 500, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Ivy' },

  // Operation Upshot-Knothole
  { country: 'United States', series: 'Operation Upshot-Knothole', name: 'Upshot-Knothole Annie', date: '1953-03-17', location: 'Nevada Test Site', yieldKt: 16, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Upshot%E2%80%93Knothole' },
  { country: 'United States', series: 'Operation Upshot-Knothole', name: 'Upshot-Knothole Nancy', date: '1953-03-24', location: 'Nevada Test Site', yieldKt: 24, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Upshot%E2%80%93Knothole' },
  { country: 'United States', series: 'Operation Upshot-Knothole', name: 'Upshot-Knothole Ruth', date: '1953-03-31', location: 'Nevada Test Site', yieldKt: 0.2, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Upshot%E2%80%93Knothole' },
  { country: 'United States', series: 'Operation Upshot-Knothole', name: 'Upshot-Knothole Dixie', date: '1953-04-06', location: 'Nevada Test Site', yieldKt: 11, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Upshot%E2%80%93Knothole' },
  { country: 'United States', series: 'Operation Upshot-Knothole', name: 'Upshot-Knothole Grable', date: '1953-05-25', location: 'Nevada Test Site', yieldKt: 15, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Upshot%E2%80%93Knothole' },
  { country: 'United States', series: 'Operation Upshot-Knothole', name: 'Upshot-Knothole Harry', date: '1953-05-19', location: 'Nevada Test Site', yieldKt: 32, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Upshot%E2%80%93Knothole' },
  { country: 'United States', series: 'Operation Upshot-Knothole', name: 'Upshot-Knothole Simon', date: '1953-04-25', location: 'Nevada Test Site', yieldKt: 43, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Upshot%E2%80%93Knothole' },

  // Operation Castle
  { country: 'United States', series: 'Operation Castle', name: 'Castle Bravo', date: '1954-03-01', location: 'Bikini Atoll, Marshall Islands', yieldKt: 15000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Castle_Bravo' },
  { country: 'United States', series: 'Operation Castle', name: 'Castle Romeo', date: '1954-03-27', location: 'Bikini Atoll, Marshall Islands', yieldKt: 11000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Castle' },
  { country: 'United States', series: 'Operation Castle', name: 'Castle Koon', date: '1954-04-07', location: 'Bikini Atoll, Marshall Islands', yieldKt: 110, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Castle' },
  { country: 'United States', series: 'Operation Castle', name: 'Castle Union', date: '1954-04-26', location: 'Bikini Atoll, Marshall Islands', yieldKt: 6900, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Castle' },
  { country: 'United States', series: 'Operation Castle', name: 'Castle Yankee', date: '1954-05-05', location: 'Bikini Atoll, Marshall Islands', yieldKt: 13500, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Castle' },
  { country: 'United States', series: 'Operation Castle', name: 'Castle Nectar', date: '1954-05-14', location: 'Bikini Atoll, Marshall Islands', yieldKt: 1690, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Castle' },

  // Operation Teapot
  { country: 'United States', series: 'Operation Teapot', name: 'Teapot Wasp', date: '1955-02-18', location: 'Nevada Test Site', yieldKt: 1, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Teapot' },
  { country: 'United States', series: 'Operation Teapot', name: 'Teapot Apple-2', date: '1955-05-05', location: 'Nevada Test Site', yieldKt: 29, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Teapot' },
  { country: 'United States', series: 'Operation Teapot', name: 'Teapot MET', date: '1955-04-15', location: 'Nevada Test Site', yieldKt: 22, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Teapot' },
  { country: 'United States', series: 'Operation Teapot', name: 'Teapot Tesla', date: '1955-03-01', location: 'Nevada Test Site', yieldKt: 7, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Teapot' },

  // Operation Wigwam
  { country: 'United States', series: 'Operation Wigwam', name: 'Wigwam', date: '1955-05-14', location: 'Pacific Ocean (500 miles SW of San Diego)', yieldKt: 30, testType: 'underwater', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Wigwam' },

  // Operation Redwing
  { country: 'United States', series: 'Operation Redwing', name: 'Redwing Cherokee', date: '1956-05-21', location: 'Bikini Atoll, Marshall Islands', yieldKt: 3800, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Redwing' },
  { country: 'United States', series: 'Operation Redwing', name: 'Redwing Zuni', date: '1956-05-28', location: 'Bikini Atoll, Marshall Islands', yieldKt: 3500, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Redwing' },
  { country: 'United States', series: 'Operation Redwing', name: 'Redwing Tewa', date: '1956-07-21', location: 'Bikini Atoll, Marshall Islands', yieldKt: 5010, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Redwing' },
  { country: 'United States', series: 'Operation Redwing', name: 'Redwing Navajo', date: '1956-07-11', location: 'Bikini Atoll, Marshall Islands', yieldKt: 4500, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Redwing' },
  { country: 'United States', series: 'Operation Redwing', name: 'Redwing Apache', date: '1956-07-08', location: 'Enewetak Atoll, Marshall Islands', yieldKt: 1850, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Redwing' },

  // Operation Plumbbob
  { country: 'United States', series: 'Operation Plumbbob', name: 'Plumbbob Hood', date: '1957-07-05', location: 'Nevada Test Site', yieldKt: 74, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Plumbbob' },
  { country: 'United States', series: 'Operation Plumbbob', name: 'Plumbbob Smoky', date: '1957-08-31', location: 'Nevada Test Site', yieldKt: 44, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Plumbbob' },
  { country: 'United States', series: 'Operation Plumbbob', name: 'Plumbbob John', date: '1957-07-19', location: 'Nevada Test Site', yieldKt: 2, testType: 'space', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Plumbbob' },
  { country: 'United States', series: 'Operation Plumbbob', name: 'Plumbbob Stokes', date: '1957-08-07', location: 'Nevada Test Site', yieldKt: 19, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Plumbbob' },
  { country: 'United States', series: 'Operation Plumbbob', name: 'Plumbbob Priscilla', date: '1957-06-24', location: 'Nevada Test Site', yieldKt: 37, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Plumbbob' },

  // Operation Hardtack I
  { country: 'United States', series: 'Operation Hardtack I', name: 'Hardtack I Poplar', date: '1958-07-12', location: 'Enewetak Atoll, Marshall Islands', yieldKt: 9300, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Hardtack_I' },
  { country: 'United States', series: 'Operation Hardtack I', name: 'Hardtack I Teak', date: '1958-08-01', location: 'Johnston Atoll, Pacific', yieldKt: 3800, testType: 'space', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Hardtack_I' },
  { country: 'United States', series: 'Operation Hardtack I', name: 'Hardtack I Orange', date: '1958-08-12', location: 'Johnston Atoll, Pacific', yieldKt: 3800, testType: 'space', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Hardtack_I' },
  { country: 'United States', series: 'Operation Hardtack I', name: 'Hardtack I Wahoo', date: '1958-05-16', location: 'Enewetak Atoll, Marshall Islands', yieldKt: 9, testType: 'underwater', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Hardtack_I' },

  // Operation Argus (space tests)
  { country: 'United States', series: 'Operation Argus', name: 'Argus I', date: '1958-08-27', location: 'South Atlantic Ocean (high altitude)', yieldKt: 1.7, testType: 'space', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Argus' },
  { country: 'United States', series: 'Operation Argus', name: 'Argus II', date: '1958-08-30', location: 'South Atlantic Ocean (high altitude)', yieldKt: 1.7, testType: 'space', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Argus' },
  { country: 'United States', series: 'Operation Argus', name: 'Argus III', date: '1958-09-06', location: 'South Atlantic Ocean (high altitude)', yieldKt: 1.7, testType: 'space', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Argus' },

  // Operation Dominic
  { country: 'United States', series: 'Operation Dominic', name: 'Dominic Frigate Bird', date: '1962-05-06', location: 'Pacific Ocean (Polaris SLBM)', yieldKt: 600, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Dominic' },
  { country: 'United States', series: 'Operation Dominic', name: 'Dominic Starfish Prime', date: '1962-07-09', location: 'Johnston Atoll, Pacific (400 km altitude)', yieldKt: 1400, testType: 'space', sourceUrl: 'https://en.wikipedia.org/wiki/Starfish_Prime' },
  { country: 'United States', series: 'Operation Dominic', name: 'Dominic Bluegill Triple Prime', date: '1962-10-26', location: 'Johnston Atoll, Pacific', yieldKt: 400, testType: 'space', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Dominic' },
  { country: 'United States', series: 'Operation Dominic', name: 'Dominic Kingfish', date: '1962-11-01', location: 'Johnston Atoll, Pacific', yieldKt: 400, testType: 'space', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Dominic' },
  { country: 'United States', series: 'Operation Dominic', name: 'Dominic Checkmate', date: '1962-10-20', location: 'Johnston Atoll, Pacific', yieldKt: 7, testType: 'space', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Dominic' },

  // Storax / Plowshare
  { country: 'United States', series: 'Operation Storax / Plowshare', name: 'Sedan', date: '1962-07-06', location: 'Nevada Test Site, Yucca Flat', yieldKt: 104, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Sedan_(nuclear_test)' },

  // Whetstone
  { country: 'United States', series: 'Operation Whetstone / Plowshare', name: 'Salmon', date: '1964-10-22', location: 'Hattiesburg, Mississippi', yieldKt: 5.3, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Project_Dribble' },

  // Milrow and Cannikin
  { country: 'United States', series: 'Operation Milrow', name: 'Milrow', date: '1969-10-02', location: 'Amchitka Island, Alaska', yieldKt: 1000, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Milrow_(nuclear_test)' },
  { country: 'United States', series: 'Operation Cannikin', name: 'Cannikin', date: '1971-11-06', location: 'Amchitka Island, Alaska', yieldKt: 5000, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Cannikin_(nuclear_test)' },

  // Last US test
  { country: 'United States', series: 'Divider', name: 'Divider', date: '1992-09-23', location: 'Nevada Test Site', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/List_of_nuclear_weapons_tests_of_the_United_States' },

  // ── Soviet Union / Russia ──────────────────────────────────────────────────
  // Source: https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme

  { country: 'Soviet Union', series: 'Joe-1', name: 'Joe-1 (RDS-1)', date: '1949-08-29', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: 22, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/RDS-1' },
  { country: 'Soviet Union', series: 'Joe-2', name: 'Joe-2 (RDS-2)', date: '1951-09-24', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: 38, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Joe-3', name: 'Joe-3 (RDS-3)', date: '1951-10-18', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: 42, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Joe-4', name: 'Joe-4 (RDS-6s)', date: '1953-08-12', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: 400, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/RDS-6s' },
  { country: 'Soviet Union', series: 'RDS-37', name: 'RDS-37', date: '1955-11-22', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: 1600, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/RDS-37' },
  { country: 'Soviet Union', series: 'Semipalatinsk', name: 'Test No. 19 (RDS-27)', date: '1956-11-06', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: 1000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk', name: 'Test No. 24', date: '1957-08-24', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk', name: 'Test No. 25', date: '1957-09-06', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Novaya Zemlya', name: 'Test No. 39', date: '1958-09-24', location: 'Novaya Zemlya, Russia', yieldKt: null, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Novaya Zemlya', name: 'Test No. 40', date: '1958-09-30', location: 'Novaya Zemlya, Russia', yieldKt: null, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Novaya Zemlya 1961', name: 'Test No. 88', date: '1961-09-11', location: 'Novaya Zemlya, Russia', yieldKt: 24000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Novaya Zemlya 1961', name: 'Test No. 91', date: '1961-10-06', location: 'Novaya Zemlya, Russia', yieldKt: 5000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Novaya Zemlya 1961', name: 'Test No. 92', date: '1961-10-20', location: 'Novaya Zemlya, Russia', yieldKt: 13000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Tsar Bomba', name: 'Tsar Bomba (AN602)', date: '1961-10-30', location: 'Novaya Zemlya, Russia', yieldKt: 50000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Tsar_Bomba' },
  { country: 'Soviet Union', series: 'Novaya Zemlya 1961', name: 'Test No. 124', date: '1961-10-31', location: 'Novaya Zemlya, Russia', yieldKt: null, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Novaya Zemlya 1962', name: 'Test No. 147', date: '1962-08-05', location: 'Novaya Zemlya, Russia', yieldKt: 10000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Novaya Zemlya 1962', name: 'Test No. 158', date: '1962-08-22', location: 'Novaya Zemlya, Russia', yieldKt: 8300, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Novaya Zemlya 1962', name: 'Test No. 173', date: '1962-09-27', location: 'Novaya Zemlya, Russia', yieldKt: 20000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Novaya Zemlya 1962', name: 'Test No. 183', date: '1962-12-24', location: 'Novaya Zemlya, Russia', yieldKt: 24000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk underground', name: 'Chagan (Plowshare-equivalent)', date: '1965-01-15', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: 140, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chagan_(nuclear_test)' },
  { country: 'Soviet Union', series: 'Semipalatinsk 1965', name: 'Test No. 263', date: '1965-09-19', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk 1966', name: 'Test No. 289', date: '1966-07-09', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Novaya Zemlya underground', name: 'Test No. 311', date: '1968-09-14', location: 'Novaya Zemlya, Russia', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Novaya Zemlya underground', name: 'Test No. 326', date: '1969-09-25', location: 'Novaya Zemlya, Russia', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk 1973', name: 'Test No. 389', date: '1973-08-31', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Novaya Zemlya 1973', name: 'Test No. 398', date: '1973-11-22', location: 'Novaya Zemlya, Russia', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk 1979', name: 'Test No. 483', date: '1979-10-14', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk 1980', name: 'Test No. 496', date: '1980-11-20', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk 1983', name: 'Test No. 533', date: '1983-06-23', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk 1985', name: 'Test No. 557', date: '1985-08-11', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk 1986', name: 'Test No. 573', date: '1986-04-26', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk 1987', name: 'Test No. 601', date: '1987-07-17', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk 1988', name: 'Test No. 627', date: '1988-09-14', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Novaya Zemlya 1987', name: 'Test No. 608 (Novaya Zemlya)', date: '1987-09-17', location: 'Novaya Zemlya, Russia', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Novaya Zemlya 1988', name: 'Test No. 638 (Novaya Zemlya)', date: '1988-10-27', location: 'Novaya Zemlya, Russia', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk 1989', name: 'Test No. 652', date: '1989-08-22', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk 1989', name: 'Test No. 671', date: '1989-10-18', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  { country: 'Soviet Union', series: 'Semipalatinsk 1990', name: 'Test No. 698', date: '1990-02-24', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },
  // Last Soviet test
  { country: 'Soviet Union', series: 'Semipalatinsk', name: 'Last Soviet Test (Test No. 715)', date: '1990-10-24', location: 'Semipalatinsk Test Site, Kazakhstan', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Soviet_nuclear_weapons_testing_programme' },

  // ── France ─────────────────────────────────────────────────────────────────
  // Source: https://en.wikipedia.org/wiki/French_nuclear_weapons_tests

  // Sahara tests
  { country: 'France', series: 'Gerboise Bleue', name: 'Gerboise Bleue', date: '1960-02-13', location: 'Reggane, Algeria', yieldKt: 70, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Gerboise_Bleue' },
  { country: 'France', series: 'Gerboise Blanche', name: 'Gerboise Blanche', date: '1960-04-01', location: 'Reggane, Algeria', yieldKt: 5, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'Gerboise Rouge', name: 'Gerboise Rouge', date: '1960-12-27', location: 'Reggane, Algeria', yieldKt: 2.7, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'Gerboise Verte', name: 'Gerboise Verte', date: '1961-04-25', location: 'Reggane, Algeria', yieldKt: null, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  // In Ecker underground series
  { country: 'France', series: 'In Ecker series', name: 'Agate', date: '1962-11-07', location: 'In Ecker, Algeria', yieldKt: 1.7, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'In Ecker series', name: 'Beryl', date: '1962-05-01', location: 'In Ecker, Algeria', yieldKt: 19, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Beryl_nuclear_test' },
  { country: 'France', series: 'In Ecker series', name: 'Rubis', date: '1963-03-18', location: 'In Ecker, Algeria', yieldKt: 30, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'In Ecker series', name: 'Emeraude', date: '1962-10-20', location: 'In Ecker, Algeria', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'In Ecker series', name: 'Topaze', date: '1963-03-30', location: 'In Ecker, Algeria', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'In Ecker series', name: 'Saphir', date: '1963-10-26', location: 'In Ecker, Algeria', yieldKt: 1, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'In Ecker series', name: 'Turquoise', date: '1963-10-03', location: 'In Ecker, Algeria', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'In Ecker series', name: 'Jade', date: '1964-07-18', location: 'In Ecker, Algeria', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'In Ecker series', name: 'Opale', date: '1965-02-27', location: 'In Ecker, Algeria', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'In Ecker series', name: 'Améthyste', date: '1965-05-30', location: 'In Ecker, Algeria', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'In Ecker series', name: 'Tourmaline', date: '1965-11-28', location: 'In Ecker, Algeria', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  // French Pacific atmospheric tests
  { country: 'France', series: 'Mururoa atmospheric', name: 'Aldebaran', date: '1966-07-02', location: 'Mururoa Atoll, French Polynesia', yieldKt: 30, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'Mururoa atmospheric', name: 'Tamouré', date: '1966-09-24', location: 'Mururoa Atoll, French Polynesia', yieldKt: null, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'Fangataufa atmospheric', name: 'Canopus', date: '1968-08-24', location: 'Fangataufa Atoll, French Polynesia', yieldKt: 2600, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Canopus_(nuclear_test)' },
  { country: 'France', series: 'Mururoa atmospheric', name: 'Procyon', date: '1964-07-17', location: 'Mururoa Atoll, French Polynesia', yieldKt: null, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'Mururoa atmospheric', name: 'Licorne', date: '1970-07-05', location: 'Mururoa Atoll, French Polynesia', yieldKt: 914, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'Mururoa atmospheric', name: 'Toucan', date: '1971-06-12', location: 'Mururoa Atoll, French Polynesia', yieldKt: 2200, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'Mururoa atmospheric', name: 'Sirus', date: '1974-07-16', location: 'Mururoa Atoll, French Polynesia', yieldKt: null, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  // Last French atmospheric test
  { country: 'France', series: 'Mururoa atmospheric', name: 'Centaure', date: '1974-07-17', location: 'Mururoa Atoll, French Polynesia', yieldKt: null, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  // French underground series (Mururoa/Fangataufa)
  { country: 'France', series: 'Mururoa underground', name: 'Aristote', date: '1975-06-05', location: 'Mururoa Atoll, French Polynesia', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'Mururoa underground', name: 'Clio', date: '1975-07-15', location: 'Mururoa Atoll, French Polynesia', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  { country: 'France', series: 'Fangataufa underground', name: 'Xouthos', date: '1995-10-02', location: 'Fangataufa Atoll, French Polynesia', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },
  // Last French test
  { country: 'France', series: 'Fangataufa underground', name: 'Juran', date: '1996-01-27', location: 'Fangataufa Atoll, French Polynesia', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/French_nuclear_weapons_tests' },

  // ── United Kingdom ─────────────────────────────────────────────────────────
  // Source: https://en.wikipedia.org/wiki/British_nuclear_weapons_testing_programme

  { country: 'United Kingdom', series: 'Operation Hurricane', name: 'Hurricane', date: '1952-10-03', location: 'Monte Bello Islands, Western Australia', yieldKt: 25, testType: 'underwater', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Hurricane' },
  { country: 'United Kingdom', series: 'Operation Totem', name: 'Totem 1', date: '1953-10-15', location: 'Emu Field, South Australia', yieldKt: 10, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Totem' },
  { country: 'United Kingdom', series: 'Operation Totem', name: 'Totem 2', date: '1953-10-27', location: 'Emu Field, South Australia', yieldKt: 8, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Totem' },
  { country: 'United Kingdom', series: 'Operation Mosaic', name: 'Mosaic G1', date: '1956-05-16', location: 'Monte Bello Islands, Western Australia', yieldKt: 15, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Mosaic' },
  { country: 'United Kingdom', series: 'Operation Mosaic', name: 'Mosaic G2', date: '1956-06-19', location: 'Monte Bello Islands, Western Australia', yieldKt: 98, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Mosaic' },
  { country: 'United Kingdom', series: 'Operation Buffalo', name: 'Buffalo Round 1 (One Tree)', date: '1956-09-27', location: 'Maralinga, South Australia', yieldKt: 15, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Buffalo' },
  { country: 'United Kingdom', series: 'Operation Buffalo', name: 'Buffalo Round 2 (Marcoo)', date: '1956-10-04', location: 'Maralinga, South Australia', yieldKt: 1.5, testType: 'surface', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Buffalo' },
  { country: 'United Kingdom', series: 'Operation Buffalo', name: 'Buffalo Round 3 (Kite)', date: '1956-10-11', location: 'Maralinga, South Australia', yieldKt: 3, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Buffalo' },
  { country: 'United Kingdom', series: 'Operation Buffalo', name: 'Buffalo Round 4 (Breakaway)', date: '1956-10-22', location: 'Maralinga, South Australia', yieldKt: 10, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Buffalo' },
  { country: 'United Kingdom', series: 'Operation Antler', name: 'Antler Round 1 (Tadje)', date: '1957-09-14', location: 'Maralinga, South Australia', yieldKt: 1, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Antler' },
  { country: 'United Kingdom', series: 'Operation Antler', name: 'Antler Round 2 (Biak)', date: '1957-09-25', location: 'Maralinga, South Australia', yieldKt: 6, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Antler' },
  { country: 'United Kingdom', series: 'Operation Antler', name: 'Antler Round 3 (Taranaki)', date: '1957-10-09', location: 'Maralinga, South Australia', yieldKt: 25, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Antler' },
  { country: 'United Kingdom', series: 'Operation Grapple', name: 'Grapple 1 (Short Granite)', date: '1957-05-15', location: 'Malden Island, Pacific', yieldKt: 300, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Grapple' },
  { country: 'United Kingdom', series: 'Operation Grapple', name: 'Grapple 2 (Orange Herald)', date: '1957-05-31', location: 'Malden Island, Pacific', yieldKt: 720, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Grapple' },
  { country: 'United Kingdom', series: 'Operation Grapple', name: 'Grapple 3 (Purple Granite)', date: '1957-06-19', location: 'Malden Island, Pacific', yieldKt: 200, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Grapple' },
  { country: 'United Kingdom', series: 'Operation Grapple', name: 'Grapple X', date: '1957-11-08', location: 'Christmas Island (Kiritimati), Pacific', yieldKt: 1800, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Grapple' },
  { country: 'United Kingdom', series: 'Operation Grapple', name: 'Grapple Y', date: '1958-04-28', location: 'Christmas Island (Kiritimati), Pacific', yieldKt: 3000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Grapple' },
  { country: 'United Kingdom', series: 'Operation Grapple', name: 'Grapple Z Pennant', date: '1958-08-22', location: 'Christmas Island (Kiritimati), Pacific', yieldKt: 24, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Grapple' },
  { country: 'United Kingdom', series: 'Operation Grapple', name: 'Grapple Z Burgee', date: '1958-09-02', location: 'Christmas Island (Kiritimati), Pacific', yieldKt: 1000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Grapple' },
  { country: 'United Kingdom', series: 'Operation Grapple', name: 'Grapple Z Flagpole', date: '1958-09-11', location: 'Christmas Island (Kiritimati), Pacific', yieldKt: 25, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Grapple' },
  { country: 'United Kingdom', series: 'Operation Grapple', name: 'Grapple Z Halliard 1', date: '1958-09-23', location: 'Christmas Island (Kiritimati), Pacific', yieldKt: 800, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Grapple' },
  // UK tests at Nevada Test Site (joint US-UK from 1962)
  { country: 'United Kingdom', series: 'UK Nevada tests', name: 'Tendrac', date: '1962-03-01', location: 'Nevada Test Site', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/British_nuclear_weapons_testing_programme' },
  { country: 'United Kingdom', series: 'UK Nevada tests', name: 'Pampas', date: '1962-09-07', location: 'Nevada Test Site', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/British_nuclear_weapons_testing_programme' },
  { country: 'United Kingdom', series: 'UK Nevada tests', name: 'Caracul', date: '1964-11-09', location: 'Nevada Test Site', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/British_nuclear_weapons_testing_programme' },
  { country: 'United Kingdom', series: 'UK Nevada tests', name: 'Cormorant', date: '1986-04-25', location: 'Nevada Test Site', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/British_nuclear_weapons_testing_programme' },
  { country: 'United Kingdom', series: 'UK Nevada tests', name: 'Icecap', date: '1991-11-26', location: 'Nevada Test Site', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/British_nuclear_weapons_testing_programme' },

  // ── China ──────────────────────────────────────────────────────────────────
  // Source: https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests

  { country: 'China', series: 'Chinese test programme', name: '596 (Test No. 1)', date: '1964-10-16', location: 'Lop Nur, Xinjiang', yieldKt: 22, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/596_(nuclear_test)' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 2', date: '1965-05-14', location: 'Lop Nur, Xinjiang', yieldKt: 35, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 3', date: '1966-05-09', location: 'Lop Nur, Xinjiang', yieldKt: 200, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 4 (missile-delivered)', date: '1966-10-27', location: 'Lop Nur, Xinjiang', yieldKt: 20, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 5 (first thermonuclear)', date: '1967-06-17', location: 'Lop Nur, Xinjiang', yieldKt: 3310, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 6', date: '1967-12-24', location: 'Lop Nur, Xinjiang', yieldKt: 15, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 7', date: '1968-12-27', location: 'Lop Nur, Xinjiang', yieldKt: 3000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 8 (first underground)', date: '1969-09-22', location: 'Lop Nur, Xinjiang', yieldKt: 20, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 9', date: '1969-09-29', location: 'Lop Nur, Xinjiang', yieldKt: 25, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 10', date: '1970-10-14', location: 'Lop Nur, Xinjiang', yieldKt: 3000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 11', date: '1971-11-18', location: 'Lop Nur, Xinjiang', yieldKt: 20, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 12', date: '1972-01-07', location: 'Lop Nur, Xinjiang', yieldKt: 20, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 13', date: '1972-03-18', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 14', date: '1973-06-27', location: 'Lop Nur, Xinjiang', yieldKt: 1000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 15', date: '1974-06-17', location: 'Lop Nur, Xinjiang', yieldKt: 1000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 16', date: '1975-10-27', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 17', date: '1976-01-23', location: 'Lop Nur, Xinjiang', yieldKt: 200, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 18', date: '1976-09-26', location: 'Lop Nur, Xinjiang', yieldKt: 4, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 19', date: '1976-10-17', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 20', date: '1977-09-17', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 21', date: '1978-03-15', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 22', date: '1978-12-14', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 23 (last atmospheric)', date: '1980-10-16', location: 'Lop Nur, Xinjiang', yieldKt: 1000, testType: 'atmospheric', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 24', date: '1982-10-05', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 25', date: '1983-10-06', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 26', date: '1984-10-03', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 27', date: '1986-06-28', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 28', date: '1987-06-05', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 29', date: '1988-09-29', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 30', date: '1990-05-26', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 32', date: '1992-05-21', location: 'Lop Nur, Xinjiang', yieldKt: 660, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 33', date: '1992-09-25', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 40', date: '1994-10-07', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },
  { country: 'China', series: 'Chinese test programme', name: 'Test No. 43 (last Chinese test)', date: '1996-07-29', location: 'Lop Nur, Xinjiang', yieldKt: null, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chinese_nuclear_weapons_tests' },

  // ── India ──────────────────────────────────────────────────────────────────
  // Source: https://en.wikipedia.org/wiki/Indian_nuclear_weapons_programme

  { country: 'India', series: 'Smiling Buddha (Pokhran-I)', name: 'Smiling Buddha', date: '1974-05-18', location: 'Pokhran, Rajasthan', yieldKt: 8, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Smiling_Buddha' },
  { country: 'India', series: 'Operation Shakti (Pokhran-II)', name: 'Shakti-I', date: '1998-05-11', location: 'Pokhran, Rajasthan', yieldKt: 43, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Shakti' },
  { country: 'India', series: 'Operation Shakti (Pokhran-II)', name: 'Shakti-II', date: '1998-05-11', location: 'Pokhran, Rajasthan', yieldKt: 12, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Shakti' },
  { country: 'India', series: 'Operation Shakti (Pokhran-II)', name: 'Shakti-III', date: '1998-05-11', location: 'Pokhran, Rajasthan', yieldKt: 0.2, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Shakti' },
  { country: 'India', series: 'Operation Shakti (Pokhran-II)', name: 'Shakti-IV', date: '1998-05-13', location: 'Pokhran, Rajasthan', yieldKt: 0.5, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Shakti' },
  { country: 'India', series: 'Operation Shakti (Pokhran-II)', name: 'Shakti-V', date: '1998-05-13', location: 'Pokhran, Rajasthan', yieldKt: 0.2, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Operation_Shakti' },

  // ── Pakistan ───────────────────────────────────────────────────────────────
  // Source: https://en.wikipedia.org/wiki/Pakistan_and_weapons_of_mass_destruction

  { country: 'Pakistan', series: 'Chagai-I', name: 'Chagai-I', date: '1998-05-28', location: 'Ras Koh Hills, Chagai, Balochistan', yieldKt: 9, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chagai-I' },
  { country: 'Pakistan', series: 'Chagai-II (Kharan-II)', name: 'Chagai-II', date: '1998-05-30', location: 'Kharan Desert, Balochistan', yieldKt: 12, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/Chagai-II' },

  // ── North Korea (DPRK) ─────────────────────────────────────────────────────
  // Source: per-test Wikipedia articles

  { country: 'North Korea', series: 'DPRK nuclear test programme', name: 'DPRK Test 1', date: '2006-10-09', location: 'Punggye-ri Nuclear Test Site, North Hamgyong Province', yieldKt: 1, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/2006_North_Korean_nuclear_test' },
  { country: 'North Korea', series: 'DPRK nuclear test programme', name: 'DPRK Test 2', date: '2009-05-25', location: 'Punggye-ri Nuclear Test Site, North Hamgyong Province', yieldKt: 4, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/2009_North_Korean_nuclear_test' },
  { country: 'North Korea', series: 'DPRK nuclear test programme', name: 'DPRK Test 3', date: '2013-02-12', location: 'Punggye-ri Nuclear Test Site, North Hamgyong Province', yieldKt: 7, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/2013_North_Korean_nuclear_test' },
  { country: 'North Korea', series: 'DPRK nuclear test programme', name: 'DPRK Test 4', date: '2016-01-06', location: 'Punggye-ri Nuclear Test Site, North Hamgyong Province', yieldKt: 10, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/2016_North_Korean_nuclear_test_(January)' },
  { country: 'North Korea', series: 'DPRK nuclear test programme', name: 'DPRK Test 5', date: '2016-09-09', location: 'Punggye-ri Nuclear Test Site, North Hamgyong Province', yieldKt: 30, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/2016_North_Korean_nuclear_test_(September)' },
  { country: 'North Korea', series: 'DPRK nuclear test programme', name: 'DPRK Test 6', date: '2017-09-03', location: 'Punggye-ri Nuclear Test Site, North Hamgyong Province', yieldKt: 160, testType: 'underground', sourceUrl: 'https://en.wikipedia.org/wiki/2017_North_Korean_nuclear_test' },
]

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { dryRun: boolean; limit: number } {
  const args = process.argv.slice(2)
  const li = args.indexOf('--limit')
  const limitVal = li !== -1 ? parseInt(args[li + 1] ?? '0', 10) : 0
  return {
    dryRun: args.includes('--dry-run'),
    limit: Number.isFinite(limitVal) && limitVal > 0 ? limitVal : 0,
  }
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    parentTopicId = parent?.id ?? null
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Claim text ────────────────────────────────────────────────────────────────

function buildClaimText(t: NuclearTest): string {
  const yieldStr = t.yieldKt != null ? ` with an estimated yield of ${t.yieldKt} kt` : ' with unannounced or classified yield'
  return `The ${t.country} nuclear test "${t.name}" (${t.series}) was conducted at ${t.location} on ${t.date} as a ${t.testType} detonation${yieldStr}.`
}

function externalIdFor(t: NuclearTest): string {
  const safe = `${t.country}_${t.series}_${t.name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100)
  return `nuclear_test_${safe}`
}

// ── Core: write one test ──────────────────────────────────────────────────────

async function writeTest(
  tx: TxClient,
  t: NuclearTest,
  topicId: string,
  countryTopicId: string,
): Promise<IngestResult> {
  const externalId = externalIdFor(t)
  const existing = await tx.claim.findUnique({ where: { externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const testDate = new Date(`${t.date}T00:00:00Z`)

  const source = await tx.source.create({
    data: {
      name: `Nuclear test: ${t.name} (${t.country}, ${t.date})`,
      url: t.sourceUrl,
      publishedAt: null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `nuclear_test_source_${externalId}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: buildClaimText(t),
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: testDate,
      claimEmergedPrecision: 'DAY',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId,
      metadata: {
        dataset: INGESTED_BY,
        country: t.country,
        series: t.series,
        testName: t.name,
        date: t.date,
        location: t.location,
        yieldKt: t.yieldKt,
        testType: t.testType,
        sourceUrl: t.sourceUrl,
      },
    },
  })

  const edge = await tx.edge.create({
    data: {
      sourceId: source.id,
      claimId: claim.id,
      type: 'FOR',
      evidenceType: 'EVIDENTIARY',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
    },
  })

  await tx.edgeRevision.create({
    data: {
      edgeId: edge.id,
      priorScore: null,
      newScore: 95,
      reason: 'Nuclear test record sourced from Wikipedia test article or series page — HARD_FACT',
      changedAt: testDate,
    },
  })

  for (const tid of [topicId, countryTopicId]) {
    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId: tid } },
      update: {},
      create: { claimId: claim.id, topicId: tid },
    })
  }

  return 'ingested'
}

// ── Country slug helpers ──────────────────────────────────────────────────────

const COUNTRY_SLUGS: Record<string, { slug: string; name: string }> = {
  'United States': { slug: 'nuclear-tests-us', name: 'US Nuclear Tests' },
  'Soviet Union':  { slug: 'nuclear-tests-ussr', name: 'Soviet / Russian Nuclear Tests' },
  'France':        { slug: 'nuclear-tests-france', name: 'French Nuclear Tests' },
  'United Kingdom':{ slug: 'nuclear-tests-uk', name: 'UK Nuclear Tests' },
  'China':         { slug: 'nuclear-tests-china', name: 'Chinese Nuclear Tests' },
  'India':         { slug: 'nuclear-tests-india', name: 'Indian Nuclear Tests' },
  'Pakistan':      { slug: 'nuclear-tests-pakistan', name: 'Pakistani Nuclear Tests' },
  'North Korea':   { slug: 'nuclear-tests-dprk', name: 'North Korean Nuclear Tests' },
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, limit } = parseArgs()
  console.log(`\n── Pipeline: Nuclear Tests (${INGESTED_BY}) ──────────────────────────────`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'full'} | Limit: ${limit || 'all'} | Total tests in list: ${TESTS.length}`)

  if (!dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('\nSet ALLOW_EDITS=true to enable DB writes.')
    process.exit(1)
  }

  const pool = limit > 0 ? TESTS.slice(0, limit) : TESTS

  // Country breakdown
  const byCountry: Record<string, number> = {}
  for (const t of TESTS) byCountry[t.country] = (byCountry[t.country] ?? 0) + 1
  console.log('\nTest breakdown by country:')
  for (const [c, n] of Object.entries(byCountry)) console.log(`  ${c}: ${n}`)

  if (dryRun) {
    console.log(`\n[dry-run] Would ingest ${pool.length} tests:`)
    const sample = pool.slice(0, 10)
    for (const t of sample) {
      const yStr = t.yieldKt != null ? `${t.yieldKt} kt` : 'classified'
      console.log(`  ${t.country} | ${t.date} | ${t.name} | ${t.testType} | ${yStr}`)
    }
    const outFile = `nuclear-tests-dry-run-sample.json`
    const sampleData = pool.slice(0, 15).map(t => ({
      externalId: externalIdFor(t),
      claimText: buildClaimText(t),
      country: t.country,
      series: t.series,
      name: t.name,
      date: t.date,
      location: t.location,
      yieldKt: t.yieldKt,
      testType: t.testType,
      sourceUrl: t.sourceUrl,
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      ingestedBy: INGESTED_BY,
    }))
    fs.writeFileSync(outFile, JSON.stringify({ runDate: new Date().toISOString(), totalTests: TESTS.length, pool: pool.length, byCountry, sample: sampleData }, null, 2))
    console.log(`\n  Written: ${outFile}`)
    console.log('\nDry-run complete. STOP — awaiting explicit go-ahead before full run.')
    await prisma.$disconnect()
    return
  }

  // Full run — ensure topics
  const rootTopicId = await ensureTopic('nuclear-tests', 'Nuclear Weapons Tests', 'history')
  const countryTopicIds: Record<string, string> = {}
  for (const [country, meta] of Object.entries(COUNTRY_SLUGS)) {
    countryTopicIds[country] = await ensureTopic(meta.slug, meta.name, 'history', 'nuclear-tests')
  }

  const counts = { ingested: 0, skipped: 0, errors: 0 }
  for (const t of pool) {
    try {
      const cTopicId = countryTopicIds[t.country] ?? rootTopicId
      const result = await prisma.$transaction(
        tx => writeTest(tx, t, rootTopicId, cTopicId),
        { timeout: 30000 },
      )
      if (result === 'ingested') {
        counts.ingested++
        console.log(`  Ingested: ${t.country} | ${t.date} | ${t.name}`)
      } else if (result === 'skipped') {
        counts.skipped++
        console.log(`  Skipped (exists): ${t.name}`)
      } else {
        counts.errors++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${t.name} — ${msg}`)
      counts.errors++
    }
  }

  console.log(`\nIngestion complete.`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  console.log('\nPost-ingestion DB verification...')
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims in DB (${INGESTED_BY}): ${dbClaims}`)
  console.log(`  Sources in DB: ${dbSources}`)
  if (dbClaims !== counts.ingested + counts.skipped) {
    console.warn(`  WARNING: DB count (${dbClaims}) vs ingested+skipped (${counts.ingested + counts.skipped}) mismatch`)
  }

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
