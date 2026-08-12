/**
 * Builds the subtopic resource fixture from real YouTube data.
 *
 *   npx tsx scripts/fetch-resources.ts                   # top up every subtopic
 *   npx tsx scripts/fetch-resources.ts --refilter        # re-apply TOPIC_FILTERS, no network
 *   npx tsx scripts/fetch-resources.ts --fresh           # rebuild from scratch
 *   npx tsx scripts/fetch-resources.ts --subject MATH
 *   npx tsx scripts/fetch-resources.ts --sync-estimates  # also fix study times
 *
 * Output: src/lib/resources/fixture.data.ts
 *
 * Re-runs are incremental: whatever the last run wrote is kept, and only the
 * gaps cost quota. `--fresh` forces full rediscovery.
 *
 * ── On quota ──────────────────────────────────────────────────────────────
 * The daily YouTube Data API allowance is 10,000 units, and endpoints are not
 * priced equally:
 *
 *   search.list       100 units   ← discovery, expensive
 *   videos.list         1 unit    ← metadata for IDs you already have, cheap
 *
 * So discovery runs once per subtopic and its results are written to disk;
 * re-running with the same curated IDs costs 1 unit per 50 videos. Prefer
 * pinning IDs in CURATED below over re-searching — search relevance for
 * "GED <topic>" is mediocre and drifts over time, whereas a pinned ID is a
 * deliberate editorial choice that stays put.
 *
 * ── On embeddability ──────────────────────────────────────────────────────
 * A video that is unlisted, region-locked, or has embedding disabled will look
 * perfectly fine on youtube.com and then fail with player error 101/150 inside
 * our iframe. `status.embeddable` is the only way to know before runtime, which
 * is the main reason this script exists rather than a hand-typed list.
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseIsoDuration } from "../src/lib/youtube/duration";
import type { Resource } from "../src/lib/resources/types";

process.loadEnvFile(resolve(process.cwd(), ".env"));

const API_KEY = process.env.YOUTUBE_API_KEY;
const OUT_PATH = resolve(process.cwd(), "src/lib/resources/fixture.data.ts");

/**
 * Upper bound on clips per subtopic — a guard rail, not a target.
 *
 * The rule is "take the lesson sequence Khan actually teaches", however long
 * that runs. An earlier version capped this at 3, which produced 9 minutes of
 * video for a subtopic the planner had budgeted 70 minutes for: a learner
 * finished the session having watched almost nothing. Study time is now derived
 * from the clips (see `--sync-estimates`) rather than clips being rationed to
 * fit a number someone guessed in advance.
 *
 * This only exists so a mis-matched 200-video playlist can't land whole.
 */
const MAX_PER_SUBTOPIC = 25;

/**
 * Khan Academy's channel.
 *
 * Every subtopic in this curriculum already points at a Khan unit page via
 * `learningUrl`, and Khan mirrors its entire library to YouTube. Searching
 * inside that one channel therefore lands much closer to the material the
 * subtopic was written against than an open search does — an open search for
 * "GED Science Astronomy" returns whatever happens to rank that week, from
 * anyone.
 *
 * Khan's own API was retired, so this is the only way to go from "the unit page
 * we link to" back to "the videos on it".
 */
const KHAN_CHANNEL_ID = "UC4a-Gbdw7vOaccHmFo40b9g";

/**
 * Length bounds, in seconds, applied after metadata is fetched.
 *
 * The API's own `videoDuration=medium` filter means 4–20 minutes, which throws
 * away a large slice of Khan's catalogue — their lessons are frequently under
 * four minutes. Filtering on the real duration we already fetched is both more
 * accurate and free.
 */
const MIN_DURATION_SEC = 90;
const MAX_DURATION_SEC = 45 * 60;

/**
 * Pinned video IDs, keyed by subtopic name. Anything listed here skips
 * discovery entirely. Use it to nail down individual clips.
 */
const CURATED: Record<string, string[]> = {};

/**
 * Khan playlists chosen by hand for each subtopic, keyed by subtopic name.
 *
 * An earlier version scored playlist titles against subtopic names
 * automatically. It read well in the abstract and produced nonsense in
 * practice: "Quadratic Functions" matched a trigonometry playlist because both
 * contain "functions", "Coordinate Geometry" matched a *kindergarten*
 * measurement playlist, and "Polynomial Operations" landed on 5th-grade
 * arithmetic. Word overlap cannot tell that a title is aimed at five-year-olds,
 * and adult GED learners are the one audience for whom that failure is most
 * insulting.
 *
 * So the matching is done once, by a person, and written down. 543 playlists
 * against 57 subtopics is an afternoon of reading, not a research problem, and
 * the result is auditable: every pairing below can be checked by looking at it.
 *
 * Several subtopics take more than one playlist — "Chemical Reactions &
 * Bonding" is two Khan units — and they are concatenated in the order given.
 *
 * Subtopics absent from this map have no suitable Khan playlist and fall
 * through to video search. Khan's catalogue is uneven: its grammar and
 * geography coverage is thin, and its biology playlists are organised around
 * cell mechanics rather than the GED's genetics/evolution/body-systems split.
 */
/**
 * Clip-level filters, applied to whatever a playlist returns.
 *
 * A Khan playlist is a *unit*, and a unit is usually wider than one of our
 * subtopics. "Ratios, proportions, units, and rates" covers four things; our
 * "Ratios & Rates" covers two, and the curriculum has nowhere to put the eleven
 * unit-conversion clips (gallons to quarts, Fahrenheit to Celsius) that came
 * along with them. Taking the playlist whole meant a learner sat through an
 * hour of measurement conversion inside a session labelled Ratios.
 *
 * `require`: keep only clips whose title mentions at least one of these.
 * `exclude`: drop clips whose title mentions any of these, even if required.
 *
 * Matching is on the lowercased title, so terms should be lowercase stems.
 * A subtopic filtered down to nothing is left uncovered on purpose — an empty
 * list is a visible gap, whereas the wrong clips are an invisible one.
 */
