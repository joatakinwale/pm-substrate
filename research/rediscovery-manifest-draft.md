# Known-Solution Rediscovery Manifest (draft)

Date: 2026-07-24
Status: content corpus draft; external field cases only; not a research slice; no
substrate mechanism; no efficacy claim.

## What this is

The external oracle for the autonomous-Arrowsmith benchmark proposed in
[`v233`](daily-arrowsmith-agent-state/v233-autonomous-research-benchmark-least-context-and-stale-basis-hypotheses-2026-07-22.md)
(Endpoint 2). It is a set of ~20 **historically solved cross-domain problems** —
cases where a problem stuck inside one field was solved by a solver from a
distant field (Jeppesen & Lakhani 2010 marginality). For each problem we record:

- **Original domain** — where the problem lived and stayed unsolved.
- **Solver's distant domain** — the marginal field the working solution came from.
- **Known solution class (ORACLE KEY — held out)** — used only to score a run;
  never shown to the engine.
- **Jargon-stripped problem statement (ENGINE INPUT)** — domain-neutral, leaks
  neither the source field nor the solution. This is the only text the engine
  sees. The oracle is binary: does the engine's top-k hypothesis land in the
  known solution class?
- **Primary sources** — only URLs verified to resolve during the run that added
  the entry.

Progress: **4 / ~20.** When ~20 are reached, a slice proposes the content-freeze;
hashing the frozen corpus and `pnpm witness:anchor` is the owner's step (done
before any engine run so the oracle key cannot be back-edited to fit a result).

Anti-leak rule: keep each ENGINE INPUT free of the tokens that name the domain or
the mechanism (no "oil", "protein", "gold", "blood", "fish oil", "vibration",
"fractal", etc.). If a statement cannot be stripped without becoming unsolvable,
it does not belong in the corpus.

---

## R1 — Semi-frozen two-liquid sludge that will not pump

- **Original domain:** Arctic marine oil-spill recovery (residual Exxon Valdez
  crude in Prince William Sound; OSRI / InnoCentive challenge, 2007).
- **Solver's distant domain:** the ready-mix concrete / construction industry
  (solver John Davis, no oil-industry background).
- **Known solution class (held out):** reduce the apparent viscosity of a cold,
  set, thixotropic mass by applying mechanical **vibration** so it becomes
  pumpable — reuse of a tool that keeps poured cement fluid, adapted to the
  recovery barge. Class: shear-thinning of a Bingham-plastic material by an
  external oscillatory field rather than by heat or solvent.
- **Jargon-stripped problem statement (engine input):** "A cold mixture of two
  immiscible liquids has set into a thick, near-solid mass inside a holding tank
  and now clogs the pumps meant to empty it. Without heating it, diluting it, or
  chemically changing it, how can the mass be made to flow freely again so it can
  be pumped out?"
- **Primary sources:**
  - InnoCentive press release — https://www.innocentive.com/innocentive-solver-develops-solution-to-help-clean-up-remaining-oil-from-the-1989-exxon-valdez-disaster/
  - Chemical & Engineering News — https://cen.acs.org/articles/85/i47/InnoCentive-Winner-Solves-Oil-Problem.html

## R2 — Two disconnected literatures imply an untested intervention

- **Original domain:** clinical vascular medicine / rheumatology (a peripheral
  circulatory disorder — Raynaud's — with no dietary therapy known in 1985).
- **Solver's distant domain:** information science / library science (Don
  Swanson, an information scientist, not a physician; the founding case of
  literature-based discovery).
- **Known solution class (held out):** transitive A→B→C inference across two
  non-intersecting bodies of literature. One literature: intervention X lowers an
  intermediate quantity Q (viscosity, platelet aggregation, vascular reactivity).
  Another literature: elevated Q drives condition C. No paper tested X on C.
  Infer and later confirm the untested X→C therapeutic link.
