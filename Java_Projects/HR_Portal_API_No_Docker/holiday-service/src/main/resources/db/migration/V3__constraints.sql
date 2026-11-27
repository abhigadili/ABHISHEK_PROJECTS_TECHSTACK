ALTER TABLE holiday_years ADD CONSTRAINT chk_year_period CHECK (end_date >= start_date);
ALTER TABLE holidays ADD CONSTRAINT chk_holiday_year CHECK (holiday_year BETWEEN 2000 AND 2100);
