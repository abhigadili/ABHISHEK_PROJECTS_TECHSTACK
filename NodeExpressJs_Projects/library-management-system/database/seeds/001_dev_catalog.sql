-- Development seed: catalog sample data (no users - see backend/scripts/db.ts seed).

INSERT INTO publishers (id, name, website) VALUES
  (1, 'Penguin Classics', NULL),
  (2, 'O''Reilly Media', NULL),
  (3, 'Addison-Wesley', NULL),
  (4, 'Vintage Books', NULL),
  (5, 'Bloomsbury', NULL),
  (6, 'HarperCollins', NULL),
  (7, 'MIT Press', NULL),
  (8, 'Oxford University Press', NULL);

INSERT INTO authors (id, name, nationality, date_of_birth, biography) VALUES
  (1, 'George Orwell', 'British', '1903-06-25', NULL),
  (2, 'Jane Austen', 'British', '1775-12-16', NULL),
  (3, 'Robert C. Martin', 'American', '1952-12-05', NULL),
  (4, 'Martin Fowler', 'British', '1963-12-18', NULL),
  (5, 'Harper Lee', 'American', '1926-04-28', NULL),
  (6, 'J.K. Rowling', 'British', '1965-07-31', NULL),
  (7, 'Yuval Noah Harari', 'Israeli', '1976-02-24', NULL),
  (8, 'Thomas H. Cormen', 'American', NULL, NULL),
  (9, 'Frank Herbert', 'American', '1920-10-08', NULL),
  (10, 'Agatha Christie', 'British', '1890-09-15', NULL),
  (11, 'Martin Kleppmann', 'British', NULL, NULL),
  (12, 'Carl Sagan', 'American', '1934-11-09', NULL);

INSERT INTO categories (id, name, slug, parent_id, description) VALUES
  (1, 'Fiction', 'fiction', NULL, NULL),
  (2, 'Classics', 'classics', 1, NULL),
  (3, 'Science Fiction', 'science-fiction', 1, NULL),
  (4, 'Mystery', 'mystery', 1, NULL),
  (5, 'Fantasy', 'fantasy', 1, NULL),
  (6, 'Non-Fiction', 'non-fiction', NULL, NULL),
  (7, 'History', 'history', 6, NULL),
  (8, 'Science', 'science', 6, NULL),
  (9, 'Technology', 'technology', NULL, NULL),
  (10, 'Programming', 'programming', 9, NULL),
  (11, 'Databases', 'databases', 9, NULL);

INSERT INTO books (id, isbn13, isbn10, title, subtitle, description, publisher_id, publication_year, language, pages, format, location, acquisition_cost, acquisition_date) VALUES
  (1, '9780451524935', '0451524934', '1984', NULL, 'A dystopian novel about surveillance, propaganda and the fragility of truth.', 1, 1949, 'English', 328, 'paperback', 'A-01-1', 9.99, '2026-01-15'),
  (2, '9780141439518', '0141439513', 'Pride and Prejudice', NULL, 'Elizabeth Bennet navigates manners, morality and marriage in Regency England.', 1, 1813, 'English', 432, 'paperback', 'A-01-2', 8.5, '2026-01-15'),
  (3, '9780132350884', '0132350882', 'Clean Code', 'A Handbook of Agile Software Craftsmanship', 'Practical advice for writing readable, maintainable code.', 3, 2008, 'English', 464, 'paperback', 'T-02-1', 39.99, '2026-01-15'),
  (4, '9780134757599', '0134757599', 'Refactoring', 'Improving the Design of Existing Code', 'Catalog of refactorings with examples in JavaScript.', 3, 2018, 'English', 448, 'hardcover', 'T-02-2', 49.99, '2026-01-15'),
  (5, '9780061120084', '0061120081', 'To Kill a Mockingbird', NULL, 'A young girl in Alabama witnesses injustice and learns empathy.', 6, 1960, 'English', 336, 'paperback', 'A-02-1', 10.99, '2026-01-15'),
  (6, '9781408855652', '1408855658', 'Harry Potter and the Philosopher''s Stone', NULL, 'A boy discovers he is a wizard and begins his first year at Hogwarts.', 5, 1997, 'English', 352, 'paperback', 'A-03-1', 12.99, '2026-01-15'),
  (7, '9780062316110', '0062316117', 'Sapiens', 'A Brief History of Humankind', 'A sweeping history of how Homo sapiens came to dominate the planet.', 6, 2015, 'English', 464, 'paperback', 'H-01-1', 18.0, '2026-01-15'),
  (8, '9780262033848', '0262033844', 'Introduction to Algorithms', NULL, 'The standard university textbook on algorithms.', 7, 2009, 'English', 1312, 'hardcover', 'T-03-1', 89.0, '2026-01-15'),
  (9, '9780441172719', '0441172717', 'Dune', NULL, 'Politics, religion and ecology on the desert planet Arrakis.', 1, 1965, 'English', 688, 'paperback', 'A-04-1', 11.99, '2026-01-15'),
  (10, '9780062073501', '0062073508', 'Murder on the Orient Express', NULL, 'Hercule Poirot investigates a murder aboard a snowbound train.', 6, 1934, 'English', 288, 'paperback', 'A-05-1', 9.5, '2026-01-15'),
  (11, '9781449373320', '1449373321', 'Designing Data-Intensive Applications', NULL, 'The big ideas behind reliable, scalable and maintainable data systems.', 2, 2017, 'English', 616, 'paperback', 'T-04-1', 44.99, '2026-01-15'),
  (12, '9780345539434', '0345539435', 'Cosmos', NULL, 'A personal voyage through the universe and the history of science.', 4, 1980, 'English', 432, 'paperback', 'S-01-1', 14.99, '2026-01-15'),
  (13, NULL, NULL, 'Local History of Springfield', 'Locally published, no ISBN', 'A locally published history of the town, held in the reference section.', 8, 1987, 'English', 210, 'hardcover', 'H-02-1', NULL, '2026-01-15');

INSERT INTO book_authors (book_id, author_id, position) VALUES
  (1, 1, 0),
  (2, 2, 0),
  (3, 3, 0),
  (4, 4, 0),
  (5, 5, 0),
  (6, 6, 0),
  (7, 7, 0),
  (8, 8, 0),
  (9, 9, 0),
  (10, 10, 0),
  (11, 11, 0),
  (12, 12, 0),
  (13, 7, 0);

INSERT INTO book_categories (book_id, category_id) VALUES
  (1, 1),
  (1, 2),
  (1, 3),
  (2, 1),
  (2, 2),
  (3, 9),
  (3, 10),
  (4, 9),
  (4, 10),
  (5, 1),
  (5, 2),
  (6, 1),
  (6, 5),
  (7, 6),
  (7, 7),
  (8, 9),
  (8, 10),
  (9, 1),
  (9, 3),
  (10, 1),
  (10, 4),
  (11, 9),
  (11, 11),
  (12, 6),
  (12, 8),
  (13, 7);