const TOPIC_FILTERS: Record<string, { require?: string[]; exclude?: string[] }> = {
  "Ratios & Rates": {
    require: ["ratio", "rate", "proportion", "speed"],
    // Unit conversion dominates this playlist and belongs to measurement, not ratios.
    exclude: ["convert", "conversion", "metric", "fahrenheit", "celsius", "temperature"],
  },
  "Percent Problems": { require: ["percent", "percentage", "discount", "markup", "tax", "tip"] },
  "Integer Operations": {
    require: ["negative", "absolute value", "integer", "number line", "opposite", "adding", "subtracting", "multiplying", "dividing"],
  },
  "Polynomial Operations": {
    require: ["polynomial", "monomial", "binomial", "distributive", "like terms", "factor"],
    // Quadratics share this playlist and are claimed by their own subtopic.
    // Without this the broad "factor" term swallows the factoring-quadratics
    // clips first, and Quadratic Functions is left with the scraps.
    exclude: ["quadratic", "parabola", "vertex", "completing the square"],
  },
  "Quadratic Functions": {
    require: ["quadratic", "parabola", "vertex", "completing the square", "discriminant"],
  },
  // "Apply the Pythagorean theorem and distance formula." Khan's unit opens with
  // three different proofs of the theorem; a GED learner needs to use it, not
  // derive it, so the proofs are excluded even though they match on name.
  "Pythagorean Theorem": {
    require: ["pythagorean", "right triangle", "hypotenuse", "distance formula", "special right"],
    exclude: ["sine", "cosine", "tangent", "trig", "unit circle", "law of", "proof"],
  },
  // "Solve linear inequalities and systems of equations" is the neighbouring
  // subtopic; this one is graphs and slope, so inequality graphing goes there.
  "Slope & Linear Graphs": {
    require: ["slope", "graph", "intercept", "linear", "line", "coordinate", "plot"],
    exclude: ["inequalit"],
  },
  // "Solve one-variable and two-variable linear equations." Variation and
  // proportion problems sit in Ratios & Rates, not here.
  "Linear Equations": {
    require: ["equation", "solve", "solving", "variable", "linear"],
    exclude: ["direct and inverse variation", "inverse variation", "proportion", "inequalit"],
  },
  // "Compute and interpret basic and compound probability." Khan front-loads
  // the unit with set theory, which the GED does not test.
  "Probability": {
    require: ["probability", "chance", "odds", "random", "dice", "die", "coin", "event", "combination", "permutation"],
    exclude: ["subset", "superset", "complement", "venn", "set operations"],
  },
  // "Calculate area, perimeter, surface area, and volume." The unit ends with
  // recreational geometry — Koch snowflakes, Heron's formula — that no GED
  // question asks for.
  "Area, Perimeter & Volume": {
    require: ["area", "perimeter", "volume", "surface", "circumference", "radius", "diameter"],
    exclude: ["koch", "snowflake", "heron", "advanced"],
  },
  // Scope comes from the subtopic's own description — "Calculate mean, median,
  // mode, and interpret data displays" — not from the playlist's name. Khan's
  // "Descriptive statistics" unit runs well past that into variance, standard
  // deviation and sampling theory, none of which the GED tests.
  "Data Analysis & Central Tendency": {
    require: ["mean", "median", "mode", "average", "range", "box", "whisker", "plot", "histogram", "quartile", "outlier", "graph", "data"],
    exclude: ["variance", "deviation", "dispersion", "sample", "population", "bias", "unbiased", "inferring", "simulation", "n-1"],
  },
  "Main Idea & Supporting Details": {
    require: ["main idea", "central idea", "supporting", "summar", "theme", "detail"],
  },
  "Atomic Structure & Periodic Table": {
    require: ["atom", "periodic", "element", "electron", "proton", "neutron", "isotope", "ion", "orbital", "nucleus", "configuration"],
  },
  "Chemical Reactions & Bonding": {
    require: ["reaction", "bond", "equation", "balanc", "ionic", "covalent", "molecul", "stoichiometry", "redox", "acid"],
  },
  "States of Matter & Solutions": {
    require: ["state", "solid", "liquid", "gas", "phase", "solution", "solubility", "acid", "base", "concentration", "molarity", "intermolecular", "boiling", "melting", "vapor", "pressure"],
    // Electronegativity and VSEPR are bonding prerequisites Khan front-loads here.
    exclude: ["electronegativity", "vsepr", "molecular geometry", "molecular polarity"],
  },
  "Ecosystems & Energy Flow": {
    require: ["ecosystem", "food chain", "food web", "trophic", "photosynthesis", "carbon cycle", "producer", "consumer", "population", "biome"],
  },
  // "Describe Earth's layers and explain plate tectonic theory." Khan files this
  // under Cosmology & Astronomy, so seasons and orbital mechanics ride along.
  "Earth's Structure & Plate Tectonics": {
    require: ["earth", "plate", "tectonic", "rock", "geolog", "volcan", "earthquake", "crust", "mantle", "fossil", "erosion", "mineral", "continent"],
    exclude: ["tilt", "season", "orbit", "moon", "eclipse"],
  },
  // "Apply Newton's laws of motion and analyze forces." Energy shares the
  // playlist and belongs to the subtopic below it.
  "Motion & Forces": {
    require: ["force", "motion", "newton", "velocity", "acceleration", "speed", "friction", "gravit", "momentum", "reference frame"],
    exclude: ["energy", "kinetic", "potential", "work"],
  },
  // "Distinguish kinetic and potential energy and apply conservation of energy."
  "Energy & Work": {
    require: ["energy", "work", "power", "kinetic", "potential", "thermal", "conservation", "heat"],
  },
  // "Describe wave properties, the electromagnetic spectrum, and sound." The
  // mapped playlists carry both a quantum tail and a circuits section; neither
  // is in scope.
  "Waves, Light & Sound": {
    require: ["wave", "light", "sound", "refraction", "diffraction", "reflection", "lens", "mirror", "electromagnetic", "spectrum", "doppler", "frequency"],
    exclude: ["photoelectric", "blackbody", "quantum", "photon", "bohr", "circuit", "voltage", "capacitor", "resistor", "induction"],
  },
  // "Understand budgeting, credit, taxes, and basic personal financial
  // planning." Khan files these under Finance and Capital Markets, a course
  // aimed at investors: present value, discounted cash flow and the time value
  // of money are the wrong subject entirely for someone learning to budget.
  "Personal Finance": {
    require: ["budget", "credit", "tax", "loan", "debt", "interest", "saving", "insurance", "mortgage", "rent", "bank", "payday", "retirement", "income"],
    exclude: ["present value", "discounted cash flow", "time value", "arbitrage", "derivative", "hedge", "bond", "equity", "leverage", "capital structure"],
  },
  "Supply, Demand & Markets": {
    require: ["supply", "demand", "market", "surplus", "elasticity", "equilibrium", "price", "competition"],
  },
  "US Constitution & Bill of Rights": {
    require: ["constitution", "bill of rights", "amendment", "federalis", "ratif", "article", "founding", "separation of powers", "checks and balances", "declaration"],
  },
  "Civil War & Reconstruction": {
    require: ["civil war", "reconstruction", "slave", "emancipation", "lincoln", "confedera", "union", "secession", "abolition", "antebellum"],
  },
};

