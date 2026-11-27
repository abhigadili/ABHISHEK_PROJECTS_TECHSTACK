/**
 * ============================================================
 * Cricket Universe Explorer — Cricketers Data
 * ============================================================
 *
 * Coverage:
 *   CSK  — 4 players (MS Dhoni, Ruturaj Gaikwad, Deepak Chahar, Ravindra Jadeja)
 *   MI   — 4 players (Rohit Sharma, Jasprit Bumrah, Suryakumar Yadav, Hardik Pandya)
 *   RCB  — 4 players (Virat Kohli, AB de Villiers, Glenn Maxwell, Faf du Plessis)
 *   KKR  — 4 players (Andre Russell, Sunil Narine, Shreyas Iyer, Varun Chakravarthy)
 *   SRH  — 4 players (Pat Cummins, Travis Head, Heinrich Klaasen, Bhuvneshwar Kumar)
 *   PSL  — 3 players each for Karachi Kings, Lahore Qalandars, Islamabad United
 *   BBL  — 3 players each for Sydney Sixers, Perth Scorchers, Melbourne Stars
 *
 * Stats are approximate career/IPL figures for learning purposes.
 *
 * Interview tip: `role` uses the PlayerRole union type defined
 *   in @/types. TypeScript will raise a compile error if you
 *   accidentally write 'Allrounder' (missing hyphen) — this is
 *   one of the key advantages of union literal types over string.
 *
 * Next.js best practice: When the same data is needed in both
 *   a Server Component (page) and a Route Handler (API), import
 *   it from this shared data file rather than duplicating it.
 *   The module is bundled once and tree-shaken per entry point.
 * ============================================================
 */

import type { Cricketer } from '@/types';

