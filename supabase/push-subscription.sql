create table if not exists "PushSubscription" (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  targets text[] default '{}',
  leads int[] default '{30}',
  userAgent text,
  timezone text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);


