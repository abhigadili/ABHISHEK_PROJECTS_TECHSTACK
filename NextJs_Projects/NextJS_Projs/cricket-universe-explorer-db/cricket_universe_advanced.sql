-- ============================================================
-- Cricket Universe Explorer — Advanced MySQL Features
-- Stored Procedures, Views, Audit Tables, Triggers,
-- Cursors, Window Functions, Analytics Procedure
-- ============================================================

USE cricket_universe;
SET NAMES utf8mb4;

-- ============================================================
-- PART 1: AUDIT TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_countries (
    audit_id      INT AUTO_INCREMENT PRIMARY KEY,
    operation     ENUM('INSERT','UPDATE','DELETE') NOT NULL,
    record_id     VARCHAR(20) NOT NULL,
    old_name      VARCHAR(100),
    new_name      VARCHAR(100),
    old_captain   VARCHAR(100),
    new_captain   VARCHAR(100),
    old_coach     VARCHAR(100),
    new_coach     VARCHAR(100),
    old_world_cups_won INT,
    new_world_cups_won INT,
    changed_by    VARCHAR(255) DEFAULT 'system',
    changed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_leagues (
    audit_id      INT AUTO_INCREMENT PRIMARY KEY,
    operation     ENUM('INSERT','UPDATE','DELETE') NOT NULL,
    record_id     VARCHAR(60) NOT NULL,
    old_name      VARCHAR(200),
    new_name      VARCHAR(200),
    old_country_id VARCHAR(20),
    new_country_id VARCHAR(20),
    old_format    VARCHAR(20),
    new_format    VARCHAR(20),
    changed_by    VARCHAR(255) DEFAULT 'system',
    changed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_teams (
    audit_id      INT AUTO_INCREMENT PRIMARY KEY,
    operation     ENUM('INSERT','UPDATE','DELETE') NOT NULL,
    record_id     VARCHAR(60) NOT NULL,
    old_name      VARCHAR(200),
    new_name      VARCHAR(200),
    old_league_id VARCHAR(60),
    new_league_id VARCHAR(60),
    old_captain   VARCHAR(100),
    new_captain   VARCHAR(100),
    old_titles    INT,
    new_titles    INT,
    changed_by    VARCHAR(255) DEFAULT 'system',
    changed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_cricketers (
    audit_id      INT AUTO_INCREMENT PRIMARY KEY,
    operation     ENUM('INSERT','UPDATE','DELETE') NOT NULL,
    record_id     VARCHAR(100) NOT NULL,
    old_name      VARCHAR(100),
    new_name      VARCHAR(100),
    old_team_id   VARCHAR(60),
    new_team_id   VARCHAR(60),
    old_role      VARCHAR(60),
    new_role      VARCHAR(60),
    old_runs      INT,
    new_runs      INT,
    old_wickets   INT,
    new_wickets   INT,
    changed_by    VARCHAR(255) DEFAULT 'system',
    changed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- PART 2: TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_countries_after_insert;
DROP TRIGGER IF EXISTS trg_countries_after_update;
DROP TRIGGER IF EXISTS trg_countries_after_delete;
DROP TRIGGER IF EXISTS trg_leagues_after_insert;
DROP TRIGGER IF EXISTS trg_leagues_after_update;
DROP TRIGGER IF EXISTS trg_leagues_after_delete;
DROP TRIGGER IF EXISTS trg_teams_after_insert;
DROP TRIGGER IF EXISTS trg_teams_after_update;
DROP TRIGGER IF EXISTS trg_teams_after_delete;
DROP TRIGGER IF EXISTS trg_cricketers_after_insert;
DROP TRIGGER IF EXISTS trg_cricketers_after_update;
DROP TRIGGER IF EXISTS trg_cricketers_after_delete;

DELIMITER $$

-- Countries INSERT
CREATE TRIGGER trg_countries_after_insert
AFTER INSERT ON countries
FOR EACH ROW
BEGIN
    INSERT INTO audit_countries (operation, record_id, new_name, new_captain, new_coach, new_world_cups_won)
    VALUES ('INSERT', NEW.id, NEW.name, NEW.captain, NEW.coach, NEW.world_cups_won);
END$$

-- Countries UPDATE
CREATE TRIGGER trg_countries_after_update
AFTER UPDATE ON countries
FOR EACH ROW
BEGIN
    INSERT INTO audit_countries (operation, record_id, old_name, new_name, old_captain, new_captain,
                                 old_coach, new_coach, old_world_cups_won, new_world_cups_won)
    VALUES ('UPDATE', NEW.id, OLD.name, NEW.name, OLD.captain, NEW.captain,
            OLD.coach, NEW.coach, OLD.world_cups_won, NEW.world_cups_won);
END$$

-- Countries DELETE
CREATE TRIGGER trg_countries_after_delete
AFTER DELETE ON countries
FOR EACH ROW
BEGIN
    INSERT INTO audit_countries (operation, record_id, old_name, old_captain, old_coach, old_world_cups_won)
    VALUES ('DELETE', OLD.id, OLD.name, OLD.captain, OLD.coach, OLD.world_cups_won);
END$$

-- Leagues INSERT
CREATE TRIGGER trg_leagues_after_insert
AFTER INSERT ON leagues
FOR EACH ROW
BEGIN
    INSERT INTO audit_leagues (operation, record_id, new_name, new_country_id, new_format)
    VALUES ('INSERT', NEW.id, NEW.name, NEW.country_id, NEW.format);
END$$

-- Leagues UPDATE
CREATE TRIGGER trg_leagues_after_update
AFTER UPDATE ON leagues
FOR EACH ROW
BEGIN
    INSERT INTO audit_leagues (operation, record_id, old_name, new_name, old_country_id, new_country_id,
                               old_format, new_format)
    VALUES ('UPDATE', NEW.id, OLD.name, NEW.name, OLD.country_id, NEW.country_id,
            OLD.format, NEW.format);
END$$

-- Leagues DELETE
CREATE TRIGGER trg_leagues_after_delete
AFTER DELETE ON leagues
FOR EACH ROW
BEGIN
    INSERT INTO audit_leagues (operation, record_id, old_name, old_country_id, old_format)
    VALUES ('DELETE', OLD.id, OLD.name, OLD.country_id, OLD.format);
END$$

-- Teams INSERT
CREATE TRIGGER trg_teams_after_insert
AFTER INSERT ON teams
FOR EACH ROW
BEGIN
    INSERT INTO audit_teams (operation, record_id, new_name, new_league_id, new_captain, new_titles)
    VALUES ('INSERT', NEW.id, NEW.name, NEW.league_id, NEW.captain, NEW.titles);
END$$

-- Teams UPDATE
CREATE TRIGGER trg_teams_after_update
AFTER UPDATE ON teams
FOR EACH ROW
BEGIN
    INSERT INTO audit_teams (operation, record_id, old_name, new_name, old_league_id, new_league_id,
                             old_captain, new_captain, old_titles, new_titles)
    VALUES ('UPDATE', NEW.id, OLD.name, NEW.name, OLD.league_id, NEW.league_id,
            OLD.captain, NEW.captain, OLD.titles, NEW.titles);
END$$

-- Teams DELETE
CREATE TRIGGER trg_teams_after_delete
AFTER DELETE ON teams
FOR EACH ROW
BEGIN
    INSERT INTO audit_teams (operation, record_id, old_name, old_league_id, old_captain, old_titles)
    VALUES ('DELETE', OLD.id, OLD.name, OLD.league_id, OLD.captain, OLD.titles);
END$$

-- Cricketers INSERT
CREATE TRIGGER trg_cricketers_after_insert
AFTER INSERT ON cricketers
FOR EACH ROW
BEGIN
    INSERT INTO audit_cricketers (operation, record_id, new_name, new_team_id, new_role, new_runs, new_wickets)
    VALUES ('INSERT', NEW.id, NEW.name, NEW.team_id, NEW.role, NEW.runs, NEW.wickets);
END$$

-- Cricketers UPDATE
CREATE TRIGGER trg_cricketers_after_update
AFTER UPDATE ON cricketers
FOR EACH ROW
BEGIN
    INSERT INTO audit_cricketers (operation, record_id, old_name, new_name, old_team_id, new_team_id,
                                  old_role, new_role, old_runs, new_runs, old_wickets, new_wickets)
    VALUES ('UPDATE', NEW.id, OLD.name, NEW.name, OLD.team_id, NEW.team_id,
            OLD.role, NEW.role, OLD.runs, NEW.runs, OLD.wickets, NEW.wickets);
END$$

-- Cricketers DELETE
CREATE TRIGGER trg_cricketers_after_delete
AFTER DELETE ON cricketers
FOR EACH ROW
BEGIN
    INSERT INTO audit_cricketers (operation, record_id, old_name, old_team_id, old_role, old_runs, old_wickets)
    VALUES ('DELETE', OLD.id, OLD.name, OLD.team_id, OLD.role, OLD.runs, OLD.wickets);
END$$

DELIMITER ;


-- ============================================================
-- PART 3: VIEWS
-- ============================================================

-- View 1: Countries + Leagues
CREATE OR REPLACE VIEW v_countries_leagues AS
SELECT
    c.id          AS country_id,
    c.name        AS country_name,
    c.short_name,
    c.flag,
    c.board,
    c.captain     AS country_captain,
    c.world_cups_won,
    l.id          AS league_id,
    l.name        AS league_name,
    l.format      AS league_format,
    l.established AS league_established,
    l.description AS league_description
FROM countries c
LEFT JOIN leagues l ON l.country_id = c.id
ORDER BY c.name, l.name;

-- View 2: Teams + Players (cricketers)
CREATE OR REPLACE VIEW v_teams_players AS
SELECT
    t.id          AS team_id,
    t.name        AS team_name,
    t.captain     AS team_captain,
    t.coach       AS team_coach,
    t.home_ground,
    t.titles      AS team_titles,
    cr.id         AS player_id,
    cr.name       AS player_name,
    cr.role       AS player_role,
    cr.batting_style,
    cr.bowling_style,
    cr.age,
    cr.matches,
    cr.runs,
    cr.wickets
FROM teams t
LEFT JOIN cricketers cr ON cr.team_id = t.id
ORDER BY t.name, cr.name;

-- View 3: All players with complete hierarchy (team + league + country)
CREATE OR REPLACE VIEW v_all_players_detail AS
SELECT
    cr.id              AS player_id,
    cr.name            AS player_name,
    cr.role,
    cr.batting_style,
    cr.bowling_style,
    cr.age,
    cr.matches,
    cr.runs,
    cr.wickets,
    cr.country         AS player_country_origin,
    t.id               AS team_id,
    t.name             AS team_name,
    t.captain          AS team_captain,
    t.home_ground,
    l.id               AS league_id,
    l.name             AS league_name,
    l.format           AS league_format,
    c.id               AS country_id,
    c.name             AS country_name,
    c.short_name       AS country_short_name,
    c.flag             AS country_flag,
    c.board            AS cricket_board
FROM cricketers cr
JOIN teams  t ON t.id = cr.team_id
JOIN leagues l ON l.id = t.league_id
JOIN countries c ON c.id = l.country_id
ORDER BY c.name, l.name, t.name, cr.name;


-- ============================================================
-- PART 4: INDIVIDUAL STORED PROCEDURES
-- ============================================================

DELIMITER $$

-- sp_list_countries: list countries with optional search
DROP PROCEDURE IF EXISTS sp_list_countries$$
CREATE PROCEDURE sp_list_countries(IN p_search VARCHAR(100))
BEGIN
    IF p_search IS NULL OR p_search = '' THEN
        SELECT id, name, short_name, flag, description, board, captain, coach,
               world_cups_won, established, famous_players, created_at
        FROM countries
        ORDER BY name;
    ELSE
        SELECT id, name, short_name, flag, description, board, captain, coach,
               world_cups_won, established, famous_players, created_at
        FROM countries
        WHERE name LIKE CONCAT('%', p_search, '%')
           OR short_name LIKE CONCAT('%', p_search, '%')
           OR board LIKE CONCAT('%', p_search, '%')
        ORDER BY name;
    END IF;
END$$

-- sp_list_leagues: list leagues with optional countryId and search
DROP PROCEDURE IF EXISTS sp_list_leagues$$
CREATE PROCEDURE sp_list_leagues(IN p_country_id VARCHAR(20), IN p_search VARCHAR(100))
BEGIN
    SELECT l.id, l.name, l.country_id, c.name AS country_name,
           l.description, l.format, l.established, l.trophy, l.image, l.created_at
    FROM leagues l
    JOIN countries c ON c.id = l.country_id
    WHERE (p_country_id IS NULL OR p_country_id = '' OR l.country_id = p_country_id)
      AND (p_search IS NULL OR p_search = '' OR l.name LIKE CONCAT('%', p_search, '%'))
    ORDER BY c.name, l.name;
END$$

-- sp_list_teams: list teams with optional leagueId
DROP PROCEDURE IF EXISTS sp_list_teams$$
CREATE PROCEDURE sp_list_teams(IN p_league_id VARCHAR(60))
BEGIN
    SELECT t.id, t.name, t.league_id, l.name AS league_name,
           t.captain, t.coach, t.home_ground, t.titles, t.logo, t.description, t.created_at
    FROM teams t
    JOIN leagues l ON l.id = t.league_id
    WHERE (p_league_id IS NULL OR p_league_id = '' OR t.league_id = p_league_id)
    ORDER BY l.name, t.name;
END$$

-- sp_list_players: list players with optional teamId and role filter
DROP PROCEDURE IF EXISTS sp_list_players$$
CREATE PROCEDURE sp_list_players(IN p_team_id VARCHAR(60), IN p_role VARCHAR(60))
BEGIN
    SELECT cr.id, cr.name, cr.team_id, t.name AS team_name,
           cr.role, cr.batting_style, cr.bowling_style,
           cr.age, cr.matches, cr.runs, cr.wickets,
           cr.country, cr.description, cr.image, cr.created_at
    FROM cricketers cr
    JOIN teams t ON t.id = cr.team_id
    WHERE (p_team_id IS NULL OR p_team_id = '' OR cr.team_id = p_team_id)
      AND (p_role IS NULL OR p_role = '' OR cr.role = p_role)
    ORDER BY t.name, cr.name;
END$$

-- sp_all_players_detail: all players with complete hierarchy
DROP PROCEDURE IF EXISTS sp_all_players_detail$$
CREATE PROCEDURE sp_all_players_detail(IN p_country_id VARCHAR(20), IN p_role VARCHAR(60))
BEGIN
    SELECT
        cr.id              AS player_id,
        cr.name            AS player_name,
        cr.role,
        cr.batting_style,
        cr.bowling_style,
        cr.age,
        cr.matches,
        cr.runs,
        cr.wickets,
        t.id               AS team_id,
        t.name             AS team_name,
        t.captain          AS team_captain,
        l.id               AS league_id,
        l.name             AS league_name,
        l.format           AS league_format,
        c.id               AS country_id,
        c.name             AS country_name,
        c.short_name       AS country_code,
        c.flag
    FROM cricketers cr
    JOIN teams   t ON t.id = cr.team_id
    JOIN leagues l ON l.id = t.league_id
    JOIN countries c ON c.id = l.country_id
    WHERE (p_country_id IS NULL OR p_country_id = '' OR c.id = p_country_id)
      AND (p_role IS NULL OR p_role = '' OR cr.role = p_role)
    ORDER BY c.name, l.name, t.name, cr.name;
END$$


-- ============================================================
-- PART 5: CURSOR PROCEDURE
-- Iterates cricketers and accumulates per-role run totals
-- ============================================================

DROP PROCEDURE IF EXISTS sp_cursor_role_run_totals$$
CREATE PROCEDURE sp_cursor_role_run_totals()
BEGIN
    DECLARE v_done       INT DEFAULT 0;
    DECLARE v_player_id  VARCHAR(100);
    DECLARE v_name       VARCHAR(100);
    DECLARE v_role       VARCHAR(60);
    DECLARE v_runs       INT;
    DECLARE v_matches    INT;

    -- Accumulators
    DECLARE v_bat_runs   BIGINT DEFAULT 0;
    DECLARE v_bowl_runs  BIGINT DEFAULT 0;
    DECLARE v_all_runs   BIGINT DEFAULT 0;
    DECLARE v_wk_runs    BIGINT DEFAULT 0;
    DECLARE v_wkb_runs   BIGINT DEFAULT 0;

    -- Declare cursor
    DECLARE cur_players CURSOR FOR
        SELECT id, name, role, runs, matches FROM cricketers ORDER BY role, name;

    -- Handler to exit loop on NOT FOUND
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

    -- Create a temporary result table
    DROP TEMPORARY TABLE IF EXISTS tmp_role_totals;
    CREATE TEMPORARY TABLE tmp_role_totals (
        role         VARCHAR(60),
        total_runs   BIGINT,
        player_count INT,
        avg_runs     DECIMAL(10,2)
    );

    OPEN cur_players;

    read_loop: LOOP
        FETCH cur_players INTO v_player_id, v_name, v_role, v_runs, v_matches;
        IF v_done THEN
            LEAVE read_loop;
        END IF;

        CASE v_role
            WHEN 'Batsman' THEN
                SET v_bat_runs = v_bat_runs + COALESCE(v_runs, 0);
            WHEN 'Bowler' THEN
                SET v_bowl_runs = v_bowl_runs + COALESCE(v_runs, 0);
            WHEN 'All-rounder' THEN
                SET v_all_runs = v_all_runs + COALESCE(v_runs, 0);
            WHEN 'Wicketkeeper' THEN
                SET v_wk_runs = v_wk_runs + COALESCE(v_runs, 0);
            WHEN 'Wicketkeeper-Batsman' THEN
                SET v_wkb_runs = v_wkb_runs + COALESCE(v_runs, 0);
            ELSE BEGIN END;
        END CASE;
    END LOOP;

    CLOSE cur_players;

    -- Populate summary from aggregated cursor results
    INSERT INTO tmp_role_totals
    SELECT role, SUM(runs) AS total_runs, COUNT(*) AS player_count,
           ROUND(AVG(runs), 2) AS avg_runs
    FROM cricketers
    GROUP BY role;

    SELECT * FROM tmp_role_totals ORDER BY total_runs DESC;
    DROP TEMPORARY TABLE IF EXISTS tmp_role_totals;
END$$


-- ============================================================
-- PART 6: WINDOW FUNCTIONS PROCEDURE
-- Demonstrates ROW_NUMBER, RANK, DENSE_RANK, NTILE,
-- LAG, LEAD, SUM OVER, AVG OVER on all tables
-- ============================================================

DROP PROCEDURE IF EXISTS sp_window_functions_demo$$
CREATE PROCEDURE sp_window_functions_demo()
BEGIN

    -- 1. Player ranking by runs within each team (RANK + DENSE_RANK)
    SELECT
        cr.name                                                   AS player,
        t.name                                                    AS team,
        cr.runs,
        RANK()       OVER (PARTITION BY cr.team_id ORDER BY cr.runs DESC) AS run_rank,
        DENSE_RANK() OVER (PARTITION BY cr.team_id ORDER BY cr.runs DESC) AS run_dense_rank,
        ROW_NUMBER() OVER (PARTITION BY cr.team_id ORDER BY cr.runs DESC) AS row_num
    FROM cricketers cr
    JOIN teams t ON t.id = cr.team_id
    ORDER BY t.name, run_rank;

    -- 2. Cumulative runs per country using SUM OVER + AVG OVER
    SELECT
        c.name                                                          AS country,
        cr.name                                                         AS player,
        cr.runs,
        SUM(cr.runs)  OVER (PARTITION BY c.id ORDER BY cr.runs DESC)   AS cumulative_runs,
        ROUND(AVG(cr.runs)  OVER (PARTITION BY c.id), 2)               AS country_avg_runs,
        cr.runs - AVG(cr.runs) OVER (PARTITION BY c.id)                AS deviation_from_avg
    FROM cricketers cr
    JOIN teams   t ON t.id = cr.team_id
    JOIN leagues l ON l.id = t.league_id
    JOIN countries c ON c.id = l.country_id
    ORDER BY c.name, cr.runs DESC;

    -- 3. Team titles percentile buckets using NTILE
    SELECT
        name   AS team,
        titles,
        NTILE(4) OVER (ORDER BY titles DESC) AS quartile
    FROM teams
    ORDER BY quartile, titles DESC;

    -- 4. LAG / LEAD — compare each cricketer's runs to previous/next in rank
    SELECT
        cr.name                                                       AS player,
        t.name                                                        AS team,
        cr.runs,
        LAG(cr.runs)  OVER (PARTITION BY cr.team_id ORDER BY cr.runs) AS prev_player_runs,
        LEAD(cr.runs) OVER (PARTITION BY cr.team_id ORDER BY cr.runs) AS next_player_runs,
        cr.runs - LAG(cr.runs, 1, 0) OVER (PARTITION BY cr.team_id ORDER BY cr.runs) AS diff_from_prev
    FROM cricketers cr
    JOIN teams t ON t.id = cr.team_id
    ORDER BY t.name, cr.runs;

    -- 5. League team count with FIRST_VALUE / LAST_VALUE
    SELECT DISTINCT
        l.name                                                          AS league,
        COUNT(t.id) OVER (PARTITION BY l.id)                           AS total_teams,
        FIRST_VALUE(t.name) OVER (PARTITION BY l.id ORDER BY t.titles DESC) AS most_titled_team,
        LAST_VALUE(t.name)  OVER (
            PARTITION BY l.id ORDER BY t.titles DESC
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
        )                                                               AS least_titled_team
    FROM leagues l
    JOIN teams t ON t.league_id = l.id
    ORDER BY l.name;

END$$


-- ============================================================
-- PART 7: ANALYTICS PROCEDURE
-- Operators, Joins, Aggregate Functions, GROUP BY,
-- Built-in Functions, Subqueries
-- ============================================================

DROP PROCEDURE IF EXISTS sp_analytics_demo$$
CREATE PROCEDURE sp_analytics_demo()
BEGIN

    -- 1. Aggregate Functions + GROUP BY — run/wicket stats per role
    SELECT
        role,
        COUNT(*)                        AS player_count,
        SUM(runs)                       AS total_runs,
        MAX(runs)                       AS highest_score,
        MIN(runs)                       AS lowest_score,
        ROUND(AVG(runs), 2)             AS avg_runs,
        SUM(wickets)                    AS total_wickets,
        ROUND(AVG(wickets), 2)          AS avg_wickets,
        ROUND(SUM(runs) / NULLIF(SUM(matches), 0), 2) AS overall_average
    FROM cricketers
    GROUP BY role
    HAVING COUNT(*) > 0
    ORDER BY total_runs DESC;

    -- 2. INNER JOIN — players with their full team+league+country hierarchy
    SELECT
        cr.name             AS player,
        cr.role,
        cr.runs,
        cr.wickets,
        t.name              AS team,
        l.name              AS league,
        l.format,
        c.name              AS country,
        c.world_cups_won
    FROM cricketers cr
    INNER JOIN teams   t ON t.id = cr.team_id
    INNER JOIN leagues l ON l.id = t.league_id
    INNER JOIN countries c ON c.id = l.country_id
    ORDER BY c.name, cr.runs DESC;

    -- 3. LEFT JOIN — countries showing league count even if 0
    SELECT
        c.name          AS country,
        c.board,
        COUNT(l.id)     AS league_count,
        SUM(COALESCE(l.established, 0)) AS sum_established_years
    FROM countries c
    LEFT JOIN leagues l ON l.country_id = c.id
    GROUP BY c.id, c.name, c.board
    ORDER BY league_count DESC;

    -- 4. Built-in Functions — string + date + math functions
    SELECT
        cr.name,
        UPPER(cr.name)                             AS name_upper,
        LENGTH(cr.name)                            AS name_length,
        SUBSTRING(cr.name, 1, 5)                   AS name_prefix,
        CONCAT(cr.name, ' (', cr.role, ')')        AS display_label,
        ROUND(cr.runs / NULLIF(cr.matches, 0), 2)  AS batting_avg,
        FLOOR(cr.runs / 100)                       AS centuries_approx,
        COALESCE(cr.bowling_style, 'N/A')          AS bowling_style,
        YEAR(cr.created_at)                        AS joined_year,
        DATE_FORMAT(cr.created_at, '%d %b %Y')    AS joined_formatted,
        DATEDIFF(NOW(), cr.created_at)             AS days_since_added
    FROM cricketers cr
    ORDER BY cr.runs DESC
    LIMIT 20;

    -- 5. Subquery — players who score above their country's average runs
    SELECT
        cr.name,
        cr.runs,
        c.name          AS country,
        country_avg.avg_runs
    FROM cricketers cr
    JOIN teams   t ON t.id = cr.team_id
    JOIN leagues l ON l.id = t.league_id
    JOIN countries c ON c.id = l.country_id
    JOIN (
        SELECT l2.country_id, ROUND(AVG(cr2.runs), 2) AS avg_runs
        FROM cricketers cr2
        JOIN teams   t2 ON t2.id = cr2.team_id
        JOIN leagues l2 ON l2.id = t2.league_id
        GROUP BY l2.country_id
    ) AS country_avg ON country_avg.country_id = c.id
    WHERE cr.runs > country_avg.avg_runs
    ORDER BY c.name, cr.runs DESC;

    -- 6. Comparison & Logical Operators — high-performance all-rounders
    SELECT
        cr.name,
        cr.role,
        cr.runs,
        cr.wickets,
        cr.matches,
        CASE
            WHEN cr.runs >= 5000 AND cr.wickets >= 100 THEN 'Elite All-rounder'
            WHEN cr.runs >= 3000 OR  cr.wickets >= 50  THEN 'Good Performer'
            WHEN cr.runs BETWEEN 1000 AND 2999          THEN 'Developing'
            ELSE 'Emerging'
        END AS performance_tier
    FROM cricketers cr
    WHERE cr.role IN ('All-rounder', 'Batsman', 'Bowler')
      AND cr.matches > 0
    ORDER BY cr.runs DESC, cr.wickets DESC;

    -- 7. Correlated subquery — teams with more players than the league average
    SELECT
        t.name  AS team,
        l.name  AS league,
        (SELECT COUNT(*) FROM cricketers cr2 WHERE cr2.team_id = t.id) AS player_count,
        (
            SELECT ROUND(AVG(cnt), 1)
            FROM (
                SELECT COUNT(*) AS cnt
                FROM cricketers cr3
                JOIN teams t3 ON t3.id = cr3.team_id
                WHERE t3.league_id = t.league_id
                GROUP BY cr3.team_id
            ) sub_avg
        ) AS league_avg_players
    FROM teams t
    JOIN leagues l ON l.id = t.league_id
    HAVING player_count > league_avg_players
    ORDER BY player_count DESC;

    -- 8. EXISTS subquery — countries that have at least one T20 league
    SELECT c.id, c.name, c.board
    FROM countries c
    WHERE EXISTS (
        SELECT 1 FROM leagues l
        WHERE l.country_id = c.id AND l.format = 'T20'
    )
    ORDER BY c.name;

END$$

DELIMITER ;


-- ============================================================
-- QUICK VERIFICATION QUERIES
-- ============================================================
SELECT 'Audit tables created:' AS status;
SHOW TABLES LIKE 'audit_%';

SELECT 'Triggers created:' AS status;
SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = 'cricket_universe'
ORDER BY EVENT_OBJECT_TABLE, EVENT_MANIPULATION;

SELECT 'Views created:' AS status;
SELECT TABLE_NAME AS view_name FROM information_schema.VIEWS WHERE TABLE_SCHEMA = 'cricket_universe';

SELECT 'Stored procedures created:' AS status;
SELECT ROUTINE_NAME AS procedure_name FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = 'cricket_universe' AND ROUTINE_TYPE = 'PROCEDURE'
ORDER BY ROUTINE_NAME;
