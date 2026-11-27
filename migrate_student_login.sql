-- Run ONCE in phpMyAdmin (database election_db > SQL tab) if you already imported the old database.sql
USE election_db;
ALTER TABLE students ADD COLUMN username VARCHAR(50) NULL UNIQUE AFTER lrn, ADD COLUMN password_hash VARCHAR(255) NULL AFTER username;
-- Existing students get their LRN as the default username. The Super Admin must still set each password (Student Voters > Reset password).
UPDATE students SET username=lrn WHERE username IS NULL;
