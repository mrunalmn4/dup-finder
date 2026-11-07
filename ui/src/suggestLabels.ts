/** Map engine keep_reason codes to short human copy for the Review UI. */
export function keepReasonLabel(code: string): string {
  switch (code) {
    case "newest_mtime":
      return "Keeping newer file";
    case "shortest_path":
      return "Keeping shorter path";
    case "lexicographic_path":
      return "Keeping first path alphabetically";
    case "user_choice":
      return "Keeping your choice";
    default:
      return `Keep reason: ${code}`;
  }
}
