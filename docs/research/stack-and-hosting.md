# Stack and hosting research

The findings behind [ADR-001](../adr/001-static-netlify-core-files.md), gathered for spike [#2](https://github.com/Johnesco/karaokeunderground/issues/2) on 2026-09-23. Each fact links its source. Dates in brackets are the source page's own "last updated" or publish date. "Unverified" marks what we couldn't confirm.

## Hosts

### Netlify

- **The free plan** costs $0 for 300 credits a month, and the cap is hard ([2026-09-01](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)).
- **What uses credits:** each production deploy costs 15, each GB of bandwidth 20, and each 10,000 requests 2. Deploy previews cost nothing, and build minutes aren't counted ([2026-08-12](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)).
- **When credits run out,** "all of your web projects (sites/apps) are paused", and visitors get a "Site not available" page (same source).
- **Commercial use:** the launch post for the free plan says "you can deploy commercial projects" ([2024-11-12](https://www.netlify.com/blog/introducing-netlify-free-plan/)). Whether that still holds under credits: unverified.
- **Query-string redirects:** `_redirects` rules can match query parameters, as in `/store id=:id /blog/:id 301` ([2026-09-17](https://docs.netlify.com/manage/routing/redirects/redirect-options/)).
  - A rule only matches URLs that have exactly those parameters, and it passes the query string on.
  - A rule on `/` needs forcing (`!`) to beat `index.html`, and a plain `/` still serves the homepage ([2025-07-14](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/)).
  - Netlify staff said in 2023 that a rule can't match a specific value, only a placeholder ([forum](https://answers.netlify.com/t/301-redirects-with-query-string-colon-works-but-question-mark-does-not/90532/5)). Whether that's still true: unverified.
- **Forms** are "free and unlimited" on credit plans ([2026-09-16](https://docs.netlify.com/manage/forms/usage-and-billing/)). Akismet checks every submission, with an optional honeypot and reCAPTCHA ([2025-07-14](https://docs.netlify.com/manage/forms/spam-filters/)). Email notifications are available ([2026-09-16](https://docs.netlify.com/manage/forms/notifications/)).
- **Build hooks** trigger a deploy with a POST to a URL ([2026-09-17](https://docs.netlify.com/build/configure-builds/build-hooks/)).
- **Transferring a project** needs the Team Owner role on the current team and Owner or Developer on the receiving team; otherwise, contact support ([2026-06-09](https://docs.netlify.com/manage/projects/transfer-project/)). Free projects are single-seat ([2026-08-19](https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/)).
- **Keeping a preview private:** password protection and basic auth are Pro-only. A "Private" free project is visible only to the Team Owner ([2026-08-19](https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/)).
- **Netlify Identity** is still supported: its 2025 deprecation was reversed ([2026-02-19](https://www.netlify.com/blog/auth0-extension-identity-changes/)). **Git Gateway** is deprecated and gets no fixes ([2026-09-17](https://docs.netlify.com/manage/security/secure-access-to-sites/git-gateway/)).

### Cloudflare Pages

- **The free plan** gives 500 builds a month, and requests for static files are "free and unlimited" ([limits, 2026-09-05](https://developers.cloudflare.com/pages/platform/limits/); [pricing, 2026-08-28](https://developers.cloudflare.com/workers/platform/pricing/)).
- **Commercial use:** the [terms](https://www.cloudflare.com/terms/) don't bar it. The [plans page](https://www.cloudflare.com/plans/) describes Free as for projects "that aren't business-critical".
- **Redirects:** `_redirects` can't match query parameters ([2026-08-25](https://developers.cloudflare.com/pages/configuration/redirects/)). Zone-level Single Redirects can, since wildcard matching covers the full URL, query string included ([2026-04-16](https://developers.cloudflare.com/ruleset-engine/rules-language/operators/)). They need the domain's DNS on Cloudflare, and the free plan gets 10 rules ([2026-08-14](https://developers.cloudflare.com/rules/url-forwarding/)).
- **Forms:** there's no built-in form service; the Static Forms plugin hands submissions to code you write ([2026-04-21](https://developers.cloudflare.com/pages/functions/plugins/static-forms/)).
- **Private previews:** Cloudflare Access can protect previews, and Zero Trust is free for up to 50 users ([docs, 2026-06-03](https://developers.cloudflare.com/pages/configuration/preview-deployments/); [Access](https://www.cloudflare.com/sase/products/access/)).

### GitHub Pages

- **Commercial use:** it's not for running "your online business, e-commerce site" or SaaS ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)).
- **Redirects:** the docs describe no server-side redirects. The supported redirect plugin serves meta-refresh pages ([jekyll-redirect-from](https://github.com/jekyll/jekyll-redirect-from)).

### Vercel

- **Hobby** is "restricted to non-commercial personal use only", and being paid to host a site counts as commercial ([2026-09-14](https://vercel.com/docs/limits/fair-use-guidelines)).
- **Redirects** can match query values with `has` ([2026-08-14](https://vercel.com/docs/project-configuration/vercel-json)).
- **Private previews:** password protection isn't on Hobby; on Pro it costs $20 per project per month ([2026-09-15](https://vercel.com/docs/deployment-protection/usage-and-pricing)).

## Email, once the site leaves the current host

- **Cloudflare Email Routing:** free and unlimited forwarding, but it requires Cloudflare DNS and can't be combined with external mail servers ([2026-06-09](https://developers.cloudflare.com/email-service/get-started/route-emails/); [2026-09-16](https://developers.cloudflare.com/email-service/configuration/domains/)).
- **ImprovMX Free:** 1 domain, 25 aliases, 500 forwards a day, and no sending by SMTP ([pricing](https://improvmx.com/pricing/)).
- **Zoho Mail Forever Free:** up to 5 users with 5 GB each, but no IMAP or POP, and only in some regions ([pricing](https://www.zoho.com/mail/zohomail-pricing.html)).

## Editing

### Google Sheets

- **"Publish to the web" as CSV** is still offered, with automatic republishing. Google says updates "might take a few minutes" ([help](https://support.google.com/docs/answer/183965)). The published CSV was observed carrying a 5-minute cache.
- **Apps Script** can POST to a URL from a custom menu item, for example to trigger a build hook ([UrlFetchApp](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app), [menus](https://developers.google.com/apps-script/guides/menus)).

### Git-based editors

| Tool | Latest release | How editors log in | Cost for one or two editors |
|---|---|---|---|
| [Decap CMS](https://github.com/decaporg/decap-cms/releases) | 3.16.3 (2026-09-22) | A GitHub account each. The hosted [Decap Turbo](https://decapcms.org/docs/turbo-how-it-works/) (beta) needs no Git account | Free. Turbo: free for 1 seat, €19/month for 5 |
| [Sveltia CMS](https://github.com/sveltia/sveltia-cms/releases) | 0.219.0 (2026-09-23), pre-1.0 | A Git host account ([docs](https://sveltiacms.app/en/docs/backends)) | Free |
| [Pages CMS](https://github.com/hunvreus/pagescms/releases) | 2.1.8 (2026-06-08) | GitHub, or an email invitation ([docs](https://pagescms.org/docs/configuration/collaborators/)) | Free |
| [TinaCMS](https://github.com/tinacms/tinacms/releases) | 3.14.1 (2026-09-23) | Email sign-up on TinaCloud; only the setup needs GitHub ([FAQ](https://tina.io/docs/faq)) | Free for 2 users ([pricing](https://tina.io/pricing)) |

Phone support: Sveltia and Pages CMS say they're built for mobile. For Decap and TinaCMS it's unverified.

## Site generators

- **Eleventy:** the latest stable version is 3.1.6 (2026-06-02). It's being renamed "Build Awesome", and Font Awesome says it "will always be free and open source" ([releases](https://github.com/11ty/buildawesome/releases), [announcement](https://www.11ty.dev/blog/build-awesome/), [Font Awesome](https://blog.fontawesome.com/pausing-kickstarter/)).
- **Astro:** version 7 came out on 2026-06-22. It sends zero JavaScript by default, and Cloudflare bought the company behind it on 2026-01-16 ([Astro 7](https://astro.build/blog/astro-7/), [why Astro](https://docs.astro.build/en/concepts/why-astro/), [Cloudflare](https://astro.build/blog/joining-cloudflare/)).
