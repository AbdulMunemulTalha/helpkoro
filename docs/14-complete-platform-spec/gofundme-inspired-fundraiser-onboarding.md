# GoFundMe-Inspired Fundraiser Onboarding

## Product decision

HelpKoro uses the same proven fundraising sequence as GoFundMe: answer a few simple questions first, tell the story, add media, preview and launch, then receive guided sharing and payout setup. This is an interaction-pattern benchmark, not a copy of GoFundMe branding, wording, visual design, proprietary tools, or country rules.

The onboarding must feel possible to complete in minutes on a phone while deferring only the information that is safely collected after publication. It must remain truthful about review and payout requirements; a quick setup cannot bypass safety, identity, payment, or legal controls.

## Required funnel and screen contract

### Step 0: Start fundraiser

Route: /start. Show a short promise: create, share, and receive support. Offer Bangla and English. Explain that the fundraiser can be saved as a draft and that launch may require review. Present an optional guided writing assistant only after privacy/safety review; it must never invent facts or make medical/legal claims.

### Step 1: Where will funds be withdrawn?

Ask for the payout country/region before currency and payment method are chosen. This configures available payment and payout adapters, currency, display formatting, required disclosures, and launch eligibility. Do not claim that an area, wallet, or bank method is supported until provider configuration confirms it.

Fields: payout country/region, preferred language, and acceptance of country-specific availability notice. Store this as private configuration, not public campaign location.

### Step 2: Who are you fundraising for?

Offer three plain-language paths:

1. Myself — the organizer is the intended recipient and manages payout setup.
2. Someone else — the organizer is raising for a beneficiary; capture relationship and consent status now, invite the beneficiary to claim/verify payout later when policy permits.
3. An organization or charity — select an approved organization record or start as a pending organization campaign. Direct charity payout is disabled until organization identity, authority, and legal/provider requirements are Validate-approved.

This answer selects the required fields, review checklist, payout flow, public labels, and safety rules. It can be changed only before money is accepted; afterwards it requires review and may require a new campaign.

### Step 3: Choose a cause and goal

Ask category, subcategory, campaign title, funding goal, and intended use of funds. Recommended categories are medical, emergency, memorial, education, community, disaster response, nonprofit/organization, and general personal support. Do not allow investment, reward, loan, equity, prohibited, or misleading categories.

Goal rules: store money as integer minor units; the goal is editable subject to audit/review; reaching it does not automatically close the campaign; failing to reach it does not automatically prevent eligible payout. The UI must never promise a transfer schedule not supported by the configured provider.

### Step 4: Create or sign in to account

Prompt account creation only after the organizer has supplied the motivating basics, so momentum is not lost. Support configured verified email and/or phone login. Explain that the chosen display name may appear publicly, with a privacy-safe display-name option allowed by policy. Preserve the pre-account draft securely and bind it to the account after verification.

### Step 5: Tell the story

Use a guided story editor with prompts:

- Who needs help and what is happening?
- What will the funds be used for?
- Why is help needed now?
- What updates can supporters expect?

Require a title and a truthful public summary; allow a longer story. Show live preview and character guidance, not a hard marketing formula. Add a privacy warning for medical, children, identity, location, account, and contact information. Scan for prohibited content, scams, doxxing, and unsupported claims; flag for review rather than silently rewriting the organizer’s narrative.

### Step 6: Add cover media

Ask for one cover photo or video and optional supporting images. Explain media rights, beneficiary consent, dignity, and privacy. Uploads use the private scanning pipeline; only approved public derivatives render on the campaign. Offer skip-and-return, but show that a clear authentic image may help supporters understand the cause. Never require humiliating medical or personal images.

### Step 7: Review, preview, and launch

Display a complete public preview exactly as a donor will see it: campaign title, organizer/beneficiary context, story, goal, fee presentation placeholder/configuration, status, media, report link, and verification-label explanation. The organizer confirms that information is truthful, has media rights, and understands review/payout conditions.

