-- Add reference and notes to quotes table
alter table quotes
  add column if not exists reference text,
  add column if not exists notes     text;
