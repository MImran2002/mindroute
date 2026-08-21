# MindRoute

## Problem Statement

Most navigation systems prioritizes routes around **travel time and distance**. This require significant cognitive burden for wayfinding because of frequent turns, short segments, complicated intersections, dense points of interest, traffic, noise, construction, and repeated crossing decisions. These factors are not just theoretical edge cases as I was almost hit by an approaching car in Presidio, San Francisco while the navigation system directed me to cross three cross-road in a span of two minutes. 

So, MindRoute propose a question:

> **What if a walking route could be recommended based on cognitive effort as well as travel efficiency?**

The project is motivated by people with ADHD and others who may experience cognitive overload while navigating unfamiliar or overstimulating environments.

### Goal

The goal of MindRoute is to give users another way to compare walking routes beyond speed.

MindRoute aims to:

- Generate multiple valid walking-route options
- Estimate cognitive burden for each route
- Compare route complexity and environmental stimulation
- Recommend one route while keeping alternatives visible
- Explain why a route was recommended
- Learn from user route selections over time
- Keep a non-AI fallback available

### Out of Scope

The current prototype does not:

- Diagnose ADHD
- Measure a user's actual mental state
- Provide a safety score
- Guarantee that one route is objectively safer than another
- Replace Mapbox or another routing provider
- Generate its own street geometry
- Provide full individual personalization yet
- Support every transportation mode

### Constraints

MindRoute currently has several prototype constraints:

- Environmental data may be incomplete
- OpenStreetMap and Overpass requests can be slow or rate-limited
- Some environmental features are estimates rather than real-time measurements
- Candidate routes may be very similar
- The current AI dataset is relatively small
- Personalization requires more real user selections
- The prototype currently focuses on walking navigation

### Assumptions

The current system assumes that:

- Route structure can contribute to navigation difficulty
- Frequent decisions and complex intersections may increase cognitive effort
- Environmental stimulation may affect how manageable a route feels
- Users may prefer a slightly longer route if it is easier to process
- User route selections can provide useful preference signals
- Cognitive burden should be treated as a multidimensional estimate

---

## Customer Experience

### Target Audience

MindRoute is designed for people with ADHD, neurodivergent users, people navigating unfamiliar environments, and anyone who prefers simpler walking routes.

It follows **accessibility and universal design principles** by reducing cognitive and visual barriers and giving users more control over route comparison.

### Customer Need

Traditional navigation mainly shows:

- Distance
- Travel time
- Transportation mode

MindRoute adds:

- Cognitive load
- Route complexity
- Environmental burden
- Comfort-related features

This expands route choice from:

**Speed**

to:

**Speed + Cognitive Load + Environmental Context**

### Customer Stories and Community Evidence

Reddit users with ADHD commonly describe **overstimulation, missed turns, difficulty remembering directions, and reliance on GPS**.

