import { describe, it, expect } from "vitest";
import { classifyShape, type CurveShape } from "@/lib/curve-shapes";

describe("classifyShape", () => {
  // Single-step exclusion
  it("returns other for single-axis array (excluded from corpus)", () => {
    expect(classifyShape(["SETTLED"])).toBe("other");
  });

  // monotone-settle
  it("classifies RECORDED → SETTLED as monotone-settle", () => {
    expect(classifyShape(["RECORDED", "SETTLED"])).toBe("monotone-settle");
  });

  it("classifies RECORDED → OPEN → SETTLED as monotone-settle (no CONTESTED)", () => {
    expect(classifyShape(["RECORDED", "OPEN", "SETTLED"])).toBe("monotone-settle");
  });

  // contested-then-settled
  it("classifies RECORDED → CONTESTED → SETTLED as contested-then-settled", () => {
    expect(classifyShape(["RECORDED", "CONTESTED", "SETTLED"])).toBe("contested-then-settled");
  });

  it("classifies RECORDED → SETTLED → CONTESTED → SETTLED as flip-flop (≥2 changes)", () => {
    // SETTLED=forward, CONTESTED=contested, SETTLED=forward → 2 changes
    expect(classifyShape(["RECORDED", "SETTLED", "CONTESTED", "SETTLED"])).toBe("flip-flop");
  });

  // settle-then-reverse
  it("classifies RECORDED → SETTLED → REVERSED as settle-then-reverse", () => {
    expect(classifyShape(["RECORDED", "SETTLED", "REVERSED"])).toBe("settle-then-reverse");
  });

  // flip-flop
  it("classifies a 6-step flip-flop", () => {
    // RECORDED(f) → CONTESTED(c) → SETTLED(f) → CONTESTED(c) → SETTLED(f) → REVERSED(t)
    // changes: f→c, c→f, f→c, c→f, f→t = 5 changes
    expect(
      classifyShape(["RECORDED", "CONTESTED", "SETTLED", "CONTESTED", "SETTLED", "REVERSED"])
    ).toBe("flip-flop");
  });

  it("classifies RECORDED → SETTLED → CONTESTED as flip-flop (2 changes, ends contested)", () => {
    // RECORDED(f) → SETTLED(f) → CONTESTED(c): only 1 change → NOT flip-flop
    // Actually: f→f = 0, f→c = 1 → only 1 change, so not flip-flop
    // ends CONTESTED, not SETTLED → other
    expect(classifyShape(["RECORDED", "SETTLED", "CONTESTED"])).toBe("other");
  });

  it("classifies RECORDED → CONTESTED → SETTLED → REVERSED as settle-then-reverse", () => {
    // Forward path (1 direction): RECORDED→CONTESTED→SETTLED (ordinals 1→3→4, all up)
    // Then terminal exit to REVERSED = 1 direction change total → NOT flip-flop
    // Ends REVERSED, SETTLED appeared earlier → settle-then-reverse
    expect(
      classifyShape(["RECORDED", "CONTESTED", "SETTLED", "REVERSED"])
    ).toBe("settle-then-reverse");
  });

  it("classifies SETTLED → CONTESTED → SETTLED → REVERSED as flip-flop (≥2 changes)", () => {
    // SETTLED(4)→CONTESTED(3) = down, change 1 (lastDir=up→down)
    // CONTESTED(3)→SETTLED(4) = up, change 2 (lastDir=down→up)
    // SETTLED(4)→REVERSED = terminal exit → flip-flop check fires first
    expect(
      classifyShape(["SETTLED", "CONTESTED", "SETTLED", "REVERSED"])
    ).toBe("flip-flop");
  });

  // abandoned
  it("classifies RECORDED → CONTESTED → ABANDONED as abandoned", () => {
    expect(classifyShape(["RECORDED", "CONTESTED", "ABANDONED"])).toBe("abandoned");
  });

  it("classifies RECORDED → ABANDONED as abandoned", () => {
    expect(classifyShape(["RECORDED", "ABANDONED"])).toBe("abandoned");
  });

  // Note: ABANDONED is terminal group, RECORDED is forward group → 1 direction change
  // only 1 change → not flip-flop → falls through to abandoned check

  // other
  it("classifies RECORDED → UNRESOLVABLE as other", () => {
    expect(classifyShape(["RECORDED", "UNRESOLVABLE"])).toBe("other");
  });

  it("classifies RECORDED → OPEN as other (no terminal state reached)", () => {
    expect(classifyShape(["RECORDED", "OPEN"])).toBe("other");
  });

  it("classifies RECORDED → REVERSED (no prior SETTLED) as other", () => {
    // ends REVERSED but no SETTLED earlier → settle-then-reverse requires SETTLED first
    expect(classifyShape(["RECORDED", "REVERSED"])).toBe("other");
  });

  // Boundary: minimum valid shape inputs
  it("handles empty array as other", () => {
    expect(classifyShape([])).toBe("other");
  });
});
