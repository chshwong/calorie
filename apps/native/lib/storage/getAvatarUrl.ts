import { supabase } from "@/lib/supabaseClient";

export function getAvatarUrl(path: string): string {
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Avatar public URL unavailable.");
  }
  return data.publicUrl;
}
