alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, updated_at, created_at)
where onboarding_completed = true and onboarding_completed_at is null;
