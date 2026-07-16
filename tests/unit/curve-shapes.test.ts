import { describe, expect, it } from "vitest";
import { classifyCurveShape } from "@/lib/curve-shapes";

describe("classifyCurveShape", () => {
  it("throws for <2 axes", () => {
    expect(() => classifyCurveShape([])).toThrow();
    expect(() => classifyCurveShape(["SETTLED"])).toThrow();
  });

  it("monotone-settle: RECORDED→SETTLED", () => {
    expect(classifyCurveShape(["RECORDED", "SETTLED"])).toBe("monotone-settle");
  });

  it("contested-then-settled: RECORDED→CONTESTED→SETTLED (CONTESTED is explicit dispute)", () => {
    expect(classifyCurveShape(["RECORDED", "CONTESTED", "SETTLED"])).toBe("contested-then-settled");
  });

  it("contested-then-settled: OPEN→CONTESTED→SETTLED", () => {
    expect(classifyCurveShape(["OPEN", "CONTESTED", "SETTLED"])).toBe("contested-then-settled");
  });

  it("settle-then-reverse: RECORDED→SETTLED→REVERSED", () => {
    expect(classifyCurveShape(["RECORDED", "SETTLED", "REVERSED"])).toBe("settle-then-reverse");
  });

  it("settle-then-reverse: longer arc ending in REVERSED after SETTLED", () => {
    expect(
      classifyCurveShape(["RECORDED", "CONTESTED", "SETTLED", "CONTESTED", "REVERSED"])
    ).toBe("settle-then-reverse");
  });

  it("flip-flop: RECORDED→SETTLED→CONTESTED→SETTLED (2 direction changes)", () => {
    expect(
      classifyCurveShape(["RECORDED", "SETTLED", "CONTESTED", "SETTLED"])
    ).toBe("flip-flop");
  });

  it("flip-flop: 6-step with ≥2 direction changes", () => {
    expect(
      classifyCurveShape(["RECORDED", "SETTLED", "CONTESTED", "SETTLED", "REVERSED", "SETTLED"])
    ).toBe("flip-flop");
  });

  it("abandoned: RECORDED→ABANDONED", () => {
    expect(classifyCurveShape(["RECORDED", "ABANDONED"])).toBe("abandoned");
  });

  it("abandoned: even after SETTLED, ends ABANDONED", () => {
    expect(classifyCurveShape(["RECORDED", "SETTLED", "ABANDONED"])).toBe("abandoned");
  });

  it("other: ends OPEN", () => {
    expect(classifyCurveShape(["RECORDED", "OPEN"])).toBe("other");
  });

  it("other: ends UNRESOLVABLE", () => {
    expect(classifyCurveShape(["RECORDED", "CONTESTED", "UNRESOLVABLE"])).toBe("other");
  });

  it("other: ends RECORDED (stuck in entry state)", () => {
    expect(classifyCurveShape(["RECORDED", "RECORDED"])).toBe("other");
  });

  it("REVERSED without prior SETTLED goes to other (not settle-then-reverse)", () => {
    expect(classifyCurveShape(["RECORDED", "REVERSED"])).toBe("other");
  });
});
