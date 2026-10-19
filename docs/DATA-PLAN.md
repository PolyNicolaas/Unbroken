# Data, accounts and security: the plan

Drafted 19 October 2026 with Nicolaas. Nothing here is built yet; it sets the direction so the steps in ROADMAP.md
("Data and accounts") fit together. Open questions for Nicolaas are at the end.

## The goal

Make something in Unbroken, and have everything about it kept together: the **raw source**, the **trace**, the
**G-code** (or plotter SVG), and the **metadata** that explains each one, with **who made it**. Later, the same record
gets the print log: when it was printed, on what, and how it came out.

Unbroken itself doesn't have to hold the data. The app's job is to produce one complete, self-describing package per
design; where that package is kept (a folder, a cloud library, a shared database) can change without touching the
tracing engine.

## Who it's for (decided 19 October)

- **Now: Nicolaas.** He runs Unbroken, hosts it and owns the printers.
- **Next: other people make designs that Nicolaas prints.** They need a way to save what they made and hand it in;
  he needs it to arrive with everything attached and to move through a workflow until it's printed.
- So there are two roles: the **owner** (Nicolaas: printers, materials, the print queue, the final say) and
  **makers** (anyone he invites: make designs, submit them, see where they are). The owner is a maker too.

## The workflow: from a design to a print

```
 Maker                              Owner (Nicolaas)
 ─────                              ────────────────
 1 Make     design in Unbroken
 2 Save     design record (source, trace, settings, who)
 3 Submit   ───────────────────────► 4 Review   check it suits the technique
                                        ├─ Needs changes ──► back to the maker, with a note
                                        └─ Accepted
                                     5 Prepare  pick printer, needle, chocolate; make the G-code
                                     6 Queue    in the print queue, with copies and a due date
                                     7 Print    the G-code stamped with design, revision, job
                                     8 Log      date, outcome, rating, photo
 9 Done     sees "Printed" (and the photo) ◄─┘
```

Statuses a submission moves through: **Draft → Submitted → Needs changes / Accepted → Queued → Printing →
Printed → Collected** (or **Declined**, with a reason). Each change is kept with who made it and when, so the
history of a print can be read back.

**The maker sends the design, never the G-code.** The owner makes the G-code from the design with his own printer,
needle and chocolate settings. That keeps the machine safe (no G-code from outside reaches the printer) and the
results consistent (the owner's recipes, not each maker's guesses). A maker sets what the piece looks like: the
source, the trace, the size, the copies wanted; the owner sets how it's printed.

## Where things stand (v99)

- **Design file** (`name.unbroken.json`, File → Save): the settings and the source image. The 3D model's mesh isn't
  in it, only a fingerprint to match it when the same STL is loaded again.
- **Exports** (G-code zip, SVG for Saxi, DXF for choc OS): downloaded separately. The G-code starts with a short
  header (`; Unbroken — one continuous path`, `; size …`); the file name has the design, needle and copies (v93).
  Nothing links an export back to the design file that made it.
- **Suggestion box notes**: kept in the browser that typed them (localStorage) on GitHub Pages. Notes from friends
  using the Pages site stay on their computers and never reach the roadmap.
- **No accounts, no server.** GitHub Pages serves static files only.

## What a design record holds

One record per design, with a permanent **design number** (`U0007`, as planned on 17 October) that goes into every
file name.

| Part | What's in it | Format |
|---|---|---|
| **Source** | The original file as dropped in: image, STL, or the typed text and font | Original bytes, untouched |
| **Design** | Every setting: tracing, size, needle, gap, layers, infill, support, plate, copies | The design-file JSON |
| **Trace** | The result: the Fourier coefficients (X, Y, Z series) and the finished line as points | JSON (coefficients) + SVG (the line) |
| **Outputs** | Each export: G-code, plotter SVG, DXF | The files as downloaded |
| **Metadata** | See the list below | `manifest.json` |
| **Prints** *(later)* | Each time it's printed: date, printer, chocolate or clay, settings stamped at export, rating, notes, a photo | Rows in the print log |

**Metadata** (`manifest.json`), written by the app at save or export time:

- Identity: design number, name, revision (each save is a new revision; old ones are kept), created and changed
  dates.
- Who: the user's id and display name (once there are accounts; until then, a name typed once and kept in the
  browser).
- App: Unbroken version (v99) and the engine's settings version, so an old design can be reopened the same way.
- Source: file name, type, size, a fingerprint (SHA-256) so the same source is recognised again.
- Trace: number of terms, error score (mm), closest gap, line length, time to trace.
- Machine: printer profile and its version, needle, line width and gap, layer height, speeds, material (chocolate
  or clay), copies, plate layout.
- Estimates: print time, metres of line, grams (and cost, once the material database has prices).
- Outputs: each file's name, fingerprint, and the settings it was made with.

The G-code header gets the same essentials as comments (`; design U0007 rev 3`, `; Unbroken v99`, `; needle 18G`,
`; chocolate …`), so a G-code file on its own still says where it came from.

## In stages

### Stage 1: the design bundle (no server, works on GitHub Pages)

