-- ════════════════════════════════════════════════════════════════════════════
-- Troca Figurinhas Copa 2026 — Supabase Schema
-- Execute este script no SQL Editor do Supabase (uma única vez)
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. PROFILES (estende auth.users) ─────────────────────────────────────────
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  phone text default '',
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- Auto-criação de perfil quando o usuário se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── 2. STICKERS ──────────────────────────────────────────────────────────────
create table if not exists public.stickers (
  id serial primary key,
  code text unique not null,
  section text not null,
  country text not null,
  number int not null default 0,
  type text default 'comum',
  description text default '',
  flag text default ''
);

create index if not exists idx_stickers_section on public.stickers(section);
create index if not exists idx_stickers_type on public.stickers(type);

-- ─── 3. USER STICKERS ─────────────────────────────────────────────────────────
create table if not exists public.user_stickers (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  sticker_id int references public.stickers(id) on delete cascade,
  quantity int default 0,
  unique(user_id, sticker_id)
);

create index if not exists idx_us_user on public.user_stickers(user_id);
create index if not exists idx_us_sticker on public.user_stickers(sticker_id);

-- ─── 4. TRADE PROPOSALS ───────────────────────────────────────────────────────
create table if not exists public.trade_proposals (
  id serial primary key,
  from_user_id uuid references public.profiles(id) on delete cascade,
  to_user_id uuid references public.profiles(id) on delete cascade,
  status text default 'pendente' check (status in ('pendente', 'aceita', 'recusada', 'cancelada', 'concluída')),
  message text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tp_from on public.trade_proposals(from_user_id);
create index if not exists idx_tp_to on public.trade_proposals(to_user_id);

-- ─── 5. TRADE ITEMS ───────────────────────────────────────────────────────────
create table if not exists public.trade_items (
  id serial primary key,
  trade_proposal_id int references public.trade_proposals(id) on delete cascade,
  sticker_id int references public.stickers(id) on delete cascade,
  direction text not null check (direction in ('give', 'receive')),
  quantity int default 1
);

create index if not exists idx_ti_proposal on public.trade_items(trade_proposal_id);

-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════
alter table public.profiles        enable row level security;
alter table public.stickers        enable row level security;
alter table public.user_stickers   enable row level security;
alter table public.trade_proposals enable row level security;
alter table public.trade_items     enable row level security;

-- ─── PROFILES policies ────────────────────────────────────────────────────────
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ─── STICKERS policies ────────────────────────────────────────────────────────
drop policy if exists "stickers_select" on public.stickers;
create policy "stickers_select" on public.stickers
  for select using (auth.role() = 'authenticated');

drop policy if exists "stickers_admin_all" on public.stickers;
create policy "stickers_admin_all" on public.stickers
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ─── USER_STICKERS policies ───────────────────────────────────────────────────
drop policy if exists "us_select_own" on public.user_stickers;
create policy "us_select_own" on public.user_stickers
  for select using (auth.uid() = user_id);

drop policy if exists "us_manage_own" on public.user_stickers;
create policy "us_manage_own" on public.user_stickers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── TRADE_PROPOSALS policies ─────────────────────────────────────────────────
drop policy if exists "tp_select_related" on public.trade_proposals;
create policy "tp_select_related" on public.trade_proposals
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop policy if exists "tp_insert_own" on public.trade_proposals;
create policy "tp_insert_own" on public.trade_proposals
  for insert with check (auth.uid() = from_user_id);

drop policy if exists "tp_update_related" on public.trade_proposals;
create policy "tp_update_related" on public.trade_proposals
  for update using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- ─── TRADE_ITEMS policies ─────────────────────────────────────────────────────
drop policy if exists "ti_select_related" on public.trade_items;
create policy "ti_select_related" on public.trade_items
  for select using (
    exists (select 1 from public.trade_proposals tp
            where tp.id = trade_proposal_id
            and (tp.from_user_id = auth.uid() or tp.to_user_id = auth.uid()))
  );

drop policy if exists "ti_insert_own" on public.trade_items;
create policy "ti_insert_own" on public.trade_items
  for insert with check (
    exists (select 1 from public.trade_proposals tp
            where tp.id = trade_proposal_id and tp.from_user_id = auth.uid())
  );

-- ════════════════════════════════════════════════════════════════════════════
-- RPC FUNCTIONS
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Buscar oportunidades de troca ────────────────────────────────────────────
create or replace function public.get_opportunities()
returns table (
  user_id uuid,
  user_name text,
  user_phone text,
  i_offer json,
  i_receive json
)
language sql security definer set search_path = public
as $$
  with my_dups as (
    select sticker_id from user_stickers where user_id = auth.uid() and quantity > 1
  ),
  my_owned as (
    select sticker_id from user_stickers where user_id = auth.uid() and quantity > 0
  )
  select
    p.id as user_id,
    p.name as user_name,
    p.phone as user_phone,
    coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'code', s.code, 'country', s.country,
        'flag', s.flag, 'type', s.type, 'section', s.section
      ))
      from my_dups md
      join stickers s on s.id = md.sticker_id
      where not exists (
        select 1 from user_stickers us
        where us.user_id = p.id and us.sticker_id = md.sticker_id and us.quantity > 0
      )
    ), '[]'::json) as i_offer,
    coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'code', s.code, 'country', s.country,
        'flag', s.flag, 'type', s.type, 'section', s.section
      ))
      from user_stickers their_dups
      join stickers s on s.id = their_dups.sticker_id
      where their_dups.user_id = p.id and their_dups.quantity > 1
        and not exists (select 1 from my_owned mo where mo.sticker_id = their_dups.sticker_id)
    ), '[]'::json) as i_receive
  from profiles p
  where p.id != auth.uid() and p.role = 'user';