export const cricketers: Cricketer[] = [

  // ══════════════════════════════════════════
  // CSK — Chennai Super Kings  (teamId: 'csk')
  // ══════════════════════════════════════════

  {
    id: 'ms-dhoni-csk',
    teamId: 'csk',
    name: 'MS Dhoni',
    country: 'India',
    role: 'Wicketkeeper-Batsman',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm medium',
    age: 43,
    matches: 250,
    runs: 5082,
    wickets: 0,
    description:
      "Mahendra Singh Dhoni is widely regarded as one of the greatest captains and finishers in cricket history. The 'Captain Cool' led India to three ICC trophies (2007 T20 WC, 2011 ODI WC, 2013 Champions Trophy) and CSK to five IPL titles. Renowned for his helicopter shot, ice-cold temperament under pressure, and lightning-fast stumpings, Dhoni is an icon of the modern game.",
    image: '/images/players/ms-dhoni.jpg',
  },
  {
    id: 'ruturaj-gaikwad-csk',
    teamId: 'csk',
    name: 'Ruturaj Gaikwad',
    country: 'India',
    role: 'Batsman',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm off-break',
    age: 27,
    matches: 80,
    runs: 2520,
    wickets: 0,
    description:
      "Ruturaj Gaikwad is one of India's most exciting young batsmen, named the IPL's best young cricketer multiple times for his stylish, elegant technique. The CSK captain scored an outstanding 583 runs in the 2021 IPL season to win the Orange Cap, and has since established himself as a key figure in India's white-ball future.",
    image: '/images/players/ruturaj-gaikwad.jpg',
  },
  {
    id: 'deepak-chahar-csk',
    teamId: 'csk',
    name: 'Deepak Chahar',
    country: 'India',
    role: 'Bowler',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm medium-fast',
    age: 31,
    matches: 75,
    runs: 280,
    wickets: 78,
    description:
      "Deepak Chahar is one of the most skilful powerplay bowlers in T20 cricket, renowned for swinging the new ball both ways. He is the only Indian bowler to take a hat-trick in T20 Internationals — his 6/7 against Bangladesh in 2019 remains the best T20I bowling figures by any Indian. His lower-order batting contributions are also invaluable for CSK.",
    image: '/images/players/deepak-chahar.jpg',
  },
  {
    id: 'ravindra-jadeja-csk',
    teamId: 'csk',
    name: 'Ravindra Jadeja',
    country: 'India',
    role: 'All-rounder',
    battingStyle: 'Left-handed',
    bowlingStyle: 'Left-arm orthodox spin',
    age: 35,
    matches: 230,
    runs: 2692,
    wickets: 132,
    description:
      "Ravindra Jadeja is one of the most complete cricketers of his generation — a hard-hitting left-hand bat, reliable left-arm spinner, and one of the finest fielders in the history of the game. A key pillar of both CSK and the Indian national team across all formats, 'Sir Jadeja' (as fans call him) is known for his relentless work-rate and match-winning lower-order cameos.",
    image: '/images/players/ravindra-jadeja.jpg',
  },

  // ══════════════════════════════════════════
  // MI — Mumbai Indians  (teamId: 'mi')
  // ══════════════════════════════════════════

  {
    id: 'rohit-sharma-mi',
    teamId: 'mi',
    name: 'Rohit Sharma',
    country: 'India',
    role: 'Batsman',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm off-break',
    age: 37,
    matches: 243,
    runs: 6211,
    wickets: 15,
    description:
      "Rohit Sharma is India's Test and ODI captain and the most prolific run-scorer in IPL history with over 6,000 runs. Known as the 'Hitman', Rohit is renowned for his effortless timing and powerful square cuts. He is the only batsman to have scored three ODI double hundreds and led Mumbai Indians to five IPL titles.",
    image: '/images/players/rohit-sharma.jpg',
  },
  {
    id: 'jasprit-bumrah-mi',
    teamId: 'mi',
    name: 'Jasprit Bumrah',
    country: 'India',
    role: 'Bowler',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm fast',
    age: 30,
    matches: 120,
    runs: 56,
    wickets: 145,
    description:
      "Jasprit Bumrah is widely considered the best fast bowler in the world across all formats, remarkable for his unorthodox action, yorker accuracy, and sharp pace from a short run-up. He consistently leads India's pace attack across Tests, ODIs, and T20Is and was named Player of the Series in the 2024 India tour of Australia.",
    image: '/images/players/jasprit-bumrah.jpg',
  },
  {
    id: 'suryakumar-yadav-mi',
    teamId: 'mi',
    name: 'Suryakumar Yadav',
    country: 'India',
    role: 'Batsman',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm medium',
    age: 34,
    matches: 130,
    runs: 3190,
    wickets: 3,
    description:
      "Suryakumar Yadav — 'SKY' — is the number-one ranked T20 International batsman in the world, famous for his 360-degree stroke play and ability to hit into non-traditional areas of the field. SKY made a stunning boundary catch in the 2024 T20 World Cup final that helped India clinch the title.",
    image: '/images/players/suryakumar-yadav.jpg',
  },
  {
    id: 'hardik-pandya-mi',
    teamId: 'mi',
    name: 'Hardik Pandya',
    country: 'India',
    role: 'All-rounder',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm fast-medium',
    age: 31,
    matches: 115,
    runs: 2100,
    wickets: 65,
    description:
      "Hardik Pandya is one of the most impactful all-rounders in world T20 cricket — a destructive middle-order batsman capable of clearing the largest grounds, and a sharp right-arm pacer who can bowl at 140+ km/h. He played a pivotal role in India's 2024 T20 World Cup triumph with vital bowling contributions in the final.",
    image: '/images/players/hardik-pandya.jpg',
  },

  // ══════════════════════════════════════════
  // RCB — Royal Challengers Bengaluru  (teamId: 'rcb')
  // ══════════════════════════════════════════

  {
    id: 'virat-kohli-rcb',
    teamId: 'rcb',
    name: 'Virat Kohli',
    country: 'India',
    role: 'Batsman',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm medium',
    age: 35,
    matches: 237,
    runs: 7263,
    wickets: 4,
    description:
      "Virat Kohli is the all-time leading run-scorer in IPL history and one of the greatest batsmen of the modern era across all formats. Known for his immense passion, fitness, and ability to chase targets, Kohli has scored over 7,000 IPL runs including the only century scored in an IPL final.",
    image: '/images/players/virat-kohli.jpg',
  },
  {
    id: 'ab-de-villiers-rcb',
    teamId: 'rcb',
    name: 'AB de Villiers',
    country: 'South Africa',
    role: 'Wicketkeeper-Batsman',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm medium',
    age: 40,
    matches: 184,
    runs: 5162,
    wickets: 0,
    description:
      "AB de Villiers — 'Mr 360' — is widely regarded as one of the greatest batsmen to ever play the game. Capable of playing any shot to any part of the ground, ABD played for RCB from 2011 to 2021, forming one of cricket's most devastating batting partnerships with Virat Kohli. Retired since 2021, his RCB legacy is unmatched.",
    image: '/images/players/ab-de-villiers.jpg',
  },
  {
    id: 'glenn-maxwell-rcb',
    teamId: 'rcb',
    name: 'Glenn Maxwell',
    country: 'Australia',
    role: 'All-rounder',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm off-break',
    age: 36,
    matches: 115,
    runs: 2607,
    wickets: 35,
    description:
      "Glenn Maxwell is one of cricket's most destructive and innovative batsmen. The 'Big Show' is most famous for his remarkable 201* against Afghanistan at the 2023 ODI World Cup — scored while cramping — widely hailed as one of the greatest ODI innings ever. He brings explosive, unconventional batting and useful off-spin to RCB.",
    image: '/images/players/glenn-maxwell.jpg',
  },
  {
    id: 'faf-du-plessis-rcb',
    teamId: 'rcb',
    name: 'Faf du Plessis',
    country: 'South Africa',
    role: 'Batsman',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm medium',
    age: 40,
    matches: 119,
    runs: 3415,
    wickets: 0,
    description:
      "Faf du Plessis is one of South Africa's finest modern batsmen, bringing elegance, experience, and match-winning ability to RCB as their captain. Known for his impeccable timing and 360-degree cricket, du Plessis was the key leader in RCB's long-awaited IPL title triumph.",
    image: '/images/players/faf-du-plessis.jpg',
  },

  // ══════════════════════════════════════════
  // KKR — Kolkata Knight Riders  (teamId: 'kkr')
  // ══════════════════════════════════════════

  {
    id: 'andre-russell-kkr',
    teamId: 'kkr',
    name: 'Andre Russell',
    country: 'West Indies',
    role: 'All-rounder',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm fast-medium',
    age: 36,
    matches: 119,
    runs: 3006,
    wickets: 110,
    description:
      "Andre Russell is one of the most feared match-winners in T20 cricket — an extraordinarily powerful batsman who can hit sixes off any bowler, and a right-arm pacer who generates genuine pace. 'Dre Russ' single-handedly won numerous matches for KKR from seemingly impossible situations.",
    image: '/images/players/andre-russell.jpg',
  },
  {
    id: 'sunil-narine-kkr',
    teamId: 'kkr',
    name: 'Sunil Narine',
    country: 'West Indies',
    role: 'All-rounder',
    battingStyle: 'Left-handed',
    bowlingStyle: 'Right-arm off-break',
    age: 36,
    matches: 177,
    runs: 1879,
    wickets: 177,
    description:
      "Sunil Narine is one of KKR's most influential players — an elite mystery spinner and a remarkably destructive pinch-hitter who transformed himself from lower-order hitter to explosive opener. His combination of miserly bowling and ferocious hitting makes him one of T20 cricket's most unique all-round assets.",
    image: '/images/players/sunil-narine.jpg',
  },
  {
    id: 'shreyas-iyer-kkr',
    teamId: 'kkr',
    name: 'Shreyas Iyer',
    country: 'India',
    role: 'Batsman',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm medium',
    age: 29,
    matches: 115,
    runs: 3243,
    wickets: 0,
    description:
      "Shreyas Iyer is a technically sound middle-order batsman with the ability to accelerate when needed. Under his captaincy KKR lifted their third IPL title in 2024, ending a decade-long wait. Shreyas is known for his clean hitting down the ground and match-winning knocks in high-pressure knockouts.",
    image: '/images/players/shreyas-iyer.jpg',
  },
  {
    id: 'varun-chakravarthy-kkr',
    teamId: 'kkr',
    name: 'Varun Chakravarthy',
    country: 'India',
    role: 'Bowler',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm mystery spin',
    age: 32,
    matches: 60,
    runs: 45,
    wickets: 81,
    description:
      "Varun Chakravarthy is one of the most intriguing mystery spinners in Indian cricket, capable of bowling multiple variations — carrom ball, googly, top-spinner — all from the same action. His exceptional form for KKR in the 2024 IPL, where he was the joint-leading wicket-taker, earned him a return to the Indian T20 national side.",
    image: '/images/players/varun-chakravarthy.jpg',
  },

  // ══════════════════════════════════════════
  // SRH — Sunrisers Hyderabad  (teamId: 'srh')
  // ══════════════════════════════════════════

  {
    id: 'pat-cummins-srh',
    teamId: 'srh',
    name: 'Pat Cummins',
    country: 'Australia',
    role: 'Bowler',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm fast',
    age: 31,
    matches: 45,
    runs: 280,
    wickets: 56,
    description:
      "Pat Cummins is the captain of both Australia and SRH, and the world's top-ranked Test bowler. He holds the record for the highest IPL auction price — fetching Rs 20.5 crore in 2024. He delivers crucial wickets in powerplay and death phases with ice-cool consistency and genuine express pace.",
    image: '/images/players/pat-cummins.jpg',
  },
  {
    id: 'travis-head-srh',
    teamId: 'srh',
    name: 'Travis Head',
    country: 'Australia',
    role: 'Batsman',
    battingStyle: 'Left-handed',
    bowlingStyle: 'Right-arm off-break',
    age: 30,
    matches: 38,
    runs: 1322,
    wickets: 5,
    description:
      "Travis Head has become one of the most feared openers in T20 cricket after destructive performances for SRH in the 2024 IPL. His left-handed aggressive approach with a strike rate regularly exceeding 175 makes him one of the most exciting batsmen in the format. He was also the hero of Australia's 2023 ODI World Cup final with a match-winning century.",
    image: '/images/players/travis-head.jpg',
  },
  {
    id: 'heinrich-klaasen-srh',
    teamId: 'srh',
    name: 'Heinrich Klaasen',
    country: 'South Africa',
    role: 'Wicketkeeper-Batsman',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm medium',
    age: 33,
    matches: 55,
    runs: 1788,
    wickets: 0,
    description:
      "Heinrich Klaasen is one of the most explosive middle-order finishers in T20 cricket. He scored a brilliant century as part of SRH's record-breaking 287/3 in the 2024 IPL. He also produced a spectacular 76 off 52 balls for South Africa against India in the 2024 T20 World Cup semi-final, nearly pulling off an impossible chase.",
    image: '/images/players/heinrich-klaasen.jpg',
  },
  {
    id: 'bhuvneshwar-kumar-srh',
    teamId: 'srh',
    name: 'Bhuvneshwar Kumar',
    country: 'India',
    role: 'Bowler',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm medium-fast',
    age: 34,
    matches: 162,
    runs: 475,
    wickets: 181,
    description:
      "Bhuvneshwar Kumar is one of the greatest swing bowlers in Indian cricket history, moving the ball both ways with pinpoint accuracy. A foundational player for SRH since their inception, Bhuvi is especially effective in the powerplay and death overs. He is also a capable lower-order batsman who has rescued India in several tight finishes.",
    image: '/images/players/bhuvneshwar-kumar.jpg',
  },

  // ══════════════════════════════════════════
  // PSL — Karachi Kings  (teamId: 'karachi-kings')
  // ══════════════════════════════════════════

  {
    id: 'babar-azam-kk',
    teamId: 'karachi-kings',
    name: 'Babar Azam',
    country: 'Pakistan',
    role: 'Batsman',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm medium',
    age: 29,
    matches: 95,
    runs: 2913,
    wickets: 0,
    description:
      "Babar Azam is Pakistan's premier batsman and a former top-ranked batsman across all three formats simultaneously — a rare feat in international cricket. Known for his classical elegance and ability to build innings under pressure, Babar is the backbone of both Pakistan and Karachi Kings. His cover drive is considered one of the most aesthetically pleasing shots in contemporary cricket.",
    image: '/images/players/babar-azam.jpg',
  },
  {
    id: 'imad-wasim-kk',
    teamId: 'karachi-kings',
    name: 'Imad Wasim',
    country: 'Pakistan',
    role: 'All-rounder',
    battingStyle: 'Left-handed',
    bowlingStyle: 'Left-arm orthodox spin',
    age: 35,
    matches: 90,
    runs: 1210,
    wickets: 85,
    description:
      "Imad Wasim is a vital cog in Karachi Kings' line-up as a left-arm spinner highly effective in T20 cricket and a capable left-handed middle-order batsman. He was Karachi Kings' captain when they won the PSL title in 2020, bringing calm tactical leadership to the franchise.",
    image: '/images/players/imad-wasim.jpg',
  },
  {
    id: 'sharjeel-khan-kk',
    teamId: 'karachi-kings',
    name: 'Sharjeel Khan',
    country: 'Pakistan',
    role: 'Batsman',
    battingStyle: 'Left-handed',
    bowlingStyle: 'Right-arm off-break',
    age: 34,
    matches: 65,
    runs: 1650,
    wickets: 0,
    description:
      "Sharjeel Khan is one of the most destructive left-handed openers in PSL history, capable of annihilating opposition attacks in the powerplay with aggressive hitting over extra cover and through the leg side. After returning from a ban, he reclaimed his place as one of Pakistan's most feared white-ball openers.",
    image: '/images/players/sharjeel-khan.jpg',
  },

  // ══════════════════════════════════════════
  // PSL — Lahore Qalandars  (teamId: 'lahore-qalandars')
  // ══════════════════════════════════════════

  {
    id: 'shaheen-afridi-lq',
    teamId: 'lahore-qalandars',
    name: 'Shaheen Shah Afridi',
    country: 'Pakistan',
    role: 'Bowler',
    battingStyle: 'Left-handed',
    bowlingStyle: 'Left-arm fast',
    age: 24,
    matches: 55,
    runs: 125,
    wickets: 72,
    description:
      "Shaheen Shah Afridi is Pakistan's most fearsome fast bowler and one of the premier left-arm pacers in world cricket. At just 24, he has already established himself as a match-winner in all three formats, swinging the new ball prodigiously and bowling an unplayable inswinging yorker. He is the captain and heartbeat of Lahore Qalandars' back-to-back PSL title-winning campaigns.",
    image: '/images/players/shaheen-afridi.jpg',
  },
  {
    id: 'fakhar-zaman-lq',
    teamId: 'lahore-qalandars',
    name: 'Fakhar Zaman',
    country: 'Pakistan',
    role: 'Batsman',
    battingStyle: 'Left-handed',
    bowlingStyle: 'Right-arm medium',
    age: 34,
    matches: 83,
    runs: 2307,
    wickets: 0,
    description:
      "Fakhar Zaman is one of Pakistan's most explosive and popular opening batsmen, famous for his high-risk, high-reward approach. He scored Pakistan's first-ever ODI double century (210* against Zimbabwe in 2018) and is a consistent powerplay threat for Lahore Qalandars. Fakhar uses strong wrists to produce unusual and powerful shots from virtually any delivery.",
    image: '/images/players/fakhar-zaman.jpg',
  },
  {
    id: 'rashid-khan-lq',
    teamId: 'lahore-qalandars',
    name: 'Rashid Khan',
    country: 'Afghanistan',
    role: 'All-rounder',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm leg-break',
    age: 25,
    matches: 110,
    runs: 1050,
    wickets: 158,
    description:
      "Rashid Khan is arguably the best T20 bowler in the world, a right-arm leg-spinner who bowls with exceptional accuracy, sharp turn, and his googly at near-medium pace without any visible change in action. Playing in seven global T20 leagues, Rashid is a prized asset in franchise cricket worldwide and Afghanistan's talisman across all formats.",
    image: '/images/players/rashid-khan.jpg',
  },

  // ══════════════════════════════════════════
  // PSL — Islamabad United  (teamId: 'islamabad-united')
  // ══════════════════════════════════════════

  {
    id: 'shadab-khan-iu',
    teamId: 'islamabad-united',
    name: 'Shadab Khan',
    country: 'Pakistan',
    role: 'All-rounder',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm leg-break',
    age: 25,
    matches: 80,
    runs: 1102,
    wickets: 92,
    description:
      "Shadab Khan is the captain of Islamabad United and Pakistan's premier leg-spin all-rounder. A genuine wicket-taker at any stage of a T20 innings, Shadab combines sharp leg-break and googly variations with hard-hitting lower-order batting. He was instrumental in both of Islamabad United's PSL title-winning campaigns.",
    image: '/images/players/shadab-khan.jpg',
  },
  {
    id: 'alex-hales-iu',
    teamId: 'islamabad-united',
    name: 'Alex Hales',
    country: 'England',
    role: 'Batsman',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm medium',
    age: 35,
    matches: 70,
    runs: 2030,
    wickets: 0,
    description:
      "Alex Hales is an aggressive right-handed opening batsman and one of the most prolific run-scorers in T20 franchise cricket worldwide. His partnership with Shadab Khan helped Islamabad United win the 2023 PSL title. Hales brings unmatched powerplay destruction with towering sixes over long-on and the ability to set the tempo from the first ball.",
    image: '/images/players/alex-hales.jpg',
  },
  {
    id: 'naseem-shah-iu',
    teamId: 'islamabad-united',
    name: 'Naseem Shah',
    country: 'Pakistan',
    role: 'Bowler',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm fast',
    age: 21,
    matches: 40,
    runs: 88,
    wickets: 47,
    description:
      "Naseem Shah is one of Pakistan's brightest fast-bowling prospects, possessing genuine raw pace at just 21 and an ability to nip the ball off the pitch. He famously hit two sixes off the last two balls to win an Asia Cup match for Pakistan against Afghanistan in 2022, and continues to develop rapidly for Islamabad United in the PSL.",
    image: '/images/players/naseem-shah.jpg',
  },

  // ══════════════════════════════════════════
  // BBL — Sydney Sixers  (teamId: 'sydney-sixers')
  // ══════════════════════════════════════════

  {
    id: 'moises-henriques-ss',
    teamId: 'sydney-sixers',
    name: 'Moises Henriques',
    country: 'Australia',
    role: 'All-rounder',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm medium-fast',
    age: 37,
    matches: 110,
    runs: 2380,
    wickets: 95,
    description:
      "Moises Henriques is the experienced captain and heartbeat of Sydney Sixers, having played for the franchise since the very first BBL season. A versatile right-hand bat and medium-pacer, Henriques led the Sixers to back-to-back titles in BBL|09 and BBL|10. His calm leadership and ability to contribute in both departments make him one of the BBL's most reliable performers.",
    image: '/images/players/moises-henriques.jpg',
  },
  {
    id: 'josh-hazlewood-ss',
    teamId: 'sydney-sixers',
    name: 'Josh Hazlewood',
    country: 'Australia',
    role: 'Bowler',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm fast-medium',
    age: 33,
    matches: 50,
    runs: 45,
    wickets: 68,
    description:
      "Josh Hazlewood is one of Australia's most consistent pace bowlers, known for impeccable line and length and the ability to swing the ball relentlessly. A key part of Australia's feared pace trio alongside Cummins and Starc, Hazlewood brings T20 expertise to Sydney Sixers with tight spells in both the powerplay and at the death.",
    image: '/images/players/josh-hazlewood.jpg',
  },
  {
    id: 'dan-christian-ss',
    teamId: 'sydney-sixers',
    name: 'Dan Christian',
    country: 'Australia',
    role: 'All-rounder',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm medium-fast',
    age: 41,
    matches: 130,
    runs: 1820,
    wickets: 110,
    description:
      "Dan Christian is a veteran T20 franchise all-rounder who has played in cricket leagues around the world, earning a reputation as one of the most reliable death bowlers and hard-hitting lower-order batsmen. His death-over economy rate is among the best in BBL history and his vast experience is a key leadership resource for the Sixers.",
    image: '/images/players/dan-christian.jpg',
  },

  // ══════════════════════════════════════════
  // BBL — Perth Scorchers  (teamId: 'perth-scorchers')
  // ══════════════════════════════════════════

  {
    id: 'ashton-turner-ps',
    teamId: 'perth-scorchers',
    name: 'Ashton Turner',
    country: 'Australia',
    role: 'Batsman',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm off-break',
    age: 31,
    matches: 88,
    runs: 2200,
    wickets: 22,
    description:
      "Ashton Turner is the captain of Perth Scorchers and a charismatic attacking middle-order batsman, who became a household name after his astonishing 84 off 43 balls to help Australia chase 359 against India in 2019. Under Turner the Scorchers have maintained their status as one of the BBL's most consistent sides.",
    image: '/images/players/ashton-turner.jpg',
  },
  {
    id: 'mitchell-marsh-ps',
    teamId: 'perth-scorchers',
    name: 'Mitchell Marsh',
    country: 'Australia',
    role: 'All-rounder',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm fast-medium',
    age: 32,
    matches: 72,
    runs: 1780,
    wickets: 48,
    description:
      "Mitchell Marsh is one of Australia's premier T20 all-rounders — a powerful right-hand batsman and useful right-arm seam bowler who delivers match-winning performances. He is consistently one of the most impactful batsmen in the BBL for Perth Scorchers and was a key contributor to Australia's multiple ICC title campaigns.",
    image: '/images/players/mitchell-marsh.jpg',
  },
  {
    id: 'andrew-tye-ps',
    teamId: 'perth-scorchers',
    name: 'Andrew Tye',
    country: 'Australia',
    role: 'Bowler',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm medium-fast',
    age: 37,
    matches: 85,
    runs: 120,
    wickets: 105,
    description:
      "Andrew Tye is one of the BBL's most experienced and crafty death bowlers, renowned for his knuckleball, slower ball, and well-disguised variations that consistently outfox batsmen in the final overs. He was the BBL's leading wicket-taker on multiple occasions and a mainstay of Perth Scorchers' dominant bowling attack across title campaigns.",
    image: '/images/players/andrew-tye.jpg',
  },

  // ══════════════════════════════════════════
  // BBL — Melbourne Stars  (teamId: 'melbourne-stars')
  // ══════════════════════════════════════════

  {
    id: 'glenn-maxwell-stars',
    teamId: 'melbourne-stars',
    name: 'Glenn Maxwell',
    country: 'Australia',
    role: 'All-rounder',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm off-break',
    age: 36,
    matches: 80,
    runs: 2105,
    wickets: 48,
    description:
      "Glenn Maxwell is the Melbourne Stars' captain and most high-profile star, widely considered one of the most entertaining cricketers in the world due to his extraordinary range of unconventional shots. Despite the Stars' title drought, Maxwell consistently delivers explosive performances at the MCG — one of the most iconic venues in world sport.",
    image: '/images/players/glenn-maxwell-stars.jpg',
  },
  {
    id: 'marcus-stoinis-stars',
    teamId: 'melbourne-stars',
    name: 'Marcus Stoinis',
    country: 'Australia',
    role: 'All-rounder',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm fast-medium',
    age: 34,
    matches: 90,
    runs: 2420,
    wickets: 72,
    description:
      "Marcus Stoinis is a powerful right-handed all-rounder equally at home opening or finishing an innings. His exceptional athleticism in the field complements his aggressive batting and useful right-arm seam bowling. His partnership with Maxwell provides Melbourne Stars with their most potent batting threat.",
    image: '/images/players/marcus-stoinis.jpg',
  },
  {
    id: 'hilton-cartwright-stars',
    teamId: 'melbourne-stars',
    name: 'Hilton Cartwright',
    country: 'Australia',
    role: 'All-rounder',
    battingStyle: 'Right-handed',
    bowlingStyle: 'Right-arm fast-medium',
    age: 31,
    matches: 65,
    runs: 1380,
    wickets: 42,
    description:
      "Hilton Cartwright is a reliable and consistent all-rounder for Melbourne Stars, providing valuable middle-order batting depth and economical fast-medium bowling through the middle overs. Born in Zimbabwe and raised in Western Australia, Cartwright has represented Australia internationally and is a technically sound contributor across both departments.",
    image: '/images/players/hilton-cartwright.jpg',
  },

] satisfies Cricketer[];
