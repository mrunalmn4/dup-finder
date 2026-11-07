/** Map engine keep_reason codes to short human copy for the Review UI. */
export function keepReasonLabel(code: string): string {
  switch (code) {
    case "newest_mtime":
      return "Newest file";
    case "shortest_path":
      return "Shortest path";
    case "lexicographic_path":
      return "First alphabetically";
    case "user_choice":
      return "Your choice";
    default:
      return code.replace(/_/g, " ");
  }
}

/** Longer why-we-picked-this copy for the keep row. */
export function keepReasonDetail(code: string): string {
  switch (code) {
    case "newest_mtime":
      return "Suggested keep: this copy was modified more recently than the others.";
    case "shortest_path":
      return "Suggested keep: this path is shorter (often the “main” copy). Same age as others.";
    case "lexicographic_path":
      return "Suggested keep: same age and path length — picked the first path in A–Z order.";
    case "user_choice":
      return "You chose this file as the one to keep.";
    default:
      return `Suggested keep (${code}). You can change it with “Keep this instead”.`;
  }
}

/** Human copy for path caution reasons from the engine. */
export function cautionReasonLabel(code: string): string {
  switch (code) {
    case "system_path":
      return "System location — deleting may break the OS";
    case "system_or_program_files":
      return "Windows system/program files — high risk";
    case "application_bundle":
      return "Inside an application bundle — may break the app";
    case "applications_folder":
      return "Applications folder — review carefully";
    case "library_folder":
      return "Library folder — may affect apps or the system";
    case "credential_or_key_material":
      return "Looks like keys/credentials — do not trash casually";
    case "windows_appdata":
      return "Windows AppData — may break installed apps";
    default:
      return `Sensitive path (${code})`;
  }
}