/** Applies the subtopic's clip-level filter, if it has one. */
function passesTopicFilter(subtopicName: string, title: string): boolean {
  const filter = TOPIC_FILTERS[subtopicName];
  if (!filter) return true;

  const lower = title.toLowerCase();
  if (filter.exclude?.some((term) => lower.includes(term))) return false;
  if (filter.require && !filter.require.some((term) => lower.includes(term))) return false;
  return true;
}

const PLAYLIST_MAP: Record<string, string[]> = {
  // ── MATH ────────────────────────────────────────────────────────────────
  "Ratios & Rates": ["PLSQl0a2vh4HCbEq-LoPEhZHWLIpQEOuPN"], // Ratios, proportions, units, and rates | Pre-Algebra
  "Integer Operations": ["PLSQl0a2vh4HCS1H6_vN7TNm_iHBftT2-3"], // Negative numbers and absolute value | Pre-Algebra
  "Fractions, Decimals & Percents": ["PLSQl0a2vh4HCQHWDXEKSnY3-cygkXGiyN"], // Fractions, decimals, and percentages
  "Percent Problems": ["PLSQl0a2vh4HBW9LIfF_DIR86AFNKX14Sa"], // Rates and proportional relationships
  "Algebraic Expressions": ["PLSQl0a2vh4HB-gkycxoc-hjjn0YdxEkJ2"], // Algebraic expressions | Algebra Basics
  // Both draw on the same Khan unit and are separated by TOPIC_FILTERS: this one
  // claims the polynomial clips, and because subtopics are processed in order
  // and every video is claimed once, Quadratic Functions gets the quadratics.
  "Polynomial Operations": ["PLSQl0a2vh4HBPsrPW_mBCNt1hQNLRpKwC"], // Quadratics and polynomials | Algebra Basics
  "Quadratic Functions": ["PLSQl0a2vh4HBPsrPW_mBCNt1hQNLRpKwC"], // Quadratics and polynomials | Algebra Basics
  "Linear Equations": ["PLSQl0a2vh4HCnd_jI7E7IUcMasEgT6hpe"], // Linear equations and inequalities | Algebra Basics
  "Inequalities & Systems": ["PLSQl0a2vh4HDL79RlGmKk77ODVXikS2ez"], // Linear inequalities | Algebra I
  "Slope & Linear Graphs": ["PLSQl0a2vh4HBrHg_YOsXhkyMpCrWH9Pbo"], // Graphing lines and slope | Algebra Basics
  "Area, Perimeter & Volume": ["PLSQl0a2vh4HCZi9FYERiOWtkgo4Qm-dgk"], // Perimeter, area, and volume | Geometry
  "Coordinate Geometry": ["PLSQl0a2vh4HB96cX311IfSJtiieZVN6p5"], // Analytic geometry | Geometry
  "Pythagorean Theorem": ["PLSQl0a2vh4HCiwguuWSD6zzzObkHXYsfG"], // Right triangles and trigonometry | Geometry
  "Data Analysis & Central Tendency": ["PLSQl0a2vh4HA8aYDea9qApTe0LENvKoIx"], // Descriptive statistics
  Probability: ["PLSQl0a2vh4HB3WvDaHYcqbfgw7cBNx8DO"], // Independent and dependent events

  // ── RLA ─────────────────────────────────────────────────────────────────
  // Khan's grammar catalogue is barely playlisted; only punctuation exists as
  // a unit. The rest of Grammar & Usage falls through to search.
  "Punctuation & Capitalization": ["PLSQl0a2vh4HAei_k1w8rMpxsWXpMNa87J"], // Punctuation | Grammar
  "Vocabulary in Context": ["PLSQl0a2vh4HC7sM881WeEQsdgDdgFpfI2"], // Vocabulary | 8th Grade
  "Main Idea & Supporting Details": ["PLSQl0a2vh4HAec7j3xa0G_bz0G0_cWIlp"], // 8th grade reading and vocabulary
  "Reading Fiction": ["PLSQl0a2vh4HB6xdtlCluDyON6qa0sQ2YD"], // 9th grade reading and vocabulary

  // ── SCIENCE ─────────────────────────────────────────────────────────────
  "Cell Biology": ["PLSQl0a2vh4HDmOg7VVnL5kiEh7tKB-jJh", "PLSQl0a2vh4HCZJ1YELKQaRt_n3wooLgn8"], // Structure of a cell + Membranes and transport
  "Atomic Structure & Periodic Table": ["PLSQl0a2vh4HBLR7jdrTrb81DNX6MaICRO", "PLSQl0a2vh4HBSf5CVmr7BQ-DAayIsE71N"], // Atomic models and periodicity + Atoms, isotopes, and ions
  "Chemical Reactions & Bonding": ["PLSQl0a2vh4HCMPYDKDWzckresmNj5geHf", "PLSQl0a2vh4HAYCvTHhMGsNvLS-btVPXRw"], // Chemical reactions + Chemical bonding
  "States of Matter & Solutions": ["PLSQl0a2vh4HAcadC8xfE0VtGhfHdrECNO", "PLSQl0a2vh4HAHzfFIPU3q0hDdHKTEPrz5"], // States of matter + Solutions, acids, and bases
  "Astronomy & the Universe": ["PLSQl0a2vh4HAhvbtx-97tTNYqTsdXlDkc", "PLSQl0a2vh4HA356b7gPXjBrmD0wUpfjJB"], // Scale of the universe + Stars, black holes and galaxies
  "Earth's Structure & Plate Tectonics": ["PLSQl0a2vh4HBrIb03_adNggSGabJHtyAM"], // Earth geological and climatic history
  "Motion & Forces": ["PLSQl0a2vh4HCiFE95STYVxTZ6Ep402vfa"], // Motion, forces, and energy | Physics
  "Energy & Work": ["PLSQl0a2vh4HC-daPugvP8kL_zuE3u_3Zr"], // Middle school physics
  "Waves, Light & Sound": ["PLSQl0a2vh4HD2AZcy7Pe8mHAiO5UG2WKt", "PLSQl0a2vh4HAtw9UfXpWWFRfheZYwHptr"], // Electromagnetic radiation + Electricity and magnetism
  "Ecosystems & Energy Flow": ["PLSQl0a2vh4HCKeX3g-Mj5wXS0nfDeDSGS"], // Cellular respiration | Biology

  // ── SOCIAL STUDIES ──────────────────────────────────────────────────────
  "American Revolution & Founding": ["PLSQl0a2vh4HC4swaRmntPsc8CHCaM8Bx-", "PLSQl0a2vh4HDwfYX6-oPL_XAFjYSogsYV"], // The road to revolution + Period 3: 1754-1800
  "Civil War & Reconstruction": ["PLSQl0a2vh4HBHCZGOW_AZMSVbCEP0xQkK"], // The Civil War era (1844-1877)
  "World Wars & Modern America": ["PLSQl0a2vh4HCNiooUekZDy0LEfhikAu3Z"], // Rise to world power (1890-1945)
  "Social Movements of the 20th Century": ["PLSQl0a2vh4HCr65cK9k8vM_QgV9iEX50s", "PLSQl0a2vh4HCOyhWe1d6QkSD6NlsW9pzb"], // The postwar era (1945-1980) ×2
  "Branches of Government": ["PLSQl0a2vh4HByQTEIdo8RTNyJ61NUnsL5"], // Interactions among branches of government
  "US Constitution & Bill of Rights": ["PLSQl0a2vh4HCiaYVxvsl6CNtNu6NxF3qL"], // Foundations of American democracy
  "Civil Rights & Liberties": ["PLSQl0a2vh4HBV_Yg4scoWR6Oj2Yxcn-me"], // Civil liberties and civil rights
  "Elections & Political Participation": ["PLSQl0a2vh4HCbPTP6mL7phF0DPxXWv3kr"], // Political participation
  "Supply, Demand & Markets": ["PLSQl0a2vh4HBOy3c5b9QyDXVnnuX4aauK", "PLSQl0a2vh4HB3fr3Xd205GnTAX9CQ334r"], // Consumer and producer surplus + Elasticity
  "Macro & Microeconomics": ["PLSQl0a2vh4HAc8iB3btIAOK3Km8GsUoI6", "PLSQl0a2vh4HB-eppLyKiTFRfPXBMQ76OZ"], // Basic economics concepts + GDP
  "Personal Finance": ["PLSQl0a2vh4HBsB7fGzaMzqT9Gr0SXThXi", "PLSQl0a2vh4HB2C9mo8ErAki5Zra1VP_lY"], // Interest and debt + Housing
};

