-- Liga16 — Esquema de base de datos para Supabase (PostgreSQL)
-- Aplicar en: SQL Editor del proyecto Supabase, o `supabase db push`.
-- Incluye RLS básico. Ver README.md «Conectar Supabase».

create extension if not exists "pgcrypto";

-- Tipos enumerados
create type user_role as enum ('player', 'captain', 'organizer', 'club', 'admin', 'sponsor');
create type sex_type as enum ('M', 'F', 'X');
create type dominant_hand as enum ('right', 'left', 'both');
create type court_position as enum ('drive', 'reves', 'both');
create type tournament_status as enum ('draft','published','registration_open','registration_closed','in_progress','finished','cancelled');
create type tournament_format as enum ('single_elimination','round_robin','groups_knockout','americano','mexicano','ladder','custom');
create type tournament_modality as enum ('pairs','singles','teams','league');
create type registration_status as enum ('started','payment_pending','payment_review','paid','refunded','cancelled','no_show');
create type payment_status as enum ('pending','review','paid','refunded','rejected');
create type payment_method as enum ('cash','transfer','stripe','mercado_pago');
create type match_status as enum ('scheduled','live','finished','walkover','disputed','cancelled');
create type dispute_status as enum ('open','under_review','resolved','rejected');
create type league_status as enum ('upcoming','active','finished');
create type invitation_status as enum ('pending','accepted','declined','expired');
create type sponsor_tier as enum ('principal','oro','plata','bronce');

-- Identidad y perfiles
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role user_role not null default 'player',
  created_at timestamptz not null default now()
);

create table public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  display_name text not null,
  username text not null unique,
  photo_url text,
  city text not null default '',
  state text not null default '',
  country text not null default 'México',
  birth_date date,
  sex sex_type not null default 'X',
  declared_level numeric(2,1) not null default 3.0 check (declared_level between 1.0 and 7.0),
  official_level numeric(2,1) check (official_level between 1.0 and 7.0),
  dominant_hand dominant_hand not null default 'right',
  preferred_position court_position not null default 'both',
  bio text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.level_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player_profiles (id) on delete cascade,
  old_level numeric(2,1),
  new_level numeric(2,1) not null,
  reason text not null,
  changed_by uuid references public.users (id),
  created_at timestamptz not null default now()
);
