export type President = {
  name: string
  party: 'Democratic' | 'Republican' | 'Whig' | 'Democratic-Republican' | 'Federalist' | 'National Republican' | 'Independent' | 'No Party'
  start: string  // YYYY-MM-DD
  end: string    // YYYY-MM-DD or "2029-01-20" for Trump current term
}

export const US_PRESIDENTS: President[] = [
  { name: 'George Washington',    party: 'No Party',               start: '1789-04-30', end: '1797-03-04' },
  { name: 'John Adams',           party: 'Federalist',             start: '1797-03-04', end: '1801-03-04' },
  { name: 'Thomas Jefferson',     party: 'Democratic-Republican',  start: '1801-03-04', end: '1809-03-04' },
  { name: 'James Madison',        party: 'Democratic-Republican',  start: '1809-03-04', end: '1817-03-04' },
  { name: 'James Monroe',         party: 'Democratic-Republican',  start: '1817-03-04', end: '1825-03-04' },
  { name: 'John Quincy Adams',    party: 'Democratic-Republican',  start: '1825-03-04', end: '1829-03-04' },
  { name: 'Andrew Jackson',       party: 'Democratic',             start: '1829-03-04', end: '1837-03-04' },
  { name: 'Martin Van Buren',     party: 'Democratic',             start: '1837-03-04', end: '1841-03-04' },
  { name: 'William Henry Harrison', party: 'Whig',                 start: '1841-03-04', end: '1841-04-04' },
  { name: 'John Tyler',           party: 'Whig',                   start: '1841-04-04', end: '1845-03-04' },
  { name: 'James K. Polk',        party: 'Democratic',             start: '1845-03-04', end: '1849-03-04' },
  { name: 'Zachary Taylor',       party: 'Whig',                   start: '1849-03-04', end: '1850-07-09' },
  { name: 'Millard Fillmore',     party: 'Whig',                   start: '1850-07-09', end: '1853-03-04' },
  { name: 'Franklin Pierce',      party: 'Democratic',             start: '1853-03-04', end: '1857-03-04' },
  { name: 'James Buchanan',       party: 'Democratic',             start: '1857-03-04', end: '1861-03-04' },
  { name: 'Abraham Lincoln',      party: 'Republican',             start: '1861-03-04', end: '1865-04-15' },
  { name: 'Andrew Johnson',       party: 'Democratic',             start: '1865-04-15', end: '1869-03-04' },
  { name: 'Ulysses S. Grant',     party: 'Republican',             start: '1869-03-04', end: '1877-03-04' },
  { name: 'Rutherford B. Hayes',  party: 'Republican',             start: '1877-03-04', end: '1881-03-04' },
  { name: 'James A. Garfield',    party: 'Republican',             start: '1881-03-04', end: '1881-09-19' },
  { name: 'Chester A. Arthur',    party: 'Republican',             start: '1881-09-19', end: '1885-03-04' },
  { name: 'Grover Cleveland',     party: 'Democratic',             start: '1885-03-04', end: '1889-03-04' },
  { name: 'Benjamin Harrison',    party: 'Republican',             start: '1889-03-04', end: '1893-03-04' },
  { name: 'Grover Cleveland',     party: 'Democratic',             start: '1893-03-04', end: '1897-03-04' },
  { name: 'William McKinley',     party: 'Republican',             start: '1897-03-04', end: '1901-09-14' },
  { name: 'Theodore Roosevelt',   party: 'Republican',             start: '1901-09-14', end: '1909-03-04' },
  { name: 'William Howard Taft',  party: 'Republican',             start: '1909-03-04', end: '1913-03-04' },
  { name: 'Woodrow Wilson',       party: 'Democratic',             start: '1913-03-04', end: '1921-03-04' },
  { name: 'Warren G. Harding',    party: 'Republican',             start: '1921-03-04', end: '1923-08-02' },
  { name: 'Calvin Coolidge',      party: 'Republican',             start: '1923-08-02', end: '1929-03-04' },
  { name: 'Herbert Hoover',       party: 'Republican',             start: '1929-03-04', end: '1933-03-04' },
  { name: 'Franklin D. Roosevelt', party: 'Democratic',            start: '1933-03-04', end: '1945-04-12' },
  { name: 'Harry S. Truman',      party: 'Democratic',             start: '1945-04-12', end: '1953-01-20' },
  { name: 'Dwight D. Eisenhower', party: 'Republican',             start: '1953-01-20', end: '1961-01-20' },
  { name: 'John F. Kennedy',      party: 'Democratic',             start: '1961-01-20', end: '1963-11-22' },
  { name: 'Lyndon B. Johnson',    party: 'Democratic',             start: '1963-11-22', end: '1969-01-20' },
  { name: 'Richard Nixon',        party: 'Republican',             start: '1969-01-20', end: '1974-08-09' },
  { name: 'Gerald Ford',          party: 'Republican',             start: '1974-08-09', end: '1977-01-20' },
  { name: 'Jimmy Carter',         party: 'Democratic',             start: '1977-01-20', end: '1981-01-20' },
  { name: 'Ronald Reagan',        party: 'Republican',             start: '1981-01-20', end: '1989-01-20' },
  { name: 'George H. W. Bush',    party: 'Republican',             start: '1989-01-20', end: '1993-01-20' },
  { name: 'Bill Clinton',         party: 'Democratic',             start: '1993-01-20', end: '2001-01-20' },
  { name: 'George W. Bush',       party: 'Republican',             start: '2001-01-20', end: '2009-01-20' },
  { name: 'Barack Obama',         party: 'Democratic',             start: '2009-01-20', end: '2017-01-20' },
  { name: 'Donald Trump',         party: 'Republican',             start: '2017-01-20', end: '2021-01-20' },
  { name: 'Joe Biden',            party: 'Democratic',             start: '2021-01-20', end: '2025-01-20' },
  { name: 'Donald Trump',         party: 'Republican',             start: '2025-01-20', end: '2029-01-20' },
]

export type Era = { label: string; start: string; end: string }

export const ERAS: Era[] = [
  { label: 'Founding Era',               start: '1789-01-01', end: '1828-12-31' },
  { label: 'Jacksonian Era',             start: '1829-01-01', end: '1860-12-31' },
  { label: 'Civil War & Reconstruction', start: '1861-01-01', end: '1876-12-31' },
  { label: 'Gilded Age',                 start: '1877-01-01', end: '1900-12-31' },
  { label: 'Progressive Era',            start: '1901-01-01', end: '1928-12-31' },
  { label: 'New Deal & WWII',            start: '1929-01-01', end: '1952-12-31' },
  { label: 'Cold War',                   start: '1953-01-01', end: '1988-12-31' },
  { label: 'Post-Cold War',              start: '1989-01-01', end: '2008-12-31' },
  { label: 'Modern',                     start: '2009-01-01', end: '2029-12-31' },
]

export function partyAbbrev(party: President['party']): string {
  switch (party) {
    case 'Democratic': return 'D'
    case 'Republican': return 'R'
    case 'Whig': return 'W'
    case 'Democratic-Republican': return 'DR'
    case 'Federalist': return 'F'
    case 'National Republican': return 'NR'
    case 'Independent': return 'I'
    case 'No Party': return '—'
  }
}

export function presidentKey(p: President): string {
  return `${p.name}__${p.start}`
}

export function presidentLabel(p: President): string {
  const startYear = p.start.slice(0, 4)
  const endYear = p.end.slice(0, 4)
  const range = startYear === endYear ? startYear : `${startYear}–${endYear}`
  return `${p.name} (${partyAbbrev(p.party)}, ${range})`
}