const db = new PrismaClient();

// ─── YouTube API ──────────────────────────────────────────────────────────

interface YtSearchItem {
  id: { videoId?: string; playlistId?: string };
}

interface YtPlaylistItem {
  contentDetails: { videoId: string };
}

interface YtVideoItem {
  id: string;
  snippet: { title: string; channelTitle: string };
  contentDetails: { duration: string };
  status: { embeddable: boolean; privacyStatus: string };
}

async function yt<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<{ items: T[]; nextPageToken?: string }> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", API_KEY!);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    // Quota rejections arrive as 429 (and sometimes 403). Worth naming plainly
    // rather than dumping the payload, because the message is easy to misread:
    // "Search Queries per day" is a *separate* allowance from the 10,000-unit
    // budget, and it is the one that runs out first. videos.list and
    // playlistItems.list keep working after search has stopped — which is
    // exactly why discovery is worth doing once and caching in the fixture.
    if ((res.status === 429 || res.status === 403) && body.includes("uota")) {
      const isSearch = endpoint === "search";
      throw new Error(
        (isSearch
          ? "YouTube search quota exhausted for today (a per-day cap separate from the 10,000-unit budget)."
          : "YouTube API daily quota exhausted (10,000 units).") +
          "\nIt resets at midnight Pacific. Re-run then — the fixture on disk is untouched," +
          "\nand the next run keeps what it already has and only pays for the gaps."
      );
    }
    throw new Error(`YouTube ${endpoint} ${res.status}: ${body.slice(0, 400)}`);
  }
  const json = (await res.json()) as { items?: T[]; nextPageToken?: string };
  return { items: json.items ?? [], nextPageToken: json.nextPageToken };
}