- **File → Save** writes one `.unbroken` bundle (a zip) with `manifest.json`, the source, the design, the trace
  and the current outputs. **File → Open** reads it back, and still reads the old `.unbroken.json`.
- Export stamps the G-code header and adds the export to the bundle's manifest.
- A design number is made locally for now (date + counter); the database takes over numbering in stage 2.
- A user name typed once (no login) goes into the manifest.
- **Submit by file**: a maker's "Send for printing" saves the bundle with their name, contact and request (copies,
  date wanted, a note) and offers to email it. The owner opens it; it goes into a **print queue** kept in his browser,
  where he can review it, make the G-code and mark it printed. The workflow runs end to end before there's a server.

Why first: it settles **what** is stored before deciding **where**. The bundle is the format stage 2 uploads, and
it's useful straight away: one file holds everything about a print, and the first makers can send designs in.

### Stage 2: accounts and a cloud library

- **A hosted backend** in front of GitHub Pages, so the app stays a static page. The likely fit is **Supabase**
  (a Postgres database, sign-in, file storage and per-user access rules in one service); Firebase is the main
  alternative. Both have free starting tiers; check limits and prices when choosing.
- **Sign-in** through the provider: email magic link, or Google / Apple. Unbroken never stores passwords.
- **My designs**: a library page listing your designs with thumbnails, search, revisions, and open / duplicate /
  delete. Saving uploads the stage 1 bundle; files go to storage, metadata into tables.
- **Offline still works**: with no sign-in the app saves bundles to disk as in stage 1. A signed-in user can upload
  local bundles later.
- **Submissions online**: makers submit from the app; the owner gets an **inbox** (review, accept, ask for
  changes, decline) and a **print queue** (order, due dates, copies, material). Makers see their designs' status;
  email when it changes.
- The Suggestion box moves into the same database, so notes from every user reach the roadmap.

Tables, roughly:

| Table | Holds |
|---|---|
| `profiles` | User id (from sign-in), display name, contact, role (owner / maker), created |
| `designs` | Design number, owner, name, current revision, created / changed, visibility |
| `revisions` | Design, revision number, manifest, app version, links to its files |
| `files` | Revision, kind (source / design / trace / gcode / svg / dxf / photo), storage path, fingerprint, size |
| `printers` | Printer profiles (choc mate 2, clay printers), versioned |
| `materials` | Chocolates and clays: name, brand, settings, price per gram |
| `recipes` | Saved 3D settings by name (the "print recipes" in PLAN.md) |
| `jobs` | A submission: design revision, maker, request (copies, date wanted, note), status, owner's notes |
| `job_events` | Each status change: job, from, to, who, when, note |
| `prints` | Job (or the owner's own design), printer, material, date, settings stamped, rating, notes, photo |
| `notes` | Suggestion box |

### Stage 3: the workshop

- The **material database** with prices → grams and cost per copy and per plate.
- **Print log** with ratings and photos, filled in after each print, used to tune recipes.
- **Sharing**: share a design by link (read-only), or with named friends who can duplicate it.
- **Personalized batches** (a list of names → one plate), saved as one design with its list.
- **Send to printer** (Repetier-Server's upload API) once the design and its G-code are tracked.
- If selling prints ever comes up: the product records removed in v75 (lot numbers, allergens) belong here.

## Security

- **Sign-in by a provider, never our own passwords.** Magic links or Google / Apple sign-in.
- **Private by default.** Each row and file belongs to its owner; the database's access rules (row-level security
  in Supabase) enforce it on the server, not just in the page. A maker sees only their own designs and jobs; the
  owner sees everything submitted to him.
- **Keys.** The public key the page needs can sit in the repo (that's its purpose); the service key never goes in the
  page or the repo.
- **Invite-only to start.** Sign-up limited to people Nicolaas invites, until there's a reason to open it.
- **G-code drives a machine.** Makers never send G-code: the owner makes it from their design. Any G-code that
  does come from outside (an old file, a shared one) is checked before it's offered for printing: only the commands
  Unbroken writes, inside the printer's bed and height, no unexpected host commands. The parser that reads G-code
  back (`UNB.readGcode`) is the starting point.
- **Uploads** are size-limited and type-checked; images are re-encoded, not served as uploaded.
- **Personal data kept small**: a display name and the sign-in email. Users can export everything they own and
  delete their account.
- **Backups** of the database and storage, on a schedule.

## Decisions

Made 19 October:
- **For Nicolaas first**, hosted by him; other people's designs come in to be printed by him (owner and makers,
  above).
- **Stage 1 first**: the bundle, G-code stamping, and submit-by-file with a local print queue, before any server.

Still open:
1. **Backend** for stage 2: Supabase (recommended: SQL tables suit designs, jobs, prints and materials) or Firebase.
2. **Where makers make designs**: in the same Unbroken page (one app, the owner's tools hidden from makers), or a
   simpler "make a design" page for them.
3. **What makers may change**: everything about the look, or only some (source, size, copies) with the owner's
   tracing defaults?
4. **Payment**, if makers are ever customers: out of scope until it's needed.
5. **Photos of prints**: part of the print log from the start, or later?
