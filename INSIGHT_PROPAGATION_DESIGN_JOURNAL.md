# Insight Propagation Design Journal

This file documents, in a deliberately verbose and step‑by‑step way, how we
designed the insight propagation visual, what we learned along the way, and
how we abstracted those learnings into a more general problem‑solving method.

The goal is for this to be reusable as:

- a design log of decisions and trade‑offs
- a thinking aid for future visual / system design problems
- a bridge to underlying theory (diffusion, networks, attention, etc.)

---

## 1. Starting Point

### 1.1. Original intent

We started from a simple narrative:

> "Show how an insight spreads naturally through an organisation versus how it
>  spreads when a system like NYQST Natura helps distribute it."

Early constraints:

- Visual should be **network‑based** (nodes and edges) rather than charts.
- We wanted a **side‑by‑side comparison** of natural vs. instant propagation.
- The user experience should be **visually rich but conceptually simple**.

### 1.2. Initial implementation (legacy `script.js`)

The first implementation (now in `archive/script.js`) focused on:

- Generating an “organic” network with multiple patterns:
  - central hubs
  - chains
  - hierarchies
  - clusters
- Running a natural BFS‑style propagation over static + dynamic connections.
- A simple instant mode where every node flipped green quickly.

At this stage:

- Nodes had positions, edges, and an `activated` flag.
- Dynamic connections were created occasionally to link silos.
- Visuals looked good, but behaviour was still fairly mechanical.

Key limitation: **once some nodes turned green, others in the same connected
component sometimes did *not***. We had a logic bug in the natural propagation
queue.

---

## 2. Fixing Basic Propagation

### 2.1. Diagnosing the bug

We inspected the natural propagation loop and realised:

- The BFS queue processed one node at a time.
- Propagation checks sometimes looked only at `conn.from` being activated,
  even when the current node was on the `to` side.

Result: a connected node could be skipped if the logic didn’t treat both
directions symmetrically.

### 2.2. Fixing directionality

We:

- Introduced symmetry when examining edges: if the current node is either
  `from` *or* `to`, and the opposite endpoint is active, we enqueue it.
- Ensured we never re‑enqueue already activated nodes.

This restored the basic invariant:

> *Within a connected component, insight eventually reaches every node.*

### 2.3. Making propagation parallel

Initially, propagation processed **one node per tick**. That felt too serial
and under‑represented the parallel nature of human conversations.

We changed the loop so that on each tick we:

- Capture the current queue length as a “frontier”.
- Process that many nodes in one pass (a wave), enqueuing their neighbours
  for the next wave.

Outcome: more **wave‑like, exponential** activation instead of a single random
walk.

---

## 3. Layout, Spacing, and Diversity

### 3.1. Visual spacing

Problem: the early networks were visually cluttered. Nodes overlapped and the
graph felt cramped.

We introduced a simple force‑like spacing pass:

- Iterate pairs of nodes.
- If they are closer than some `minDistance`, nudge them apart.
- Repeat a few iterations.

This dramatically improved readability without implementing a full force‑
directed layout.

### 3.2. Pattern diversity

We noticed networks sometimes degenerated into repeated patterns (e.g., too
many chains, too many hubs).

To address this, we:

- Defined a list of pattern generators: `createCentralHub`, `createChain`,
  `createHierarchy`, `createCluster`.
- Introduced a **pattern diversity** mechanism:
  - Guarantee that we use each pattern at least once before repeating.
  - Avoid using the same pattern more than N times in a row.

Result: networks with a **healthy mix** of small/medium/large structures.

---

## 4. Transition to the NYQST Natura Paradigm (`index-v2.html` / `script-v2-fixed.js`)

### 4.1. Freezing the old world

We archived the original `index.html`, `script.js`, and `script-v2.js` into
`archive/` and defined `index-v2.html + script-v2-fixed.js` as the new source
of truth.

This avoided “which version is live?” confusion and let us refactor more
aggressively.

### 4.2. Designing the Natura view

We created a cleaner layout:

- A single hero comparison:
  - **Existing Organisations** (natural propagation on the left)
  - **Organisations with NYQST Natura** (system‑enabled propagation on the
    right)
