# BookingTours Partner Widget

Embed our booking flow on your website with two lines.

## Quick start

```html
<div id="bookingtours-widget" data-tenant="aonyx"></div>
<script src="https://booking.bookingtours.co.za/widget.js" async></script>
```

Replace `aonyx` with the operator's slug (we'll send you yours).

## Options

| Attribute | Default | Effect |
|---|---|---|
| `data-tenant` | required | Operator's subdomain (e.g. `aonyx`) |
| `data-tour` | none | Preselect a tour by ID; customer can still pick another |
| `data-bg` | `transparent` | Background colour. Use your site's colour for seamless blending. |
| `data-min-height` | `600` | Initial iframe height in px. Auto-grows after load. |
| `data-host` | auto | Override the iframe origin (useful for local testing). |

## Examples

Embedded with a preselected tour and white background:

```html
<div
  id="bookingtours-widget"
  data-tenant="aonyx"
  data-tour="094c6fc8-8d24-421f-9411-c0e6e55cb09e"
  data-bg="#ffffff"
></div>
<script src="https://booking.bookingtours.co.za/widget.js" async></script>
```

Multiple widgets on one page (use class instead of ID):

```html
<div class="bookingtours-widget" data-tenant="aonyx" data-tour="tour-a-id"></div>
<div class="bookingtours-widget" data-tenant="aonyx" data-tour="tour-b-id"></div>
<script src="https://booking.bookingtours.co.za/widget.js" async></script>
```

## What it does

- Loads the full booking flow as a responsive iframe (height grows with content).
- Customer picks tour, date, time, enters details, pays via Yoco (secure card payment).
- After payment, Yoco redirects to our confirmation page; the customer gets an email.
- We track every widget booking with `source: WIDGET` for attribution.

## Payment flow

When the customer clicks "Pay", they are redirected to Yoco's secure checkout (full-page redirect out of the iframe). After payment completes, Yoco redirects to the booking confirmation page on the operator's site.

## Browser support

Chrome 90+, Safari 14+, Firefox 90+, Edge 90+.

## Get help

Email partners@bookingtours.co.za or open an issue at github.com/bookingtours/widget-issues.
