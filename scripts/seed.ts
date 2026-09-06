import { config } from "dotenv";

config({ path: ".env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DealStatus } from "../lib/types";

// Standalone seed script for demo data (Phase 6). Never deployed, never
// imported by the app itself.
//
// THIS SCRIPT IS DESTRUCTIVE. It wipes the demo account's companies (and
// every deal and note cascading from them) before inserting. It refuses to
// run unless you name the host you mean to wipe - see assertWipeConfirmed
// below:
//
//   npm run seed -- --confirm-wipe=<host from NEXT_PUBLIC_SUPABASE_URL>
//
// Signs
// in as the demo account and inserts data through the same anon-key client
// the app uses, so every insert goes through the normal Row Level Security
// policies (supabase/migrations) instead of a service-role bypass.
//
// console.log is fine here (unlike in app code, see AGENTS.md - Prohibited
// Patterns): this is a CLI tool whose entire job is reporting progress to
// the person running it, not server code that runs for real users.

interface SeedNote {
  daysAgo: number;
  content: string;
  /** Defaults to "note". "email" also carries a subject and a direction. */
  kind?: "note" | "email";
  subject?: string;
  direction?: "outbound" | "inbound";
  /** Kept out of every analysis. One seeded note sets this so the demo
   *  shows the feature rather than only describing it. */
  confidential?: boolean;
}

/**
 * A stored momentum read, seeded rather than generated.
 *
 * The demo runs with AUTO_ANALYSIS off, because it is a public page with a
 * one-click login and a visitor must not be able to spend the API budget.
 * Without seeded rows every deal there reads "not analysed yet" and the
 * one feature the product is built around is invisible until someone
 * presses a button. So the readings are written straight into
 * deal_insights, worded the way the model words them, and dated so the
 * age line beside the colour is believable.
 */
interface SeedInsight {
  momentum: "healthy" | "stalling" | "at_risk";
  reasoning: string;
  analyzedDaysAgo: number;
}

interface SeedDeal {
  title: string;
  status: DealStatus;
  notes: SeedNote[];
  /** Euros. Omitted on one open deal on purpose, see SEED_DATA. */
  valueEur?: number;
  /** Days ago the deal was marked won or lost. Only for closed deals. */
  closedDaysAgo?: number;
  /** Only on open deals: a closed deal has no momentum, and the insight
   *  route deletes any row it finds when a deal is won or lost. */
  insight?: SeedInsight;
}

interface SeedContact {
  name: string;
  role: string;
  emails: string[];
  phones?: string[];
  socials?: string[];
}

interface SeedCompany {
  name: string;
  deals: SeedDeal[];
  contacts?: SeedContact[];
  /**
   * The company record itself. All optional, and deliberately not filled
   * in on every seeded company: a book where every row is complete is not
   * what a real one looks like, and the panel's "nothing filled in yet"
   * state is worth showing too.
   */
  description?: string;
  background?: string;
  address?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  socials?: string[];
  vatNumber?: string;
  registrationNumber?: string;
  /**
   * The name of the company this one is part of. Resolved to an id in a
   * second pass, after every company exists, so a parent may be declared
   * anywhere in this list rather than only above its children.
   */
  partOf?: string;
}

// Shorthand for the two long enterprise timelines below - a plain object
// literal per note gets unreadable at 50+ entries. [daysAgo, content] pairs
// stay scannable as a table of dates.
function notesFromTimeline(entries: Array<[number, string]>): SeedNote[] {
  return entries.map(([daysAgo, content]) => ({ daysAgo, content }));
}

/**
 * The age of the earliest note on a deal, used to backdate the deal
 * itself. Returns 0 for a deal with no notes, which dates it today - the
 * only sensible answer when there is nothing to date it from.
 */
function oldestNoteDaysAgo(notes: SeedNote[]): number {
  return notes.reduce((oldest, note) => Math.max(oldest, note.daysAgo), 0);
}

// Note timelines are written to land on one classification each once
// analyzed, so the AI feature has something to catch on a first-time demo:
// Acme Robotics reads healthy (steady cadence, forward movement, ending
// recently), Northwind Traders and Bluepeak Logistics both read at_risk in
// practice (a widening gap and an explicit budget freeze respectively - the
// model's bar for "at risk" turned out stricter than "stalling" for both,
// which is a legitimate reasoning call, not a bug). Fenwick & Cole and
// Solara Energy round out the deal list as a closed-won and a closed-lost
// deal, so /deals doesn't look like every deal is perpetually open.
//
// Meridian Global Systems and IronGate Financial Holdings are a different
// kind of test case: enterprise-scale deals with 4-6 quarter cycles and
// 50+ notes each, matching the "Oracle/IBM-scale" sales cycles this app is
// meant to demo against, not just quick small-business deals. Meridian's
// story arc is a champion departure and reorg mid-cycle that fully
// recovers (should read healthy or stalling-but-recovering depending on
// how much weight the model gives the old gap vs. the strong recent
// momentum). IronGate's arc is the opposite: a strong multi-quarter
// engagement that goes cold after the champion resigns, with repeated
// reconnect attempts that all go unanswered - a much longer, more
// deliberate "at risk" case than Northwind or Bluepeak.
const SEED_DATA: SeedCompany[] = [
  {
    name: "Acme Robotics",
    description:
      "Warehouse automation and robotic picking systems for third-party logistics operators.",
    background:
      "Family-held, second generation, run out of Eindhoven. Priya Shah owns the budget and Tom Reyes owns the technical veto, and nothing moves without both. They bought their last two systems after a paid pilot, never off a proposal.",
    address: "Hurksestraat 18\n5652 AJ Eindhoven",
    country: "Netherlands",
    phone: "+31 20 555 0100",
    email: "info@acmerobotics.example",
    website: "https://www.acmerobotics.example",
    socials: ["https://www.linkedin.com/company/example-acme-robotics"],
    vatNumber: "NL812345678B01",
    registrationNumber: "17098234",
    contacts: [
      {
        name: "Priya Shah",
        role: "Operations Director",
        emails: [
          "p.shah@acmerobotics.example",
          "priya.shah@acme-group.example",
        ],
        phones: ["+31 20 555 0142"],
        socials: ["linkedin.com/in/example-priya-shah"],
      },
      {
        name: "Tom Reyes",
        role: "VP Engineering",
        emails: ["t.reyes@acmerobotics.example"],
      },
    ],
    deals: [
      {
        title: "Q3 Expansion",
        insight: {
          momentum: "healthy",
          reasoning:
            "Steady two-week cadence with no gaps, and every exchange moves the deal a step: discovery, then the technical session Tom asked for, then a dated pilot scope. Priya has named a decision window and nobody has gone quiet. Nothing here reads as drift.",
          analyzedDaysAgo: 1,
        },
        status: "open",
        valueEur: 48000,
        notes: [
          {
            daysAgo: 14,
            content:
              "Discovery call with Priya Shah (Ops Director). They are evaluating three vendors for the new fulfillment center automation. Sent over the case study deck.",
          },
          {
            daysAgo: 10,
            content:
              "Priya looped in their VP of Engineering, Tom Reyes. Good technical fit discussion, no blockers raised.",
          },
          {
            daysAgo: 6,
            content:
              "Demo went well. The team asked for a formal proposal by end of month.",
          },
          {
            daysAgo: 2,
            content:
              "Sent the proposal. Priya confirmed she will review internally this week and get back with next steps.",
          },
        ],
      },
    ],
  },
  {
    name: "Northwind Traders",
    description:
      "Regional food and beverage distributor, 40 depots across the Benelux.",
    background:
      "Margin-thin business that buys on payback period, not on features. Marcus Webb is the only contact and has gone quiet twice before, both times because a depot closure ate the quarter.",
    address: "Havenweg 210\n3089 JJ Rotterdam",
    country: "Netherlands",
    phone: "+31 10 555 0188",
    website: "https://www.northwind.example",
    vatNumber: "NL823456789B01",
    contacts: [
      {
        name: "Marcus Webb",
        role: "Head of Logistics",
        emails: ["m.webb@northwind.example"],
        phones: ["+44 20 7946 0812"],
      },
    ],
    deals: [
      {
        title: "Warehouse Automation Pilot",
        insight: {
          momentum: "at_risk",
          reasoning:
            "The gap between contacts has widened from nine days to nineteen, and the last two touches were both outbound with no reply. A voicemail with no callback after an unanswered email is the pattern that precedes a no-decision. There is no named next step and no date attached to anything since the depot review was mentioned.",
          analyzedDaysAgo: 2,
        },
        status: "open",
        valueEur: 26500,
        notes: [
          {
            daysAgo: 40,
            content:
              "Intro call with Marcus Webb. Interested in a pilot for one warehouse before a wider rollout.",
          },
          {
            daysAgo: 33,
            content:
              "Sent pilot scope and pricing. Marcus said he needed to check budget with finance.",
          },
          {
            daysAgo: 25,
            content:
              "Followed up. Marcus said the finance review is taking longer than expected.",
          },
          {
            daysAgo: 18,
            content: "No response to the last two emails. Left a voicemail.",
          },
        ],
      },
    ],
  },
  {
    name: "Bluepeak Logistics",
    description:
      "Cross-border freight forwarding and customs brokerage, Nordics to the Rhine corridor.",
    background:
      "Sofia Lindqvist runs procurement and is straight with you, which is rare and worth protecting. Budget freeze came from the board, not from her, so the objection is timing rather than value.",
    address: "Kungsgatan 44\n111 35 Stockholm",
    country: "Sweden",
    phone: "+46 8 555 0121",
    email: "hello@bluepeak.example",
    website: "https://www.bluepeak.example",
    socials: ["https://www.linkedin.com/company/example-bluepeak"],
    registrationNumber: "556123-4567",
    contacts: [
      {
        name: "Sofia Lindqvist",
        role: "CFO",
        emails: ["s.lindqvist@bluepeak.example"],
      },
    ],
    deals: [
      {
        title: "Enterprise Rollout",
        insight: {
          momentum: "stalling",
          reasoning:
            "Sofia has been straight about a board-level budget freeze, which is a real obstacle rather than avoidance, and she is still replying. But nothing has moved on the deal itself for five weeks and there is no date on when the freeze lifts. The relationship is healthy; the deal is parked.",
          analyzedDaysAgo: 1,
        },
        status: "open",
        valueEur: 74000,
        notes: [
          {
            daysAgo: 65,
            content:
              "Kickoff call with the Bluepeak team. Strong initial interest in a company-wide rollout.",
          },
          {
            daysAgo: 58,
            content:
              "Sent enterprise pricing. They mentioned needing sign-off from their CFO.",
          },
          {
            daysAgo: 51,
            content:
              "Contact said the CFO put a freeze on new software spend this quarter. No timeline on when it might lift.",
          },
        ],
      },
    ],
  },
  {
    name: "Fenwick & Cole",
    description:
      "Commercial law firm, 90 fee earners, corporate and real estate practice.",
    background:
      "Bought on a two-week trial and renewed without a negotiation. Daniel Okonkwo is now the reference you use on every other legal-sector call.",
    address: "12 Bedford Row\nLondon WC1R 4BU",
    country: "United Kingdom",
    phone: "+44 20 7555 0166",
    website: "https://www.fenwickcole.example",
    registrationNumber: "09876543",
    contacts: [
      {
        name: "Daniel Okonkwo",
        role: "Managing Partner",
        emails: ["d.okonkwo@fenwickcole.example"],
        phones: ["+44 161 496 0233"],
      },
    ],
    deals: [
      {
        title: "Renewal FY26",
        status: "won",
        valueEur: 31500,
        closedDaysAgo: 3,
        notes: [
          {
            daysAgo: 20,
            content:
              "Renewal conversation with our existing contact, Dana Fitch. No major concerns, just confirming the updated seat count.",
          },
          { daysAgo: 12, content: "Sent the renewal contract for signature." },
          {
            daysAgo: 5,
            content:
              "Contract signed. Renewed for another year at the higher tier.",
          },
        ],
      },
    ],
  },
  {
    name: "Solara Energy",
    description:
      "Utility-scale solar development and asset management, Iberian peninsula.",
    background:
      "Lost on price against an incumbent with an existing framework agreement. Elena Vasquez said the door reopens when that contract comes up, which is roughly a year out.",
    address: "Calle Serrano 41\n28001 Madrid",
    country: "Spain",
    website: "https://www.solara.example",
    contacts: [
      {
        name: "Elena Vasquez",
        role: "Head of Procurement",
        emails: ["e.vasquez@solara.example"],
      },
    ],
    deals: [
      {
        title: "Pilot Program",
        status: "lost",
        valueEur: 19000,
        closedDaysAgo: 20,
        notes: [
          {
            daysAgo: 45,
            content:
              "Initial pitch to Solara's ops team. They are comparing us against two other vendors.",
          },
          {
            daysAgo: 30,
            content:
              "Follow-up call. They said pricing was a concern relative to the incumbent tool.",
          },
          {
            daysAgo: 22,
            content:
              "Solara confirmed they are moving forward with a competitor. Closing this out.",
          },
        ],
      },
    ],
  },
  {
    name: "Meridian Global Systems",
    description:
      "Enterprise systems integrator, 4,000 staff, public sector and financial services.",
    background:
      "Part of the Kestrel group since the 2024 buyout, which is why procurement now runs through Kestrel Holdings in Zurich. Anders Blom is the champion and Ravi Menon the architect; the reorg cost this deal eight months and neither of them could stop it.",
    address: "Bahnhofstrasse 22\n8001 Zurich",
    country: "Switzerland",
    phone: "+41 44 555 0199",
    email: "contact@meridian-global.example",
    website: "https://www.meridian-global.example",
    socials: [
      "https://www.linkedin.com/company/example-meridian-global",
      "https://x.com/example_meridian",
    ],
    vatNumber: "CHE-123.456.789",
    registrationNumber: "CH-020.3.045.678-1",
    partOf: "Kestrel Holdings",
    contacts: [
      {
        name: "Anneke Blom",
        role: "Director of Data Platforms",
        emails: ["a.blom@meridian-global.example"],
        phones: ["+31 30 555 0199", "+31 6 1234 5678"],
        socials: [
          "linkedin.com/in/example-anneke-blom",
          "x.com/example-anneke",
        ],
      },
      {
        name: "Rahul Menon",
        role: "Enterprise Architect",
        emails: ["r.menon@meridian-global.example"],
      },
    ],
    deals: [
      {
        title: "Enterprise Data Platform Rollout",
        insight: {
          momentum: "at_risk",
          reasoning:
            "Eight months of activity with two champions engaged, then a reorg, and since then two follow-up emails with no reply. Anders and Ravi both went quiet at the same moment, which points at the account rather than at either person. A deal this size with no answer from anyone for a month is not slow, it is stopped.",
          analyzedDaysAgo: 3,
        },
        status: "open",
        valueEur: 410000,
        notes: notesFromTimeline([
          // Phase 1: discovery, weekly cadence.
          [
            480,
            "Inbound from Elena Kowalski (VP Data Strategy) after our webinar. Meridian is consolidating five legacy data warehouses and wants a modern platform. Scheduled a discovery call.",
          ],
          [
            473,
            "Discovery call with Elena and her team. Current pain: reporting takes three to four days to refresh, and execs are flying blind on quarterly numbers.",
          ],
          [
            466,
            "Sent an initial capabilities overview and two reference customers in the same industry.",
          ],
          [
            459,
            "Elena looped in Raj Patel, Director of Data Engineering, for a technical deep dive next week.",
          ],
          [
            452,
            "Technical deep dive with Raj. Walked through the architecture, ingestion model, and how we would handle their five source systems.",
          ],
          [
            445,
            "Raj asked for a sandbox environment to test with a sample of their real data. Provisioning access.",
          ],
          [
            438,
            "Sandbox is live. Raj's team started loading a subset of their sales data warehouse.",
          ],
          [
            431,
            "Check-in call. Raj said early results look promising, query times dropped from minutes to seconds on the sample.",
          ],
          [
            424,
            "Elena mentioned this is now on the radar for their FY budget planning cycle, timing lines up well.",
          ],
          [
            417,
            "Raj's team hit a schema mapping issue with one of the legacy systems. Sent our integration engineer to help directly.",
          ],
          [
            410,
            "Schema issue resolved. Raj confirmed the sandbox is now processing all five source systems end to end.",
          ],
          [
            403,
            "Elena asked for a formal proposal scoped to a phased rollout, starting with finance and sales data.",
          ],
          [
            396,
            "Sent the phased rollout proposal. Elena said she would present it to the exec team next week.",
          ],
          // Phase 2: POC and technical validation.
          [
            389,
            "Elena confirmed the exec team approved moving to a formal POC. Kicking off with the finance data set first.",
          ],
          [
            382,
            "POC kickoff workshop with finance stakeholders and Raj's engineering team.",
          ],
          [
            375,
            "First POC milestone hit: finance dashboards refreshing in near real time instead of the old three-day cycle.",
          ],
          [
            368,
            "CFO's team asked to see the POC results directly. Elena is setting up a demo.",
          ],
          [
            361,
            "Demo to the CFO's team went well. They asked about data governance and access controls next.",
          ],
          [
            354,
            "Sent our governance and role-based access control documentation. David Chen (CISO) was added to the thread.",
          ],
          [
            347,
            "Kickoff call with David Chen on security requirements. Standard enterprise checklist, nothing unusual.",
          ],
          [
            340,
            "Sent responses to David's initial security questionnaire, covering encryption, access logging, and data residency.",
          ],
          [
            333,
            "Raj confirmed the sales data ingestion is also running cleanly in the sandbox, ahead of schedule.",
          ],
          [
            326,
            "POC review meeting. Elena said this is tracking toward a Q3 rollout decision, pending final budget sign-off.",
          ],
          [
            316,
            "Elena mentioned she is presenting the business case to the board's technology committee this month.",
          ],
          // Phase 3: champion departs, deal goes quiet during a reorg.
          [
            305,
            "Heard secondhand from Raj that Elena is leaving Meridian for another company. No official word from Elena directly.",
          ],
          [
            288,
            "Followed up with Raj to check deal status. He said data strategy ownership is being reorganized and there is no clear successor yet.",
          ],
          [
            260,
            "No response to two follow-up emails this month. Deal appears to be in limbo during the reorg.",
          ],
          [
            238,
            "Raj said a new interim VP, Sofia Ibrahim, has been named to lead data strategy and will need to be re-briefed.",
          ],
          // Phase 4: re-engagement and a fresh security review.
          [
            224,
            "Intro call with Sofia Ibrahim (interim VP, Data Strategy). She was briefed on the POC results and wants to pick things back up.",
          ],
          [
            217,
            "Sent Sofia a recap of the POC outcomes and the phased rollout proposal Elena had been reviewing.",
          ],
          [
            210,
            "Sofia asked for an updated proposal reflecting current pricing and a revised timeline given the gap.",
          ],
          [
            196,
            "Sent the updated proposal. Sofia said she wants David Chen to re-validate the security review before going further.",
          ],
          [
            182,
            "Follow-up security call with David Chen. He confirmed our earlier answers still hold and requested an updated SOC 2 report.",
          ],
          [
            175,
            "Sent the current SOC 2 Type II report. David said his team would complete their review within three weeks.",
          ],
          [
            161,
            "David's security review passed. He is routing the summary to procurement.",
          ],
          [
            154,
            "Sofia confirmed the business case is back on the board's technology committee agenda for next month.",
          ],
          [
            147,
            "Board's technology committee approved moving forward, pending legal and procurement sign-off.",
          ],
          [
            140,
            "Kickoff call with Meridian's procurement team to start contract negotiations.",
          ],
          // Phase 5: legal and procurement, the slow sporadic part of an enterprise cycle.
          [
            133,
            "Received Meridian's first markup of the MSA. Mostly standard redlines around liability caps and data ownership.",
          ],
          [119, "Sent our legal team's response to the MSA redlines."],
          [
            105,
            "Meridian's legal team requested a call to walk through the data processing addendum in detail.",
          ],
          [
            98,
            "DPA walkthrough call. No major objections, a few clarifying edits requested.",
          ],
          [
            84,
            "Sent the revised DPA. Meridian legal said it looked good, pending final internal sign-off.",
          ],
          [
            70,
            "Sofia said procurement is finalizing the statement of work and expects to have final pricing approved this month.",
          ],
          [
            56,
            "Procurement sent a revised SOW reflecting the phased rollout scope and updated seat counts.",
          ],
          [
            49,
            "Confirmed final pricing with Sofia. She said the only remaining step is CFO sign-off on the FY budget line.",
          ],
          [
            35,
            "Sofia said the CFO sign-off is expected within the next few weeks, timed to the new fiscal quarter.",
          ],
          // Phase 6: final stretch, still open but strong recent momentum.
          [
            28,
            "Sofia confirmed the CFO reviewed the business case and had no objections.",
          ],
          [
            21,
            "Procurement said the contract is in final internal routing for signature.",
          ],
          [
            14,
            "Sofia said legal completed their final pass and the contract is with the CFO for signature this week.",
          ],
          [
            7,
            "Sofia said the CFO signed off internally on the FY budget line. Their legal team is finalizing the countersigned contract now.",
          ],
          [
            3,
            "Sofia confirmed the countersigned contract is with their legal team for final processing, expected back any day. Kickoff planning has already started informally.",
          ],
        ]),
      },
    ],
  },
  {
    name: "IronGate Financial Holdings",
    description:
      "Retail and commercial banking group, 1.8 million customers across three markets.",
    background:
      "Two CIOs in eighteen months. Every stall on this deal has been an org change rather than an objection, which is why the value is unpriced: nobody has been in the seat long enough to scope it.",
    address: "Kaiserstrasse 8\n60311 Frankfurt am Main",
    country: "Germany",
    phone: "+49 69 555 0177",
    website: "https://www.irongate.example",
    socials: ["https://www.linkedin.com/company/example-irongate"],
    vatNumber: "DE812345678",
    registrationNumber: "HRB 98765",
    contacts: [
      {
        name: "Charles Whitfield",
        role: "CIO (departed)",
        emails: ["c.whitfield@irongate.example"],
      },
      {
        name: "Dana Kowalski",
        role: "Interim Head of Technology",
        emails: ["d.kowalski@irongate.example"],
        phones: ["+1 212 555 0177"],
      },
    ],
    deals: [
      {
        title: "Core Banking Platform Migration",
        insight: {
          momentum: "stalling",
          reasoning:
            "The introduction to the new CIO went out and has not been answered, which is normal at this stage rather than a warning. But the deal has now survived two CIO changes without a value being agreed, and an unpriced deal at this age has no forecast worth having. The next move has to be a scoping session with a date on it.",
          analyzedDaysAgo: 5,
        },
        status: "open",
        notes: notesFromTimeline([
          // Phase 1: executive workshops and architecture review.
          [
            552,
            "Initial inbound inquiry via our contact form, routed to Michael Torres's team for triage.",
          ],
          [
            545,
            "Inbound follow-up from Michael Torres (CIO) after a referral from one of our existing banking clients. IronGate is evaluating a full core banking platform migration.",
          ],
          [
            538,
            "Exec alignment call. Michael, Angela Whitfield (Head of Core Banking Ops), and their CFO joined. High urgency, their current system is fifteen years old and increasingly hard to maintain.",
          ],
          [
            531,
            "Sent our banking-sector case studies and a high-level migration approach.",
          ],
          [
            524,
            "Technical workshop with Angela's team to map their current core banking architecture.",
          ],
          [
            517,
            "Second architecture workshop. Identified three major integration points that will need custom connectors.",
          ],
          [
            510,
            "Michael asked for a phased migration plan rather than a big-bang cutover, lower risk for a bank of their size.",
          ],
          [
            503,
            "Sent a phased migration proposal: pilot branch network first, then regional, then full rollout.",
          ],
          [
            496,
            "Angela's team reviewed the phased plan internally. Positive feedback, minor scope questions on the pilot branch selection.",
          ],
          [
            489,
            "Follow-up call to finalize which branch network to use for the pilot phase.",
          ],
          [
            482,
            "Michael confirmed the pilot branch network and asked to move into a formal technical evaluation.",
          ],
          [
            475,
            "Technical evaluation kickoff with IronGate's infrastructure and security teams.",
          ],
          [
            468,
            "Infrastructure team raised questions about data residency requirements under banking regulations.",
          ],
          [
            461,
            "Sent our data residency and compliance documentation, including regional hosting options.",
          ],
          [
            454,
            "Compliance team confirmed our hosting options satisfy their regulatory requirements.",
          ],
          [
            447,
            "Michael said the board is being briefed on the migration business case next month.",
          ],
          [
            440,
            "Board briefing happened. Michael said the reception was positive, no major objections raised.",
          ],
          [
            433,
            "Angela's team started a deeper technical evaluation of our core transaction processing module.",
          ],
          [
            426,
            "Core transaction processing review completed. Angela's team had no blocking concerns.",
          ],
          [
            419,
            "Angela asked for a reference call with one of our existing banking clients.",
          ],
          [
            412,
            "Reference call happened. IronGate's team came away reassured about our ability to handle their scale.",
          ],
          [
            405,
            "Michael confirmed we are now the lead vendor and asked to move into formal security and compliance review.",
          ],
          [
            398,
            "Sent our standard security review kickoff packet ahead of the formal process.",
          ],
          [
            391,
            "Security review kickoff meeting scheduled with IronGate's information security team.",
          ],
          [
            384,
            "Kickoff meeting held with IronGate's information security team.",
          ],
          // Phase 2: security and compliance deep dive.
          [
            370,
            "Sent responses to the first round of security questionnaires, covering encryption at rest, key management, and audit logging.",
          ],
          [
            363,
            "Security team requested a live architecture review session to walk through our access control model.",
          ],
          [
            356,
            "Access control review session completed. Security team had a few follow-up questions on key rotation policy.",
          ],
          [349, "Sent our key rotation and incident response documentation."],
          [
            342,
            "Security team asked for a demo of our audit logging dashboard.",
          ],
          [
            335,
            "Audit logging demo completed. Well received, no follow-up concerns.",
          ],
          [
            328,
            "Security team said the review is on track, moving to their formal penetration test phase next.",
          ],
          [
            321,
            "Pen test scoping call to coordinate the engagement window with our security team.",
          ],
          [
            314,
            "Penetration test kicked off on our side, a scoped and coordinated engagement.",
          ],
          [
            307,
            "Mid-test check-in with the security team. No issues reported so far.",
          ],
          [
            300,
            "Penetration test completed with no critical findings. Security team said they are finalizing their report.",
          ],
          // Phase 3: the CIO departs and the deal stalls.
          [
            293,
            "Angela mentioned Michael has been out of the office more than usual, unclear why.",
          ],
          [
            279,
            "Learned that Michael Torres resigned as CIO effective immediately. No successor named yet.",
          ],
          [
            265,
            "Followed up with Angela for a status update. She said leadership is focused on the CIO transition and the migration project is on hold for now.",
          ],
          [
            251,
            "Angela said the board is prioritizing the CIO search before any major vendor decisions resume.",
          ],
          // Phase 4: repeated reconnect attempts, all unanswered.
          [225, "Check-in email to Angela. No response."],
          [
            200,
            "Called Angela directly. She said there is still no interim CIO named and she cannot make commitments on the project right now.",
          ],
          [
            175,
            "Sent a quarterly check-in summarizing where the evaluation left off, in case a new CIO picks it up.",
          ],
          [
            150,
            "No response to the quarterly check-in. Tried reaching Angela again, no reply.",
          ],
          [
            120,
            "Found via LinkedIn that IronGate named a new CIO, Patricia Nguyen. Sent an introduction email with the project history recap.",
          ],
          [
            95,
            "No response from Patricia Nguyen. Sent a shorter follow-up with a direct ask for fifteen minutes.",
          ],
          [
            70,
            "Angela replied briefly that Patricia is still getting oriented and the core banking migration has not been reprioritized yet.",
          ],
          [
            45,
            "Sent a check-in to both Angela and Patricia. No response from either.",
          ],
          [20, "Tried Angela once more. No response."],
          [
            10,
            "Sent a final check-in referencing the completed security review and pen test, offering to pick things back up whenever they are ready. No response so far.",
          ],
        ]),
      },
    ],
  },
  {
    name: "Kestrel Holdings",
    description:
      "Investment holding company. Owns eleven technology and services businesses across Europe.",
    background:
      "The reason the Meridian deal moved to Zurich. Nothing over CHF 250k is signed at an operating company any more, so a deal you win at Meridian is a deal you then have to win again here. Ingrid Halvorsen is the gate.",
    address: "Talacker 41\n8001 Zurich",
    country: "Switzerland",
    phone: "+41 44 555 0110",
    website: "https://www.kestrelholdings.example",
    socials: ["https://www.linkedin.com/company/example-kestrel-holdings"],
    vatNumber: "CHE-987.654.321",
    registrationNumber: "CH-020.3.011.222-3",
    contacts: [
      {
        name: "Ingrid Halvorsen",
        role: "Group Procurement Director",
        emails: ["i.halvorsen@kestrelholdings.example"],
        phones: ["+41 44 555 0111"],
        socials: ["https://www.linkedin.com/in/example-ingrid-halvorsen"],
      },
    ],
    deals: [],
  },
  {
    name: "Kestrel Analytics",
    partOf: "Kestrel Holdings",
    description:
      "Data and reporting arm of the Kestrel group. Builds internal analytics for the other portfolio companies.",
    background:
      "Sells to its own group rather than to the market, so its buying cycle follows Kestrel's budget year and not a sales quarter. Lars Bergstrom has run the same evaluation twice already, both times ending in a deferral he did not choose.",
    address: "Sveavagen 9\n111 57 Stockholm",
    country: "Sweden",
    email: "hei@kestrelanalytics.example",
    website: "https://www.kestrelanalytics.example",
    registrationNumber: "556777-8899",
    contacts: [
      {
        name: "Lars Bergstrom",
        role: "Head of Data Platform",
        emails: ["l.bergstrom@kestrelanalytics.example"],
        phones: ["+46 8 555 0134"],
      },
      {
        name: "Nadia Farouk",
        role: "Finance Business Partner",
        emails: ["n.farouk@kestrelanalytics.example"],
      },
    ],
    deals: [
      {
        title: "Reporting Platform Consolidation",
        status: "open",
        valueEur: 96000,
        insight: {
          momentum: "stalling",
          reasoning:
            "Lars is engaged and replying within a day, and the technical fit was settled three weeks ago. What has not moved is the approval: every date given has come from him rather than from Zurich, and the last two exchanges are about waiting for the group budget round rather than about the deal. This is not going backwards, but nothing here will close without Ingrid Halvorsen at Kestrel Holdings.",
          analyzedDaysAgo: 1,
        },
        notes: [
          ...notesFromTimeline([
            [
              52,
              "Inbound enquiry through the website. They run four separate reporting stacks across the group and want one.",
            ],
            [
              45,
              "Scoping call with Lars Bergstrom. Nine data sources, two of them mainframe. He has done this evaluation twice before and both times it was deferred at group level.",
            ],
            [
              38,
              "Technical session. No blockers found. Lars asked for a written summary he can take upstairs.",
            ],
            [
              24,
              "Nadia Farouk joined to talk numbers. Group finance wants a three-year TCO, not an annual price.",
            ],
            [
              11,
              "Lars confirmed the technical fit is agreed internally. Approval now sits with group procurement in Zurich.",
            ],
            [
              4,
              "Asked Lars for an introduction to Ingrid Halvorsen. He said he would rather raise it in the budget round in two weeks than go around it.",
            ],
          ]),
          // Two logged emails and one confidential note, so the demo shows
          // three things at once: that a logged email carries its
          // direction into the analysis, that an inbound reply reads
          // differently from another chase, and that a note can be kept
          // out of the analysis entirely.
          {
            daysAgo: 30,
            kind: "email",
            direction: "outbound",
            subject: "Consolidation summary for the group review",
            content:
              "Sent the written summary Lars asked for: nine sources, the two mainframe extracts, the migration sequence and a three-year cost line. Told him to forward it rather than reformat it.",
          },
          {
            daysAgo: 28,
            kind: "email",
            direction: "inbound",
            subject: "Re: Consolidation summary for the group review",
            content:
              "Lars replied same week. Group finance want the TCO split by operating company rather than one total. He is confident on the technical side and says the only open question is the budget round.",
          },
          {
            daysAgo: 9,
            confidential: true,
            content:
              "Lars mentioned off the record that his own role is under review in the reorg. Not something to reference on a call, and not something the analysis should be reading as a deal signal.",
          },
        ],
      },
    ],
  },
  {
    name: "Kestrel Field Services",
    partOf: "Kestrel Holdings",
    description:
      "Maintenance and inspection contractor for wind and solar assets. Part of the Kestrel group.",
    background:
      "The easiest sale in the group and the smallest. Bought on one call after seeing the Meridian pilot, which is worth remembering: inside a group, a reference travels further than a proposal.",
    address: "Nordre gate 12\n7011 Trondheim",
    country: "Norway",
    website: "https://www.kestrelfield.example",
    contacts: [
      {
        name: "Petter Aune",
        role: "Operations Manager",
        emails: ["p.aune@kestrelfield.example"],
        phones: ["+47 73 555 0140"],
      },
    ],
    deals: [
      {
        title: "Field Reporting Rollout",
        status: "won",
        valueEur: 21500,
        closedDaysAgo: 19,
        notes: notesFromTimeline([
          [
            61,
            "Petter got in touch after seeing the Meridian pilot. Wants the same thing for 60 field engineers.",
          ],
          [
            54,
            "Demo. He asked two questions and then asked for a quote, which is not how these usually go.",
          ],
          [40, "Quote sent, 21.5k, one year."],
          [33, "Nothing back. Sent a short chase."],
          [
            26,
            "Petter replied: waiting on a signature from Zurich, nothing to worry about.",
          ],
          [19, "Signed. Kickoff booked for the first week of next month."],
        ]),
      },
    ],
  },
  {
    name: "Verity Compliance",
    description:
      "Regulatory reporting and audit software for mid-market insurers.",
    background:
      "Met at a conference. No deal yet and no clear budget owner found, which is why this one has sat in the book for a month without moving into the five.",
    address: "Rue du Commerce 31\n1000 Brussels",
    country: "Belgium",
    email: "contact@veritycompliance.example",
    website: "https://www.veritycompliance.example",
    socials: ["https://www.linkedin.com/company/example-verity-compliance"],
    contacts: [
      {
        name: "Camille Dubois",
        role: "Head of Client Services",
        emails: ["c.dubois@veritycompliance.example"],
        phones: ["+32 2 555 0155"],
        socials: ["https://www.linkedin.com/in/example-camille-dubois"],
      },
    ],
    deals: [],
  },
  {
    name: "Harbourline Freight",
    deals: [],
  },
];

function daysAgoIso(days: number, now: Date): string {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return new Date(now.getTime() - days * millisecondsPerDay).toISOString();
}

async function resolveDemoUserId(
  supabase: SupabaseClient,
  demoEmail: string,
  demoPassword: string,
): Promise<string> {
  const signIn = await supabase.auth.signInWithPassword({
    email: demoEmail,
    password: demoPassword,
  });

  if (signIn.data.user) {
    return signIn.data.user.id;
  }

  console.log(`No existing session for ${demoEmail}, creating the account...`);

  const signUp = await supabase.auth.signUp({
    email: demoEmail,
    password: demoPassword,
  });

  if (signUp.error) {
    throw new Error(`Failed to create demo account: ${signUp.error.message}`);
  }

  if (signUp.data.session?.user) {
    return signUp.data.session.user.id;
  }

  // Some Supabase projects require email confirmation before a session is
  // issued at signup time, but still allow signing in once the account
  // exists. Try once more before giving up.
  const retrySignIn = await supabase.auth.signInWithPassword({
    email: demoEmail,
    password: demoPassword,
  });

  if (retrySignIn.data.user) {
    return retrySignIn.data.user.id;
  }

  throw new Error(
    `Account for ${demoEmail} exists but could not sign in ` +
      `(${retrySignIn.error?.message ?? "no session returned"}). If your ` +
      "Supabase project requires email confirmation, confirm this " +
      "account's email address (Supabase dashboard -> Authentication -> " +
      "Users), then re-run this script.",
  );
}

/**
 * Refuses to run unless the caller has named the exact database they mean
 * to wipe. `main` below deletes every company row owned by the demo user,
 * and every deal and note cascades from that, so this script is a
 * destructive operation wearing an innocuous name.
 *
 * That was harmless while the only database was a hosted demo full of
 * invented companies. It stopped being harmless the moment a local
 * database started holding a real pipeline. A stale `.env.local`, a copied
 * environment file or plain muscle memory are all it would take.
 *
 * The guard is deliberately annoying: `npm run seed` alone always
 * refuses. You have to pass the host you intend to wipe, and it has to
 * match the host in NEXT_PUBLIC_SUPABASE_URL:
 *
 *   npm run seed -- --confirm-wipe=abcdefgh.supabase.co
 *
 * A local host needs a second flag on top, because local is where the real
 * data lives:
 *
 *   npm run seed -- --confirm-wipe=127.0.0.1 --allow-local
 *
 * Neither flag can be satisfied by copying a file around, which is the
 * whole point. Confirming the wrong host fails loudly rather than wiping
 * the wrong database quietly.
 */
function assertWipeConfirmed(supabaseUrl: string): void {
  const targetHost = new URL(supabaseUrl).hostname;
  const args = process.argv.slice(2);
  const confirmed = args
    .find((arg) => arg.startsWith("--confirm-wipe="))
    ?.slice("--confirm-wipe=".length);
  const allowLocal = args.includes("--allow-local");
  const isLocalHost =
    targetHost === "localhost" ||
    targetHost === "127.0.0.1" ||
    targetHost === "[::1]";

  if (!confirmed) {
    throw new Error(
      `Refusing to seed. This deletes every company, deal and note owned by the demo account on ${targetHost}.\n` +
        `If that is what you want, name the host explicitly:\n` +
        `  npm run seed -- --confirm-wipe=${targetHost}${isLocalHost ? " --allow-local" : ""}`,
    );
  }

  if (confirmed !== targetHost) {
    throw new Error(
      `Refusing to seed. You confirmed "${confirmed}" but .env.local points at "${targetHost}".\n` +
        `Check which database NEXT_PUBLIC_SUPABASE_URL is pointing at before trying again.`,
    );
  }

  if (isLocalHost && !allowLocal) {
    throw new Error(
      `Refusing to seed a local database without --allow-local.\n` +
        `Local is where your real pipeline lives. If you really mean to wipe it and load demo data:\n` +
        `  npm run seed -- --confirm-wipe=${targetHost} --allow-local`,
    );
  }
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const demoEmail = process.env.SEED_DEMO_EMAIL;
  const demoPassword = process.env.SEED_DEMO_PASSWORD;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local.",
    );
  }

  if (!demoEmail || !demoPassword) {
    throw new Error(
      "SEED_DEMO_EMAIL and SEED_DEMO_PASSWORD must be set in .env.local (see .env.local.example).",
    );
  }

  assertWipeConfirmed(supabaseUrl);

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const userId = await resolveDemoUserId(supabase, demoEmail, demoPassword);

  console.log(`Signed in as ${demoEmail} (${userId}).`);
  console.log("Clearing any existing demo data for this account...");

  const { error: deleteError } = await supabase
    .from("companies")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error(
      `Failed to clear existing demo data: ${deleteError.message}`,
    );
  }

  const now = new Date();

  // Name to id, so `partOf` can be resolved after every company exists.
  // A parent may be declared anywhere in SEED_DATA rather than only above
  // its children, which matters because a group reads better written
  // top-down and the holding company usually has no deals of its own.
  const companyIdsByName = new Map<string, string>();

  for (const company of SEED_DATA) {
    const { data: companyRow, error: companyError } = await supabase
      .from("companies")
      .insert({
        user_id: userId,
        name: company.name,
        // Every optional field explicitly null rather than omitted, so a
        // company that was seeded blank stays blank instead of inheriting
        // whatever a future column default turns out to be.
        description: company.description ?? null,
        background: company.background ?? null,
        address: company.address ?? null,
        country: company.country ?? null,
        phone: company.phone ?? null,
        email: company.email ?? null,
        website: company.website ?? null,
        socials: company.socials ?? [],
        vat_number: company.vatNumber ?? null,
        registration_number: company.registrationNumber ?? null,
      })
      .select("id")
      .single();

    if (companyError || !companyRow) {
      throw new Error(
        `Failed to create company "${company.name}": ${companyError?.message ?? "unknown error"}`,
      );
    }

    companyIdsByName.set(company.name, (companyRow as { id: string }).id);

    if (company.contacts?.length) {
      const contactRows = company.contacts.map((contact) => ({
        user_id: userId,
        company_id: (companyRow as { id: string }).id,
        name: contact.name,
        role: contact.role,
        emails: contact.emails,
        phones: contact.phones ?? [],
        socials: contact.socials ?? [],
      }));

      const { error: contactsError } = await supabase
        .from("contacts")
        .insert(contactRows);

      if (contactsError) {
        throw new Error(
          `Failed to create contacts for "${company.name}": ${contactsError.message}`,
        );
      }

      console.log(
        `Seeded ${contactRows.length} contact(s) for "${company.name}".`,
      );
    }

    for (const deal of company.deals) {
      const { data: dealRow, error: dealError } = await supabase
        .from("deals")
        .insert({
          user_id: userId,
          company_id: (companyRow as { id: string }).id,
          title: deal.title,
          status: deal.status,
          value_eur: deal.valueEur ?? null,
          // A deal starts when its first note was written, not when the
          // seed script ran. Without this every deal is created "today",
          // which makes the open-to-won metric compute a negative
          // interval against a closed_at in the past and discard it, so
          // the panel reads "not enough data" on a fully seeded demo.
          created_at: daysAgoIso(oldestNoteDaysAgo(deal.notes), now),
          closed_at:
            deal.closedDaysAgo === undefined
              ? null
              : daysAgoIso(deal.closedDaysAgo, now),
        })
        .select("id")
        .single();

      if (dealError || !dealRow) {
        throw new Error(
          `Failed to create deal "${deal.title}": ${dealError?.message ?? "unknown error"}`,
        );
      }

      const noteRows = deal.notes.map((note) => ({
        user_id: userId,
        deal_id: (dealRow as { id: string }).id,
        content: note.content,
        kind: note.kind ?? "note",
        // The database enforces both halves of this: an email has a
        // direction and a note does not. Sending "outbound" on a plain
        // note would trip the check constraint rather than be ignored.
        subject: note.kind === "email" ? (note.subject ?? null) : null,
        direction:
          note.kind === "email" ? (note.direction ?? "outbound") : null,
        confidential: note.confidential ?? false,
        created_at: daysAgoIso(note.daysAgo, now),
        // Must match created_at. Without it the column defaults to now(),
        // so a note backdated three weeks looks three weeks newer than it
        // is, and NoteList renders "edited" on every seeded note in the
        // demo. Nothing was edited: only the default gave that impression.
        updated_at: daysAgoIso(note.daysAgo, now),
      }));

      const { error: notesError } = await supabase
        .from("notes")
        .insert(noteRows);

      if (notesError) {
        throw new Error(
          `Failed to create notes for "${deal.title}": ${notesError.message}`,
        );
      }

      // The stored momentum read. Written directly rather than generated,
      // because the demo runs with AUTO_ANALYSIS off and must never make a
      // model call on a visitor's behalf. Without this the traffic light on
      // /deals is blank on the one page the case study links to.
      if (deal.insight) {
        const { error: insightError } = await supabase
          .from("deal_insights")
          .insert({
            user_id: userId,
            deal_id: (dealRow as { id: string }).id,
            momentum: deal.insight.momentum,
            reasoning: deal.insight.reasoning,
            analyzed_at: daysAgoIso(deal.insight.analyzedDaysAgo, now),
          });

        if (insightError) {
          throw new Error(
            `Failed to seed the analysis for "${deal.title}": ${insightError.message}`,
          );
        }
      }

      console.log(
        `Seeded "${company.name} / ${deal.title}" with ${deal.notes.length} note(s).`,
      );
    }
  }

  // Second pass for the group structure, now that every company has an id.
  // Only the child holds the link: the parent has no list of subsidiaries,
  // so the fact is stored once (see the 20260906180000 migration).
  for (const company of SEED_DATA) {
    if (!company.partOf) {
      continue;
    }

    const childId = companyIdsByName.get(company.name);
    const parentId = companyIdsByName.get(company.partOf);

    if (!childId || !parentId) {
      throw new Error(
        `Cannot put "${company.name}" under "${company.partOf}": one of them was not seeded.`,
      );
    }

    const { error: parentError } = await supabase
      .from("companies")
      .update({ parent_id: parentId })
      .eq("id", childId);

    if (parentError) {
      throw new Error(
        `Failed to link "${company.name}" to "${company.partOf}": ${parentError.message}`,
      );
    }

    console.log(`Put "${company.name}" under "${company.partOf}".`);
  }

  // Pick the demo's five prospects, staggered rather than all "picked
  // today". The desk shows how long each has been held, and that number
  // only says anything if the five do not all say the same thing: a
  // prospect sitting there for two weeks is the one the screen is trying
  // to make you notice.
  const PROSPECT_AGES_IN_DAYS = [16, 9, 5, 2, 0];

  // Named rather than taken from seed order, which is what this used to
  // do. Two of the five are Meridian and Kestrel Analytics, both inside
  // the Kestrel group, so the demo actually shows the warning the group
  // tree exists for: "2 of your five are in this group". Seed order would
  // have picked IronGate for that slot and the warning would never have
  // fired on the one deployment strangers look at.
  const PROSPECT_COMPANY_NAMES = [
    "Meridian Global Systems",
    "Northwind Traders",
    "Kestrel Analytics",
    "Bluepeak Logistics",
    "Acme Robotics",
  ];

  const prospectIds = PROSPECT_COMPANY_NAMES.map((name) => {
    const companyId = companyIdsByName.get(name);

    if (!companyId) {
      throw new Error(
        `Cannot pick "${name}" as a prospect: it was not seeded.`,
      );
    }

    return companyId;
  });

  for (const [index, companyId] of prospectIds.entries()) {
    const { error: prospectError } = await supabase
      .from("companies")
      .update({
        prospect_since: daysAgoIso(PROSPECT_AGES_IN_DAYS[index], now),
      })
      .eq("id", companyId);

    if (prospectError) {
      throw new Error(`Failed to mark a prospect: ${prospectError.message}`);
    }
  }

  console.log(`Picked ${prospectIds.length} prospect(s).`);
  console.log("Done.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
