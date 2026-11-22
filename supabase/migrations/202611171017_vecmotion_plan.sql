-- vecmotion (Android) plan: a minimal-fee subscription.
--
-- The Android build no longer ships the EPS/SVG/AI/JPG generators, so the
-- desktop plans are the wrong price for it. This plan exists only for the
-- phone: a very small monthly fee that keeps the account active. All tools
-- (metadata, upscaling to 8K, motion, backgrounds, vector conversion) work
-- without it; the plan simply keeps the subscription feature alive at a
-- minimal price. Desktop plans are untouched.
insert into public.plans (slug, name, tier, tagline, features, sort) values
  ('vecmotion', 'vecmotion', 1, 'Minimal fee plan for the Android app',
   '{"vector":false,"jpg":false,"premium_upscale":true,"video_premium":true,"max_export_px":10000,"queue_priority":1}', 0)
on conflict (slug) do nothing;

insert into public.plan_prices (plan_slug, months, price_bdt, price_usd, credits) values
  ('vecmotion', 1, 49, 0.40, 100),
  ('vecmotion', 6, 249, 2.05, 600),
  ('vecmotion', 12, 449, 3.70, 1200)
on conflict (plan_slug, months) do nothing;
