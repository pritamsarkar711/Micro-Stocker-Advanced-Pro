# Pricing, credits and what an action costs

All money is shown and charged in Bangladeshi taka. The numbers below are the
live values in `plans`, `plan_prices` and `app_settings`; nothing is hard coded
in the interface, so the admin console and the subscription page always agree.

## Plans

| Plan | 1 month | 6 months (per month) | 12 months (per month) | Credits per term |
| --- | --- | --- | --- | --- |
| Starter | ৳299 | ৳1,590 (৳265) | ৳2,690 (৳224) | 150 / 900 / 1,800 |
| Standard | ৳699 | ৳3,690 (৳615) | ৳6,290 (৳524) | 450 / 2,700 / 5,400 |
| Professional | ৳1,299 | ৳6,890 (৳1,148) | ৳11,690 (৳974) | 1,200 / 7,200 / 14,400 |

In USD at the configured `fx_bdt_usd = 122`: 2.45 / 13.05 / 22.05, 5.75 / 30.25 /
51.55 and 10.65 / 56.50 / 95.80. The longer terms give the same total credits per
month (150, 450, 1,200) for a lower price: 11–12% off at six months.

Revenue per credit therefore ranges from ৳0.812 (Professional, yearly) to ৳1.99
(Starter, monthly). Every cost calculation below uses the **worst** case, ৳0.812.

## Credit prices per action

| Action | Credits | Worst case revenue | Typical upstream cost |
| --- | --- | --- | --- |
| Vector / EPS / SVG / AI brief | 2 | ৳1.62 | Kimi K2.5 ≈ ৳1.19, DeepSeek Flash ≈ ৳0.48 |
| JPG studio render | 8 | ৳6.50 | gpt-image-1 ≈ ৳4.88 per image |
| Premium upscale (per image) | 2 | ৳1.62 | runs on the customer's device |
| Premium video upscale (per clip) | 6 | ৳4.87 | runs on the customer's device |

Worst case gross margin is about 25% (Professional paid yearly, spending every
credit on the most expensive model) and 50–70% on the shorter terms. A failed
job is refunded automatically, and credits stay in the wallet when a plan lapses.

Credit prices live in `app_settings.credits`, editable under **Admin console →
Settings → Credit cost per action**. The subscription page and the generator
buttons read them from the entitlement, so a change is visible everywhere on the
next reload.

Model costs live per model in `ai_models.cost_in_per_mtok`, `cost_out_per_mtok`
and `cost_per_image_usd`, editable under **Admin console → Providers → Models**
in BDT per million tokens. `pro_admin_stats()` compares revenue with
`api_usage.cost_usd` and shows the resulting margin on the Overview tab.

## Limits

| Setting | Value | Where |
| --- | --- | --- |
| Generations per day | 60 | `app_settings.limits.daily_generations` |
| Generations per minute | 6 | `rate_gen_per_minute` |
| Prompt length | 600 characters | `max_prompt_chars` |
| Pending orders per customer | 3 | `max_pending_orders` |
| bKash / Nagad order window | 90 minutes | `payment.order_ttl_minutes` |
| Crypto invoice window | 120 minutes | `crypto_ttl_minutes` |
| Free tier | converters, optimiser, background remover, standard upscales, Vector Studio, 2,000 px exports | `app_settings.free_tier` |

## Activating and expiring

* A plan starts when the payment is approved, not when the order is created.
* Renewing before the expiry **adds** the new months to the end of the current
  one; the days already paid for are never lost.
* Entitlement is decided by `expires_at > now()`, so access drops the second the
  date passes even before the hourly sweep marks the row `expired`.
* **Admin console → Security → Run expiry sweep** does the bookkeeping.

## Changing prices safely

1. **Admin console → Plans**: price and credits per term. Existing customers keep
   the credits they already bought; only new orders use the new numbers.
2. **Admin console → Settings → Credit cost per action** when the upstream price
   moves. Check that `price_per_credit × credits_per_action` still beats the
   model cost table.
3. Re-read the two tables above after any change: the margin is the only number
   that must never go negative.
