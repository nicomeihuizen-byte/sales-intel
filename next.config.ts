import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Next.js 16.3+ auto-generates/overwrites AGENTS.md and CLAUDE.md on
  // `next dev`/`next build` when it detects an AI coding agent in the
  // environment. It replaced this project's hand-authored AGENTS.md the
  // first time someone ran a local build, instead of merging around it.
  // Opting out here keeps that file under our own control.
  agentRules: false,
};

export default nextConfig;
