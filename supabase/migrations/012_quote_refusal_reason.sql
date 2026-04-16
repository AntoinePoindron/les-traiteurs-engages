-- Add refusal reason to quotes (filled by client when refusing a quote)
alter table quotes
  add column if not exists refusal_reason text;
