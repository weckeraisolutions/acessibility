-- Removes the synthetic test data created by synthetic-data.sql.
-- Deleting the auth users cascades to profiles, projects, pages, chapters
-- and page narrations.
DELETE FROM auth.users
WHERE id IN ('5e5e0000-0000-4000-8000-00000000000a', '5e5e0000-0000-4000-8000-00000000000b')
  AND email LIKE '%@synthetic.invalid';