- A metrics grid beneath the canvases.
- A legend for node states and connection types.

We also settled on a palette and semantics:

- Grey = unaware.
- Orange = discovery node.
- Green = adopted.
- Blue = Natura system and its connections.

---

## 5. Making Propagation Feel Human

### 5.1. From simple BFS to particle‑based storytelling

We replaced “instant flips” with **particles** traveling along edges:

- Natural side:
  - Green particles move from activated nodes to neighbours.
  - Dynamic edges (dashed orange) connect silos and carry particles too.

- Natura side:
  - A particle travels from the source node to the blue Natura hub.
  - Once Natura is “activated”, particles fan out to every node.

Particles made the flow **legible**: you see where the signal is going, not
just the end state.

### 5.2. Duration‑based motion

We moved from step‑wise position updates to **duration‑based** timing:

- Each particle has `startTime` and `duration`.
- Progress is computed as `(now - startTime) / duration`, clamped to [0, 1].
- We apply an ease‑out curve: `progress = 1 - (1 - linearProgress)^3`.

Key benefit: **time to transfer is consistent regardless of distance**. That
matches the conceptual notion: once a connection exists, it doesn’t take
longer to email someone “further away” in the drawing.

### 5.3. Slowing down and calming the experience

Several passes focused on pacing:

- Increased particle durations so movements were slow enough to track.
- Reduced metric update frequency to every N frames to avoid flicker.
- Ensured that each phase (natural spread, Natura detection, Natura broadcast)
  had space to breathe before the next began.

We iterated until the animation felt **contemplative**, not frantic.

---

## 6. Introducing Behavioural Blockers

At this point, the visuals showed clean propagation, but didn’t capture the
messiness of real organisations. We began modelling **blockers**.

### 6.1. Blocker types

We introduced three behavioural blockers on the natural side:

1. **Focus drag** – the person hears the idea but parks it until they have
   mental bandwidth.
2. **Trust hurdle** – the person requires multiple confirmations / peer
   adoption before acting.
3. **Verification delay** – the person or team must verify or get compliance
   sign‑off before adopting.

Implementation details:

- Each node has:
  - `blocker` ∈ {`focus`, `trust`, `verify`, `null`}.
  - `blockerResolved`, `blockerHits`, `blockerResolveTime`, `blockerNextAttempt`.
- At reset time we assign blockers probabilistically:
  - Higher probability for at least one blocker so they’re visible each run.

### 6.2. Enforcing blockers in natural propagation

When a particle reaches a node:

- `canReceiveInsight(nodeIndex)` checks whether the node is allowed to accept
  a particle yet (based on timers and hit counts).
- `applyBlockerOnArrival(nodeIndex)` decides whether the particle:
  - is consumed without activation (stay grey, schedule a later attempt), or
  - clears the blocker and allows activation.

We tuned behaviour:

- Focus: long random delays (several seconds) before `blockerResolved` flips.
- Trust: node requires multiple hits (e.g. three attempts) before allowing
  activation.
- Verify: node has a long, fixed “validation window” before accepting any
  particle.

### 6.3. Visualising blockers

We added **halo rings** around blocked nodes:

- Amber = focus drag.
- Violet = trust hurdle.
- Blue = validation loop.

We also introduced **blocker cards** beneath the main comparison, each listing
node IDs currently blocked by that type. These cards update live as blockers
resolve.

Outcome: the user can see *where* the network is stuck, and *why*.

---

## 7. Metrics and Evidence

### 7.1. Per‑node productivity counters

We assigned each node:

- `outputRateInactive` – baseline productivity when still grey.
- `outputRateActive` – 2× the baseline once the insight is adopted.

Every animation tick, we increment `outputCounter` by the relevant rate.

### 7.2. Global aggregates and averages

We aggregate across nodes to compute:

- `globalNaturalOutput` and `globalInstantOutput`.
- Average per‑cycle output for each network.
- Delta between the two outputs.

We surface these in the **metrics grid** right under the canvases:

- Left: Natural output + average.
- Middle: Delta + cycle count.
- Right: Natura output + average.

We batch updates every 10 frames and show **whole numbers**, keeping the
metrics readable and calm.

