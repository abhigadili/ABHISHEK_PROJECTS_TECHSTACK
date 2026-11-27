/**
 * ============================================================
 * Cricket Universe Explorer — Teams Data
 * ============================================================
 *
 * Coverage:
 *   IPL   — 5 teams (csk, mi, rcb, kkr, srh)
 *   PSL   — 3 teams (karachi-kings, lahore-qalandars, islamabad-united)
 *   BBL   — 3 teams (sydney-sixers, perth-scorchers, melbourne-stars)
 *   SA20  — 3 teams (mi-cape-town, paarl-royals, sunrisers-eastern-cape)
 *
 * Each team's `leagueId` must match a League.id in leagues.ts.
 *
 * Interview tip: Keeping team IDs human-readable ('csk', 'mi')
 *   rather than auto-incremented integers makes URLs more
 *   meaningful (/teams/csk) and debugging easier — you can
 *   tell at a glance which team a record belongs to.
 *
 * Next.js best practice: Dynamic route segments ([id]) in
 *   Next.js App Router map directly to these id values.
 *   E.g., /teams/csk renders the page for Chennai Super Kings.
 * ============================================================
 */

import type { Team } from '@/types';

export const teams: Team[] = [

  // ══════════════════════════════════════════
  // IPL — Indian Premier League  (leagueId: 'ipl')
  // ══════════════════════════════════════════

  {
    id: 'csk',
    leagueId: 'ipl',
    name: 'Chennai Super Kings',
    captain: 'Ruturaj Gaikwad',
    coach: 'Stephen Fleming',
    homeGround: 'MA Chidambaram Stadium, Chennai',
    titles: 5,
    logo: '/images/teams/csk.png',
    description:
      'Chennai Super Kings are one of the most successful and beloved franchises in IPL history, having won the title five times (2010, 2011, 2018, 2021, 2023). Known as the "Yellow Army", CSK is famous for their calm, experience-driven approach under former captain MS Dhoni, their unwavering loyalty to core players, and their record of reaching the playoffs in almost every season they have competed.',
  },
  {
    id: 'mi',
    leagueId: 'ipl',
    name: 'Mumbai Indians',
    captain: 'Hardik Pandya',
    coach: 'Mark Boucher',
    homeGround: 'Wankhede Stadium, Mumbai',
    titles: 5,
    logo: '/images/teams/mi.png',
    description:
      "Mumbai Indians are the most successful franchise in IPL history, having lifted the title five times (2013, 2015, 2017, 2019, 2020). Owned by Reliance Industries, MI have built a reputation for exceptional player development, producing stars like Rohit Sharma, Jasprit Bumrah, and Hardik Pandya. Their fan base — the 'Paltan' — is one of the largest in world sport.",
  },
  {
    id: 'rcb',
    leagueId: 'ipl',
    name: 'Royal Challengers Bengaluru',
    captain: 'Faf du Plessis',
    coach: 'Andy Flower',
    homeGround: 'M. Chinnaswamy Stadium, Bengaluru',
    titles: 1,
    logo: '/images/teams/rcb.png',
    description:
      "Royal Challengers Bengaluru are one of the IPL's most popular franchises, known for their passionate fan base ('RCB Army') and their ability to attract world-class batting talent including Virat Kohli and AB de Villiers. After years of near-misses, RCB finally broke their title drought to lift the IPL trophy in 2024 under captain Faf du Plessis.",
  },
  {
    id: 'kkr',
    leagueId: 'ipl',
    name: 'Kolkata Knight Riders',
    captain: 'Shreyas Iyer',
    coach: 'Chandrakant Pandit',
    homeGround: 'Eden Gardens, Kolkata',
    titles: 3,
    logo: '/images/teams/kkr.png',
    description:
      "Kolkata Knight Riders, co-owned by Bollywood superstar Shah Rukh Khan, are a three-time IPL champions (2012, 2014, 2024). Eden Gardens — their home ground and the largest cricket stadium in India — provides one of the most electric atmospheres in world cricket. KKR are known for their roster of explosive power-hitters and mystery spinners.",
  },
  {
    id: 'srh',
    leagueId: 'ipl',
    name: 'Sunrisers Hyderabad',
    captain: 'Pat Cummins',
    coach: 'Daniel Vettori',
    homeGround: 'Rajiv Gandhi International Cricket Stadium, Hyderabad',
    titles: 1,
    logo: '/images/teams/srh.png',
    description:
      'Sunrisers Hyderabad won their maiden IPL title in 2016 under David Warner and have consistently been known for producing high scores and attacking batting. In their 2024 campaign they set multiple IPL records for big totals, showcasing the explosive potential of their batting line-up featuring Travis Head and Heinrich Klaasen.',
  },

  // ══════════════════════════════════════════
  // PSL — Pakistan Super League  (leagueId: 'psl')
  // ══════════════════════════════════════════

  {
    id: 'karachi-kings',
    leagueId: 'psl',
    name: 'Karachi Kings',
    captain: 'Babar Azam',
    coach: 'Mohammad Yousuf',
    homeGround: 'National Stadium, Karachi',
    titles: 1,
    logo: '/images/teams/karachi-kings.png',
    description:
      "Karachi Kings are the franchise representing Pakistan's largest city and cricket heartland. They won the PSL title in 2020 under Imad Wasim. Led by superstar batsman Babar Azam, the Kings are consistently one of the most followed franchises in the PSL and enjoy a fanatical support base in the city of Karachi.",
  },
  {
    id: 'lahore-qalandars',
    leagueId: 'psl',
    name: 'Lahore Qalandars',
    captain: 'Shaheen Afridi',
    coach: 'Aaqib Javed',
    homeGround: 'Gaddafi Stadium, Lahore',
    titles: 2,
    logo: '/images/teams/lahore-qalandars.png',
    description:
      'Lahore Qalandars have transformed from PSL underdogs to back-to-back champions (2022, 2023), driven by an outstanding team culture and prolific fast-bowling spearhead Shaheen Shah Afridi. Their elite academy programme has been widely praised for developing young Pakistani talent, and they play in front of passionate crowds at the iconic Gaddafi Stadium.',
  },
  {
    id: 'islamabad-united',
    leagueId: 'psl',
    name: 'Islamabad United',
    captain: 'Shadab Khan',
    coach: 'Mike Hesson',
    homeGround: 'Rawalpindi Cricket Stadium, Rawalpindi',
    titles: 2,
    logo: '/images/teams/islamabad-united.png',
    description:
      "Islamabad United were the inaugural PSL champions (2016) and won a second title in 2018, making them the most decorated franchise in PSL history alongside Lahore Qalandars. Known for their analytical, data-driven approach and smart player recruitment, United have consistently blended experienced internationals with talented young Pakistanis.",
  },

  // ══════════════════════════════════════════
  // BBL — Big Bash League  (leagueId: 'bbl')
  // ══════════════════════════════════════════

  {
    id: 'sydney-sixers',
    leagueId: 'bbl',
    name: 'Sydney Sixers',
    captain: 'Moises Henriques',
    coach: 'Greg Shipperd',
    homeGround: 'Sydney Cricket Ground, Sydney',
    titles: 4,
    logo: '/images/teams/sydney-sixers.png',
    description:
      'The Sydney Sixers are the most successful team in BBL history with four titles (BBL|02, BBL|09, BBL|10, BBL|12). Known as the Magenta, they combine experienced NSW players with savvy international recruits and are renowned for their strong team culture and consistent finals appearances every season.',
  },
  {
    id: 'perth-scorchers',
    leagueId: 'bbl',
    name: 'Perth Scorchers',
    captain: 'Ashton Turner',
    coach: 'Adam Voges',
    homeGround: 'Optus Stadium, Perth',
    titles: 4,
    logo: '/images/teams/perth-scorchers.png',
    description:
      'Perth Scorchers are tied with Sydney Sixers as the most decorated BBL franchise with four titles (BBL|02, BBL|03, BBL|06, BBL|11). The Scorchers are famous for their relentless pace attack, exemplary fielding, and the electric atmosphere at Optus Stadium in Perth, the largest cricket ground in Australia.',
  },
  {
    id: 'melbourne-stars',
    leagueId: 'bbl',
    name: 'Melbourne Stars',
    captain: 'Glenn Maxwell',
    coach: 'David Hussey',
    homeGround: 'Melbourne Cricket Ground, Melbourne',
    titles: 0,
    logo: '/images/teams/melbourne-stars.png',
    description:
      'Melbourne Stars play their home games at the iconic Melbourne Cricket Ground — the largest cricket venue in the world — in front of huge home crowds. Despite consistently fielding world-class players including Glenn Maxwell, they are famously yet to win the BBL title, making them one of the tournament\'s most intriguing stories.',
  },

  // ══════════════════════════════════════════
  // SA20 — South Africa  (leagueId: 'sa20')
  // ══════════════════════════════════════════

  {
    id: 'mi-cape-town',
    leagueId: 'sa20',
    name: 'MI Cape Town',
    captain: 'Kagiso Rabada',
    coach: 'Simon Katich',
    homeGround: 'Newlands Cricket Ground, Cape Town',
    titles: 1,
    logo: '/images/teams/mi-cape-town.png',
    description:
      'MI Cape Town are the SA20 franchise backed by the Mumbai Indians ownership group. Playing in the beautiful shadow of Table Mountain at Newlands, they won the inaugural SA20 title in 2023. The franchise blends South African pace-bowling firepower led by Kagiso Rabada with marquee international batting talent.',
  },
  {
    id: 'paarl-royals',
    leagueId: 'sa20',
    name: 'Paarl Royals',
    captain: 'David Miller',
    coach: 'Graeme Smith',
    homeGround: 'Boland Park, Paarl',
    titles: 1,
    logo: '/images/teams/paarl-royals.png',
    description:
      "Paarl Royals are affiliated with Rajasthan Royals from the IPL and carry forward that franchise's ethos of smart player identification and development. They won the SA20 title in 2024, with dangerous South African finisher David Miller leading the charge in a memorable final.",
  },
  {
    id: 'sunrisers-eastern-cape',
    leagueId: 'sa20',
    name: 'Sunrisers Eastern Cape',
    captain: 'Aiden Markram',
    coach: 'Rob Walter',
    homeGround: 'St George\'s Park, Gqeberha',
    titles: 1,
    logo: '/images/teams/sunrisers-eastern-cape.png',
    description:
      "Sunrisers Eastern Cape, backed by the Sunrisers Hyderabad ownership group, are one of the powerhouse franchises of SA20 cricket. The 2025 SA20 champions under Aiden Markram are known for their disciplined pace attack and experienced batting line-up that combines South African depth with quality international recruits.",
  },

] satisfies Team[];