- **Jargon-stripped problem statement (engine input):** "Two large collections of
  published findings never cite each other. Collection 1 reports that treatment X
  reduces measurable quantity Q. Collection 2 reports that a high value of Q makes
  condition C worse. No study has ever tested whether X helps C. From the
  literature alone, identify the untested treatment→condition link most likely to
  hold, and name the intermediate quantity that bridges it."
- **Primary sources:**
  - Swanson 1986, *Perspect Biol Med* 30(1):7-18 (PMID 3797213) — https://pubmed.ncbi.nlm.nih.gov/3797213/
  - Gordon & Lindsay 1996 replication, *JASIS* — https://asistdl.onlinelibrary.wiley.com/doi/abs/10.1002/(SICI)1097-4571(199602)47:2%3C116::AID-ASI3%3E3.0.CO;2-1

## R3 — A configuration automated search could not find for a decade

- **Original domain:** structural biology / X-ray crystallography — the
  Mason-Pfizer monkey virus (M-PMV) retroviral protease structure, unsolved by
  molecular replacement for ~15 years.
- **Solver's distant domain:** online puzzle/video-game players (non-scientists,
  the Foldit Contenders and Void Crushers groups).
- **Known solution class (held out):** crowdsourced interactive 3-D spatial
  reasoning. Give many non-expert humans direct-manipulation tools plus a scoring
  function; their best folded model is accurate enough to seed the automated
  method that then completes the solution. Class: human spatial search over a
  rugged energy landscape where automated global search stalls.
- **Jargon-stripped problem statement (engine input):** "An automated search has
  failed for more than a decade to find a valid three-dimensional arrangement of a
  flexible chain-like object that satisfies a fixed set of physical measurements.
  A good-enough arrangement would let a standard automated method finish the job.
  Design an approach that reaches such an arrangement despite the automated search
  repeatedly getting stuck."
- **Primary sources:**
  - Khatib et al. 2011, *Nat Struct Mol Biol* 18:1175-1177 — https://www.nature.com/articles/nsmb.2119
  - PubMed record (PMID 21926992) — https://pubmed.ncbi.nlm.nih.gov/21926992/

## R4 — Locating rare buried features in a large messy data archive

- **Original domain:** mineral exploration geology (Goldcorp Red Lake mine,
  Ontario; the 2000 Goldcorp Challenge released ~400 MB of survey data publicly).
- **Solver's distant domain:** applied mathematics / computer graphics / fractal
  geometry (the winning Australian teams — Fractal Graphics and Taylor Wall &
  Associates — were graphics and engineering firms, not the company's geologists).
- **Known solution class (held out):** fuse heterogeneous multi-year, multi-format
  survey data into a single 3-D spatial model and apply pattern / fractal spatial
  analysis to rank candidate target locations. Class: model-then-rank over a fused
  geospatial dataset, outperforming in-field expert intuition.
- **Jargon-stripped problem statement (engine input):** "You are handed a large,
  disorganized archive of measurements collected over a wide area across many
  years and incompatible formats. A rare, high-value feature occurs at a few
  unknown points within that area. Build a spatial model from the archive that
  ranks where the next occurrences of the feature are most likely to be, well
  enough to direct a costly physical search."
- **Primary sources:**
  - Fast Company, "He Struck Gold on the Net (Really)" — https://www.fastcompany.com/44917/he-struck-gold-net-really
  - IdeaConnection open-innovation case — https://www.ideaconnection.com/open-innovation-success/open-innovation-goldcorp-challenge-00031.html

---

## Candidate pool for future runs (not yet added; sources unverified)

Left as leads for later runs; each must be source-verified before it counts
toward the 20:

- Swanson magnesium → migraine (the second canonical LBD case; PMID to verify).
- NASA solar-particle-event forecasting solved by a retired RF/telecom engineer
  (InnoCentive; the v233 anchor — verify the solver write-up before adding).
- Prize4Life ALS progression biomarker challenge.
- Netflix Prize temporal-dynamics / ensemble methods from outside the recommender
  field (verify cross-domain framing before adding).
- Kaggle/NASA tournament results and additional InnoCentive-era challenges from
  the Jeppesen & Lakhani 2010 corpus.