$$;

-- ─── Concluir uma troca (transação atômica) ───────────────────────────────────
create or replace function public.complete_trade(proposal_id int)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  proposal record;
  item record;
  giver uuid;
  receiver uuid;
begin
  select * into proposal from trade_proposals where id = proposal_id;
  if proposal is null then raise exception 'Proposta não encontrada'; end if;
  if proposal.status != 'aceita' then raise exception 'Proposta precisa estar aceita primeiro'; end if;
  if proposal.from_user_id != auth.uid() and proposal.to_user_id != auth.uid() then
    raise exception 'Sem permissão';
  end if;

  for item in select * from trade_items where trade_proposal_id = proposal_id loop
    if item.direction = 'give' then
      giver := proposal.from_user_id;
      receiver := proposal.to_user_id;
    else
      giver := proposal.to_user_id;
      receiver := proposal.from_user_id;
    end if;

    insert into user_stickers (user_id, sticker_id, quantity) values (giver, item.sticker_id, 0)
      on conflict (user_id, sticker_id) do nothing;
    update user_stickers set quantity = greatest(0, quantity - item.quantity)
      where user_id = giver and sticker_id = item.sticker_id;

    insert into user_stickers (user_id, sticker_id, quantity) values (receiver, item.sticker_id, item.quantity)
      on conflict (user_id, sticker_id) do update set quantity = user_stickers.quantity + item.quantity;
  end loop;

  update trade_proposals set status = 'concluída', updated_at = now() where id = proposal_id;
end;
$$;

-- ─── Estatísticas do usuário ──────────────────────────────────────────────────
create or replace function public.my_stats()
returns json
language sql security definer set search_path = public
as $$
  select json_build_object(
    'total', (select count(*) from stickers),
    'owned', (select count(*) from user_stickers where user_id = auth.uid() and quantity >= 1),
    'duplicates', coalesce((select sum(quantity - 1) from user_stickers where user_id = auth.uid() and quantity > 1), 0),
    'missing', (select count(*) from stickers) - (select count(*) from user_stickers where user_id = auth.uid() and quantity >= 1)
  );
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- SEED — Inserir as 980 figurinhas da Copa 2026
-- ════════════════════════════════════════════════════════════════════════════
insert into public.stickers (code, section, country, number, type, description, flag) values
  ('00', 'INTRO', 'Introdução', 0, 'especial', 'Página de Introdução', '🏆'),
  ('FWC1','FWC','FIFA World Cup 2026',1,'especial','Troféu FIFA','🌍'),
  ('FWC2','FWC','FIFA World Cup 2026',2,'especial','Mascote Oficial','🌍'),
  ('FWC3','FWC','FIFA World Cup 2026',3,'especial','Logo Copa 2026','🌍'),
  ('FWC4','FWC','FIFA World Cup 2026',4,'especial','Sede - Los Angeles','🌍'),
  ('FWC5','FWC','FIFA World Cup 2026',5,'especial','Sede - New York/NJ','🌍'),
  ('FWC6','FWC','FIFA World Cup 2026',6,'especial','Sede - Dallas','🌍'),
  ('FWC7','FWC','FIFA World Cup 2026',7,'especial','Sede - Miami','🌍'),
  ('FWC8','FWC','FIFA World Cup 2026',8,'especial','Sede - San Francisco','🌍'),
  ('FWC9','FWC','FIFA World Cup 2026',9,'especial','Sede - Seattle','🌍'),
  ('FWC10','FWC','FIFA World Cup 2026',10,'especial','Sede - Boston','🌍'),
  ('FWC11','FWC','FIFA World Cup 2026',11,'especial','Sede - Kansas City','🌍'),
  ('FWC12','FWC','FIFA World Cup 2026',12,'especial','Sede - Vancouver','🌍'),
  ('FWC13','FWC','FIFA World Cup 2026',13,'especial','Sede - Toronto','🌍'),
  ('FWC14','FWC','FIFA World Cup 2026',14,'especial','Sede - Guadalajara','🌍'),
  ('FWC15','FWC','FIFA World Cup 2026',15,'especial','Sede - Monterrey','🌍'),
  ('FWC16','FWC','FIFA World Cup 2026',16,'especial','Sede - Cidade do México','🌍'),
  ('FWC17','FWC','FIFA World Cup 2026',17,'especial','Estrelas do Mundo','🌍'),
  ('FWC18','FWC','FIFA World Cup 2026',18,'especial','Grandes Momentos','🌍'),
  ('FWC19','FWC','FIFA World Cup 2026',19,'especial','Copa do Mundo 2026','🌍')
