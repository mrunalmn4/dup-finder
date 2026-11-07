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
