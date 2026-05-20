// POPIA / CCPA / GDPR-aligned baseline policy text used when the operator
// hasn't published their own privacy / terms / cookies policy. Surfaces a
// "default text" notice so customers understand this is a platform-provided
// placeholder, not bespoke legal copy, and triggers when the stored policy
// is missing OR is shorter than 100 characters (catches one-word
// placeholders like "Yo-yo" that operators leave in during onboarding).

export function isPlaceholderPolicy(text: string | null | undefined): boolean {
  if (!text) return true;
  const stripped = text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return stripped.length < 100;
}

export function defaultPrivacyPolicy(businessName: string): string {
  const name = businessName || "the operator";
  return `<p class="text-sm italic mb-6 text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
    This is a default privacy notice provided by the booking platform. ${escapeHtml(name)}
    has not yet published a customised policy. Contact ${escapeHtml(name)} directly for
    bespoke privacy questions.
  </p>

  <h2>Who we are</h2>
  <p>This site is operated by ${escapeHtml(name)} ("we", "us", "our"). We process your
  personal information in accordance with South Africa's Protection of Personal Information
  Act, 2013 (POPIA), and where applicable the EU General Data Protection Regulation (GDPR).</p>

  <h2>What we collect</h2>
  <ul>
    <li>Identification: name, email address, phone number, traveller details you provide at booking.</li>
    <li>Booking: tour selected, date and time, party size, special requests, waiver acknowledgement.</li>
    <li>Payment: handled by our payment processor; we do not store full card details on our servers.</li>
    <li>Communication: emails and WhatsApp messages exchanged about your booking.</li>
    <li>Technical: IP address, user agent and session cookies needed to operate the site.</li>
  </ul>

  <h2>Why we process it</h2>
  <ul>
    <li>To create, confirm, modify and cancel your booking and to issue receipts and invoices.</li>
    <li>To communicate with you about your booking, including reminders and weather-related changes.</li>
    <li>To prevent fraud, abuse and double-booking, and to enforce our Terms &amp; Conditions.</li>
    <li>Where required by law (e.g. tax recordkeeping, financial reporting).</li>
    <li>With your consent, to send marketing about future trips; you can opt out at any time.</li>
  </ul>

  <h2>Who we share it with</h2>
  <p>We share the minimum personal information necessary with: payment processors (Yoco, Paysafe,
  PayFast as applicable); email and WhatsApp delivery providers; tour-distribution partners (e.g.
  Viator, GetYourGuide) only where you booked through them; our cloud-hosting providers (Supabase,
  Vercel) acting as data processors under contract; and law-enforcement or regulators where legally
  required. We do not sell your personal information.</p>

  <h2>How long we keep it</h2>
  <p>Booking, financial and tax records are retained for the period required by South African law
  (typically 5 years). Marketing consent records are retained while consent is active and for a
  reasonable period after revocation to evidence opt-out. Other personal information is retained
  only as long as needed to provide the services you've requested.</p>

  <h2>Your rights under POPIA / GDPR</h2>
  <p>You may request access to a copy of the personal information we hold about you, ask us to
  correct inaccurate information, or ask us to delete your information ("right to be forgotten").
  Submit any of these via the <a href="/popia" class="underline">Privacy Request</a> form. Deletion
  requests are subject to a 30-day cooling-off period after confirmation, and to legal record-keeping
  obligations that may require us to retain anonymised financial records.</p>

  <h2>Cookies</h2>
  <p>We use strictly necessary cookies to operate the booking site (e.g. session, CSRF protection)
  and optional analytics cookies only with your consent. See our <a href="/cookies" class="underline">Cookies Policy</a>.</p>

  <h2>Security</h2>
  <p>Personal information is encrypted in transit (TLS 1.2+) and sensitive credentials (payment
  keys, WhatsApp tokens, bank details) are encrypted at rest using AES-256. Access is restricted
  to authorised operator staff under role-based access control.</p>

  <h2>How to contact us / lodge a complaint</h2>
  <p>For privacy queries, contact ${escapeHtml(name)} via the contact details on this site, or
  submit a <a href="/popia" class="underline">Privacy Request</a>. You also have the right to
  lodge a complaint with the South African Information Regulator: <a href="https://inforegulator.org.za" target="_blank" rel="noopener noreferrer" class="underline">inforegulator.org.za</a>.</p>`;
}

export function defaultTerms(businessName: string): string {
  const name = businessName || "the operator";
  return `<p class="text-sm italic mb-6 text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
    These are default terms provided by the booking platform. ${escapeHtml(name)} has not yet
    published customised terms. Contact ${escapeHtml(name)} directly for the latest version.
  </p>

  <h2>Booking</h2>
  <p>By completing a booking with ${escapeHtml(name)} ("we", "us"), you confirm the details supplied
  are accurate and that all travellers in your party agree to these terms. A booking is only confirmed
  once payment has cleared and you have received a confirmation email.</p>

  <h2>Payment</h2>
  <p>Full payment is taken at booking unless otherwise stated. Card payments are processed by our
  payment partners; we do not store full card details.</p>

  <h2>Cancellation &amp; refunds</h2>
  <p>Refund eligibility depends on how far in advance you cancel and is shown on the booking page
  before you confirm. Weather-related cancellations called by ${escapeHtml(name)} are refunded in full
  or rescheduled at no charge.</p>

  <h2>Safety, fitness &amp; waivers</h2>
  <p>Adventure tourism carries inherent risk. You confirm participants are of sound health, can swim
  to a reasonable standard (where the activity requires it), and will follow guide instructions at
  all times. A signed waiver may be required before participating.</p>

  <h2>Photos</h2>
  <p>Guides may take photos during the trip. By participating you consent to ${escapeHtml(name)}
  using anonymised photos for marketing; opt out at the start of your trip if you'd prefer not to
  be photographed.</p>

  <h2>Liability</h2>
  <p>${escapeHtml(name)}'s liability is limited as set out in South African consumer protection law.
  Nothing in these terms excludes liability for death or personal injury caused by negligence.</p>

  <h2>Changes</h2>
  <p>We may update these terms from time to time. The version shown at the time of your booking
  governs that booking.</p>`;
}

export function defaultCookies(businessName: string): string {
  const name = businessName || "the operator";
  return `<p class="text-sm italic mb-6 text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
    This is a default cookies policy provided by the booking platform. ${escapeHtml(name)} has not
    yet published a customised version.
  </p>

  <h2>What are cookies?</h2>
  <p>Cookies are small text files stored in your browser to remember preferences, keep you signed
  in to your booking lookup, and protect against fraud.</p>

  <h2>Strictly necessary cookies</h2>
  <p>We always set these because the site cannot function without them: session identifiers,
  CSRF tokens, theme selection (light/dark), and tenant resolution (which operator's site you're
  on). These cookies do not track you across other sites and are exempt from consent under
  POPIA / ePrivacy.</p>

  <h2>Optional cookies</h2>
  <p>We only set analytics or marketing cookies with your explicit consent. You can withdraw consent
  at any time via your browser's cookie controls.</p>

  <h2>Third-party cookies</h2>
  <p>Embedded payment pages (Yoco, Paysafe, PayFast) and review sources (Google) may set their
  own cookies when you interact with them. Refer to their respective cookie policies.</p>

  <h2>Managing cookies</h2>
  <p>You can block or delete cookies via your browser settings. Disabling strictly-necessary cookies
  will prevent the booking flow from working. For questions, contact ${escapeHtml(name)} via the
  contact details on this site.</p>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