on conflict (code) do nothing;

-- Função auxiliar para inserir 20 figurinhas de um país
do $$
declare
  countries jsonb := '[
    {"code":"MEX","name":"México","flag":"🇲🇽"},
    {"code":"RSA","name":"África do Sul","flag":"🇿🇦"},
    {"code":"KOR","name":"Coreia do Sul","flag":"🇰🇷"},
    {"code":"CZE","name":"República Tcheca","flag":"🇨🇿"},
    {"code":"CAN","name":"Canadá","flag":"🇨🇦"},
    {"code":"BIH","name":"Bósnia e Herzegovina","flag":"🇧🇦"},
    {"code":"QAT","name":"Catar","flag":"🇶🇦"},
    {"code":"SUI","name":"Suíça","flag":"🇨🇭"},
    {"code":"BRA","name":"Brasil","flag":"🇧🇷"},
    {"code":"MAR","name":"Marrocos","flag":"🇲🇦"},
    {"code":"HAI","name":"Haiti","flag":"🇭🇹"},
    {"code":"SCO","name":"Escócia","flag":"🏴"},
    {"code":"USA","name":"Estados Unidos","flag":"🇺🇸"},
    {"code":"PAR","name":"Paraguai","flag":"🇵🇾"},
    {"code":"AUS","name":"Austrália","flag":"🇦🇺"},
    {"code":"TUR","name":"Turquia","flag":"🇹🇷"},
    {"code":"GER","name":"Alemanha","flag":"🇩🇪"},
    {"code":"CUW","name":"Curaçao","flag":"🇨🇼"},
    {"code":"CIV","name":"Costa do Marfim","flag":"🇨🇮"},
    {"code":"ECU","name":"Equador","flag":"🇪🇨"},
    {"code":"NED","name":"Holanda","flag":"🇳🇱"},
    {"code":"JPN","name":"Japão","flag":"🇯🇵"},
    {"code":"SWE","name":"Suécia","flag":"🇸🇪"},
    {"code":"TUN","name":"Tunísia","flag":"🇹🇳"},
    {"code":"BEL","name":"Bélgica","flag":"🇧🇪"},
    {"code":"EGY","name":"Egito","flag":"🇪🇬"},
    {"code":"IRN","name":"Irã","flag":"🇮🇷"},
    {"code":"NZL","name":"Nova Zelândia","flag":"🇳🇿"},
    {"code":"ESP","name":"Espanha","flag":"🇪🇸"},
    {"code":"CPV","name":"Cabo Verde","flag":"🇨🇻"},
    {"code":"KSA","name":"Arábia Saudita","flag":"🇸🇦"},
    {"code":"URU","name":"Uruguai","flag":"🇺🇾"},
    {"code":"FRA","name":"França","flag":"🇫🇷"},
    {"code":"SEN","name":"Senegal","flag":"🇸🇳"},
    {"code":"IRQ","name":"Iraque","flag":"🇮🇶"},
    {"code":"NOR","name":"Noruega","flag":"🇳🇴"},
    {"code":"ARG","name":"Argentina","flag":"🇦🇷"},
    {"code":"ALG","name":"Argélia","flag":"🇩🇿"},
    {"code":"AUT","name":"Áustria","flag":"🇦🇹"},
    {"code":"JOR","name":"Jordânia","flag":"🇯🇴"},
    {"code":"POR","name":"Portugal","flag":"🇵🇹"},
    {"code":"COD","name":"Rep. Dem. do Congo","flag":"🇨🇩"},
    {"code":"UZB","name":"Uzbequistão","flag":"🇺🇿"},
    {"code":"COL","name":"Colômbia","flag":"🇨🇴"},
    {"code":"ENG","name":"Inglaterra","flag":"🏴"},
    {"code":"CRO","name":"Croácia","flag":"🇭🇷"},
    {"code":"GHA","name":"Gana","flag":"🇬🇭"},
    {"code":"PAN","name":"Panamá","flag":"🇵🇦"}
  ]'::jsonb;
  c jsonb;
  i int;
  ttype text;
begin
  for c in select * from jsonb_array_elements(countries) loop
    for i in 1..20 loop
      ttype := case
        when i = 1 then 'escudo'
        when i <= 3 then 'brilhante'
        else 'comum'
      end;
      insert into public.stickers (code, section, country, number, type, description, flag)
      values (
        (c->>'code') || i::text,
        c->>'code',
        c->>'name',
        i,
        ttype,
        case when i = 1 then 'Escudo - ' || (c->>'name') else (c->>'name') || ' ' || i::text end,
        c->>'flag'
      )
      on conflict (code) do nothing;
    end loop;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- COMO PROMOVER UM USUÁRIO A ADMIN
-- ════════════════════════════════════════════════════════════════════════════
-- Após cadastrar seu primeiro usuário pela aplicação, execute (substitua o e-mail):
--
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'seu@email.com');
--
-- ════════════════════════════════════════════════════════════════════════════
