# Hertwill EU Shipping & VAT Context

## Warehouse coverage

Hertwill operates a mix of EU-based and CN-based warehouses. Products shipped from EU warehouses deliver in typical windows of 3–7 business days to most EU destinations. CN-based products can take 10–20 business days and may incur customs handling on the buyer's side.

Prefer products with `ships_to` including the target EU destination AND an EU-shippable flag; use `search_products` with `eu_shippable=true` to filter.

## VAT (20–27% range)

EU VAT rates vary by member state:

- Luxembourg: 17% (below the typical band)
- Germany / France / Spain / Italy: 19–22%
- Nordics + Hungary: 24–27%

Dropshippers selling into the EU must collect VAT at the buyer's country rate (OSS / IOSS scheme applies above certain thresholds). The MCP's `calculate_margin` tool takes a `vat_rate` input — pass the destination country's rate, not a single hardcoded value.

## DDP vs DDU

- **DDP (Delivered Duty Paid)**: the seller pre-pays duties/VAT; the buyer receives the parcel without additional charges at the door. Better customer experience, thinner margins.
- **DDU (Delivered Duty Unpaid)**: the buyer pays duties/VAT on delivery. Worse customer experience, reduces returns/refusals if not disclosed upfront.

Check each Hertwill product's shipping terms before promising "all-in" pricing to end buyers. Hertwill's product responses surface shipping terms where available; when unclear, treat the product as DDU and disclose duties to the buyer.

## Shipping-time expectations to communicate

- EU warehouse → EU buyer: 3–7 business days (promise 5–10 to absorb customs exceptions)
- CN warehouse → EU buyer: 10–20 business days (promise 15–25, flag as "longer shipping" in listings)

## Authoritative source

For the live contract, see [hertwill.com/docs](https://hertwill.com/docs). This resource is a summary for agent-quotable context; the canonical store terms take precedence for real orders.
