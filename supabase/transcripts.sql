create table if not exists transcripts (
  id uuid primary key default gen_random_uuid(),
  title text,
  original_file_name text,
  original_file_url text,
  transcript_text text,
  summary text,
  minutes text,
  todos text,
  status text default 'uploaded',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists transcripts_created_at_idx
on transcripts (created_at desc);

create index if not exists transcripts_status_idx
on transcripts (status);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists transcripts_set_updated_at on transcripts;

create trigger transcripts_set_updated_at
before update on transcripts
for each row execute function set_updated_at();
