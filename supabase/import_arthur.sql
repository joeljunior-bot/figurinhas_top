-- ════════════════════════════════════════════════════════════════════════════
-- Importar coleção do Arthur Andrade (aaraujocelular@gmail.com)
-- Pré-requisito: Arthur precisa estar cadastrado em auth.users
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  target_id uuid;
  missing_codes text[] := array[
    'ALG3','ALG4','ALG7','ALG8','ALG11','ALG13','ALG16','ALG19','ALG20',
    'ARG4','ARG5','ARG6','ARG9','ARG10','ARG11','ARG13','ARG14','ARG18','ARG20',
    'AUS1','AUS4','AUS6','AUS7','AUS8','AUS11','AUS12','AUS13','AUS15','AUS16','AUS17','AUS18','AUS20',
    'AUT2','AUT5','AUT6','AUT8','AUT9','AUT10','AUT11','AUT13','AUT14','AUT15','AUT16','AUT18','AUT19',
    'BEL3','BEL4','BEL5','BEL6','BEL7','BEL8','BEL10','BEL11','BEL17','BEL18','BEL20',
    'BIH1','BIH2','BIH4','BIH5','BIH6','BIH8','BIH9','BIH10','BIH11','BIH12','BIH13','BIH14','BIH15','BIH16','BIH17','BIH18','BIH19','BIH20',
    'BRA1','BRA2','BRA6','BRA7','BRA9','BRA12','BRA13','BRA15','BRA18','BRA20',
    'CAN1','CAN3','CAN4','CAN6','CAN8','CAN10','CAN11','CAN12','CAN13','CAN15','CAN20',
    'CIV1','CIV8','CIV9','CIV10','CIV12','CIV13','CIV14','CIV15','CIV17','CIV18','CIV19',
    'COD1','COD2','COD3','COD4','COD5','COD6','COD7','COD8','COD9','COD10','COD11','COD12','COD13','COD14','COD15','COD16','COD17','COD18','COD19','COD20',
    'COL3','COL4','COL6','COL7','COL10','COL11','COL12','COL15','COL16','COL17','COL19','COL20',
    'CPV1','CPV2','CPV4','CPV5','CPV6','CPV9','CPV10','CPV14','CPV15','CPV17','CPV18','CPV19',
    'CRO1','CRO2','CRO3','CRO8','CRO9','CRO11','CRO12','CRO13','CRO15','CRO16','CRO20',
    'CUW1','CUW4','CUW6','CUW8','CUW10','CUW11','CUW13','CUW15','CUW18','CUW19',
    'CZE1','CZE2','CZE3','CZE4','CZE5','CZE6','CZE7','CZE8','CZE9','CZE10','CZE11','CZE12','CZE13','CZE14','CZE15','CZE16','CZE17','CZE18','CZE19','CZE20',
    'ECU1','ECU2','ECU3','ECU4','ECU8','ECU12','ECU13','ECU16','ECU17',
    'EGY2','EGY5','EGY6','EGY9','EGY10','EGY14','EGY15','EGY18','EGY19',
    'ENG1','ENG3','ENG4','ENG7','ENG8','ENG10','ENG11','ENG12','ENG13','ENG15','ENG16','ENG17','ENG18','ENG20',
    'ESP2','ESP3','ESP4','ESP5','ESP6','ESP7','ESP8','ESP9','ESP10','ESP11','ESP12','ESP13','ESP14','ESP15','ESP18','ESP19',
    'FRA1','FRA3','FRA4','FRA7','FRA8','FRA11','FRA13','FRA15','FRA16','FRA19',
    'FWC1','FWC2','FWC3','FWC4','FWC5','FWC6','FWC7','FWC8','FWC10','FWC11','FWC12','FWC13','FWC14','FWC15','FWC17','FWC18','FWC19',
    'GER5','GER6','GER7','GER8','GER10','GER11','GER12','GER13','GER14','GER15','GER16','GER17','GER18','GER19',
    'GHA2','GHA3','GHA5','GHA6','GHA7','GHA9','GHA11','GHA13','GHA16','GHA18','GHA19','GHA20',
    'HAI1','HAI2','HAI4','HAI5','HAI6','HAI9','HAI10','HAI11','HAI13','HAI14','HAI15','HAI16','HAI18','HAI19','HAI20',
    'IRN3','IRN7','IRN11','IRN12','IRN13','IRN15','IRN16','IRN17','IRN20',
    'IRQ1','IRQ2','IRQ3','IRQ4','IRQ5','IRQ6','IRQ7','IRQ8','IRQ9','IRQ10','IRQ11','IRQ12','IRQ13','IRQ14','IRQ15','IRQ16','IRQ17','IRQ18','IRQ19','IRQ20',
    'JOR1','JOR2','JOR5','JOR8','JOR9','JOR10','JOR11','JOR13','JOR14','JOR15','JOR16','JOR17','JOR18','JOR19',
    'JPN1','JPN3','JPN4','JPN7','JPN8','JPN11','JPN12','JPN13','JPN16','JPN17','JPN20',
    'KOR2','KOR5','KOR6','KOR10','KOR13','KOR19',
    'KSA1','KSA3','KSA4','KSA7','KSA8','KSA11','KSA12','KSA13','KSA16','KSA17','KSA19','KSA20',
    'MAR2','MAR4','MAR5','MAR6','MAR9','MAR10','MAR12','MAR13','MAR14','MAR16','MAR17','MAR18','MAR20',
    'MEX2','MEX3','MEX5','MEX6','MEX7','MEX8','MEX9','MEX10','MEX11','MEX12','MEX13','MEX14','MEX16','MEX20',
    'NED5','NED6','NED9','NED13','NED14','NED17','NED19',
    'NOR2','NOR3','NOR4','NOR5','NOR6','NOR7','NOR8','NOR11','NOR12','NOR13','NOR15','NOR16','NOR17','NOR19','NOR20',
    'NZL1','NZL2','NZL3','NZL5','NZL6','NZL7','NZL8','NZL9','NZL10','NZL11','NZL13','NZL14','NZL15','NZL16','NZL17','NZL18','NZL19','NZL20',
    'PAN1','PAN3','PAN4','PAN5','PAN7','PAN8','PAN9','PAN10','PAN11','PAN12','PAN13','PAN15','PAN16','PAN17','PAN18','PAN19','PAN20',
    'PAR1','PAR2','PAR4','PAR5','PAR9','PAR10','PAR12','PAR13','PAR14','PAR15','PAR17','PAR18','PAR19','PAR20',
    'POR1','POR2','POR3','POR4','POR5','POR6','POR10','POR13','POR15','POR19',
    'QAT4','QAT5','QAT10','QAT13','QAT14','QAT15','QAT16','QAT18','QAT20',
    'RSA4','RSA8','RSA11','RSA13','RSA17','RSA18','RSA20',
    'SCO1','SCO5','SCO6','SCO7','SCO8','SCO9','SCO10','SCO12','SCO13','SCO14','SCO15','SCO16','SCO18','SCO19','SCO20',
    'SEN1','SEN3','SEN4','SEN7','SEN8','SEN11','SEN12','SEN13','SEN15','SEN16',
    'SUI1','SUI2','SUI5','SUI8','SUI9','SUI10','SUI11','SUI12','SUI13','SUI14','SUI15','SUI16','SUI17','SUI18','SUI19','SUI20',
    'SWE1','SWE2','SWE3','SWE4','SWE5','SWE6','SWE7','SWE8','SWE9','SWE10','SWE11','SWE12','SWE13','SWE14','SWE15','SWE16','SWE17','SWE18','SWE19','SWE20',
    'TUN2','TUN3','TUN4','TUN5','TUN6','TUN7','TUN8','TUN9','TUN10','TUN11','TUN12','TUN13','TUN14','TUN16','TUN17','TUN18','TUN19','TUN20',
    'TUR1','TUR2','TUR3','TUR4','TUR5','TUR6','TUR7','TUR8','TUR9','TUR10','TUR11','TUR12','TUR13','TUR14','TUR15','TUR16','TUR17','TUR18','TUR19','TUR20',
    'URU2','URU3','URU4','URU5','URU6','URU7','URU8','URU9','URU12','URU14','URU15','URU16','URU17','URU18','URU19','URU20',
    'USA1','USA2','USA3','USA4','USA5','USA6','USA7','USA8','USA9','USA10','USA11','USA12','USA13','USA14','USA15','USA16','USA17','USA18','USA19','USA20',
    'UZB1','UZB2','UZB3','UZB4','UZB5','UZB6','UZB7','UZB8','UZB9','UZB11','UZB12','UZB13','UZB16','UZB17','UZB18','UZB19','UZB20'
  ];
  dup_codes jsonb := '{
    "RSA15":2,"RSA2":1,"RSA5":1,"RSA12":1,"RSA14":1,"RSA19":3,
    "KSA2":1,"KSA5":1,"KSA6":1,"KSA10":1,"KSA18":1,
    "ALG1":1,
    "ARG12":1,"ARG19":1,
    "BEL14":2,"BEL12":1,"BEL15":1,"BEL16":1,
    "BRA3":1,"BRA4":1,
    "CPV20":2,"CPV11":1,"CPV16":1,
    "COL5":1,"COL14":1,"COL18":1,
    "KOR8":2,"KOR11":2,"KOR16":1,"KOR20":1,
    "CIV4":1,"CIV6":1,
    "CRO5":2,"CRO6":1,"CRO14":1,"CRO18":1,
    "CUW3":1,
    "EGY3":2,"EGY7":2,"EGY1":1,"EGY4":1,"EGY11":1,"EGY17":1,
    "ECU5":1,"ECU18":1,"ECU19":1,
    "SCO4":1,"SCO3":3,
    "FRA5":1,"FRA6":1,"FRA9":1,"FRA14":1,
    "GHA1":1,
    "HAI8":1,
    "ENG9":1,
    "IRN6":1,"IRN10":1,"IRN18":1,
    "JPN14":1,"JPN18":1,
    "MAR3":1,
    "MEX15":2,
    "SEN2":2,"SEN18":2,"SEN19":2,"SEN6":1,"SEN9":1,"SEN10":1
  }'::jsonb;
  total_owned int;
  total_dup int;
