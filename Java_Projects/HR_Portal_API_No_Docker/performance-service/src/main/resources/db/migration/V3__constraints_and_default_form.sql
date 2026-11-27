ALTER TABLE performance_reviews ADD CONSTRAINT chk_review_ratings CHECK ((self_rating IS NULL OR self_rating BETWEEN 1 AND 5) AND (manager_rating IS NULL OR manager_rating BETWEEN 1 AND 5) AND (final_rating IS NULL OR final_rating BETWEEN 1 AND 5));
ALTER TABLE review_answers ADD CONSTRAINT chk_answer_rating CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);
ALTER TABLE goals ADD CONSTRAINT chk_goal_progress CHECK (progress BETWEEN 0 AND 100);
ALTER TABLE review_cycles ADD CONSTRAINT chk_cycle_dates CHECK (period_end >= period_start AND manager_eval_deadline >= self_eval_deadline);
ALTER TABLE form_questions ADD CONSTRAINT fk_question_form FOREIGN KEY (form_id) REFERENCES evaluation_forms (id);
ALTER TABLE review_answers ADD CONSTRAINT fk_answer_review FOREIGN KEY (review_id) REFERENCES performance_reviews (id);
ALTER TABLE key_results ADD CONSTRAINT fk_kr_goal FOREIGN KEY (goal_id) REFERENCES goals (id);
ALTER TABLE review_history ADD CONSTRAINT fk_review_history FOREIGN KEY (review_id) REFERENCES performance_reviews (id);
ALTER TABLE performance_reviews ADD CONSTRAINT fk_review_cycle FOREIGN KEY (cycle_id) REFERENCES review_cycles (id);

-- Default evaluation form (editable through the API)
SET @form = UUID();
INSERT INTO evaluation_forms (id, name, description, active, deleted, created_at, updated_at, created_by, updated_by)
VALUES (@form, 'Standard Annual Review', 'Delivery, collaboration, ownership, growth and a free-text summary', 1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway');
INSERT INTO form_questions (id, form_id, section, text, type, weight, required, order_no, created_at, updated_at, created_by, updated_by) VALUES
 (UUID(), @form, 'Delivery',      'Quality and timeliness of the work delivered in the period', 'RATING', 2.0, 1, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), @form, 'Collaboration', 'Teamwork, communication and support of colleagues',          'RATING', 1.0, 1, 2, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), @form, 'Ownership',     'Initiative, accountability and problem solving',             'RATING', 1.5, 1, 3, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), @form, 'Growth',        'Learning, skill development and feedback adoption',          'RATING', 1.0, 1, 4, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), @form, 'Summary',       'Key accomplishments of the period in your own words',        'TEXT',   1.0, 0, 5, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway');
