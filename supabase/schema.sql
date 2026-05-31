-- ============================================================
-- WC 2026 PREDICTOR — SUPABASE SCHEMA
-- Run this in the Supabase SQL editor (Database → SQL Editor)
-- ============================================================

-- PARTICIPANTS
create table if not exists participants (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now(),
  constraint participants_name_key unique (lower(name))
);

-- MATCHES (seeded below)
create table if not exists matches (
  id serial primary key,
  match_num integer not null unique,
  stage text not null,
  home_team text not null,
  away_team text not null,
  match_date text,
  home_score integer,
  away_score integer,
  is_open boolean default false  -- admin opens each round for predictions
);

-- PREDICTIONS
create table if not exists predictions (
  id uuid default gen_random_uuid() primary key,
  participant_id uuid references participants(id) on delete cascade,
  match_id integer references matches(id) on delete cascade,
  home_pred integer,
  away_pred integer,
  points integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(participant_id, match_id)
);

-- TIEBREAKERS
create table if not exists tiebreakers (
  id uuid default gen_random_uuid() primary key,
  participant_id uuid references participants(id) on delete cascade unique,
  tb1 text,   -- Highest attendance: exact figure + stadium name
  tb2 text,   -- Golden Boot winner (player name)
  tb3 text,   -- Highest-scoring team in tournament
  created_at timestamptz default now()
);

-- LEADERBOARD VIEW
create or replace view leaderboard as
select
  p.id,
  p.name,
  coalesce(sum(pr.points), 0)                            as total_points,
  count(pr.id) filter (where pr.points is not null)      as scored_matches,
  count(pr.id) filter (where pr.points = 3)              as exact_scores,
  count(pr.id) filter (where pr.points = 1)              as correct_results,
  count(pr.id) filter (where pr.points = 0)              as wrong,
  count(pr.id) filter (where pr.home_pred is not null)   as predictions_made
from participants p
left join predictions pr on pr.participant_id = p.id
group by p.id, p.name
order by total_points desc, exact_scores desc;

-- RLS — open access (no auth required)
alter table participants  enable row level security;
alter table matches       enable row level security;
alter table predictions   enable row level security;
alter table tiebreakers   enable row level security;

create policy "public_all_participants"  on participants  for all using (true) with check (true);
create policy "public_all_matches"       on matches       for all using (true) with check (true);
create policy "public_all_predictions"   on predictions   for all using (true) with check (true);
create policy "public_all_tiebreakers"   on tiebreakers   for all using (true) with check (true);

-- ENABLE REALTIME on predictions so leaderboard auto-refreshes
alter publication supabase_realtime add table predictions;
alter publication supabase_realtime add table matches;