/** Find candidate video IDs for a subtopic. Costs 100 quota units per call. */
async function search(query: string, channelId?: string): Promise<string[]> {
  const { items } = await yt<YtSearchItem>("search", {
    part: "id",
    q: query,
    type: "video",
    // Only surface videos the API already believes are embeddable and public.
    // This is a hint, not a guarantee — videos.list still gets the final say.
    videoEmbeddable: "true",
    videoSyndicated: "true",
    relevanceLanguage: "en",
    safeSearch: "strict",
    maxResults: "25",
    ...(channelId ? { channelId } : {}),
  });
  return items.map((i) => i.id.videoId).filter((id): id is string => Boolean(id));
}

interface YtPlaylist {
  id: string;
  snippet: { title: string };
  contentDetails: { itemCount: number };
}

export interface PlaylistSummary {
  id: string;
  title: string;
  itemCount: number;
}

/**
 * Every playlist on Khan's channel — 543 of them, for 11 quota units.
 *
 * `playlists.list` is not a search endpoint, which matters more than the price:
 * "Search Queries per day" is a separate allowance from the 10,000-unit budget
 * and runs out long before it does. Listing the channel and matching titles
 * locally sidesteps that limit entirely, and turns 57 searches (5,700 units,
 * and blocked once the search cap is hit) into 11 units that always work.
 *
 * It is also simply better data. Khan groups videos into unit playlists —
 * "Chemical bonding | Chemistry" holds the nine clips that teach bonding, in
 * teaching order. That *is* the lesson sequence for a subtopic. A relevance
 * ranking is three clips that mention the words.
 */
