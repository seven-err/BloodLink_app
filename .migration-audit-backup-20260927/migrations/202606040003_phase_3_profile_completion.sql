-- BloodLink Phase 3 profile completion support

alter table public.profiles
add column if not exists birthdate date;


-- phase 4

alter table public.profiles
add column if not exists weight_kg numeric(5,2),
add column if not exists last_donation_at date;