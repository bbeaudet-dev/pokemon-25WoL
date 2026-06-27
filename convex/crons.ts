import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Backstop for players who disconnect without explicitly leaving.
//
// Two separate numbers are at play here:
//   - The interval below ({ minutes: 2 }) is how OFTEN this job runs.
//   - PRESENCE_TIMEOUT_MS (~15 min) is how STALE a player's heartbeat must be
//     before that run actually reaps them.
//
// So every 2 minutes we check, and remove anyone silent for >15 min, then clean
// up any lobbies/games that end up empty as a result (net: a disconnect is
// cleaned up within ~15-17 min).
crons.interval(
  "reap stale lobby members",
  { minutes: 2 },
  internal.lobbies.reapStaleMembers,
  {},
);

export default crons;
