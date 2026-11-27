-- ============================================================
-- Fix: Stored Procedure Collation Mismatch
-- Root cause: tables are utf8mb4_unicode_ci but server default
-- is utf8mb4_0900_ai_ci. Procedure VARCHAR parameters inherit
-- the server collation, causing comparison failures.
-- Fix: Explicitly declare each VARCHAR parameter with
-- CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci to match tables.
-- ============================================================

USE cricket_universe;

DELIMITER $$

-- ── sp_list_countries ────────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_list_countries$$
CREATE PROCEDURE sp_list_countries(
    IN p_search VARCHAR(100) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci
)
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
        WHERE name       LIKE CONCAT('%', p_search, '%')
           OR short_name LIKE CONCAT('%', p_search, '%')
           OR board      LIKE CONCAT('%', p_search, '%')
        ORDER BY name;
    END IF;
END$$

-- ── sp_list_leagues ──────────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_list_leagues$$
CREATE PROCEDURE sp_list_leagues(
    IN p_country_id VARCHAR(20)  CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci,
    IN p_search     VARCHAR(100) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci
)
BEGIN
    SELECT l.id, l.name, l.country_id, c.name AS country_name,
           l.description, l.format, l.established, l.trophy, l.image, l.created_at
    FROM leagues l
    JOIN countries c ON c.id = l.country_id
    WHERE (p_country_id IS NULL OR p_country_id = '' OR l.country_id = p_country_id)
      AND (p_search IS NULL OR p_search = '' OR l.name LIKE CONCAT('%', p_search, '%'))
    ORDER BY c.name, l.name;
END$$

-- ── sp_list_teams ────────────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_list_teams$$
CREATE PROCEDURE sp_list_teams(
    IN p_league_id VARCHAR(60) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci
)
BEGIN
    SELECT t.id, t.name, t.league_id, l.name AS league_name,
           t.captain, t.coach, t.home_ground, t.titles, t.logo, t.description, t.created_at
    FROM teams t
    JOIN leagues l ON l.id = t.league_id
    WHERE (p_league_id IS NULL OR p_league_id = '' OR t.league_id = p_league_id)
    ORDER BY l.name, t.name;
END$$

-- ── sp_list_players ──────────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_list_players$$
CREATE PROCEDURE sp_list_players(
    IN p_team_id VARCHAR(60) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci,
    IN p_role    VARCHAR(60) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci
)
BEGIN
    SELECT cr.id, cr.name, cr.team_id, t.name AS team_name,
           cr.role, cr.batting_style, cr.bowling_style,
           cr.age, cr.matches, cr.runs, cr.wickets,
           cr.country, cr.description, cr.image, cr.created_at
    FROM cricketers cr
    JOIN teams t ON t.id = cr.team_id
    WHERE (p_team_id IS NULL OR p_team_id = '' OR cr.team_id = p_team_id)
      AND (p_role    IS NULL OR p_role    = '' OR cr.role    = p_role)
    ORDER BY t.name, cr.name;
END$$

-- ── sp_all_players_detail ────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_all_players_detail$$
CREATE PROCEDURE sp_all_players_detail(
    IN p_country_id VARCHAR(20) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci,
    IN p_role       VARCHAR(60) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci
)
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
    JOIN teams   t ON t.id  = cr.team_id
    JOIN leagues l ON l.id  = t.league_id
    JOIN countries c ON c.id = l.country_id
    WHERE (p_country_id IS NULL OR p_country_id = '' OR c.id   = p_country_id)
      AND (p_role       IS NULL OR p_role       = '' OR cr.role = p_role)
    ORDER BY c.name, l.name, t.name, cr.name;
END$$