> “busy traffic, overstimulated by all the action & signs”  
[Reddit — r/ADHD](https://www.reddit.com/r/ADHD/comments/rpmcf9)

> “It’s a lot easier to have my phone hold the directions than my head”  
[Reddit — r/ADHD](https://www.reddit.com/r/ADHD/comments/1dx43e8)

> “I struggle immensely with knowing where to go, how to get there”  
[Reddit — r/ADHDWomen](https://www.reddit.com/r/adhdwomen/comments/1vqdsm2/struggle_with_navigating_public_spaces_transport/)

These experiences support MindRoute’s core idea that navigation has a **cognitive cost as well as a time cost**.

### User Journey

1. Enter a starting point and destination
2. Generate multiple walking routes
3. Analyze cognitive and environmental features
4. Rank the routes
5. Show one recommendation with alternatives
6. Compare time, distance, scores, and explanations
7. Select a route
8. Use that selection as future AI training data

### Customer Experience Changes

Traditional navigation:

`Origin → Destination → Fastest Route`

MindRoute:

`Origin → Destination → Multiple Routes → Cognitive Analysis → User Choice`

Users gain visibility into **route complexity and cognitive burden**, while the interface also supports day/night themes, colorblind-friendly route colors, and single-route or multi-route viewing.

---

## Competitive Analysis

| Platform | Primary Focus | ADHD Route? | Competitive Position vs. MindRoute |
|---|---|---:|---|
| **Google Maps** | Fast, efficient routing | No | Does not optimize for cognitive load |
| **Apple Maps** | Navigation and accessibility | No | Simplifies guidance, not route burden |
| **Citymapper** | Transit and accessible routing | No | Supports simpler routes but is not ADHD-specific |
| **Mapbox** | Routing infrastructure | No | Generates routes; MindRoute adds cognitive ranking |
| **NavFocus** | ADHD-focused navigation assistance | Yes | Helps reduce distraction during navigation, but does not rank routes by cognitive burden |
| **MindRoute** | Cognitive-aware walking routes | Yes | Adds cognitive and environmental dimensions to route selection |

---

## Proposed Solution

MindRoute adds a cognitive-aware intelligence layer on top of standard walking navigation.

Instead of generating roads itself, MindRoute receives valid walking routes from Mapbox, analyzes each candidate, and recommends the route with the best balance of cognitive burden and travel efficiency.

### Core Solution

- Generate multiple walking-route options
- Extract navigation features
- Analyze environmental characteristics along each route
- Estimate cognitive load and comfort
- Rank route candidates
- Present one recommendation with alternatives
- Learn from route selections using AI
- Fall back to deterministic scoring when AI is unavailable

### Dependencies

| Dependency | Purpose |
|---|---|
| Mapbox Directions API | Generate walking routes |
| Mapbox GL JS | Render and compare routes |
| OpenStreetMap | Geographic and environmental information |
| Overpass API | Query environmental features |
| NestJS | Route orchestration and scoring |
| FastAPI | Serve AI ranking |
| XGBoost | Learn route preference ranking |
| JSONL/CSV | Store prototype training and diagnostic data |

### How the Solution Meets the Goal

MindRoute keeps travel time visible while adding cognitive burden as another comparison dimension.

Example:

| Route | Time | Cognitive Load | Recommendation |
|---|---:|---:|---|
| Route A | 17 min | High | Fastest |
| Route B | 20 min | Medium | Best overall |
| Route C | 23 min | Low | Lowest cognitive load |

The system does not force one definition of the best route. It gives the user additional information to make a more informed choice.

---
## Running the App in Local Development

MindRoute uses fixed development ports:

| Service | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:3001` |
| Backend Health | `http://localhost:3001/api/health` |
| ML API | `http://localhost:8000` |
| ML Health | `http://localhost:8000/health` |

### Start Development

Run:

```bash
chmod +x dev-all.sh
./dev-all.sh
```

---

## App Design

MindRoute keeps route comparison simple and avoids unnecessary visual overload.

- Select a starting point and destination
- Display one recommended route first
- Reveal alternative routes when needed
- Show distance and walking time
- Show cognitive-load and comfort scores
- Explain why routes receive their labels
- Support single-route and multi-route modes
- Include day and night themes
- Use a colorblind-friendly route palette

> **Insert application user-flow video here.**

---

## Workflow Changes

Traditional routing:

`request → routing provider → route → user`

MindRoute:

`request`
→ `multiple walking candidates`
→ `feature extraction`
→ `environmental analysis`
→ `baseline scoring`
→ `optional ML ranking`
→ `recommended route + alternatives`
→ `user selection`
→ `training record`

The main workflow change is the addition of a route-analysis and learning layer between route generation and route presentation.

---

## API and Data Changes

MindRoute extends standard route data and APIs to support cognitive-aware ranking.

### Backend and AI API

The NestJS backend manages:

- Route generation and comparison
- Environmental feature collection
- Cognitive-load scoring
- User selections and diagnostics
- AI ranking requests

The FastAPI ML service exposes:

`POST /rank`

and returns:

- `mlScore`
- `mlRank`

If the AI service is unavailable, MindRoute continues using the deterministic baseline.

### Extended Route Data

Standard route data such as **geometry, distance, duration, and maneuvers** is expanded with features including:

- Shade
- Greenery
- Pedestrian density
- Traffic
- Noise
- Commercial activity
- Construction
- POI density
- Crossing complexity

MindRoute also records recommendation labels, baseline scores, user selections, data quality/provenance, and training eligibility so route choices can later become supervised AI training examples.

## Cognitive Burden Metric

Cognitive burden cannot be directly measured from map data.

MindRoute therefore uses route characteristics as **proxies** for how demanding a route may be to navigate.

| Factor | Why It Matters |
|---|---|
| Crossing complexity | More complex crossings may require more attention |
| POI density | Dense environments may create more visual information |
| Commercial activity | Commercial areas may contain more signage and activity |
| Pedestrian density | Crowded areas may increase navigation demands |
| Traffic | Vehicle activity can increase environmental stimulation |
| Noise | Noisy environments may be harder to process |
| Construction | Temporary obstacles can make routes less predictable |
| Route structure | Turns and short segments require repeated decisions |
| Greenery | May contribute to a calmer environment |
| Parks | Can represent lower-stimulation portions of a route |
| Shade | Can contribute to walking comfort |

These values describe characteristics of the route. They do **not** measure a person's actual cognitive state.

---

## AI Alternative Consideration

Several possible optimization targets were considered before focusing on cognitive burden.

| Alternative | Advantages | Disadvantages |
|---|---|---|
| **Cognitive burden** | Directly matches the project's research question and can use measurable route proxies | No universally accepted cognitive-load metric exists for navigation |
| **Comfort** | Easy for users to understand and can use greenery, shade and noise | Highly subjective and varies between users |
| **Shortest distance** | Easy to calculate and validate | Already handled by existing navigation platforms |
| **Fastest route** | Familiar and directly measurable | Does not solve the cognitive-overload problem |
| **Quietest route** | Strong relationship to overstimulation | Reliable real-time noise data is difficult to obtain |
| **Fewest turns** | Simple measure of navigation complexity | Ignores environmental stimulation and other route factors |
| **Greenest route** | Uses measurable environmental features | Greenery alone does not represent cognitive burden |

### Why Cognitive Burden Was Selected

Cognitive burden was selected because it best matches the problem MindRoute is trying to explore.

A route can be short and fast while still containing:

- Frequent turns
- Complex intersections
- Dense POIs
- Heavy pedestrian activity
- Traffic
- Noise
- Construction

MindRoute combines these characteristics instead of relying on a single factor.

---

## AI Component

MindRoute uses a Python/FastAPI service backed by an **XGBoost learning-to-rank model (`XGBRanker`)**.

The AI does not generate routes.

Mapbox first generates valid walking candidates. MindRoute extracts structured features from those routes and sends candidate feature vectors to the model.

Current model features include:

- Distance
- Duration
- Shade
- Greenery
- Park exposure
- Pedestrian density
- Traffic
- Noise
- Commercial activity
- Construction
- POI density
- Crossing complexity

The model also receives request-relative versions of these values so it can compare each candidate with the other routes presented for the same trip.

---

## AI Usage

The AI pipeline is:

`walking candidates`
→ `feature extraction`
→ `environmental analysis`
→ `baseline scoring`
→ `ML ranking`
→ `ranked alternatives`

When a user chooses a route, MindRoute records the selected candidate.

For example:

`Route A`
`Route B`
`Route C`
→ **User selected Route B**

That request can then become a supervised learning example.

Over multiple selections, the model can learn which combinations of route characteristics better predict route preference.

At inference time, the NestJS API sends candidate feature vectors to the FastAPI service.

The model returns:

- `mlScore`
- `mlRank`

If the model is unavailable or not considered ready, MindRoute continues using its deterministic ranking.

---

## AI Usage During Development

AI was also used as a development assistant while building the MindRoute prototype.

It supported tasks such as:

- Brainstorming cognitive-load features
- Reviewing architecture and backend design
- Generating and refining implementation ideas
- Debugging TypeScript, NestJS, and Python issues
- Improving API and data-flow design
- Creating test cases and checking edge cases
- Reviewing training-data readiness
- Interpreting XGBoost evaluation results
- Improving README and technical documentation

AI was used to speed up iteration and provide implementation support, while design decisions, testing, validation, and final integration remained part of the development process.

---

## AI Challenges and Overcoming Them

### Cold-Start Problem

A preference model cannot learn before route choices exist.

**Approach:**  
Start with deterministic cognitive scoring and collect route selections over time.

### Environmental API Reliability

OpenStreetMap and Overpass requests may fail, time out, or become rate-limited.

**Approach:**  
Use caching, fallback environmental data, provenance tracking, and diagnostics.

### Poor Training Examples

Not every generated route should automatically become training data.

**Approach:**  
Use training eligibility and dataset-readiness checks.

### Similar Route Candidates

If route alternatives are nearly identical, user selections provide little learning value.

**Approach:**  
Generate offset candidates and remove substantially duplicated routes.

### Model Overconfidence

A small or repetitive dataset may produce misleadingly strong evaluation results.

**Approach:**  
Evaluate using held-out requests and held-out trip families and compare the learned model with the deterministic baseline.

### AI Environment Challenges

The main application uses TypeScript and Node.js while the model uses Python.

The full development environment therefore includes:

`Next.js`
+
`NestJS`
+
`FastAPI`
+
`XGBoost model artifacts`

**Approach:**  
Keep the Python ML environment separated behind an HTTP API so AI-specific setup or dependency problems do not break core navigation.

---

## Testing

Testing is separated between deterministic application behavior and machine-learning behavior.

### Unit Tests

Unit testing covers components such as:

- Feature extraction
- Environmental aggregation
- Baseline scoring
- Route comparison
- Recommendation assignment
- Input validation

### Environment Testing

Environment testing verifies that:

- Mapbox credentials work
- Walking routes can be generated
- Environmental data can be retrieved
- Fallback data works when providers fail
- NestJS can communicate with external services

### AI Environment Testing

AI requires separate evaluation because ML quality cannot be determined through normal unit tests alone.

The AI pipeline uses:

- Training-data audits
- Dataset-readiness checks
- Held-out request testing
- Held-out trip-family testing
- Top-choice accuracy
- NDCG
- Baseline comparison
- Model-readiness checks

The current repository reports prototype results including:

- **76 trainable requests**
- **197 training rows**
- **93.4% request-holdout top-choice accuracy**
- **76.3% leave-one-trip-family-out top-choice accuracy**
- **57.9% baseline top-choice accuracy**
- **~0.904 trip-holdout NDCG**

These results describe performance on the current prototype dataset and are not clinical validation.

---

## Work Breakdown

![alt text](./commitHistory.png)

[MindRoute Planning & Design Document](https://docs.google.com/document/d/1SG8YXR0_SdxMIckXGpZmWioQvJRKJwOQTRc7vOUn5D8/edit?usp=sharing)

- **Week 1 — Research & Scope**
  - Defined the problem, terminology, target users, available data, tech stack, scope, and repository strategy
  - Focused on keeping the prototype small and clearly scoped before implementation

- **Week 2 — AI & Engineering Planning**
  - Researched AI approaches and possible cognitive-load factors
  - Broke the project into epics, issues, sprints, and a monorepo structure

- **Week 3 — Technical Design**
  - Finalized the roadmap, cognitive-load framework, environmental feature taxonomy, and AI architecture
  - Defined route recommendation strategy, data flow, and implementation plans

- **Week 4 — Application Foundation**
  - Built the repository structure, frontend and backend foundation, and basic service health checks
  - Established the initial application architecture and development environment

- **Week 5 — Maps & Navigation**
  - Integrated Mapbox, destination search, and walking-route generation
  - Improved map rendering, location handling, search constraints, and error handling

- **Week 6 — Cognitive Route Analysis**
  - Added multiple-route generation, route comparison, and deterministic cognitive scoring
  - Built the foundation for AI-ready route analysis

- **Week 7 — Environmental Data & Training Pipeline**
  - Added environmental data, caching, diagnostics, route statistics, training records, and user route selections
  - Prepared structured data for future machine-learning training

- **Week 8 — Machine Learning, Evaluation & Demo**
  - Completed the XGBoost ranking pipeline, FastAPI integration, and model evaluation
  - Refined the frontend, accessibility features, and demo readiness

---

## Tech Stack and Rationale

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript | Component-based UI and strong TypeScript support |
| Styling | Tailwind CSS 4 | Rapid accessibility-focused UI development |
| Map Rendering | Mapbox GL JS | Interactive route visualization and map customization |
| Walking Directions | Mapbox Directions API | Generates valid pedestrian routes and navigation instructions |
| Backend | NestJS 11 | Structured services, dependency injection, and orchestration |
| Environmental Data | OpenStreetMap + Overpass | Open geographic context around routes |
| AI Service | Python + FastAPI | Separates ML runtime from the TypeScript application |
| Machine Learning | XGBoost `XGBRanker` | Appropriate for structured features and grouped ranking |
| Data Processing | pandas | Dataset construction and evaluation |
| Validation | Joi, Pydantic, class-validator | Explicit contracts between application layers |
| Package Management | pnpm workspaces | Monorepo dependency management |
| Testing | Jest + Python evaluation scripts | Separates software tests from ML evaluation |
| Prototype Storage | JSONL/CSV | Easy to inspect while the data model evolves |
| Future Storage | PostgreSQL + PostGIS | Appropriate for larger-scale persistent geospatial data |

---

## Technical Design Choices

**Separate route generation from route intelligence.**  
Mapbox generates valid walking routes while MindRoute analyzes and ranks them.

**Keep a deterministic baseline.**  
The baseline provides explainability, a benchmark for AI performance, and fallback behavior.

**Use ranking instead of classification.**  
A user's preference depends on the other routes shown for the same request, making learning-to-rank more suitable than independently labeling routes.

**Use absolute and relative features.**  
Absolute features describe the route itself while relative features describe how it compares with the other candidates.

**Sample environmental context along the route.**  
Route characteristics cannot be estimated reliably using only the origin and destination.

**Track data provenance.**  
Live, cached, mixed, and fallback environmental data are distinguished so weak data can be identified.

**Separate collection, training, evaluation, and inference.**  
NestJS manages navigation and data collection, Python handles model training and evaluation, and FastAPI serves inference.