The button text is Launch fundraiser. On press, the system validates the latest draft, creates an immutable submission version, creates a review case when required, and shows one of:

- Live: only for categories/configurations eligible for immediate publication.
- Under review: the normal protected launch state; show estimated status language without promising a review time.
- Needs information: explain required next action.

Never present a campaign as live until its actual state is live.

## Post-launch success path

### Share dashboard

Immediately after launch, show the personal share dashboard rather than dropping the organizer into generic settings. Include copy link, WhatsApp, Messenger/SMS, email, Facebook/other configured social sharing, QR link where appropriate, suggested first-share message, checklist, and privacy-safe preview. Do not expose donor or beneficiary private data in any share URL or metadata.

### Fundraising coach

Show practical, non-deceptive steps: share with close community first, post campaign updates, explain the intended use of funds, thank supporters, and add verified context when available. The coach must state that HelpKoro does not guarantee discovery or donations.

### Co-organizers

Allow the organizer to invite co-organizers by email/phone after launch or while in review. Co-organizers can share, post approved updates, and help manage community communication. By default they cannot change payout destinations, initiate/approve payout, alter beneficiary relationship, view private identity evidence, or edit the original story without explicit configurable permission and audit.

### Beneficiary invite and payout setup

For Someone else, provide a beneficiary invitation flow after campaign submission/publication according to policy. The beneficiary creates or claims an account, verifies their contact details, completes required payout/identity checks, and accepts the relationship. The organizer sees status only, not private payout data. If the beneficiary cannot complete the flow, route to reviewer/finance policy handling; do not quietly redirect funds.

### Organizer dashboard

Show raised amount as a ledger-derived projection, donor count consistent with privacy policy, donation statuses, updates, pending review tasks, share actions, payout eligibility/holds, required fund-use reports, and support/contact routes. Explain every unavailable action with a human-readable reason and next step.

## State machine

Draft -> Basics complete -> Account verified -> Story/media complete -> Submitted -> Under review -> Live -> Paused or Closed.

At any pre-launch point, the organizer may save and exit. Submitted content is versioned. Only authorized reviewer/system rules move Under review to Live. Material post-live changes create a new version and may move the campaign back to Under review. A campaign may never transition from rejected directly to live without a new review decision.

## Required analytics

Track funnel_viewed, payout_region_selected, beneficiary_type_selected, category_selected, goal_set, account_created, story_completed, media_uploaded, preview_opened, launch_submitted, review_requested_info, campaign_live, share_clicked, coorganizer_invited, beneficiary_invited, and payout_setup_completed. Do not send story text, identity documents, phone numbers, payout data, or other sensitive content to analytics.

## Acceptance tests

- A self, someone-else, and organization path each route to the correct required fields and review/payout policy.
- Refreshing, signing in mid-flow, or poor connectivity preserves a safe draft without accidental publication.
- A non-authorized user cannot publish, change beneficiary, assign co-organizer privilege, or configure payout through a client request.
- Preview never leaks private evidence, contact, identity, payout, or internal-review fields.
- Duplicate launch requests create one submission/review case only.
- Bangla and English completion paths, mobile keyboard navigation, screen-reader labels, validation errors, and slow-network states pass end-to-end tests.
- The post-launch dashboard works for live, under-review, needs-information, paused, and closed campaigns.

## Asian-market adaptation

Keep the low-friction funnel, but make country configuration explicit before the fundraiser is created. Support language selection, phone-first onboarding where appropriate, local payment/payout adapters behind a common contract, and low-bandwidth media behavior. Do not imitate any GoFundMe statement about availability, charity status, fees, transfers, verification, or country eligibility; validate every regional/provider rule before enabling it.

## Cross-references

See end-to-end-platform-process.md, feature-catalog.md, campaign-creation.md, campaign-lifecycle.md, campaign-page.md, payout-eligibility.md, payment-provider-strategy.md, identity-and-kyc.md, localization-and-accessibility.md, and testing-and-release.md.