### 7.3. Time as “cycles”

Rather than seconds, we label time in **Cycles**:

- A cycle is an abstract time unit (roughly ~1.5s) so the story doesn’t feel
  tied to literal seconds.
- This matches the idea of “iterations”, “sprints”, or “communication rounds”.

Result: we can talk about “output per cycle” and “delta by cycle N” as a more
general concept.

---

## 8. Visual Proofs: Archetypes and Blockers in Isolation

### 8.1. Archetype mini‑visuals

We added a **Visual Proofs** section with individual cards:

- Peer Roundtable (chain).
- COE After Field Spark (hub from spoke).
- COE Starting At HQ (hub from centre).
- Program Pods (parallel tree).
- Cross‑Silo Liaison (bridge between clusters).

Each card has its own canvas, controls, and plain‑language blurb. These run
automatically (auto‑cycle) and can be manually triggered.

### 8.2. Blocker‑specific micro‑visuals

To show blockers in isolation, we added three more cards:

- Focus Drag Demo.
- Trust Threshold Demo.
- Verification Delay Demo.

Each uses a dedicated network builder and an **arrival handler**:

- `focusArrivalHandler`:
  - Keeps rejecting the first two particles to a node.
  - Only on the third attempt does the node activate.

- `trustArrivalHandler`:
  - Checks how many neighbours are already activated.
  - Only activates the node once two neighbours are green.

- `verifyArrivalHandler`:
  - Rejects the first particle and schedules a retry after a fixed “gate”
    duration.
  - Second attempt is allowed through.

These mini‑scenes run on a loop, each reinforcing one specific organisational
behaviour.

---

## 9. Technically Reusable Patterns

The code now embodies several patterns that are reusable in other problems:

1. **Topology generators decoupled from behaviour**
   - `createChain`, `createHub`, `createParallelVisualNetwork`, etc. are pure
     graph constructors.
   - Propagation logic sits in separate methods/classes.

2. **Arrival handlers for behaviour injection**
   - Mini visualisations use `arrivalHandler(viz, particle)` hooks to alter
     how adoption works, without touching the particle engine.

3. **Randomised variants with stable semantics**
   - `generateShowcaseNetwork(centerX, centerY)` chooses a mix of patterns,
     variants, positions, but keeps colours and labels consistent.

4. **Auto‑cycle micro‑visuals**
   - Each card’s `MiniPropagationVisualization` auto‑restarts after a pause
     once its queue and particles are empty.

5. **Batched metrics**
   - A simple tick counter controls how often we update DOM metrics, smoothing
     the UX while keeping the underlying model continuous.

6. **Blocker overlays and lists**
   - Halos on the canvas plus live badge lists give both spatial and textual
     visibility of blockers.

---

## 10. Abstracted Method for Future Problem‑Solving

Summarising the method we followed:

1. **Clarify the story before the mechanics.**
   - Natural vs system‑enabled propagation was the anchor.

2. **Start with a minimal, working structure.**
   - Generate networks, run simple BFS/particles, make sure it doesn’t crash.

3. **Fix correctness first (e.g., full propagation).**
   - Ensure every reachable node can eventually adopt.

4. **Improve legibility: spacing, layout, pacing.**
   - Make it easy for the eye to follow; slow things down.

5. **Inject realistic frictions.**
   - Focus, trust, verification as explicit rules and state on nodes.

6. **Add instrumentation and metrics.**
   - Per‑node counters, global totals, averages, delta.

7. **Co‑locate visuals and evidence.**
   - Put metrics under canvases; put blocker badges next to relevant copy.

8. **Build micro‑scenes for each key concept.**
   - Small auto‑cycling demos for archetypes and blockers.

9. **Tie everything back to human terms.**
   - Rename technical ideas (“wavefront”) into everyday organisational
     language (peer forum, COE, liaison).

10. **Only then, map to theory.**
    - After the visuals felt right, we located them in diffusion, attention,
      legitimacy, and network theories.

This pattern—structure → correctness → legibility → behaviour → metrics →
micro‑scenes → language → theory—can be reused as a general design and
problem‑solving method for complex organisational visuals.

