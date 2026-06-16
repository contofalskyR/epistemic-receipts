import type { Metadata } from "next";
import TrajectoryEncyclopedia from "./TrajectoryEncyclopedia";

export const metadata: Metadata = {
  title: "Trajectory Encyclopedia — Epistemic Receipts",
  description:
    "Browse historical epistemic trajectories by era — how claims settled, reversed, or were abandoned across expert literature, institutions, courts, the public, and markets.",
};

export default function TrajectoriesPage() {
  return <TrajectoryEncyclopedia />;
}