begin
  -- Localiza Arthur
  select id into target_id from auth.users where email = 'aaraujocelular@gmail.com';
  if target_id is null then
    raise exception 'Usuário aaraujocelular@gmail.com não está cadastrado. Peça para o Arthur acessar a aplicação e fazer cadastro primeiro.';
  end if;

  -- Garantir que tem perfil
  insert into public.profiles (id, name, phone, role)
  values (target_id, 'Arthur Andrade', '', 'user')
  on conflict (id) do nothing;

  -- Reset da coleção atual
  delete from public.user_stickers where user_id = target_id;

  -- Insere todas as figurinhas que ele TEM (não estão no missing) com quantidade 1
  insert into public.user_stickers (user_id, sticker_id, quantity)
  select target_id, s.id, 1
  from public.stickers s
  where s.code <> all(missing_codes);

  -- Atualiza as repetidas (quantity = 1 + número de repetidas)
  update public.user_stickers us
  set quantity = 1 + (dup_codes->>s.code)::int
  from public.stickers s
  where us.user_id = target_id
    and us.sticker_id = s.id
    and dup_codes ? s.code;

  -- Estatísticas finais
  select count(*), coalesce(sum(case when quantity > 1 then quantity - 1 else 0 end), 0)
  into total_owned, total_dup
  from public.user_stickers
  where user_id = target_id and quantity >= 1;

  raise notice '✅ Coleção do Arthur importada com sucesso!';
  raise notice '   Figurinhas que ele tem: %', total_owned;
  raise notice '   Cópias repetidas (para troca): %', total_dup;
  raise notice '   Faltam: %', 980 - total_owned;
end $$;
