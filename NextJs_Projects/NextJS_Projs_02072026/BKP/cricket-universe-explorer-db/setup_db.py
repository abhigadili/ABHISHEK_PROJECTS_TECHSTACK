#!/usr/bin/env python3
"""
Cricket Universe Explorer — MySQL Database Setup Script
Creates tables and seeds all data for the cricket_universe database.
"""

import subprocess
import json
import sys


def q(s):
    """Escape and quote a string value for MySQL."""
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"


def run_sql(sql: str):
    proc = subprocess.run(
        ['mysql', '-h', 'localhost', '-P', '3306', '-u', 'abhig', '-pPass@123', '--default-character-set=utf8mb4'],
        input=sql,
        text=True,
        capture_output=True,
        encoding='utf-8',
    )
    if proc.returncode != 0:
        # Filter out the password warning
        err = '\n'.join(l for l in proc.stderr.splitlines() if 'password' not in l.lower())
        if err.strip():
            print(f"SQL Error:\n{err}", file=sys.stderr)
            sys.exit(1)


# ─── DDL ─────────────────────────────────────────────────────────────────────

DDL = """
USE cricket_universe;

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS loginusers (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL,
    email                 VARCHAR(255) NOT NULL UNIQUE,
    password_hash         VARCHAR(255) NOT NULL,
    role                  ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    is_active             TINYINT(1) NOT NULL DEFAULT 1,
    last_login            TIMESTAMP NULL DEFAULT NULL,
    refresh_token_hash    VARCHAR(64)  NULL DEFAULT NULL,
    refresh_token_expires TIMESTAMP    NULL DEFAULT NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS countries (
    id            VARCHAR(20)  PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    short_name    VARCHAR(10)  NOT NULL,
    flag          VARCHAR(20),
    description   TEXT,
    background    VARCHAR(255),
    established   INT,
    world_cups_won INT DEFAULT 0,
    board         VARCHAR(100),
    coach         VARCHAR(100),
    captain       VARCHAR(100),
    famous_players JSON,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leagues (
    id          VARCHAR(60)  PRIMARY KEY,
    country_id  VARCHAR(20)  NOT NULL,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    established INT,
    format      ENUM('Test','ODI','T20','First-Class','List-A') NOT NULL DEFAULT 'T20',
    trophy      VARCHAR(200),
    image       VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teams (
    id          VARCHAR(60)  PRIMARY KEY,
    league_id   VARCHAR(60)  NOT NULL,
    name        VARCHAR(200) NOT NULL,
    captain     VARCHAR(100),
    coach       VARCHAR(100),
    home_ground VARCHAR(200),
    titles      INT DEFAULT 0,
    logo        VARCHAR(255),
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cricketers (
    id            VARCHAR(100) PRIMARY KEY,
    team_id       VARCHAR(60)  NOT NULL,
    name          VARCHAR(100) NOT NULL,
    country       VARCHAR(100),
    role          ENUM('Batsman','Bowler','All-rounder','Wicketkeeper-Batsman','Wicketkeeper') NOT NULL DEFAULT 'Batsman',
    batting_style ENUM('Right-handed','Left-handed') NOT NULL DEFAULT 'Right-handed',
    bowling_style VARCHAR(100),
    age           INT,
    matches       INT DEFAULT 0,
    runs          INT DEFAULT 0,
    wickets       INT DEFAULT 0,
    description   TEXT,
    image         VARCHAR(255),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

# ─── Countries data ───────────────────────────────────────────────────────────

COUNTRIES = [
    {
        'id': 'ind',
        'name': 'India',
        'shortName': 'IND',
        'flag': '🇮🇳',
        'description': (
            'India is the most powerful nation in world cricket, home to the Board of Control for Cricket in India (BCCI) — the richest cricket board on the planet. '
            'The Indian Premier League (IPL), launched in 2008, revolutionised franchise cricket globally and made India the financial epicentre of the sport. '
            'The Men in Blue have won the ICC Cricket World Cup twice (1983 and 2011), and captured the T20 World Cup twice (2007 and 2024). '
            'With a fanbase surpassing a billion passionate supporters, every Indian match is a national event watched by millions across continents.'
        ),
        'background': '/images/countries/india-bg.jpg',
        'established': 1928,
        'worldCupsWon': 2,
        'board': 'BCCI',
        'coach': 'Gautam Gambhir',
        'captain': 'Rohit Sharma',
        'famousPlayers': ['Sachin Tendulkar', 'Rahul Dravid', 'Sourav Ganguly', 'Anil Kumble', 'MS Dhoni', 'Virat Kohli', 'Kapil Dev', 'Sunil Gavaskar'],
    },
    {
        'id': 'aus',
        'name': 'Australia',
        'shortName': 'AUS',
        'flag': '🇦🇺',
        'description': (
            'Australia is the most successful team in ICC Cricket World Cup history, having lifted the trophy a record six times (1987, 1999, 2003, 2007, 2015, and 2023). '
            'Cricket Australia oversees a rich domestic structure that includes the Sheffield Shield (First-Class), the Big Bash League (T20), and the Marsh Cup (List-A). '
            'The Australians are renowned for their aggressive brand of cricket, a formidable fast-bowling tradition, and a culture of producing world-class talent generation after generation. '
            'The Baggy Green cap remains one of the most coveted symbols in international sport.'
        ),
        'background': '/images/countries/australia-bg.jpg',
        'established': 1905,
        'worldCupsWon': 6,
        'board': 'Cricket Australia',
        'coach': 'Andrew McDonald',
        'captain': 'Pat Cummins',
        'famousPlayers': ['Don Bradman', 'Shane Warne', 'Glenn McGrath', 'Ricky Ponting', 'Adam Gilchrist', 'Steve Waugh', 'Matthew Hayden', 'Brett Lee'],
    },
    {
        'id': 'eng',
        'name': 'England',
        'shortName': 'ENG',
        'flag': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        'description': (
            "England is the birthplace of cricket — the sport was codified here in the 18th century, and the Laws of Cricket are still maintained by the MCC at Lord's in London. "
            "England have won the ICC Cricket World Cup three times: the 1979 Women's World Cup, the 2017 Women's World Cup, and a thrilling men's title in 2019 decided by a Super Over at Lord's. "
            'Under Ben Stokes and Brendon McCullum, England embraced "Bazball" — a positive, attacking approach that has revitalised Test cricket. '
            'The County Championship, spanning 18 counties, is one of the oldest and most competitive domestic structures in world cricket.'
        ),
        'background': '/images/countries/england-bg.jpg',
        'established': 1877,
        'worldCupsWon': 3,
        'board': 'ECB',
        'coach': 'Brendon McCullum',
        'captain': 'Ben Stokes',
        'famousPlayers': ['W.G. Grace', 'Ian Botham', 'Alastair Cook', 'Andrew Flintoff', 'James Anderson', 'Kevin Pietersen', 'Graeme Swann', 'Joe Root'],
    },
    {
        'id': 'pak',
        'name': 'Pakistan',
        'shortName': 'PAK',
        'flag': '🇵🇰',
        'description': (
            'Pakistan is one of the most exciting and unpredictable teams in world cricket, a side capable of beating anyone on any given day. '
            'The Pakistan Cricket Board (PCB) governs the sport in a country where cricket is a unifying national passion. '
            "Pakistan's finest hour came in the 1992 ICC Cricket World Cup, where Imran Khan led a spirited comeback campaign to lift the trophy in Melbourne. "
            'The Pakistan Super League (PSL), launched in 2016, has grown into a major T20 franchise competition, developing emerging domestic talent alongside global stars.'
        ),
        'background': '/images/countries/pakistan-bg.jpg',
        'established': 1948,
        'worldCupsWon': 1,
        'board': 'PCB',
        'coach': 'Gary Kirsten',
        'captain': 'Babar Azam',
        'famousPlayers': ['Imran Khan', 'Wasim Akram', 'Waqar Younis', 'Javed Miandad', 'Inzamam-ul-Haq', 'Shoaib Akhtar', 'Younis Khan', 'Shahid Afridi'],
    },
    {
        'id': 'sa',
        'name': 'South Africa',
        'shortName': 'SA',
        'flag': '🇿🇦',
        'description': (
            'South Africa — the Proteas — are perennial World Cup contenders who have narrowly missed ICC trophy glory on multiple occasions, most memorably in the dramatic 1999 semi-final tie against Australia. '
            'Cricket South Africa (CSA) reintegrated the national team into international cricket in 1992 after the end of apartheid-era isolation. '
            'The country boasts exceptional fast-bowling talent, powerful batting depth, and a fiercely competitive domestic structure. '
            'The SA20 franchise league, launched in January 2023, has rapidly become one of the most watched T20 competitions in the world.'
        ),
        'background': '/images/countries/south-africa-bg.jpg',
        'established': 1909,
        'worldCupsWon': 0,
        'board': 'CSA',
        'coach': 'Shukri Conrad',
        'captain': 'Temba Bavuma',
        'famousPlayers': ['Graeme Pollock', 'Barry Richards', 'Allan Donald', 'Hansie Cronje', 'Shaun Pollock', 'Jacques Kallis', 'AB de Villiers', 'Dale Steyn'],
    },
    {
        'id': 'nz',
        'name': 'New Zealand',
        'shortName': 'NZ',
        'flag': '🇳🇿',
        'description': (
            'New Zealand — the Black Caps — punch well above their weight for a nation of just five million people and are widely regarded as the most sporting team in world cricket. '
            'New Zealand Cricket (NZC) administers the game through the Plunket Shield, Ford Trophy, and Super Smash competitions. '
            'The Black Caps reached back-to-back ICC final appearances, winning the inaugural World Test Championship in 2021 by defeating India at Southampton. '
            'Under former captain Kane Williamson the team built an enduring reputation for disciplined, high-quality cricket and exemplary sportsmanship on the global stage.'
        ),
        'background': '/images/countries/new-zealand-bg.jpg',
        'established': 1894,
        'worldCupsWon': 0,
        'board': 'NZC',
        'coach': 'Gary Stead',
        'captain': 'Kane Williamson',
        'famousPlayers': ['Richard Hadlee', 'Martin Crowe', 'Stephen Fleming', 'Daniel Vettori', 'Brendon McCullum', 'Kane Williamson', 'Ross Taylor', 'Trent Boult'],
    },
]

# ─── Leagues data ─────────────────────────────────────────────────────────────

LEAGUES = [
    # India
    {'id': 'ipl', 'countryId': 'ind', 'name': 'Indian Premier League', 'established': 2008, 'format': 'T20', 'trophy': 'IPL Trophy', 'image': '/images/leagues/ipl.jpg',
     'description': "The IPL is the most watched and commercially valuable T20 franchise competition in the world, attracting top international talent to play alongside India's best. Founded in 2008 by the BCCI, the league transformed cricket into a premium entertainment product blending sport with Bollywood glamour."},
    {'id': 'ranji', 'countryId': 'ind', 'name': 'Ranji Trophy', 'established': 1934, 'format': 'First-Class', 'trophy': 'Ranji Trophy', 'image': '/images/leagues/ranji.jpg',
     'description': "The Ranji Trophy is India's premier First-Class domestic competition, named after cricketing legend K.S. Ranjitsinhji. Established in 1934, it is the backbone of Indian cricket providing a pathway for players to graduate into the national side. Teams represent states and zones across the country."},
    {'id': 'wpl', 'countryId': 'ind', 'name': "Women's Premier League", 'established': 2023, 'format': 'T20', 'trophy': 'WPL Trophy', 'image': '/images/leagues/wpl.jpg',
     'description': "The WPL is India's franchise T20 competition for women, launched in 2023 by the BCCI to mirror the success of the IPL. The league has provided a major platform for women cricketers to showcase their talent in front of packed stadiums and a global television audience."},
    {'id': 'smat', 'countryId': 'ind', 'name': 'Syed Mushtaq Ali Trophy', 'established': 2006, 'format': 'T20', 'trophy': 'Syed Mushtaq Ali Trophy', 'image': '/images/leagues/smat.jpg',
     'description': 'The Syed Mushtaq Ali Trophy (SMAT) is the national T20 tournament for Indian states, named after legendary Indian cricketer Syed Mushtaq Ali. It serves as the primary T20 feeder competition for the IPL auction pool and helps identify emerging domestic T20 specialists.'},
    {'id': 'duleep', 'countryId': 'ind', 'name': 'Duleep Trophy', 'established': 1961, 'format': 'First-Class', 'trophy': 'Duleep Trophy', 'image': '/images/leagues/duleep.jpg',
     'description': 'The Duleep Trophy is a prestigious First-Class competition where Indian players are divided into zonal teams — a crucial stepping stone for those aspiring to break into the Test national side. Named after the Jam Sahib of Nawanagar, K.S. Duleepsinhji, it has a rich history dating back to 1961.'},
    {'id': 'vijay-hazare', 'countryId': 'ind', 'name': 'Vijay Hazare Trophy', 'established': 2002, 'format': 'List-A', 'trophy': 'Vijay Hazare Trophy', 'image': '/images/leagues/vijay-hazare.jpg',
     'description': "The Vijay Hazare Trophy is India's flagship List-A / 50-over domestic competition, serving the same role for ODI cricket that the Ranji Trophy does for Test cricket. Named after India's legendary batsman Vijay Hazare, it allows states to compete at the one-day format and is key preparation for the national ODI team."},
    # Australia
    {'id': 'bbl', 'countryId': 'aus', 'name': 'Big Bash League', 'established': 2011, 'format': 'T20', 'trophy': 'Big Bash Trophy', 'image': '/images/leagues/bbl.jpg',
     'description': "The BBL is Australia's premier franchise T20 competition, launched in 2011 to replace the older state-based Twenty20 Big Bash. Known for its family-friendly atmosphere, innovative broadcast innovations, and consistently high match quality, it draws large crowds every Australian summer season."},
    {'id': 'wbbl', 'countryId': 'aus', 'name': "Women's Big Bash League", 'established': 2015, 'format': 'T20', 'trophy': 'WBBL Trophy', 'image': '/images/leagues/wbbl.jpg',
     'description': "The WBBL is the women's counterpart to the BBL and is widely regarded as the highest-quality women's T20 competition in the world, attracting the best female cricketers from every nation. Since its 2015 launch it has helped grow the women's game in Australia enormously."},
    {'id': 'sheffield-shield', 'countryId': 'aus', 'name': 'Sheffield Shield', 'established': 1892, 'format': 'First-Class', 'trophy': 'Sheffield Shield', 'image': '/images/leagues/sheffield-shield.jpg',
     'description': "The Sheffield Shield is Australia's oldest and most prestigious domestic First-Class competition, contested since 1892 between the six state teams. It is the primary breeding ground for Australian Test players and is considered one of the strongest First-Class competitions anywhere in the world."},
    {'id': 'marsh-cup', 'countryId': 'aus', 'name': 'Marsh Cup', 'established': 1969, 'format': 'List-A', 'trophy': 'Marsh Cup', 'image': '/images/leagues/marsh-cup.jpg',
     'description': "The Marsh Cup (formerly Matador BBQs One-Day Cup and Ford Ranger Cup) is Australia's domestic List-A competition, serving as the 50-over pathway for state players aspiring to represent Australia in ODIs. It provides valuable preparation ahead of international one-day series."},
    {'id': 'ncl-aus', 'countryId': 'aus', 'name': 'National Cricket League', 'established': 1969, 'format': 'List-A', 'trophy': 'National Cricket League Trophy', 'image': '/images/leagues/ncl-aus.jpg',
     'description': "The National Cricket League was the previous title of Australia's premier List-A domestic competition before it underwent rebrandings. It laid the structural foundation for what became the Marsh Cup and gave generations of Australian players vital 50-over experience."},
    {'id': 'premier-cricket-aus', 'countryId': 'aus', 'name': 'Premier Cricket', 'established': 1905, 'format': 'First-Class', 'trophy': 'Premier Cricket Shield', 'image': '/images/leagues/premier-cricket-aus.jpg',
     'description': 'Premier Cricket is the highest level of club cricket in each Australian state, acting as the entry point into the professional pathway. Many current BBL and Sheffield Shield players rose through Premier Cricket, making it an essential talent pipeline for Australian cricket.'},
    # England
    {'id': 'the-hundred', 'countryId': 'eng', 'name': 'The Hundred', 'established': 2021, 'format': 'T20', 'trophy': 'The Hundred Trophy', 'image': '/images/leagues/the-hundred.jpg',
     'description': "The Hundred is England's innovative 100-ball format franchise competition launched in 2021 by the ECB to attract a younger, broader audience to cricket. Eight city-based franchises compete in a fast, action-packed format with unique rules designed to make the game more accessible for first-time fans."},
    {'id': 'county-championship', 'countryId': 'eng', 'name': 'County Championship', 'established': 1890, 'format': 'First-Class', 'trophy': 'County Championship Trophy', 'image': '/images/leagues/county-championship.jpg',
     'description': 'The County Championship is one of the oldest domestic cricket competitions in the world, contested by the 18 first-class counties of England and Wales. Dating back to 1890, it is the pinnacle of First-Class cricket in England and the primary breeding ground for England Test players.'},
    {'id': 't20-blast', 'countryId': 'eng', 'name': 'T20 Blast', 'established': 2003, 'format': 'T20', 'trophy': 'T20 Blast Trophy', 'image': '/images/leagues/t20-blast.jpg',
     'description': "The T20 Blast is England's county-based T20 competition, the most widely attended domestic T20 tournament in England. The Blast consistently draws large local crowds and serves as a platform for international stars to compete alongside county regulars across the English summer."},
    {'id': 'one-day-cup', 'countryId': 'eng', 'name': 'One Day Cup', 'established': 1963, 'format': 'List-A', 'trophy': 'One Day Cup', 'image': '/images/leagues/one-day-cup.jpg',
     'description': 'The One Day Cup (previously the Royal London One-Day Cup) is the premier 50-over domestic competition for English counties, providing players with vital List-A experience. It acts as a developmental bridge between county cricket and international ODI cricket for England hopefuls.'},
    {'id': 'rhf-trophy', 'countryId': 'eng', 'name': 'Rachael Heyhoe Flint Trophy', 'established': 2020, 'format': 'List-A', 'trophy': 'Rachael Heyhoe Flint Trophy', 'image': '/images/leagues/rhf-trophy.jpg',
     'description': "The Rachael Heyhoe Flint Trophy is England's regional women's One Day competition, named in honour of the trailblazing England women's captain who helped establish the women's game internationally. It provides the primary List-A pathway for English women cricketers."},
    {'id': 'charlotte-edwards-cup', 'countryId': 'eng', 'name': 'Charlotte Edwards Cup', 'established': 2021, 'format': 'T20', 'trophy': 'Charlotte Edwards Cup', 'image': '/images/leagues/charlotte-edwards-cup.jpg',
     'description': "The Charlotte Edwards Cup is England's regional women's T20 competition, named after the legendary England Women's captain. Launched in 2021, it runs alongside The Hundred and provides a domestic T20 platform for aspiring English women cricketers."},
    # Pakistan
    {'id': 'psl', 'countryId': 'pak', 'name': 'Pakistan Super League', 'established': 2016, 'format': 'T20', 'trophy': 'PSL Trophy', 'image': '/images/leagues/psl.jpg',
     'description': "The PSL is Pakistan's marquee T20 franchise competition, launched in 2016, that has grown into one of the most entertaining and competitive leagues in the world. It returned cricket to Pakistan after years of security concerns and has produced a string of exciting young Pakistani talent alongside marquee international signings."},
    {'id': 'quaid-e-azam', 'countryId': 'pak', 'name': 'Quaid-e-Azam Trophy', 'established': 1953, 'format': 'First-Class', 'trophy': 'Quaid-e-Azam Trophy', 'image': '/images/leagues/quaid-e-azam.jpg',
     'description': "The Quaid-e-Azam Trophy is Pakistan's premier First-Class domestic competition, named after the nation's founder Mohammad Ali Jinnah. Contested between departmental and regional teams, it is the backbone of Pakistani red-ball cricket and the primary pathway to the Test national side."},
    {'id': 'national-t20-cup', 'countryId': 'pak', 'name': 'National T20 Cup', 'established': 2004, 'format': 'T20', 'trophy': 'National T20 Cup', 'image': '/images/leagues/national-t20-cup.jpg',
     'description': "Pakistan's National T20 Cup is the domestic T20 competition that serves as the feeder tournament for the PSL, helping scouts identify emerging T20 talent from across the country's provincial teams. It provides a vital platform for young players to showcase their skills in the shortest format."},
    {'id': 'pakistan-cup', 'countryId': 'pak', 'name': 'Pakistan Cup', 'established': 2016, 'format': 'List-A', 'trophy': 'Pakistan Cup', 'image': '/images/leagues/pakistan-cup.jpg',
     'description': "The Pakistan Cup is the country's premier List-A / 50-over domestic competition, contested between regional teams. It replicates the ODI format and is instrumental in preparing Pakistani players for international one-day cricket, providing consistent 50-over match experience."},
    {'id': 'pcb-womens-league', 'countryId': 'pak', 'name': "PCB Women's League", 'established': 2010, 'format': 'T20', 'trophy': "PCB Women's League Trophy", 'image': '/images/leagues/pcb-womens-league.jpg',
     'description': "The PCB Women's League is Pakistan's domestic cricket competition for women, administered by the Pakistan Cricket Board. The league plays a crucial role in developing female cricket talent in Pakistan and provides a structured competitive environment for women aspiring to represent the national team."},
    {'id': 'president-trophy', 'countryId': 'pak', 'name': 'President Trophy', 'established': 1953, 'format': 'First-Class', 'trophy': 'President Trophy', 'image': '/images/leagues/president-trophy.jpg',
     'description': "The President Trophy is Pakistan's oldest First-Class domestic competition for departmental teams, providing a second tier of red-ball cricket alongside the Quaid-e-Azam Trophy. It has historically been instrumental in giving Pakistan's departmental cricket structure a competitive annual championship."},
    # South Africa
    {'id': 'sa20', 'countryId': 'sa', 'name': 'SA20', 'established': 2023, 'format': 'T20', 'trophy': 'SA20 Trophy', 'image': '/images/leagues/sa20.jpg',
     'description': "South Africa's SA20 is a franchise T20 competition launched in January 2023, featuring six teams backed by IPL franchise owners. The league has quickly become one of the world's premier T20 competitions, showcasing South Africa's domestic talent alongside top international players."},
    {'id': 'csa-t20-challenge', 'countryId': 'sa', 'name': 'CSA T20 Challenge', 'established': 2003, 'format': 'T20', 'trophy': 'CSA T20 Challenge Trophy', 'image': '/images/leagues/csa-t20-challenge.jpg',
     'description': 'The CSA T20 Challenge is the provincial T20 competition in South Africa, contested between the six major provincial sides. It acts as a feeder competition for the SA20 and provides vital T20 experience for domestic players seeking franchise contracts and national team selection.'},
    {'id': 'csa-one-day-cup', 'countryId': 'sa', 'name': 'CSA One Day Cup', 'established': 1981, 'format': 'List-A', 'trophy': 'CSA One Day Cup', 'image': '/images/leagues/csa-one-day-cup.jpg',
     'description': "The CSA One Day Cup is South Africa's provincial 50-over competition, designed to prepare players for international ODI cricket. Contested between the six major provincial teams, it provides List-A cricket experience and serves as a key selection ground for the national ODI squad."},
    {'id': 'four-day-series', 'countryId': 'sa', 'name': 'Four Day Series', 'established': 2004, 'format': 'First-Class', 'trophy': 'Four Day Series Trophy', 'image': '/images/leagues/four-day-series.jpg',
     'description': "The Four Day Series is South Africa's premier First-Class domestic competition, replacing the Sunfoil Series. Contested between the six provincial sides over four-day matches, it is the backbone of South African red-ball cricket and the primary pathway to Test match selection."},
    {'id': 'provincial-t20', 'countryId': 'sa', 'name': 'Provincial T20', 'established': 2004, 'format': 'T20', 'trophy': 'Provincial T20 Trophy', 'image': '/images/leagues/provincial-t20.jpg',
     'description': "South Africa's Provincial T20 competition features the country's provincial sides competing at the sub-franchise level. It provides a broader pool of T20 talent from which CSA selectors and SA20 franchises can identify players for higher-level competitions."},
    {'id': 'womens-provincial-league', 'countryId': 'sa', 'name': "Women's Provincial League", 'established': 2000, 'format': 'T20', 'trophy': "Women's Provincial League Trophy", 'image': '/images/leagues/womens-provincial-league.jpg',
     'description': "The Women's Provincial League is South Africa's domestic cricket competition for women, providing competitive cricket at provincial level. It acts as the talent nursery for the Momentum Proteas (national women's team) and is vital to the long-term growth of women's cricket in the country."},
    # New Zealand
    {'id': 'super-smash', 'countryId': 'nz', 'name': 'Super Smash', 'established': 2005, 'format': 'T20', 'trophy': 'Super Smash Trophy', 'image': '/images/leagues/super-smash.jpg',
     'description': "The Super Smash is New Zealand's domestic T20 competition, featuring the six major associations. Played during the New Zealand summer, it provides high-quality domestic T20 cricket and acts as a feeder for the national T20 squad ahead of international tournaments."},
    {'id': 'plunket-shield', 'countryId': 'nz', 'name': 'Plunket Shield', 'established': 1906, 'format': 'First-Class', 'trophy': 'Plunket Shield', 'image': '/images/leagues/plunket-shield.jpg',
     'description': "The Plunket Shield is New Zealand's premier First-Class competition, one of the oldest in the Southern Hemisphere. Named after Lord Plunket, a former Governor-General of New Zealand, it has been contested since 1906 and is the key proving ground for Black Caps Test aspirants."},
    {'id': 'ford-trophy', 'countryId': 'nz', 'name': 'Ford Trophy', 'established': 1971, 'format': 'List-A', 'trophy': 'Ford Trophy', 'image': '/images/leagues/ford-trophy.jpg',
     'description': "The Ford Trophy is New Zealand's premier List-A / 50-over domestic competition for the six major associations. It mirrors the ODI format and provides essential preparation for New Zealand players targeting international one-day selection and the Cricket World Cup squad."},
    {'id': 'hjs', 'countryId': 'nz', 'name': 'Hallyburton Johnstone Shield', 'established': 1972, 'format': 'List-A', 'trophy': 'Hallyburton Johnstone Shield', 'image': '/images/leagues/hjs.jpg',
     'description': "The Hallyburton Johnstone Shield is New Zealand's premier domestic women's one-day competition, providing the 50-over pathway for women cricketers who aspire to represent the White Ferns. It is a cornerstone of the NZC women's cricket development pathway."},
    {'id': 'super-smash-women', 'countryId': 'nz', 'name': 'Dream11 Super Smash Women', 'established': 2005, 'format': 'T20', 'trophy': "Women's Super Smash Trophy", 'image': '/images/leagues/super-smash-women.jpg',
     'description': "The women's Super Smash is New Zealand's domestic T20 competition for women, providing a high-quality T20 platform for aspiring White Ferns players. It runs alongside the men's Super Smash and helps NZC identify and develop female T20 talent for international competitions."},
    {'id': 'hawke-cup', 'countryId': 'nz', 'name': 'Hawke Cup', 'established': 1910, 'format': 'First-Class', 'trophy': 'Hawke Cup', 'image': '/images/leagues/hawke-cup.jpg',
     'description': "The Hawke Cup is New Zealand's premier challenge cricket competition for minor associations, operating on a challenge system where the current holder defends against challenger associations. Named after Lord Hawke, it has been contested since 1910 and gives provincial talent vital first-class experience."},
]

# ─── Teams data ───────────────────────────────────────────────────────────────

TEAMS = [
    {'id': 'csk', 'leagueId': 'ipl', 'name': 'Chennai Super Kings', 'captain': 'Ruturaj Gaikwad', 'coach': 'Stephen Fleming', 'homeGround': 'MA Chidambaram Stadium, Chennai', 'titles': 5, 'logo': '/images/teams/csk.png',
     'description': 'Chennai Super Kings are one of the most successful and beloved franchises in IPL history, having won the title five times (2010, 2011, 2018, 2021, 2023). Known as the "Yellow Army", CSK is famous for their calm, experience-driven approach under former captain MS Dhoni, their unwavering loyalty to core players, and their record of reaching the playoffs in almost every season they have competed.'},
    {'id': 'mi', 'leagueId': 'ipl', 'name': 'Mumbai Indians', 'captain': 'Hardik Pandya', 'coach': 'Mark Boucher', 'homeGround': 'Wankhede Stadium, Mumbai', 'titles': 5, 'logo': '/images/teams/mi.png',
     'description': "Mumbai Indians are the most successful franchise in IPL history, having lifted the title five times (2013, 2015, 2017, 2019, 2020). Owned by Reliance Industries, MI have built a reputation for exceptional player development, producing stars like Rohit Sharma, Jasprit Bumrah, and Hardik Pandya. Their fan base — the 'Paltan' — is one of the largest in world sport."},
    {'id': 'rcb', 'leagueId': 'ipl', 'name': 'Royal Challengers Bengaluru', 'captain': 'Faf du Plessis', 'coach': 'Andy Flower', 'homeGround': 'M. Chinnaswamy Stadium, Bengaluru', 'titles': 1, 'logo': '/images/teams/rcb.png',
     'description': "Royal Challengers Bengaluru are one of the IPL's most popular franchises, known for their passionate fan base ('RCB Army') and their ability to attract world-class batting talent including Virat Kohli and AB de Villiers. After years of near-misses, RCB finally broke their title drought to lift the IPL trophy in 2024 under captain Faf du Plessis."},
    {'id': 'kkr', 'leagueId': 'ipl', 'name': 'Kolkata Knight Riders', 'captain': 'Shreyas Iyer', 'coach': 'Chandrakant Pandit', 'homeGround': 'Eden Gardens, Kolkata', 'titles': 3, 'logo': '/images/teams/kkr.png',
     'description': "Kolkata Knight Riders, co-owned by Bollywood superstar Shah Rukh Khan, are a three-time IPL champions (2012, 2014, 2024). Eden Gardens — their home ground and the largest cricket stadium in India — provides one of the most electric atmospheres in world cricket. KKR are known for their roster of explosive power-hitters and mystery spinners."},
    {'id': 'srh', 'leagueId': 'ipl', 'name': 'Sunrisers Hyderabad', 'captain': 'Pat Cummins', 'coach': 'Daniel Vettori', 'homeGround': 'Rajiv Gandhi International Cricket Stadium, Hyderabad', 'titles': 1, 'logo': '/images/teams/srh.png',
     'description': 'Sunrisers Hyderabad won their maiden IPL title in 2016 under David Warner and have consistently been known for producing high scores and attacking batting. In their 2024 campaign they set multiple IPL records for big totals, showcasing the explosive potential of their batting line-up featuring Travis Head and Heinrich Klaasen.'},
    {'id': 'karachi-kings', 'leagueId': 'psl', 'name': 'Karachi Kings', 'captain': 'Babar Azam', 'coach': 'Mohammad Yousuf', 'homeGround': 'National Stadium, Karachi', 'titles': 1, 'logo': '/images/teams/karachi-kings.png',
     'description': "Karachi Kings are the franchise representing Pakistan's largest city and cricket heartland. They won the PSL title in 2020 under Imad Wasim. Led by superstar batsman Babar Azam, the Kings are consistently one of the most followed franchises in the PSL and enjoy a fanatical support base in the city of Karachi."},
    {'id': 'lahore-qalandars', 'leagueId': 'psl', 'name': 'Lahore Qalandars', 'captain': 'Shaheen Afridi', 'coach': 'Aaqib Javed', 'homeGround': 'Gaddafi Stadium, Lahore', 'titles': 2, 'logo': '/images/teams/lahore-qalandars.png',
     'description': 'Lahore Qalandars have transformed from PSL underdogs to back-to-back champions (2022, 2023), driven by an outstanding team culture and prolific fast-bowling spearhead Shaheen Shah Afridi. Their elite academy programme has been widely praised for developing young Pakistani talent, and they play in front of passionate crowds at the iconic Gaddafi Stadium.'},
    {'id': 'islamabad-united', 'leagueId': 'psl', 'name': 'Islamabad United', 'captain': 'Shadab Khan', 'coach': 'Mike Hesson', 'homeGround': 'Rawalpindi Cricket Stadium, Rawalpindi', 'titles': 2, 'logo': '/images/teams/islamabad-united.png',
     'description': "Islamabad United were the inaugural PSL champions (2016) and won a second title in 2018, making them the most decorated franchise in PSL history alongside Lahore Qalandars. Known for their analytical, data-driven approach and smart player recruitment, United have consistently blended experienced internationals with talented young Pakistanis."},
    {'id': 'sydney-sixers', 'leagueId': 'bbl', 'name': 'Sydney Sixers', 'captain': 'Moises Henriques', 'coach': 'Greg Shipperd', 'homeGround': 'Sydney Cricket Ground, Sydney', 'titles': 4, 'logo': '/images/teams/sydney-sixers.png',
     'description': 'The Sydney Sixers are the most successful team in BBL history with four titles (BBL|02, BBL|09, BBL|10, BBL|12). Known as the Magenta, they combine experienced NSW players with savvy international recruits and are renowned for their strong team culture and consistent finals appearances every season.'},
    {'id': 'perth-scorchers', 'leagueId': 'bbl', 'name': 'Perth Scorchers', 'captain': 'Ashton Turner', 'coach': 'Adam Voges', 'homeGround': 'Optus Stadium, Perth', 'titles': 4, 'logo': '/images/teams/perth-scorchers.png',
     'description': 'Perth Scorchers are tied with Sydney Sixers as the most decorated BBL franchise with four titles (BBL|02, BBL|03, BBL|06, BBL|11). The Scorchers are famous for their relentless pace attack, exemplary fielding, and the electric atmosphere at Optus Stadium in Perth, the largest cricket ground in Australia.'},
    {'id': 'melbourne-stars', 'leagueId': 'bbl', 'name': 'Melbourne Stars', 'captain': 'Glenn Maxwell', 'coach': 'David Hussey', 'homeGround': 'Melbourne Cricket Ground, Melbourne', 'titles': 0, 'logo': '/images/teams/melbourne-stars.png',
     'description': "Melbourne Stars play their home games at the iconic Melbourne Cricket Ground — the largest cricket venue in the world — in front of huge home crowds. Despite consistently fielding world-class players including Glenn Maxwell, they are famously yet to win the BBL title, making them one of the tournament's most intriguing stories."},
    {'id': 'mi-cape-town', 'leagueId': 'sa20', 'name': 'MI Cape Town', 'captain': 'Kagiso Rabada', 'coach': 'Simon Katich', 'homeGround': 'Newlands Cricket Ground, Cape Town', 'titles': 1, 'logo': '/images/teams/mi-cape-town.png',
     'description': 'MI Cape Town are the SA20 franchise backed by the Mumbai Indians ownership group. Playing in the beautiful shadow of Table Mountain at Newlands, they won the inaugural SA20 title in 2023. The franchise blends South African pace-bowling firepower led by Kagiso Rabada with marquee international batting talent.'},
    {'id': 'paarl-royals', 'leagueId': 'sa20', 'name': 'Paarl Royals', 'captain': 'David Miller', 'coach': 'Graeme Smith', 'homeGround': 'Boland Park, Paarl', 'titles': 1, 'logo': '/images/teams/paarl-royals.png',
     'description': "Paarl Royals are affiliated with Rajasthan Royals from the IPL and carry forward that franchise's ethos of smart player identification and development. They won the SA20 title in 2024, with dangerous South African finisher David Miller leading the charge in a memorable final."},
    {'id': 'sunrisers-eastern-cape', 'leagueId': 'sa20', 'name': 'Sunrisers Eastern Cape', 'captain': 'Aiden Markram', 'coach': 'Rob Walter', 'homeGround': "St George's Park, Gqeberha", 'titles': 1, 'logo': '/images/teams/sunrisers-eastern-cape.png',
     'description': "Sunrisers Eastern Cape, backed by the Sunrisers Hyderabad ownership group, are one of the powerhouse franchises of SA20 cricket. The 2025 SA20 champions under Aiden Markram are known for their disciplined pace attack and experienced batting line-up that combines South African depth with quality international recruits."},
]

# ─── Cricketers data ──────────────────────────────────────────────────────────

CRICKETERS = [
    # CSK
    {'id': 'ms-dhoni-csk', 'teamId': 'csk', 'name': 'MS Dhoni', 'country': 'India', 'role': 'Wicketkeeper-Batsman', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm medium', 'age': 43, 'matches': 250, 'runs': 5082, 'wickets': 0, 'image': '/images/players/ms-dhoni.jpg',
     'description': "Mahendra Singh Dhoni is widely regarded as one of the greatest captains and finishers in cricket history. The 'Captain Cool' led India to three ICC trophies (2007 T20 WC, 2011 ODI WC, 2013 Champions Trophy) and CSK to five IPL titles. Renowned for his helicopter shot, ice-cold temperament under pressure, and lightning-fast stumpings, Dhoni is an icon of the modern game."},
    {'id': 'ruturaj-gaikwad-csk', 'teamId': 'csk', 'name': 'Ruturaj Gaikwad', 'country': 'India', 'role': 'Batsman', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm off-break', 'age': 27, 'matches': 80, 'runs': 2520, 'wickets': 0, 'image': '/images/players/ruturaj-gaikwad.jpg',
     'description': "Ruturaj Gaikwad is one of India's most exciting young batsmen, named the IPL's best young cricketer multiple times for his stylish, elegant technique. The CSK captain scored an outstanding 583 runs in the 2021 IPL season to win the Orange Cap, and has since established himself as a key figure in India's white-ball future."},
    {'id': 'deepak-chahar-csk', 'teamId': 'csk', 'name': 'Deepak Chahar', 'country': 'India', 'role': 'Bowler', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm medium-fast', 'age': 31, 'matches': 75, 'runs': 280, 'wickets': 78, 'image': '/images/players/deepak-chahar.jpg',
     'description': "Deepak Chahar is one of the most skilful powerplay bowlers in T20 cricket, renowned for swinging the new ball both ways. He is the only Indian bowler to take a hat-trick in T20 Internationals — his 6/7 against Bangladesh in 2019 remains the best T20I bowling figures by any Indian. His lower-order batting contributions are also invaluable for CSK."},
    {'id': 'ravindra-jadeja-csk', 'teamId': 'csk', 'name': 'Ravindra Jadeja', 'country': 'India', 'role': 'All-rounder', 'battingStyle': 'Left-handed', 'bowlingStyle': 'Left-arm orthodox spin', 'age': 35, 'matches': 230, 'runs': 2692, 'wickets': 132, 'image': '/images/players/ravindra-jadeja.jpg',
     'description': "Ravindra Jadeja is one of the most complete cricketers of his generation — a hard-hitting left-hand bat, reliable left-arm spinner, and one of the finest fielders in the history of the game. A key pillar of both CSK and the Indian national team across all formats, 'Sir Jadeja' (as fans call him) is known for his relentless work-rate and match-winning lower-order cameos."},
    # MI
    {'id': 'rohit-sharma-mi', 'teamId': 'mi', 'name': 'Rohit Sharma', 'country': 'India', 'role': 'Batsman', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm off-break', 'age': 37, 'matches': 243, 'runs': 6211, 'wickets': 15, 'image': '/images/players/rohit-sharma.jpg',
     'description': "Rohit Sharma is India's Test and ODI captain and the most prolific run-scorer in IPL history with over 6,000 runs. Known as the 'Hitman', Rohit is renowned for his effortless timing and powerful square cuts. He is the only batsman to have scored three ODI double hundreds and led Mumbai Indians to five IPL titles."},
    {'id': 'jasprit-bumrah-mi', 'teamId': 'mi', 'name': 'Jasprit Bumrah', 'country': 'India', 'role': 'Bowler', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm fast', 'age': 30, 'matches': 120, 'runs': 56, 'wickets': 145, 'image': '/images/players/jasprit-bumrah.jpg',
     'description': "Jasprit Bumrah is widely considered the best fast bowler in the world across all formats, remarkable for his unorthodox action, yorker accuracy, and sharp pace from a short run-up. He consistently leads India's pace attack across Tests, ODIs, and T20Is and was named Player of the Series in the 2024 India tour of Australia."},
    {'id': 'suryakumar-yadav-mi', 'teamId': 'mi', 'name': 'Suryakumar Yadav', 'country': 'India', 'role': 'Batsman', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm medium', 'age': 34, 'matches': 130, 'runs': 3190, 'wickets': 3, 'image': '/images/players/suryakumar-yadav.jpg',
     'description': "Suryakumar Yadav — 'SKY' — is the number-one ranked T20 International batsman in the world, famous for his 360-degree stroke play and ability to hit into non-traditional areas of the field. SKY made a stunning boundary catch in the 2024 T20 World Cup final that helped India clinch the title."},
    {'id': 'hardik-pandya-mi', 'teamId': 'mi', 'name': 'Hardik Pandya', 'country': 'India', 'role': 'All-rounder', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm fast-medium', 'age': 31, 'matches': 115, 'runs': 2100, 'wickets': 65, 'image': '/images/players/hardik-pandya.jpg',
     'description': "Hardik Pandya is one of the most impactful all-rounders in world T20 cricket — a destructive middle-order batsman capable of clearing the largest grounds, and a sharp right-arm pacer who can bowl at 140+ km/h. He played a pivotal role in India's 2024 T20 World Cup triumph with vital bowling contributions in the final."},
    # RCB
    {'id': 'virat-kohli-rcb', 'teamId': 'rcb', 'name': 'Virat Kohli', 'country': 'India', 'role': 'Batsman', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm medium', 'age': 35, 'matches': 237, 'runs': 7263, 'wickets': 4, 'image': '/images/players/virat-kohli.jpg',
     'description': "Virat Kohli is the all-time leading run-scorer in IPL history and one of the greatest batsmen of the modern era across all formats. Known for his immense passion, fitness, and ability to chase targets, Kohli has scored over 7,000 IPL runs including the only century scored in an IPL final."},
    {'id': 'ab-de-villiers-rcb', 'teamId': 'rcb', 'name': 'AB de Villiers', 'country': 'South Africa', 'role': 'Wicketkeeper-Batsman', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm medium', 'age': 40, 'matches': 184, 'runs': 5162, 'wickets': 0, 'image': '/images/players/ab-de-villiers.jpg',
     'description': "AB de Villiers — 'Mr 360' — is widely regarded as one of the greatest batsmen to ever play the game. Capable of playing any shot to any part of the ground, ABD played for RCB from 2011 to 2021, forming one of cricket's most devastating batting partnerships with Virat Kohli. Retired since 2021, his RCB legacy is unmatched."},
    {'id': 'glenn-maxwell-rcb', 'teamId': 'rcb', 'name': 'Glenn Maxwell', 'country': 'Australia', 'role': 'All-rounder', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm off-break', 'age': 36, 'matches': 115, 'runs': 2607, 'wickets': 35, 'image': '/images/players/glenn-maxwell.jpg',
     'description': "Glenn Maxwell is one of cricket's most destructive and innovative batsmen. The 'Big Show' is most famous for his remarkable 201* against Afghanistan at the 2023 ODI World Cup — scored while cramping — widely hailed as one of the greatest ODI innings ever. He brings explosive, unconventional batting and useful off-spin to RCB."},
    {'id': 'faf-du-plessis-rcb', 'teamId': 'rcb', 'name': 'Faf du Plessis', 'country': 'South Africa', 'role': 'Batsman', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm medium', 'age': 40, 'matches': 119, 'runs': 3415, 'wickets': 0, 'image': '/images/players/faf-du-plessis.jpg',
     'description': "Faf du Plessis is one of South Africa's finest modern batsmen, bringing elegance, experience, and match-winning ability to RCB as their captain. Known for his impeccable timing and 360-degree cricket, du Plessis was the key leader in RCB's long-awaited IPL title triumph."},
    # KKR
    {'id': 'andre-russell-kkr', 'teamId': 'kkr', 'name': 'Andre Russell', 'country': 'West Indies', 'role': 'All-rounder', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm fast-medium', 'age': 36, 'matches': 119, 'runs': 3006, 'wickets': 110, 'image': '/images/players/andre-russell.jpg',
     'description': "Andre Russell is one of the most feared match-winners in T20 cricket — an extraordinarily powerful batsman who can hit sixes off any bowler, and a right-arm pacer who generates genuine pace. 'Dre Russ' single-handedly won numerous matches for KKR from seemingly impossible situations."},
    {'id': 'sunil-narine-kkr', 'teamId': 'kkr', 'name': 'Sunil Narine', 'country': 'West Indies', 'role': 'All-rounder', 'battingStyle': 'Left-handed', 'bowlingStyle': 'Right-arm off-break', 'age': 36, 'matches': 177, 'runs': 1879, 'wickets': 177, 'image': '/images/players/sunil-narine.jpg',
     'description': "Sunil Narine is one of KKR's most influential players — an elite mystery spinner and a remarkably destructive pinch-hitter who transformed himself from lower-order hitter to explosive opener. His combination of miserly bowling and ferocious hitting makes him one of T20 cricket's most unique all-round assets."},
    {'id': 'shreyas-iyer-kkr', 'teamId': 'kkr', 'name': 'Shreyas Iyer', 'country': 'India', 'role': 'Batsman', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm medium', 'age': 29, 'matches': 115, 'runs': 3243, 'wickets': 0, 'image': '/images/players/shreyas-iyer.jpg',
     'description': "Shreyas Iyer is a technically sound middle-order batsman with the ability to accelerate when needed. Under his captaincy KKR lifted their third IPL title in 2024, ending a decade-long wait. Shreyas is known for his clean hitting down the ground and match-winning knocks in high-pressure knockouts."},
    {'id': 'varun-chakravarthy-kkr', 'teamId': 'kkr', 'name': 'Varun Chakravarthy', 'country': 'India', 'role': 'Bowler', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm mystery spin', 'age': 32, 'matches': 60, 'runs': 45, 'wickets': 81, 'image': '/images/players/varun-chakravarthy.jpg',
     'description': "Varun Chakravarthy is one of the most intriguing mystery spinners in Indian cricket, capable of bowling multiple variations — carrom ball, googly, top-spinner — all from the same action. His exceptional form for KKR in the 2024 IPL, where he was the joint-leading wicket-taker, earned him a return to the Indian T20 national side."},
    # SRH
    {'id': 'pat-cummins-srh', 'teamId': 'srh', 'name': 'Pat Cummins', 'country': 'Australia', 'role': 'Bowler', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm fast', 'age': 31, 'matches': 45, 'runs': 280, 'wickets': 56, 'image': '/images/players/pat-cummins.jpg',
     'description': "Pat Cummins is the captain of both Australia and SRH, and the world's top-ranked Test bowler. He holds the record for the highest IPL auction price — fetching Rs 20.5 crore in 2024. He delivers crucial wickets in powerplay and death phases with ice-cool consistency and genuine express pace."},
    {'id': 'travis-head-srh', 'teamId': 'srh', 'name': 'Travis Head', 'country': 'Australia', 'role': 'Batsman', 'battingStyle': 'Left-handed', 'bowlingStyle': 'Right-arm off-break', 'age': 30, 'matches': 38, 'runs': 1322, 'wickets': 5, 'image': '/images/players/travis-head.jpg',
     'description': "Travis Head has become one of the most feared openers in T20 cricket after destructive performances for SRH in the 2024 IPL. His left-handed aggressive approach with a strike rate regularly exceeding 175 makes him one of the most exciting batsmen in the format. He was also the hero of Australia's 2023 ODI World Cup final with a match-winning century."},
    {'id': 'heinrich-klaasen-srh', 'teamId': 'srh', 'name': 'Heinrich Klaasen', 'country': 'South Africa', 'role': 'Wicketkeeper-Batsman', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm medium', 'age': 33, 'matches': 55, 'runs': 1788, 'wickets': 0, 'image': '/images/players/heinrich-klaasen.jpg',
     'description': "Heinrich Klaasen is one of the most explosive middle-order finishers in T20 cricket. He scored a brilliant century as part of SRH's record-breaking 287/3 in the 2024 IPL. He also produced a spectacular 76 off 52 balls for South Africa against India in the 2024 T20 World Cup semi-final, nearly pulling off an impossible chase."},
    {'id': 'bhuvneshwar-kumar-srh', 'teamId': 'srh', 'name': 'Bhuvneshwar Kumar', 'country': 'India', 'role': 'Bowler', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm medium-fast', 'age': 34, 'matches': 162, 'runs': 475, 'wickets': 181, 'image': '/images/players/bhuvneshwar-kumar.jpg',
     'description': "Bhuvneshwar Kumar is one of the greatest swing bowlers in Indian cricket history, moving the ball both ways with pinpoint accuracy. A foundational player for SRH since their inception, Bhuvi is especially effective in the powerplay and death overs. He is also a capable lower-order batsman who has rescued India in several tight finishes."},
    # Karachi Kings
    {'id': 'babar-azam-kk', 'teamId': 'karachi-kings', 'name': 'Babar Azam', 'country': 'Pakistan', 'role': 'Batsman', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm medium', 'age': 29, 'matches': 95, 'runs': 2913, 'wickets': 0, 'image': '/images/players/babar-azam.jpg',
     'description': "Babar Azam is Pakistan's premier batsman and a former top-ranked batsman across all three formats simultaneously — a rare feat in international cricket. Known for his classical elegance and ability to build innings under pressure, Babar is the backbone of both Pakistan and Karachi Kings. His cover drive is considered one of the most aesthetically pleasing shots in contemporary cricket."},
    {'id': 'imad-wasim-kk', 'teamId': 'karachi-kings', 'name': 'Imad Wasim', 'country': 'Pakistan', 'role': 'All-rounder', 'battingStyle': 'Left-handed', 'bowlingStyle': 'Left-arm orthodox spin', 'age': 35, 'matches': 90, 'runs': 1210, 'wickets': 85, 'image': '/images/players/imad-wasim.jpg',
     'description': "Imad Wasim is a vital cog in Karachi Kings' line-up as a left-arm spinner highly effective in T20 cricket and a capable left-handed middle-order batsman. He was Karachi Kings' captain when they won the PSL title in 2020, bringing calm tactical leadership to the franchise."},
    {'id': 'sharjeel-khan-kk', 'teamId': 'karachi-kings', 'name': 'Sharjeel Khan', 'country': 'Pakistan', 'role': 'Batsman', 'battingStyle': 'Left-handed', 'bowlingStyle': 'Right-arm off-break', 'age': 34, 'matches': 65, 'runs': 1650, 'wickets': 0, 'image': '/images/players/sharjeel-khan.jpg',
     'description': "Sharjeel Khan is one of the most destructive left-handed openers in PSL history, capable of annihilating opposition attacks in the powerplay with aggressive hitting over extra cover and through the leg side. After returning from a ban, he reclaimed his place as one of Pakistan's most feared white-ball openers."},
    # Lahore Qalandars
    {'id': 'shaheen-afridi-lq', 'teamId': 'lahore-qalandars', 'name': 'Shaheen Shah Afridi', 'country': 'Pakistan', 'role': 'Bowler', 'battingStyle': 'Left-handed', 'bowlingStyle': 'Left-arm fast', 'age': 24, 'matches': 55, 'runs': 125, 'wickets': 72, 'image': '/images/players/shaheen-afridi.jpg',
     'description': "Shaheen Shah Afridi is Pakistan's most fearsome fast bowler and one of the premier left-arm pacers in world cricket. At just 24, he has already established himself as a match-winner in all three formats, swinging the new ball prodigiously and bowling an unplayable inswinging yorker. He is the captain and heartbeat of Lahore Qalandars' back-to-back PSL title-winning campaigns."},
    {'id': 'fakhar-zaman-lq', 'teamId': 'lahore-qalandars', 'name': 'Fakhar Zaman', 'country': 'Pakistan', 'role': 'Batsman', 'battingStyle': 'Left-handed', 'bowlingStyle': 'Right-arm medium', 'age': 34, 'matches': 83, 'runs': 2307, 'wickets': 0, 'image': '/images/players/fakhar-zaman.jpg',
     'description': "Fakhar Zaman is one of Pakistan's most explosive and popular opening batsmen, famous for his high-risk, high-reward approach. He scored Pakistan's first-ever ODI double century (210* against Zimbabwe in 2018) and is a consistent powerplay threat for Lahore Qalandars. Fakhar uses strong wrists to produce unusual and powerful shots from virtually any delivery."},
    {'id': 'rashid-khan-lq', 'teamId': 'lahore-qalandars', 'name': 'Rashid Khan', 'country': 'Afghanistan', 'role': 'All-rounder', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm leg-break', 'age': 25, 'matches': 110, 'runs': 1050, 'wickets': 158, 'image': '/images/players/rashid-khan.jpg',
     'description': "Rashid Khan is arguably the best T20 bowler in the world, a right-arm leg-spinner who bowls with exceptional accuracy, sharp turn, and his googly at near-medium pace without any visible change in action. Playing in seven global T20 leagues, Rashid is a prized asset in franchise cricket worldwide and Afghanistan's talisman across all formats."},
    # Islamabad United
    {'id': 'shadab-khan-iu', 'teamId': 'islamabad-united', 'name': 'Shadab Khan', 'country': 'Pakistan', 'role': 'All-rounder', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm leg-break', 'age': 25, 'matches': 80, 'runs': 1102, 'wickets': 92, 'image': '/images/players/shadab-khan.jpg',
     'description': "Shadab Khan is the captain of Islamabad United and Pakistan's premier leg-spin all-rounder. A genuine wicket-taker at any stage of a T20 innings, Shadab combines sharp leg-break and googly variations with hard-hitting lower-order batting. He was instrumental in both of Islamabad United's PSL title-winning campaigns."},
    {'id': 'alex-hales-iu', 'teamId': 'islamabad-united', 'name': 'Alex Hales', 'country': 'England', 'role': 'Batsman', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm medium', 'age': 35, 'matches': 70, 'runs': 2030, 'wickets': 0, 'image': '/images/players/alex-hales.jpg',
     'description': "Alex Hales is an aggressive right-handed opening batsman and one of the most prolific run-scorers in T20 franchise cricket worldwide. His partnership with Shadab Khan helped Islamabad United win the 2023 PSL title. Hales brings unmatched powerplay destruction with towering sixes over long-on and the ability to set the tempo from the first ball."},
    {'id': 'naseem-shah-iu', 'teamId': 'islamabad-united', 'name': 'Naseem Shah', 'country': 'Pakistan', 'role': 'Bowler', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm fast', 'age': 21, 'matches': 40, 'runs': 88, 'wickets': 47, 'image': '/images/players/naseem-shah.jpg',
     'description': "Naseem Shah is one of Pakistan's brightest fast-bowling prospects, possessing genuine raw pace at just 21 and an ability to nip the ball off the pitch. He famously hit two sixes off the last two balls to win an Asia Cup match for Pakistan against Afghanistan in 2022, and continues to develop rapidly for Islamabad United in the PSL."},
    # Sydney Sixers
    {'id': 'moises-henriques-ss', 'teamId': 'sydney-sixers', 'name': 'Moises Henriques', 'country': 'Australia', 'role': 'All-rounder', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm medium-fast', 'age': 37, 'matches': 110, 'runs': 2380, 'wickets': 95, 'image': '/images/players/moises-henriques.jpg',
     'description': "Moises Henriques is the experienced captain and heartbeat of Sydney Sixers, having played for the franchise since the very first BBL season. A versatile right-hand bat and medium-pacer, Henriques led the Sixers to back-to-back titles in BBL|09 and BBL|10. His calm leadership and ability to contribute in both departments make him one of the BBL's most reliable performers."},
    {'id': 'josh-hazlewood-ss', 'teamId': 'sydney-sixers', 'name': 'Josh Hazlewood', 'country': 'Australia', 'role': 'Bowler', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm fast-medium', 'age': 33, 'matches': 50, 'runs': 45, 'wickets': 68, 'image': '/images/players/josh-hazlewood.jpg',
     'description': "Josh Hazlewood is one of Australia's most consistent pace bowlers, known for impeccable line and length and the ability to swing the ball relentlessly. A key part of Australia's feared pace trio alongside Cummins and Starc, Hazlewood brings T20 expertise to Sydney Sixers with tight spells in both the powerplay and at the death."},
    {'id': 'dan-christian-ss', 'teamId': 'sydney-sixers', 'name': 'Dan Christian', 'country': 'Australia', 'role': 'All-rounder', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm medium-fast', 'age': 41, 'matches': 130, 'runs': 1820, 'wickets': 110, 'image': '/images/players/dan-christian.jpg',
     'description': "Dan Christian is a veteran T20 franchise all-rounder who has played in cricket leagues around the world, earning a reputation as one of the most reliable death bowlers and hard-hitting lower-order batsmen. His death-over economy rate is among the best in BBL history and his vast experience is a key leadership resource for the Sixers."},
    # Perth Scorchers
    {'id': 'ashton-turner-ps', 'teamId': 'perth-scorchers', 'name': 'Ashton Turner', 'country': 'Australia', 'role': 'Batsman', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm off-break', 'age': 31, 'matches': 88, 'runs': 2200, 'wickets': 22, 'image': '/images/players/ashton-turner.jpg',
     'description': "Ashton Turner is the captain of Perth Scorchers and a charismatic attacking middle-order batsman, who became a household name after his astonishing 84 off 43 balls to help Australia chase 359 against India in 2019. Under Turner the Scorchers have maintained their status as one of the BBL's most consistent sides."},
    {'id': 'mitchell-marsh-ps', 'teamId': 'perth-scorchers', 'name': 'Mitchell Marsh', 'country': 'Australia', 'role': 'All-rounder', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm fast-medium', 'age': 32, 'matches': 72, 'runs': 1780, 'wickets': 48, 'image': '/images/players/mitchell-marsh.jpg',
     'description': "Mitchell Marsh is one of Australia's premier T20 all-rounders — a powerful right-hand batsman and useful right-arm seam bowler who delivers match-winning performances. He is consistently one of the most impactful batsmen in the BBL for Perth Scorchers and was a key contributor to Australia's multiple ICC title campaigns."},
    {'id': 'andrew-tye-ps', 'teamId': 'perth-scorchers', 'name': 'Andrew Tye', 'country': 'Australia', 'role': 'Bowler', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm medium-fast', 'age': 37, 'matches': 85, 'runs': 120, 'wickets': 105, 'image': '/images/players/andrew-tye.jpg',
     'description': "Andrew Tye is one of the BBL's most experienced and crafty death bowlers, renowned for his knuckleball, slower ball, and well-disguised variations that consistently outfox batsmen in the final overs. He was the BBL's leading wicket-taker on multiple occasions and a mainstay of Perth Scorchers' dominant bowling attack across title campaigns."},
    # Melbourne Stars
    {'id': 'glenn-maxwell-stars', 'teamId': 'melbourne-stars', 'name': 'Glenn Maxwell', 'country': 'Australia', 'role': 'All-rounder', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm off-break', 'age': 36, 'matches': 80, 'runs': 2105, 'wickets': 48, 'image': '/images/players/glenn-maxwell-stars.jpg',
     'description': "Glenn Maxwell is the Melbourne Stars' captain and most high-profile star, widely considered one of the most entertaining cricketers in the world due to his extraordinary range of unconventional shots. Despite the Stars' title drought, Maxwell consistently delivers explosive performances at the MCG — one of the most iconic venues in world sport."},
    {'id': 'marcus-stoinis-stars', 'teamId': 'melbourne-stars', 'name': 'Marcus Stoinis', 'country': 'Australia', 'role': 'All-rounder', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm fast-medium', 'age': 34, 'matches': 90, 'runs': 2420, 'wickets': 72, 'image': '/images/players/marcus-stoinis.jpg',
     'description': "Marcus Stoinis is a powerful right-handed all-rounder equally at home opening or finishing an innings. His exceptional athleticism in the field complements his aggressive batting and useful right-arm seam bowling. His partnership with Maxwell provides Melbourne Stars with their most potent batting threat."},
    {'id': 'hilton-cartwright-stars', 'teamId': 'melbourne-stars', 'name': 'Hilton Cartwright', 'country': 'Australia', 'role': 'All-rounder', 'battingStyle': 'Right-handed', 'bowlingStyle': 'Right-arm fast-medium', 'age': 31, 'matches': 65, 'runs': 1380, 'wickets': 42, 'image': '/images/players/hilton-cartwright.jpg',
     'description': "Hilton Cartwright is a reliable and consistent all-rounder for Melbourne Stars, providing valuable middle-order batting depth and economical fast-medium bowling through the middle overs. Born in Zimbabwe and raised in Western Australia, Cartwright has represented Australia internationally and is a technically sound contributor across both departments."},
]


def build_insert_countries():
    lines = []
    for c in COUNTRIES:
        lines.append(
            f"INSERT INTO countries (id, name, short_name, flag, description, background, established, world_cups_won, board, coach, captain, famous_players) "
            f"VALUES ({q(c['id'])}, {q(c['name'])}, {q(c['shortName'])}, {q(c['flag'])}, {q(c['description'])}, {q(c['background'])}, "
            f"{c['established']}, {c['worldCupsWon']}, {q(c['board'])}, {q(c['coach'])}, {q(c['captain'])}, {q(json.dumps(c['famousPlayers'], ensure_ascii=False))}) "
            f"ON DUPLICATE KEY UPDATE name=VALUES(name);"
        )
    return '\n'.join(lines)


def build_insert_leagues():
    lines = []
    for l in LEAGUES:
        lines.append(
            f"INSERT INTO leagues (id, country_id, name, description, established, format, trophy, image) "
            f"VALUES ({q(l['id'])}, {q(l['countryId'])}, {q(l['name'])}, {q(l['description'])}, "
            f"{l['established']}, {q(l['format'])}, {q(l['trophy'])}, {q(l['image'])}) "
            f"ON DUPLICATE KEY UPDATE name=VALUES(name);"
        )
    return '\n'.join(lines)


def build_insert_teams():
    lines = []
    for t in TEAMS:
        lines.append(
            f"INSERT INTO teams (id, league_id, name, captain, coach, home_ground, titles, logo, description) "
            f"VALUES ({q(t['id'])}, {q(t['leagueId'])}, {q(t['name'])}, {q(t['captain'])}, {q(t['coach'])}, "
            f"{q(t['homeGround'])}, {t['titles']}, {q(t['logo'])}, {q(t['description'])}) "
            f"ON DUPLICATE KEY UPDATE name=VALUES(name);"
        )
    return '\n'.join(lines)


def build_insert_cricketers():
    lines = []
    for p in CRICKETERS:
        lines.append(
            f"INSERT INTO cricketers (id, team_id, name, country, role, batting_style, bowling_style, age, matches, runs, wickets, description, image) "
            f"VALUES ({q(p['id'])}, {q(p['teamId'])}, {q(p['name'])}, {q(p['country'])}, {q(p['role'])}, "
            f"{q(p['battingStyle'])}, {q(p['bowlingStyle'])}, {p['age']}, {p['matches']}, {p['runs']}, {p['wickets']}, "
            f"{q(p['description'])}, {q(p['image'])}) "
            f"ON DUPLICATE KEY UPDATE name=VALUES(name);"
        )
    return '\n'.join(lines)


SEED_ADMIN_SQL = """
-- Default admin user: email=admin@cricket.com / password=Cricket@123
-- Password hashed with bcryptjs cost=12
INSERT INTO loginusers (name, email, password_hash, role) VALUES
('Admin', 'admin@cricket.com', '$2b$12$0qPOAr6DIprjr1HXpEGRJuWjCEz5ZMyTVCRJec2IqgGEymkOlX/Ea', 'admin')
ON DUPLICATE KEY UPDATE name=VALUES(name);
"""


def main():
    print("Setting up cricket_universe database...")

    full_sql = (
        DDL + '\n' +
        SEED_ADMIN_SQL + '\n' +
        build_insert_countries() + '\n' +
        build_insert_leagues() + '\n' +
        build_insert_teams() + '\n' +
        build_insert_cricketers()
    )

    run_sql(full_sql)
    print("Database setup complete!")
    print(f"  loginusers: 1 (admin@cricket.com / Cricket@123)")
    print(f"  Countries : {len(COUNTRIES)}")
    print(f"  Leagues   : {len(LEAGUES)}")
    print(f"  Teams     : {len(TEAMS)}")
    print(f"  Cricketers: {len(CRICKETERS)}")


if __name__ == '__main__':
    main()