async function fetchChannelPlaylists(channelId: string): Promise<{
  playlists: PlaylistSummary[];
  calls: number;
}> {
  const playlists: PlaylistSummary[] = [];
  let pageToken: string | undefined;
  let calls = 0;

  do {
    const { items, nextPageToken } = await yt<YtPlaylist>("playlists", {
      part: "snippet,contentDetails",
      channelId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    calls++;
    playlists.push(
      ...items.map((p) => ({
        id: p.id,
        title: p.snippet.title,
        itemCount: p.contentDetails.itemCount,
      }))
    );
    pageToken = nextPageToken;
  } while (pageToken && calls < 20);

  return { playlists, calls };
}

/**
 * Every video ID in a playlist, in order. Costs 1 quota unit per 50 items.
 *
 * This is the cheap half of the strategy: discovery costs 100 units once, then
 * pulling the entire lesson sequence behind it costs one or two more.
 */
async function playlistVideoIds(playlistId: string): Promise<{ ids: string[]; calls: number }> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  let calls = 0;

  do {
    const { items, nextPageToken } = await yt<YtPlaylistItem>("playlistItems", {
      part: "contentDetails",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    calls++;
    ids.push(...items.map((i) => i.contentDetails.videoId));
    pageToken = nextPageToken;
    // One extra page is plenty: past 100 clips we are no longer looking at a
    // subtopic, and MAX_PER_SUBTOPIC would discard the tail anyway.
  } while (pageToken && calls < 2);

  return { ids, calls };
}

/** Fetch metadata for up to 50 IDs at a time. Costs 1 quota unit per call. */
async function hydrate(ids: string[]): Promise<YtVideoItem[]> {
  const out: YtVideoItem[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const { items } = await yt<YtVideoItem>("videos", {
      part: "snippet,contentDetails,status",
      id: batch.join(","),
    });
    out.push(...items);
  }
  return out;
}

// ─── Main ─────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** A video picked for a subtopic, from either the existing fixture or a search. */
interface Picked {
  youtubeId: string;
  title: string;
  channelTitle: string;
  durationSec: number;
}

function toPicked(v: YtVideoItem): Picked {
  return {
    youtubeId: v.id,
    title: v.snippet.title,
    channelTitle: v.snippet.channelTitle,
    durationSec: parseIsoDuration(v.contentDetails.duration),
  };
}

/**
 * Reads whatever the last run produced, so a re-run tops up the gaps instead of
 * paying 100 quota units to rediscover videos we already have.
 *
 * `--fresh` skips this and rebuilds from nothing, which costs a full search per
 * subtopic — worth it only when the queries or filters have changed.
 */
async function loadExisting(): Promise<Map<string, Picked[]>> {
  const bySubtopic = new Map<string, Picked[]>();
  if (!existsSync(OUT_PATH)) return bySubtopic;

  const mod: { RESOURCES: Resource[] } = await import("../src/lib/resources/fixture.data");
  for (const r of mod.RESOURCES) {
    const list = bySubtopic.get(r.subtopicId) ?? [];
    list.push({
      youtubeId: r.youtubeId,
      title: r.title,
      channelTitle: r.channelTitle,
      durationSec: r.durationSec,
    });
    bySubtopic.set(r.subtopicId, list);
  }
  return bySubtopic;
}

/**
 * Re-applies TOPIC_FILTERS to the fixture already on disk, touching no network.
 *
 * Tightening a filter only ever removes clips, so there is nothing to re-fetch —
 * and re-fetching would be actively risky, because a `--fresh` run has to
 * rediscover the search-sourced subtopics and the search allowance is the first
 * thing to run out. This lets the editorial rules be corrected as often as
 * needed without gambling the coverage already earned.
 */
async function refilter() {
  const existing = await loadExisting();
  const subs = await db.subtopic.findMany({ select: { id: true, name: true } });
  const nameById = new Map(subs.map((s) => [s.id, s.name]));

  const rows: string[] = [];
  let kept = 0;
  let dropped = 0;
  const changes: string[] = [];

  for (const s of subs) {
    const before = existing.get(s.id) ?? [];
    if (!before.length) continue;

    const after = before.filter((p) => passesTopicFilter(s.name, p.title));
    kept += after.length;
    dropped += before.length - after.length;

    if (after.length !== before.length) {
      const mins = Math.round(after.reduce((sum, p) => sum + p.durationSec, 0) / 60);
      changes.push(
        `  ${s.name.padEnd(38)} ${before.length} → ${after.length} clips (${mins} min)`
      );
    }

    // Renumber: `order` has to stay contiguous from 0, and the resource id is
    // derived from it, so a gap would silently orphan any stored progress.
    after.forEach((p, order) => {
      rows.push(
        `  {\n` +
          `    id: ${JSON.stringify(`${s.id}-r${order}`)},\n` +
          `    subtopicId: ${JSON.stringify(s.id)},\n` +
          `    youtubeId: ${JSON.stringify(p.youtubeId)},\n` +
          `    title: ${JSON.stringify(p.title)},\n` +
          `    channelTitle: ${JSON.stringify(p.channelTitle)},\n` +
          `    durationSec: ${p.durationSec},\n` +
          `    order: ${order},\n` +
          `  },`
      );
    });
  }

  writeFile(rows);

  console.log("Re-applied TOPIC_FILTERS to the existing fixture (no API calls).\n");
  if (changes.length) {
    console.log("CHANGED");
    changes.forEach((c) => console.log(c));
  } else {
    console.log("Nothing changed — every clip already passes its filter.");
  }

  const emptied = subs.filter(
    (s) => (existing.get(s.id)?.length ?? 0) > 0 &&
      !(existing.get(s.id) ?? []).some((p) => passesTopicFilter(s.name, p.title))
  );
  if (emptied.length) {
    console.log(
      `\nFiltered to nothing: ${emptied.map((s) => nameById.get(s.id)).join(", ")}`
    );
  }

  console.log(`\nKept ${kept}, dropped ${dropped}.`);
}

/** Serialises rows into the fixture module. */
function writeFile(rows: string[]) {
  const ids = rows.map((r) => /youtubeId: "([^"]+)"/.exec(r)?.[1] ?? "");
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) {
    throw new Error(
      `Refusing to write: ${dupes.length} duplicate video(s) — ${[...new Set(dupes)].join(", ")}`
    );
  }

  writeFileSync(
    OUT_PATH,
    `// AUTO-GENERATED by scripts/fetch-resources.ts — do not edit by hand.\n` +
      `//\n` +
      `// Real YouTube metadata, checked for embeddability at fetch time. This is a\n` +
      `// staging ground, not mock data: when the Resource table lands, the same\n` +
      `// script writes these rows to the database instead of to this file, and\n` +
      `// getSubtopicResources() switches over without any consumer noticing.\n` +
      `//\n` +
      `// Generated: ${new Date().toISOString()}\n\n` +
      `import type { Resource } from "./types";\n\n` +
      `export const RESOURCES: Resource[] = [\n${rows.join("\n")}\n];\n`,
    "utf8"
  );
}

async function main() {
  if (process.argv.includes("--refilter")) {
    await refilter();
    return;
  }

  if (!API_KEY) {
    throw new Error(
      "YOUTUBE_API_KEY is not set. Add it to .env — see the comment above the key."
    );
  }

  const limit = arg("limit") ? Number(arg("limit")) : undefined;
  const subject = arg("subject");

  const subtopics = await db.subtopic.findMany({
    where: subject
      ? { topic: { category: { subject: { code: subject } } } }
      : undefined,
    take: limit,
    orderBy: [
      { topic: { category: { subject: { code: "asc" } } } },
      { topic: { name: "asc" } },
      { name: "asc" },
    ],
    select: {
      id: true,
      name: true,
      estimatedMinutes: true,
      topic: {
        select: {
          name: true,
          category: { select: { subject: { select: { code: true, name: true } } } },
        },
      },
    },
  });

  const fresh = process.argv.includes("--fresh");
  const existing = fresh ? new Map<string, Picked[]>() : await loadExisting();

  console.log(
    `Building fixture for ${subtopics.length} subtopic(s)` +
      (fresh ? " (fresh — ignoring the current fixture)\n" : " (topping up the current fixture)\n")
  );

  /**
   * Every video ID already spoken for, across all subtopics processed so far.
   *
   * Search ranks each subtopic independently, so a broad lesson like "Equations
   * and Inequalities" surfaces for several of them and the same clip ends up
   * filed in four places. A learner then watches one video and sees it tick off
   * under a topic they never opened. One video, one home.
   */
  const usedIds = new Set<string>();

  const rows: string[] = [];
  let quotaUnits = 0;

  /** search() with the quota meter attached, so the final tally stays honest. */
  const tallySearch = async (query: string, channelId?: string): Promise<string[]> => {
    quotaUnits += 100;
    return search(query, channelId);
  };

  // Listed once, purely so PLAYLIST_MAP entries can be validated and named in
  // the report — the IDs themselves are pinned, not discovered.
  const { playlists: khanPlaylists, calls: playlistCalls } =
    await fetchChannelPlaylists(KHAN_CHANNEL_ID);
  quotaUnits += playlistCalls;
  const playlistTitles = new Map(khanPlaylists.map((p) => [p.id, p.title]));
  console.log(`Listed ${khanPlaylists.length} Khan playlists (${playlistCalls} units)\n`);

  /** Playlist chosen per subtopic, printed at the end so matches can be audited. */
  const matchLog: string[] = [];

  /** Subtopics whose search fallback failed, usually because quota ran out. */
  const searchErrors: string[] = [];

  /** Per-subtopic tally, printed as a report once every subtopic is done. */
  const report: {
    subtopicId: string;
    subject: string;
    topic: string;
    subtopic: string;
    count: number;
    /** Total runtime of the picked clips — the figure study time is derived from. */
    minutes: number;
    /** What the planner currently believes this subtopic takes. */
    estimatedMinutes: number;
    source: "curated" | "kept" | "playlist" | "khan" | "open" | "none";
    titles: string[];
  }[] = [];

  for (const st of subtopics) {
    const subjectName = st.topic.category.subject.name;
    const subjectCode = st.topic.category.subject.code;

    let source: "curated" | "kept" | "playlist" | "khan" | "open" | "none" = "none";

    /**
     * IDs already placed in *this* subtopic.
     *
     * Kept separate from `usedIds`, which only learns about a subtopic's picks
     * once that subtopic is finished. Without this, a search that re-surfaces a
     * video already carried over from the previous run appends it a second
     * time — the same clip twice in one list.
     */
    const pickedIds = new Set<string>();

    /** Fetch metadata for candidate IDs and keep only what we can actually play. */
    const vet = async (ids: string[]): Promise<Picked[]> => {
      const fresh = ids.filter((id) => !usedIds.has(id) && !pickedIds.has(id));
      if (!fresh.length) return [];

      const videos = await hydrate(fresh);
      quotaUnits += Math.ceil(fresh.length / 50);

      // Preserve the ranking we asked for: videos.list returns results in an
      // arbitrary order, not the order the IDs were supplied in.
      const byId = new Map(videos.map((v) => [v.id, v]));
      return fresh
        .map((id) => byId.get(id))
        .filter((v): v is YtVideoItem => !!v)
        .filter((v) => {
          const secs = parseIsoDuration(v.contentDetails.duration);
          return (
            v.status.embeddable &&
            v.status.privacyStatus === "public" &&
            secs >= MIN_DURATION_SEC &&
            secs <= MAX_DURATION_SEC &&
            passesTopicFilter(st.name, v.snippet.title)
          );
        })
        .map(toPicked);
    };

    // Start from what the previous run already found, minus anything an earlier
    // subtopic has since claimed.
    const picked: Picked[] = [];
    for (const p of existing.get(st.id) ?? []) {
      if (usedIds.has(p.youtubeId) || pickedIds.has(p.youtubeId)) continue;
      picked.push(p);
      pickedIds.add(p.youtubeId);
    }
    if (picked.length) source = "kept";

    const take = (found: Picked[], label: typeof source) => {
      for (const p of found) {
        if (picked.length >= MAX_PER_SUBTOPIC) break;
        if (usedIds.has(p.youtubeId) || pickedIds.has(p.youtubeId)) continue;
        picked.push(p);
        pickedIds.add(p.youtubeId);
        if (source === "none" || source === "kept") source = label;
      }
    };

    const curated = CURATED[st.name];
    if (curated?.length) {
      take(await vet(curated), "curated");
    } else {
      // Pass 1 — the hand-picked Khan unit playlist(s) for this subtopic.
      for (const playlistId of PLAYLIST_MAP[st.name] ?? []) {
        if (picked.length >= MAX_PER_SUBTOPIC) break;
        const title = playlistTitles.get(playlistId);
        if (!title) {
          // The channel listing didn't contain it: the playlist was renamed,
          // made private, or the ID was mistyped. Say so rather than silently
          // producing a thinner subtopic.
          console.log(`    ! ${st.name}: playlist ${playlistId} not found on the channel`);
          continue;
        }
        const { ids, calls } = await playlistVideoIds(playlistId);
        quotaUnits += calls;
        const before = picked.length;
        take(await vet(ids), "playlist");
        matchLog.push(
          `${st.name.padEnd(38)} → ${title} (+${picked.length - before})`
        );
      }

      // Passes 2 and 3 — video search, where no playlist matched well enough.
      // These spend the search allowance, which is both scarcer than the unit
      // budget and the first thing to run out, so a failure here must not throw
      // away the playlist work already done for the other 50-odd subtopics.
      // The subtopic is simply left uncovered and named in the gap report.
      if (!picked.length) {
        try {
          take(await vet(await tallySearch(`${st.name} ${st.topic.name}`, KHAN_CHANNEL_ID)), "khan");

          // Khan's catalogue is deep but not uniform; a few GED topics
          // genuinely aren't in it.
          if (!picked.length) {
            take(await vet(await tallySearch(`GED ${subjectName} ${st.name} lesson`)), "open");
          }
        } catch (err) {
          searchErrors.push(st.name);
          if (searchErrors.length === 1) console.log(`    ! ${(err as Error).message}`);
        }
      }
    }

    for (const p of picked) usedIds.add(p.youtubeId);

    console.log(
      `  [${subjectCode}] ${st.name} — ${picked.length} video(s) via ${source}`
    );

    report.push({
      subtopicId: st.id,
      subject: subjectCode,
      topic: st.topic.name,
      subtopic: st.name,
      count: picked.length,
      minutes: Math.round(picked.reduce((sum, p) => sum + p.durationSec, 0) / 60),
      estimatedMinutes: st.estimatedMinutes,
      source,
      titles: picked.map((v) => v.title),
    });

    picked.forEach((v, order) => {
      rows.push(
        `  {\n` +
          `    id: ${JSON.stringify(`${st.id}-r${order}`)},\n` +
          `    subtopicId: ${JSON.stringify(st.id)},\n` +
          `    youtubeId: ${JSON.stringify(v.youtubeId)},\n` +
          `    title: ${JSON.stringify(v.title)},\n` +
          `    channelTitle: ${JSON.stringify(v.channelTitle)},\n` +
          `    durationSec: ${v.durationSec},\n` +
          `    order: ${order},\n` +
          `  },`
      );
    });
  }

  const file =
    `// AUTO-GENERATED by scripts/fetch-resources.ts — do not edit by hand.\n` +
    `//\n` +
    `// Real YouTube metadata, checked for embeddability at fetch time. This is a\n` +
    `// staging ground, not mock data: when the Resource table lands, the same\n` +
    `// script writes these rows to the database instead of to this file, and\n` +
    `// getSubtopicResources() switches over without any consumer noticing.\n` +
    `//\n` +
    `// Generated: ${new Date().toISOString()}\n\n` +
    `import type { Resource } from "./types";\n\n` +
    `export const RESOURCES: Resource[] = [\n${rows.join("\n")}\n];\n`;

  // Guard rather than trust: the dedup rules are spread across `vet`, `take`,
  // and the carry-over loop, and a gap in any one of them is invisible in the
  // output. Assert the invariant that matters instead — one video, one place.
  const ids = rows.map((r) => /youtubeId: "([^"]+)"/.exec(r)?.[1] ?? "");
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) {
    throw new Error(
      `Refusing to write: ${dupes.length} duplicate video(s) — ${[...new Set(dupes)].join(", ")}`
    );
  }

  writeFileSync(OUT_PATH, file, "utf8");

  // ── Report ──────────────────────────────────────────────────────────────
  // Grouped by subject so gaps are obvious at a glance: a subtopic showing 0
  // is one where a learner still lands on the external-link fallback.

  console.log("\n" + "─".repeat(72));
  console.log("COVERAGE BY SUBTOPIC");
  console.log("─".repeat(72));

  const subjects = [...new Set(report.map((r) => r.subject))];
  for (const code of subjects) {
    const inSubject = report.filter((r) => r.subject === code);
    const videos = inSubject.reduce((sum, r) => sum + r.count, 0);
    const covered = inSubject.filter((r) => r.count > 0).length;

    const minutes = inSubject.reduce((sum, r) => sum + r.minutes, 0);
    console.log(
      `\n${code} — ${covered}/${inSubject.length} subtopics, ${videos} videos, ${minutes} min`
    );

    let currentTopic = "";
    for (const r of inSubject) {
      if (r.topic !== currentTopic) {
        currentTopic = r.topic;
        console.log(`  ${currentTopic}`);
      }
      // Flag subtopics whose clips run to well under what the planner budgeted:
      // those are the sessions a learner can finish without learning much.
      const thin = r.count > 0 && r.minutes < r.estimatedMinutes * 0.5;
      const mark = r.count === 0 ? "  !" : thin ? "  ~" : "   ";
      console.log(
        `  ${mark} ${r.subtopic.padEnd(38)} ${String(r.count).padStart(2)} clips  ` +
          `${String(r.minutes).padStart(3)} min (planner says ${r.estimatedMinutes})  ${r.source}`
      );
    }
  }

  // ── Study time follows the videos ───────────────────────────────────────
  //
  // `estimatedMinutes` was seeded with round numbers nobody measured — 45, 60,
  // 70 — and the GA schedules against them. Now that each subtopic has a real
  // lesson sequence, its runtime is the honest figure, and the guess should give
  // way to it rather than the clip list being trimmed to fit the guess.
  //
  // Opt-in, because this rewrites curriculum data the planner depends on and
  // future plans will schedule differently afterwards.
  if (process.argv.includes("--sync-estimates")) {
    console.log("\nSyncing Subtopic.estimatedMinutes from real video runtime…");

    let changed = 0;
    for (const r of report) {
      if (r.count === 0) continue; // nothing measured — leave the guess alone
      if (r.minutes === r.estimatedMinutes) continue;

      await db.subtopic.update({
        where: { id: r.subtopicId },
        data: { estimatedMinutes: r.minutes },
      });
      changed++;
      console.log(`  ${r.subtopic.padEnd(38)} ${r.estimatedMinutes} → ${r.minutes} min`);
    }

    console.log(`Updated ${changed} subtopic(s).`);
    console.log(
      "Existing study plans keep the durations they were generated with; " +
        "regenerate a plan to schedule against the new figures."
    );
  } else {
    const thin = report.filter((r) => r.count > 0 && r.minutes < r.estimatedMinutes * 0.5);
    if (thin.length) {
      console.log(
        `\n${thin.length} subtopic(s) have under half the video the planner budgets for.`
      );
      console.log("Re-run with --sync-estimates to make study time follow the clips.");
    }
  }

  if (matchLog.length) {
    console.log("\n" + "─".repeat(72));
    console.log("PLAYLIST MATCHES");
    console.log("─".repeat(72));
    for (const line of matchLog) console.log(`  ${line}`);
  }

  const gaps = report.filter((r) => r.count === 0);
  console.log("\n" + "─".repeat(72));
  console.log(`Wrote ${rows.length} resource(s) to src/lib/resources/fixture.data.ts`);
  console.log(
    `Covered ${report.length - gaps.length}/${report.length} subtopics; ${gaps.length} still on the external-link fallback`
  );
  if (gaps.length) {
    console.log(`Gaps: ${gaps.map((g) => g.subtopic).join(", ")}`);
  }
  console.log(`Quota used: ~${quotaUnits} units of 10,000/day`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