-- ============================================================
-- SEED: ALL 104 MATCHES
-- ============================================================
insert into matches (match_num, stage, home_team, away_team, match_date, is_open) values
-- Group A
(1,'Group A','Mexico','South Africa','11 Jun',true),
(2,'Group A','South Korea','Czechia','11 Jun',true),
(3,'Group A','Czechia','South Africa','18 Jun',true),
(4,'Group A','Mexico','South Korea','18 Jun',true),
(5,'Group A','Czechia','Mexico','24 Jun',true),
(6,'Group A','South Africa','South Korea','24 Jun',true),
-- Group B
(7,'Group B','Canada','Bosnia & Herz.','12 Jun',true),
(8,'Group B','Qatar','Switzerland','13 Jun',true),
(9,'Group B','Switzerland','Bosnia & Herz.','18 Jun',true),
(10,'Group B','Canada','Qatar','18 Jun',true),
(11,'Group B','Switzerland','Canada','24 Jun',true),
(12,'Group B','Bosnia & Herz.','Qatar','24 Jun',true),
-- Group C
(13,'Group C','Brazil','Morocco','13 Jun',true),
(14,'Group C','Haiti','Scotland','13 Jun',true),
(15,'Group C','Scotland','Morocco','19 Jun',true),
(16,'Group C','Brazil','Haiti','19 Jun',true),
(17,'Group C','Scotland','Brazil','24 Jun',true),
(18,'Group C','Morocco','Haiti','24 Jun',true),
-- Group D
(19,'Group D','USA','Paraguay','12 Jun',true),
(20,'Group D','Australia','Turkey','13 Jun',true),
(21,'Group D','USA','Australia','19 Jun',true),
(22,'Group D','Turkey','Paraguay','19 Jun',true),
(23,'Group D','Turkey','USA','25 Jun',true),
(24,'Group D','Paraguay','Australia','25 Jun',true),
-- Group E
(25,'Group E','Germany','Curaçao','14 Jun',true),
(26,'Group E','Ivory Coast','Ecuador','14 Jun',true),
(27,'Group E','Germany','Ivory Coast','20 Jun',true),
(28,'Group E','Ecuador','Curaçao','20 Jun',true),
(29,'Group E','Ecuador','Germany','25 Jun',true),
(30,'Group E','Curaçao','Ivory Coast','25 Jun',true),
-- Group F
(31,'Group F','Netherlands','Japan','14 Jun',true),
(32,'Group F','Sweden','Tunisia','14 Jun',true),
(33,'Group F','Netherlands','Sweden','20 Jun',true),
(34,'Group F','Tunisia','Japan','20 Jun',true),
(35,'Group F','Japan','Sweden','25 Jun',true),
(36,'Group F','Tunisia','Netherlands','25 Jun',true),
-- Group G
(37,'Group G','Belgium','Egypt','15 Jun',true),
(38,'Group G','Iran','New Zealand','15 Jun',true),
(39,'Group G','Belgium','Iran','21 Jun',true),
(40,'Group G','New Zealand','Egypt','21 Jun',true),
(41,'Group G','Egypt','Iran','26 Jun',true),
(42,'Group G','New Zealand','Belgium','26 Jun',true),
-- Group H
(43,'Group H','Spain','Cape Verde','15 Jun',true),
(44,'Group H','Saudi Arabia','Uruguay','15 Jun',true),
(45,'Group H','Spain','Saudi Arabia','21 Jun',true),
(46,'Group H','Uruguay','Cape Verde','21 Jun',true),
(47,'Group H','Cape Verde','Saudi Arabia','26 Jun',true),
(48,'Group H','Uruguay','Spain','26 Jun',true),
-- Group I
(49,'Group I','France','Senegal','16 Jun',true),
(50,'Group I','Iraq','Norway','16 Jun',true),
(51,'Group I','France','Iraq','22 Jun',true),
(52,'Group I','Norway','Senegal','22 Jun',true),
(53,'Group I','Norway','France','26 Jun',true),
(54,'Group I','Senegal','Iraq','26 Jun',true),
-- Group J
(55,'Group J','Argentina','Algeria','16 Jun',true),
(56,'Group J','Austria','Jordan','16 Jun',true),
(57,'Group J','Argentina','Austria','22 Jun',true),
(58,'Group J','Jordan','Algeria','22 Jun',true),
(59,'Group J','Algeria','Austria','27 Jun',true),
(60,'Group J','Argentina','Jordan','27 Jun',true),
-- Group K
(61,'Group K','Portugal','DR Congo','17 Jun',true),
(62,'Group K','Uzbekistan','Colombia','17 Jun',true),
(63,'Group K','Portugal','Uzbekistan','23 Jun',true),
(64,'Group K','Colombia','DR Congo','23 Jun',true),
(65,'Group K','Portugal','Colombia','27 Jun',true),
(66,'Group K','DR Congo','Uzbekistan','27 Jun',true),
-- Group L
(67,'Group L','England','Croatia','17 Jun',true),
(68,'Group L','Ghana','Panama','17 Jun',true),
(69,'Group L','England','Ghana','23 Jun',true),
(70,'Group L','Panama','Croatia','23 Jun',true),
(71,'Group L','Panama','England','27 Jun',true),
(72,'Group L','Croatia','Ghana','27 Jun',true),
-- Round of 32
(73,'Round of 32','Runner-up Grp A','Runner-up Grp B','28 Jun',false),
(74,'Round of 32','Winner Grp E','Best 3rd A/B/C/D/F','29 Jun',false),
(75,'Round of 32','Winner Grp F','Runner-up Grp C','29 Jun',false),
(76,'Round of 32','Winner Grp C','Runner-up Grp F','29 Jun',false),
(77,'Round of 32','Winner Grp I','Best 3rd C/D/F/G/H','30 Jun',false),
(78,'Round of 32','Runner-up Grp E','Runner-up Grp I','30 Jun',false),
(79,'Round of 32','Winner Grp A','Best 3rd C/E/F/H/I','30 Jun',false),
(80,'Round of 32','Winner Grp L','Best 3rd E/H/I/J/K','1 Jul',false),
(81,'Round of 32','Winner Grp D','Best 3rd B/E/F/I/J','1 Jul',false),
(82,'Round of 32','Winner Grp G','Best 3rd A/E/H/I/J','1 Jul',false),
(83,'Round of 32','Runner-up Grp K','Runner-up Grp L','2 Jul',false),
(84,'Round of 32','Winner Grp H','Runner-up Grp J','2 Jul',false),
(85,'Round of 32','Winner Grp B','Best 3rd E/F/G/I/J','2 Jul',false),
(86,'Round of 32','Winner Grp J','Runner-up Grp H','3 Jul',false),
(87,'Round of 32','Winner Grp K','Best 3rd D/E/I/J/L','3 Jul',false),
(88,'Round of 32','Runner-up Grp D','Runner-up Grp G','3 Jul',false),
-- Round of 16
(89,'Round of 16','Winner M74','Winner M77','4 Jul',false),
(90,'Round of 16','Winner M73','Winner M75','4 Jul',false),
(91,'Round of 16','Winner M76','Winner M78','5 Jul',false),
(92,'Round of 16','Winner M79','Winner M80','5 Jul',false),
(93,'Round of 16','Winner M83','Winner M84','6 Jul',false),
(94,'Round of 16','Winner M85','Winner M86','6 Jul',false),
(95,'Round of 16','Winner M81','Winner M82','7 Jul',false),
(96,'Round of 16','Winner M87','Winner M88','7 Jul',false),
-- Quarter-Finals
(97,'Quarter-Final','Winner M89','Winner M90','9 Jul',false),
(98,'Quarter-Final','Winner M91','Winner M92','10 Jul',false),
(99,'Quarter-Final','Winner M93','Winner M94','11 Jul',false),
(100,'Quarter-Final','Winner M95','Winner M96','11 Jul',false),
-- Semi-Finals
(101,'Semi-Final','Winner M97','Winner M98','14 Jul',false),
(102,'Semi-Final','Winner M99','Winner M100','15 Jul',false),
-- 3rd Place + Final
(103,'3rd Place','Loser M101','Loser M102','18 Jul',false),
(104,'Final','Winner M101','Winner M102','19 Jul',false)
on conflict (match_num) do nothing;