-- ── sp_cursor_role_run_totals ────────────────────────────────
DROP PROCEDURE IF EXISTS sp_cursor_role_run_totals$$
CREATE PROCEDURE sp_cursor_role_run_totals()
BEGIN
    DECLARE v_done      INT DEFAULT 0;
    DECLARE v_player_id VARCHAR(100) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
    DECLARE v_name      VARCHAR(100) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
    DECLARE v_role      VARCHAR(60)  CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
    DECLARE v_runs      INT;
    DECLARE v_matches   INT;

    DECLARE v_bat_runs  BIGINT DEFAULT 0;
    DECLARE v_bowl_runs BIGINT DEFAULT 0;
    DECLARE v_all_runs  BIGINT DEFAULT 0;
    DECLARE v_wk_runs   BIGINT DEFAULT 0;
    DECLARE v_wkb_runs  BIGINT DEFAULT 0;

    DECLARE cur_players CURSOR FOR
        SELECT id, name, role, runs, matches FROM cricketers ORDER BY role, name;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

    DROP TEMPORARY TABLE IF EXISTS tmp_role_totals;
    CREATE TEMPORARY TABLE tmp_role_totals (
        role         VARCHAR(60)    CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci,
        total_runs   BIGINT,
        player_count INT,
        avg_runs     DECIMAL(10,2)
    );

    OPEN cur_players;

    read_loop: LOOP
        FETCH cur_players INTO v_player_id, v_name, v_role, v_runs, v_matches;
        IF v_done THEN LEAVE read_loop; END IF;

        CASE v_role
            WHEN 'Batsman'             THEN SET v_bat_runs  = v_bat_runs  + COALESCE(v_runs, 0);
            WHEN 'Bowler'              THEN SET v_bowl_runs = v_bowl_runs + COALESCE(v_runs, 0);
            WHEN 'All-rounder'         THEN SET v_all_runs  = v_all_runs  + COALESCE(v_runs, 0);
            WHEN 'Wicketkeeper'        THEN SET v_wk_runs   = v_wk_runs   + COALESCE(v_runs, 0);
            WHEN 'Wicketkeeper-Batsman'THEN SET v_wkb_runs  = v_wkb_runs  + COALESCE(v_runs, 0);
            ELSE BEGIN END;
        END CASE;
    END LOOP;

    CLOSE cur_players;

    INSERT INTO tmp_role_totals
    SELECT role, SUM(runs), COUNT(*), ROUND(AVG(runs), 2)
    FROM cricketers
    GROUP BY role;

    SELECT * FROM tmp_role_totals ORDER BY total_runs DESC;
    DROP TEMPORARY TABLE IF EXISTS tmp_role_totals;
END$$

-- ── sp_window_functions_demo ─────────────────────────────────
DROP PROCEDURE IF EXISTS sp_window_functions_demo$$
CREATE PROCEDURE sp_window_functions_demo()
BEGIN
    -- 1. RANK / DENSE_RANK / ROW_NUMBER within each team by runs
    SELECT
        cr.name,
        t.name                                                            AS team,
        cr.runs,
        RANK()       OVER (PARTITION BY cr.team_id ORDER BY cr.runs DESC) AS run_rank,
        DENSE_RANK() OVER (PARTITION BY cr.team_id ORDER BY cr.runs DESC) AS run_dense_rank,
        ROW_NUMBER() OVER (PARTITION BY cr.team_id ORDER BY cr.runs DESC) AS row_num
    FROM cricketers cr
    JOIN teams t ON t.id = cr.team_id
    ORDER BY t.name, run_rank;

    -- 2. SUM OVER / AVG OVER — cumulative & deviation per country
    SELECT
        c.name                                                             AS country,
        cr.name                                                            AS player,
        cr.runs,
        SUM(cr.runs) OVER (PARTITION BY c.id ORDER BY cr.runs DESC)        AS cumulative_runs,
        ROUND(AVG(cr.runs) OVER (PARTITION BY c.id), 2)                   AS country_avg_runs,
        cr.runs - AVG(cr.runs) OVER (PARTITION BY c.id)                   AS deviation_from_avg
    FROM cricketers cr
    JOIN teams   t ON t.id = cr.team_id
    JOIN leagues l ON l.id = t.league_id
    JOIN countries c ON c.id = l.country_id
    ORDER BY c.name, cr.runs DESC;

    -- 3. NTILE — team titles quartiles
    SELECT
        name   AS team,
        titles,
        NTILE(4) OVER (ORDER BY titles DESC) AS quartile
    FROM teams
    ORDER BY quartile, titles DESC;

    -- 4. LAG / LEAD — compare each player's runs to neighbours
    SELECT
        cr.name,
        t.name                                                          AS team,
        cr.runs,
        LAG(cr.runs)  OVER (PARTITION BY cr.team_id ORDER BY cr.runs)  AS prev_player_runs,
        LEAD(cr.runs) OVER (PARTITION BY cr.team_id ORDER BY cr.runs)  AS next_player_runs,
        cr.runs - LAG(cr.runs, 1, 0) OVER (PARTITION BY cr.team_id ORDER BY cr.runs) AS diff_from_prev
    FROM cricketers cr
    JOIN teams t ON t.id = cr.team_id
    ORDER BY t.name, cr.runs;

    -- 5. FIRST_VALUE / LAST_VALUE — best and least titled team per league
    SELECT DISTINCT
        l.name                                                            AS league,
        COUNT(t.id) OVER (PARTITION BY l.id)                             AS total_teams,
        FIRST_VALUE(t.name) OVER (PARTITION BY l.id ORDER BY t.titles DESC) AS most_titled_team,
        LAST_VALUE(t.name)  OVER (
            PARTITION BY l.id ORDER BY t.titles DESC
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
        )                                                                 AS least_titled_team
    FROM leagues l
    JOIN teams t ON t.league_id = l.id
    ORDER BY l.name;
