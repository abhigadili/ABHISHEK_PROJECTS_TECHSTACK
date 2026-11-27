/**
 * ============================================================
 * Cricket Universe Explorer — Countries Data
 * ============================================================
 *
 * Why static data in TypeScript files instead of a database?
 *   For a demo / portfolio project, static data lets you ship
 *   instantly without a backend.  In production you'd fetch
 *   this from a CMS or database and cache with Next.js ISR.
 *
 * Next.js best practice: When data rarely changes (< once/day),
 *   use `fetch` with `{ next: { revalidate: 86400 } }` (ISR)
 *   so Next.js serves a cached static page and revalidates in
 *   the background — best of both worlds: speed + freshness.
 *
 * Interview tip: TypeScript's `satisfies` operator checks that
 *   an object matches a type WITHOUT widening it. This means
 *   each entry still has its literal id type instead of string,
 *   giving better autocomplete and stricter inference downstream.
 * ============================================================
 */

import type { Country } from '@/types';

// ─────────────────────────────────────────────
// Country data
// ─────────────────────────────────────────────

/**
 * All six cricket nations featured in this application.
 * Exported as a plain typed array — consumers should never
 * mutate it directly; use the utility helpers in `@/utils`.
 */
export const countries: Country[] = [

  // ── India ───────────────────────────────────────────────────
  {
    id: 'ind',
    name: 'India',
    shortName: 'IND',
    flag: '🇮🇳',
    description:
      'India is the most powerful nation in world cricket, home to the Board of Control for Cricket in India (BCCI) — the richest cricket board on the planet. ' +
      'The Indian Premier League (IPL), launched in 2008, revolutionised franchise cricket globally and made India the financial epicentre of the sport. ' +
      'The Men in Blue have won the ICC Cricket World Cup twice (1983 and 2011), and captured the T20 World Cup twice (2007 and 2024). ' +
      'With a fanbase surpassing a billion passionate supporters, every Indian match is a national event watched by millions across continents.',
    background: '/images/countries/india-bg.jpg',
    established: 1928,
    worldCupsWon: 2,
    board: 'BCCI',
    coach: 'Gautam Gambhir',
    captain: 'Rohit Sharma',
    famousPlayers: [
      'Sachin Tendulkar',
      'Rahul Dravid',
      'Sourav Ganguly',
      'Anil Kumble',
      'MS Dhoni',
      'Virat Kohli',
      'Kapil Dev',
      'Sunil Gavaskar',
    ],
  },

  // ── Australia ──────────────────────────────────────────────
  {
    id: 'aus',
    name: 'Australia',
    shortName: 'AUS',
    flag: '🇦🇺',
    description:
      'Australia is the most successful team in ICC Cricket World Cup history, having lifted the trophy a record six times (1987, 1999, 2003, 2007, 2015, and 2023). ' +
      'Cricket Australia oversees a rich domestic structure that includes the Sheffield Shield (First-Class), the Big Bash League (T20), and the Marsh Cup (List-A). ' +
      'The Australians are renowned for their aggressive brand of cricket, a formidable fast-bowling tradition, and a culture of producing world-class talent generation after generation. ' +
      'The Baggy Green cap remains one of the most coveted symbols in international sport.',
    background: '/images/countries/australia-bg.jpg',
    established: 1905,
    worldCupsWon: 6,
    board: 'Cricket Australia',
    coach: 'Andrew McDonald',
    captain: 'Pat Cummins',
    famousPlayers: [
      'Don Bradman',
      'Shane Warne',
      'Glenn McGrath',
      'Ricky Ponting',
      'Adam Gilchrist',
      'Steve Waugh',
      'Matthew Hayden',
      'Brett Lee',
    ],
  },

  // ── England ────────────────────────────────────────────────
  {
    id: 'eng',
    name: 'England',
    shortName: 'ENG',
    // Note: England cricket traditionally uses the Cross of St George
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    description:
      "England is the birthplace of cricket — the sport was codified here in the 18th century, and the Laws of Cricket are still maintained by the MCC at Lord's in London. " +
      "England have won the ICC Cricket World Cup three times: the 1979 Women's World Cup, the 2017 Women's World Cup, and a thrilling men's title in 2019 decided by a Super Over at Lord's. " +
      'Under Ben Stokes and Brendon McCullum, England embraced "Bazball" — a positive, attacking approach that has revitalised Test cricket. ' +
      'The County Championship, spanning 18 counties, is one of the oldest and most competitive domestic structures in world cricket.',
    background: '/images/countries/england-bg.jpg',
    established: 1877,
    worldCupsWon: 3,
    board: 'ECB',
    coach: 'Brendon McCullum',
    captain: 'Ben Stokes',
    famousPlayers: [
      'W.G. Grace',
      'Ian Botham',
      'Alastair Cook',
      'Andrew Flintoff',
      'James Anderson',
      'Kevin Pietersen',
      'Graeme Swann',
      'Joe Root',
    ],
  },

  // ── Pakistan ───────────────────────────────────────────────
  {
    id: 'pak',
    name: 'Pakistan',
    shortName: 'PAK',
    flag: '🇵🇰',
    description:
      'Pakistan is one of the most exciting and unpredictable teams in world cricket, a side capable of beating anyone on any given day. ' +
      'The Pakistan Cricket Board (PCB) governs the sport in a country where cricket is a unifying national passion. ' +
      "Pakistan's finest hour came in the 1992 ICC Cricket World Cup, where Imran Khan led a spirited comeback campaign to lift the trophy in Melbourne. " +
      'The Pakistan Super League (PSL), launched in 2016, has grown into a major T20 franchise competition, developing emerging domestic talent alongside global stars.',
    background: '/images/countries/pakistan-bg.jpg',
    established: 1948,
    worldCupsWon: 1,
    board: 'PCB',
    coach: 'Gary Kirsten',
    captain: 'Babar Azam',
    famousPlayers: [
      'Imran Khan',
      'Wasim Akram',
      'Waqar Younis',
      'Javed Miandad',
      'Inzamam-ul-Haq',
      'Shoaib Akhtar',
      'Younis Khan',
      'Shahid Afridi',
    ],
  },

  // ── South Africa ───────────────────────────────────────────
  {
    id: 'sa',
    name: 'South Africa',
    shortName: 'SA',
    flag: '🇿🇦',
    description:
      'South Africa — the Proteas — are perennial World Cup contenders who have narrowly missed ICC trophy glory on multiple occasions, most memorably in the dramatic 1999 semi-final tie against Australia. ' +
      'Cricket South Africa (CSA) reintegrated the national team into international cricket in 1992 after the end of apartheid-era isolation. ' +
      'The country boasts exceptional fast-bowling talent, powerful batting depth, and a fiercely competitive domestic structure. ' +
      'The SA20 franchise league, launched in January 2023, has rapidly become one of the most watched T20 competitions in the world.',
    background: '/images/countries/south-africa-bg.jpg',
    established: 1909,
    worldCupsWon: 0,
    board: 'CSA',
    coach: 'Shukri Conrad',
    captain: 'Temba Bavuma',
    famousPlayers: [
      'Graeme Pollock',
      'Barry Richards',
      'Allan Donald',
      'Hansie Cronje',
      'Shaun Pollock',
      'Jacques Kallis',
      'AB de Villiers',
      'Dale Steyn',
    ],
  },

  // ── New Zealand ────────────────────────────────────────────
  {
    id: 'nz',
    name: 'New Zealand',
    shortName: 'NZ',
    flag: '🇳🇿',
    description:
      'New Zealand — the Black Caps — punch well above their weight for a nation of just five million people and are widely regarded as the most sporting team in world cricket. ' +
      'New Zealand Cricket (NZC) administers the game through the Plunket Shield, Ford Trophy, and Super Smash competitions. ' +
      'The Black Caps reached back-to-back ICC final appearances, winning the inaugural World Test Championship in 2021 by defeating India at Southampton. ' +
      'Under former captain Kane Williamson the team built an enduring reputation for disciplined, high-quality cricket and exemplary sportsmanship on the global stage.',
    background: '/images/countries/new-zealand-bg.jpg',
    established: 1894,
    worldCupsWon: 0,
    board: 'NZC',
    coach: 'Gary Stead',
    captain: 'Kane Williamson',
    famousPlayers: [
      'Richard Hadlee',
      'Martin Crowe',
      'Stephen Fleming',
      'Daniel Vettori',
      'Brendon McCullum',
      'Kane Williamson',
      'Ross Taylor',
      'Trent Boult',
    ],
  },

] satisfies Country[];
