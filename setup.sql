-- ============================================================
-- MunchReviews — Supabase Setup
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- 1. Reviews table
create table if not exists reviews (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  reviewer_name text,
  restaurant    text not null,
  food_type     text,
  rating        int  not null check (rating between 1 and 10),
  review_text   text check (char_length(review_text) <= 600),
  city          text,
  state         text,
  photo_urls    text[] default '{}'
);

-- Migrations: add columns to existing table
-- alter table reviews add column if not exists reviewer_name text;
-- alter table reviews add column if not exists city text;
-- alter table reviews add column if not exists state text;

-- 2. Enable Row Level Security (open read/write for now — lock down later)
alter table reviews enable row level security;

create policy "Anyone can read reviews"
  on reviews for select using (true);

create policy "Anyone can insert reviews"
  on reviews for insert with check (true);

-- 3. Recipes table
create table if not exists recipes (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  author_name  text,
  meal_name    text not null,
  prep_time    text,
  ingredients  jsonb    default '[]',
  equipment    text[]   default '{}',
  rating       int      not null check (rating between 1 and 10),
  photo_urls   text[]   default '{}'
);

alter table recipes enable row level security;

create policy "Anyone can read recipes"
  on recipes for select using (true);

create policy "Anyone can insert recipes"
  on recipes for insert with check (true);

-- 4. Storage bucket for review photos
insert into storage.buckets (id, name, public)
values ('review-photos', 'review-photos', true)
on conflict do nothing;

create policy "Anyone can upload photos"
  on storage.objects for insert
  with check (bucket_id = 'review-photos');

create policy "Photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'review-photos');

-- 5. Storage bucket for recipe photos
insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict do nothing;

create policy "Anyone can upload recipe photos"
  on storage.objects for insert
  with check (bucket_id = 'recipe-photos');

create policy "Recipe photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'recipe-photos');
