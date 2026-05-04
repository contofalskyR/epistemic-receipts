export function isReadOnly(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ALLOW_EDITS !== "true";
}
