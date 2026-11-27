/**
 * ============================================================
 * Cricket Universe Explorer — Leagues Data
 * ============================================================
 *
 * Structure: 6 leagues per country × 6 countries = 36 leagues.
 * Each league has a `countryId` foreign key that links back
 * to a Country in countries.ts.
 *
 * Interview tip: Foreign key relationships in static data work
 *   just like in a relational database. The `countryId` field
 *   here mirrors a FK constraint in SQL — we validate the
 *   relationship at the utility layer (`getLeaguesByCountry`).
 *
 * Next.js best practice: In a production app, group related
 *   server queries so Next.js can deduplicate identical fetch()
 *   calls within a single render pass (Request Memoisation).
 * ============================================================
 */

import type { League } from '@/types';

// ─────────────────────────────────────────────
// League data (36 entries)
// ─────────────────────────────────────────────

export const leagues: League[] = [

  // ══════════════════════════════════════════
  // INDIA  (countryId: 'ind')
  // ══════════════════════════════════════════

  {
    id: 'ipl',
    countryId: 'ind',
    name: 'Indian Premier League',
    description:
      'The IPL is the most watched and commercially valuable T20 franchise competition in the world, attracting top international talent to play alongside India\'s best. Founded in 2008 by the BCCI, the league transformed cricket into a premium entertainment product blending sport with Bollywood glamour.',
    established: 2008,
    format: 'T20',
    trophy: 'IPL Trophy',
    image: '/images/leagues/ipl.jpg',
  },
  {
    id: 'ranji',
    countryId: 'ind',
    name: 'Ranji Trophy',
    description:
      'The Ranji Trophy is India\'s premier First-Class domestic competition, named after cricketing legend K.S. Ranjitsinhji. Established in 1934, it is the backbone of Indian cricket providing a pathway for players to graduate into the national side. Teams represent states and zones across the country.',
    established: 1934,
    format: 'First-Class',
    trophy: 'Ranji Trophy',
    image: '/images/leagues/ranji.jpg',
  },
  {
    id: 'wpl',
    countryId: 'ind',
    name: "Women's Premier League",
    description:
      "The WPL is India's franchise T20 competition for women, launched in 2023 by the BCCI to mirror the success of the IPL. The league has provided a major platform for women cricketers to showcase their talent in front of packed stadiums and a global television audience.",
    established: 2023,
    format: 'T20',
    trophy: 'WPL Trophy',
    image: '/images/leagues/wpl.jpg',
  },
  {
    id: 'smat',
    countryId: 'ind',
    name: 'Syed Mushtaq Ali Trophy',
    description:
      'The Syed Mushtaq Ali Trophy (SMAT) is the national T20 tournament for Indian states, named after legendary Indian cricketer Syed Mushtaq Ali. It serves as the primary T20 feeder competition for the IPL auction pool and helps identify emerging domestic T20 specialists.',
    established: 2006,
    format: 'T20',
    trophy: 'Syed Mushtaq Ali Trophy',
    image: '/images/leagues/smat.jpg',
  },
  {
    id: 'duleep',
    countryId: 'ind',
    name: 'Duleep Trophy',
    description:
      'The Duleep Trophy is a prestigious First-Class competition where Indian players are divided into zonal teams — a crucial stepping stone for those aspiring to break into the Test national side. Named after the Jam Sahib of Nawanagar, K.S. Duleepsinhji, it has a rich history dating back to 1961.',
    established: 1961,
    format: 'First-Class',
    trophy: 'Duleep Trophy',
    image: '/images/leagues/duleep.jpg',
  },
  {
    id: 'vijay-hazare',
    countryId: 'ind',
    name: 'Vijay Hazare Trophy',
    description:
      'The Vijay Hazare Trophy is India\'s flagship List-A / 50-over domestic competition, serving the same role for ODI cricket that the Ranji Trophy does for Test cricket. Named after India\'s legendary batsman Vijay Hazare, it allows states to compete at the one-day format and is key preparation for the national ODI team.',
    established: 2002,
    format: 'List-A',
    trophy: 'Vijay Hazare Trophy',
    image: '/images/leagues/vijay-hazare.jpg',
  },

  // ══════════════════════════════════════════
  // AUSTRALIA  (countryId: 'aus')
  // ══════════════════════════════════════════

  {
    id: 'bbl',
    countryId: 'aus',
    name: 'Big Bash League',
    description:
      'The BBL is Australia\'s premier franchise T20 competition, launched in 2011 to replace the older state-based Twenty20 Big Bash. Known for its family-friendly atmosphere, innovative broadcast innovations, and consistently high match quality, it draws large crowds every Australian summer season.',
    established: 2011,
    format: 'T20',
    trophy: 'Big Bash Trophy',
    image: '/images/leagues/bbl.jpg',
  },
  {
    id: 'wbbl',
    countryId: 'aus',
    name: "Women's Big Bash League",
    description:
      "The WBBL is the women's counterpart to the BBL and is widely regarded as the highest-quality women's T20 competition in the world, attracting the best female cricketers from every nation. Since its 2015 launch it has helped grow the women's game in Australia enormously.",
    established: 2015,
    format: 'T20',
    trophy: 'WBBL Trophy',
    image: '/images/leagues/wbbl.jpg',
  },
  {
    id: 'sheffield-shield',
    countryId: 'aus',
    name: 'Sheffield Shield',
    description:
      'The Sheffield Shield is Australia\'s oldest and most prestigious domestic First-Class competition, contested since 1892 between the six state teams. It is the primary breeding ground for Australian Test players and is considered one of the strongest First-Class competitions anywhere in the world.',
    established: 1892,
    format: 'First-Class',
    trophy: 'Sheffield Shield',
    image: '/images/leagues/sheffield-shield.jpg',
  },
  {
    id: 'marsh-cup',
    countryId: 'aus',
    name: 'Marsh Cup',
    description:
      'The Marsh Cup (formerly Matador BBQs One-Day Cup and Ford Ranger Cup) is Australia\'s domestic List-A competition, serving as the 50-over pathway for state players aspiring to represent Australia in ODIs. It provides valuable preparation ahead of international one-day series.',
    established: 1969,
    format: 'List-A',
    trophy: 'Marsh Cup',
    image: '/images/leagues/marsh-cup.jpg',
  },
  {
    id: 'ncl-aus',
    countryId: 'aus',
    name: 'National Cricket League',
    description:
      'The National Cricket League was the previous title of Australia\'s premier List-A domestic competition before it underwent rebrandings. It laid the structural foundation for what became the Marsh Cup and gave generations of Australian players vital 50-over experience.',
    established: 1969,
    format: 'List-A',
    trophy: 'National Cricket League Trophy',
    image: '/images/leagues/ncl-aus.jpg',
  },
  {
    id: 'premier-cricket-aus',
    countryId: 'aus',
    name: 'Premier Cricket',
    description:
      'Premier Cricket is the highest level of club cricket in each Australian state, acting as the entry point into the professional pathway. Many current BBL and Sheffield Shield players rose through Premier Cricket, making it an essential talent pipeline for Australian cricket.',
    established: 1905,
    format: 'First-Class',
    trophy: 'Premier Cricket Shield',
    image: '/images/leagues/premier-cricket-aus.jpg',
  },

  // ══════════════════════════════════════════
  // ENGLAND  (countryId: 'eng')
  // ══════════════════════════════════════════

  {
    id: 'the-hundred',
    countryId: 'eng',
    name: 'The Hundred',
    description:
      'The Hundred is England\'s innovative 100-ball format franchise competition launched in 2021 by the ECB to attract a younger, broader audience to cricket. Eight city-based franchises compete in a fast, action-packed format with unique rules designed to make the game more accessible for first-time fans.',
    established: 2021,
    format: 'T20',
    trophy: 'The Hundred Trophy',
    image: '/images/leagues/the-hundred.jpg',
  },
  {
    id: 'county-championship',
    countryId: 'eng',
    name: 'County Championship',
    description:
      'The County Championship is one of the oldest domestic cricket competitions in the world, contested by the 18 first-class counties of England and Wales. Dating back to 1890, it is the pinnacle of First-Class cricket in England and the primary breeding ground for England Test players.',
    established: 1890,
    format: 'First-Class',
    trophy: 'County Championship Trophy',
    image: '/images/leagues/county-championship.jpg',
  },
  {
    id: 't20-blast',
    countryId: 'eng',
    name: 'T20 Blast',
    description:
      'The T20 Blast is England\'s county-based T20 competition, the most widely attended domestic T20 tournament in England. The Blast consistently draws large local crowds and serves as a platform for international stars to compete alongside county regulars across the English summer.',
    established: 2003,
    format: 'T20',
    trophy: 'T20 Blast Trophy',
    image: '/images/leagues/t20-blast.jpg',
  },
  {
    id: 'one-day-cup',
    countryId: 'eng',
    name: 'One Day Cup',
    description:
      'The One Day Cup (previously the Royal London One-Day Cup) is the premier 50-over domestic competition for English counties, providing players with vital List-A experience. It acts as a developmental bridge between county cricket and international ODI cricket for England hopefuls.',
    established: 1963,
    format: 'List-A',
    trophy: 'One Day Cup',
    image: '/images/leagues/one-day-cup.jpg',
  },
  {
    id: 'rhf-trophy',
    countryId: 'eng',
    name: 'Rachael Heyhoe Flint Trophy',
    description:
      "The Rachael Heyhoe Flint Trophy is England's regional women's One Day competition, named in honour of the trailblazing England women's captain who helped establish the women's game internationally. It provides the primary List-A pathway for English women cricketers.",
    established: 2020,
    format: 'List-A',
    trophy: 'Rachael Heyhoe Flint Trophy',
    image: '/images/leagues/rhf-trophy.jpg',
  },
  {
    id: 'charlotte-edwards-cup',
    countryId: 'eng',
    name: 'Charlotte Edwards Cup',
    description:
      "The Charlotte Edwards Cup is England's regional women's T20 competition, named after the legendary England Women's captain. Launched in 2021, it runs alongside The Hundred and provides a domestic T20 platform for aspiring English women cricketers.",
    established: 2021,
    format: 'T20',
    trophy: 'Charlotte Edwards Cup',
    image: '/images/leagues/charlotte-edwards-cup.jpg',
  },

  // ══════════════════════════════════════════
  // PAKISTAN  (countryId: 'pak')
  // ══════════════════════════════════════════

  {
    id: 'psl',
    countryId: 'pak',
    name: 'Pakistan Super League',
    description:
      'The PSL is Pakistan\'s marquee T20 franchise competition, launched in 2016, that has grown into one of the most entertaining and competitive leagues in the world. It returned cricket to Pakistan after years of security concerns and has produced a string of exciting young Pakistani talent alongside marquee international signings.',
    established: 2016,
    format: 'T20',
    trophy: 'PSL Trophy',
    image: '/images/leagues/psl.jpg',
  },
  {
    id: 'quaid-e-azam',
    countryId: 'pak',
    name: 'Quaid-e-Azam Trophy',
    description:
      "The Quaid-e-Azam Trophy is Pakistan's premier First-Class domestic competition, named after the nation's founder Mohammad Ali Jinnah. Contested between departmental and regional teams, it is the backbone of Pakistani red-ball cricket and the primary pathway to the Test national side.",
    established: 1953,
    format: 'First-Class',
    trophy: 'Quaid-e-Azam Trophy',
    image: '/images/leagues/quaid-e-azam.jpg',
  },
  {
    id: 'national-t20-cup',
    countryId: 'pak',
    name: 'National T20 Cup',
    description:
      "Pakistan's National T20 Cup is the domestic T20 competition that serves as the feeder tournament for the PSL, helping scouts identify emerging T20 talent from across the country's provincial teams. It provides a vital platform for young players to showcase their skills in the shortest format.",
    established: 2004,
    format: 'T20',
    trophy: 'National T20 Cup',
    image: '/images/leagues/national-t20-cup.jpg',
  },
  {
    id: 'pakistan-cup',
    countryId: 'pak',
    name: 'Pakistan Cup',
    description:
      "The Pakistan Cup is the country's premier List-A / 50-over domestic competition, contested between regional teams. It replicates the ODI format and is instrumental in preparing Pakistani players for international one-day cricket, providing consistent 50-over match experience.",
    established: 2016,
    format: 'List-A',
    trophy: 'Pakistan Cup',
    image: '/images/leagues/pakistan-cup.jpg',
  },
  {
    id: 'pcb-womens-league',
    countryId: 'pak',
    name: "PCB Women's League",
    description:
      "The PCB Women's League is Pakistan's domestic cricket competition for women, administered by the Pakistan Cricket Board. The league plays a crucial role in developing female cricket talent in Pakistan and provides a structured competitive environment for women aspiring to represent the national team.",
    established: 2010,
    format: 'T20',
    trophy: "PCB Women's League Trophy",
    image: '/images/leagues/pcb-womens-league.jpg',
  },
  {
    id: 'president-trophy',
    countryId: 'pak',
    name: 'President Trophy',
    description:
      "The President Trophy is Pakistan's oldest First-Class domestic competition for departmental teams, providing a second tier of red-ball cricket alongside the Quaid-e-Azam Trophy. It has historically been instrumental in giving Pakistan's departmental cricket structure a competitive annual championship.",
    established: 1953,
    format: 'First-Class',
    trophy: 'President Trophy',
    image: '/images/leagues/president-trophy.jpg',
  },

  // ══════════════════════════════════════════
  // SOUTH AFRICA  (countryId: 'sa')
  // ══════════════════════════════════════════

  {
    id: 'sa20',
    countryId: 'sa',
    name: 'SA20',
    description:
      "South Africa's SA20 is a franchise T20 competition launched in January 2023, featuring six teams backed by IPL franchise owners. The league has quickly become one of the world's premier T20 competitions, showcasing South Africa's domestic talent alongside top international players.",
    established: 2023,
    format: 'T20',
    trophy: 'SA20 Trophy',
    image: '/images/leagues/sa20.jpg',
  },
  {
    id: 'csa-t20-challenge',
    countryId: 'sa',
    name: 'CSA T20 Challenge',
    description:
      'The CSA T20 Challenge is the provincial T20 competition in South Africa, contested between the six major provincial sides. It acts as a feeder competition for the SA20 and provides vital T20 experience for domestic players seeking franchise contracts and national team selection.',
    established: 2003,
    format: 'T20',
    trophy: 'CSA T20 Challenge Trophy',
    image: '/images/leagues/csa-t20-challenge.jpg',
  },
  {
    id: 'csa-one-day-cup',
    countryId: 'sa',
    name: 'CSA One Day Cup',
    description:
      "The CSA One Day Cup is South Africa's provincial 50-over competition, designed to prepare players for international ODI cricket. Contested between the six major provincial teams, it provides List-A cricket experience and serves as a key selection ground for the national ODI squad.",
    established: 1981,
    format: 'List-A',
    trophy: 'CSA One Day Cup',
    image: '/images/leagues/csa-one-day-cup.jpg',
  },
  {
    id: 'four-day-series',
    countryId: 'sa',
    name: 'Four Day Series',
    description:
      "The Four Day Series is South Africa's premier First-Class domestic competition, replacing the Sunfoil Series. Contested between the six provincial sides over four-day matches, it is the backbone of South African red-ball cricket and the primary pathway to Test match selection.",
    established: 2004,
    format: 'First-Class',
    trophy: 'Four Day Series Trophy',
    image: '/images/leagues/four-day-series.jpg',
  },
  {
    id: 'provincial-t20',
    countryId: 'sa',
    name: 'Provincial T20',
    description:
      "South Africa's Provincial T20 competition features the country's provincial sides competing at the sub-franchise level. It provides a broader pool of T20 talent from which CSA selectors and SA20 franchises can identify players for higher-level competitions.",
    established: 2004,
    format: 'T20',
    trophy: 'Provincial T20 Trophy',
    image: '/images/leagues/provincial-t20.jpg',
  },
  {
    id: 'womens-provincial-league',
    countryId: 'sa',
    name: "Women's Provincial League",
    description:
      "The Women's Provincial League is South Africa's domestic cricket competition for women, providing competitive cricket at provincial level. It acts as the talent nursery for the Momentum Proteas (national women's team) and is vital to the long-term growth of women's cricket in the country.",
    established: 2000,
    format: 'T20',
    trophy: "Women's Provincial League Trophy",
    image: '/images/leagues/womens-provincial-league.jpg',
  },

  // ══════════════════════════════════════════
  // NEW ZEALAND  (countryId: 'nz')
  // ══════════════════════════════════════════

  {
    id: 'super-smash',
    countryId: 'nz',
    name: 'Super Smash',
    description:
      "The Super Smash is New Zealand's domestic T20 competition, featuring the six major associations. Played during the New Zealand summer, it provides high-quality domestic T20 cricket and acts as a feeder for the national T20 squad ahead of international tournaments.",
    established: 2005,
    format: 'T20',
    trophy: 'Super Smash Trophy',
    image: '/images/leagues/super-smash.jpg',
  },
  {
    id: 'plunket-shield',
    countryId: 'nz',
    name: 'Plunket Shield',
    description:
      "The Plunket Shield is New Zealand's premier First-Class competition, one of the oldest in the Southern Hemisphere. Named after Lord Plunket, a former Governor-General of New Zealand, it has been contested since 1906 and is the key proving ground for Black Caps Test aspirants.",
    established: 1906,
    format: 'First-Class',
    trophy: 'Plunket Shield',
    image: '/images/leagues/plunket-shield.jpg',
  },
  {
    id: 'ford-trophy',
    countryId: 'nz',
    name: 'Ford Trophy',
    description:
      "The Ford Trophy is New Zealand's premier List-A / 50-over domestic competition for the six major associations. It mirrors the ODI format and provides essential preparation for New Zealand players targeting international one-day selection and the Cricket World Cup squad.",
    established: 1971,
    format: 'List-A',
    trophy: 'Ford Trophy',
    image: '/images/leagues/ford-trophy.jpg',
  },
  {
    id: 'hjs',
    countryId: 'nz',
    name: 'Hallyburton Johnstone Shield',
    description:
      "The Hallyburton Johnstone Shield is New Zealand's premier domestic women's one-day competition, providing the 50-over pathway for women cricketers who aspire to represent the White Ferns. It is a cornerstone of the NZC women's cricket development pathway.",
    established: 1972,
    format: 'List-A',
    trophy: 'Hallyburton Johnstone Shield',
    image: '/images/leagues/hjs.jpg',
  },
  {
    id: 'super-smash-women',
    countryId: 'nz',
    name: "Dream11 Super Smash Women",
    description:
      "The women's Super Smash is New Zealand's domestic T20 competition for women, providing a high-quality T20 platform for aspiring White Ferns players. It runs alongside the men's Super Smash and helps NZC identify and develop female T20 talent for international competitions.",
    established: 2005,
    format: 'T20',
    trophy: "Women's Super Smash Trophy",
    image: '/images/leagues/super-smash-women.jpg',
  },
  {
    id: 'hawke-cup',
    countryId: 'nz',
    name: 'Hawke Cup',
    description:
      "The Hawke Cup is New Zealand's premier challenge cricket competition for minor associations, operating on a challenge system where the current holder defends against challenger associations. Named after Lord Hawke, it has been contested since 1910 and gives provincial talent vital first-class experience.",
    established: 1910,
    format: 'First-Class',
    trophy: 'Hawke Cup',
    image: '/images/leagues/hawke-cup.jpg',
  },

] satisfies League[];
