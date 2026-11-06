create or replace function public.nearby_courts(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision default 15000,
  p_limit integer default 200
)
returns table (
  id uuid, name text, lat double precision, lng double precision,
  address text, surface_type text, hoop_count integer,
  venue_type text, sport text, status text, distance_m double precision
)
language sql
stable
set search_path = public
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select c.id, c.name, c.lat, c.lng, c.address, c.surface_type, c.hoop_count,
         c.venue_type, c.sport, c.status,
         st_distance(c.location, o.g) as distance_m
  from courts c, origin o
  where coalesce(c.status, 'active') = 'active'
    and st_dwithin(c.location, o.g, p_radius_m)
  order by c.location <-> o.g
  limit p_limit;
$$;

grant execute on function public.nearby_courts(double precision, double precision, double precision, integer)
  to anon, authenticated;