END$$

-- ── sp_analytics_demo ────────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_analytics_demo$$
CREATE PROCEDURE sp_analytics_demo()
BEGIN
    -- 1. Aggregates + GROUP BY + HAVING per role
    SELECT
        role,
        COUNT(*)                                                 AS player_count,
        SUM(runs)                                                AS total_runs,
        MAX(runs)                                                AS highest_score,
        MIN(runs)                                                AS lowest_score,
        ROUND(AVG(runs), 2)                                      AS avg_runs,
        SUM(wickets)                                             AS total_wickets,
        ROUND(AVG(wickets), 2)                                   AS avg_wickets,
        ROUND(SUM(runs) / NULLIF(SUM(matches), 0), 2)           AS overall_average
    FROM cricketers
    GROUP BY role
    HAVING COUNT(*) > 0
    ORDER BY total_runs DESC;

    -- 2. INNER JOIN — full player hierarchy
    SELECT
        cr.name, cr.role, cr.runs, cr.wickets,
        t.name AS team, l.name AS league, l.format, c.name AS country, c.world_cups_won
    FROM cricketers cr
    INNER JOIN teams   t ON t.id = cr.team_id
    INNER JOIN leagues l ON l.id = t.league_id
    INNER JOIN countries c ON c.id = l.country_id
    ORDER BY c.name, cr.runs DESC;

    -- 3. LEFT JOIN — countries with 0 leagues shown
    SELECT
        c.name, c.board,
        COUNT(l.id)                              AS league_count,
        COALESCE(SUM(l.established), 0)          AS sum_established_years
    FROM countries c
    LEFT JOIN leagues l ON l.country_id = c.id
    GROUP BY c.id, c.name, c.board
    ORDER BY league_count DESC;

    -- 4. Built-in string + date + math functions
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

    -- 5. Subquery — players above their country's average runs
    SELECT
        cr.name, cr.runs, c.name AS country, country_avg.avg_runs
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

    -- 6. CASE + comparison/logical operators — performance tier
    SELECT
        cr.name, cr.role, cr.runs, cr.wickets, cr.matches,
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

    -- 7. Correlated subquery — teams above league average player count
    SELECT
        t.name AS team, l.name AS league,
        (SELECT COUNT(*) FROM cricketers cr2 WHERE cr2.team_id = t.id) AS player_count,
        (
            SELECT ROUND(AVG(cnt), 1) FROM (
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

    -- 8. EXISTS subquery — countries with at least one T20 league
    SELECT c.id, c.name, c.board
    FROM countries c
    WHERE EXISTS (
        SELECT 1 FROM leagues l
        WHERE l.country_id = c.id AND l.format = 'T20'
    )
    ORDER BY c.name;
END$$

DELIMITER ;

-- Verify all procedures recreated
SELECT ROUTINE_NAME, ROUTINE_TYPE
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = 'cricket_universe' AND ROUTINE_TYPE = 'PROCEDURE'
ORDER BY ROUTINE_NAME;
