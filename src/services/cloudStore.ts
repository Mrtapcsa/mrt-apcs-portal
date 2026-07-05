import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Course } from "../data/portalData";

const CONTENT_ID = "mrt-ap-computer-science-portal-phase-1";
const TABLE_NAME = "portal_content";
const ASSET_BUCKET = "portal-assets";

export type CloudState = "connected" | "not-configured" | "error";

export type LoadResult = {
  courses?: Course[];
  state: CloudState;
  message: string;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const client: SupabaseClient | null = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const hasCloudStore = Boolean(client);

export async function loadCoursesFromCloud(): Promise<LoadResult> {
  if (!client) {
    return {
      state: "not-configured",
      message: "Supabase is not configured yet. The portal is using built-in seed content and local draft cache.",
    };
  }

  const { data, error } = await client.from(TABLE_NAME).select("payload").eq("id", CONTENT_ID).maybeSingle();

  if (error) {
    return { state: "error", message: error.message };
  }

  const payload = data?.payload as { courses?: Course[] } | null;

  return {
    courses: payload?.courses,
    state: "connected",
    message: payload?.courses ? "Loaded course content from Supabase." : "Supabase is connected. No cloud content exists yet.",
  };
}

export async function saveCoursesToCloud(courses: Course[]) {
  if (!client) {
    return { state: "not-configured" as const, message: "Supabase is not configured. Saved to local draft cache only." };
  }

  const { error } = await client.from(TABLE_NAME).upsert({
    id: CONTENT_ID,
    payload: { courses, savedAt: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return { state: "error" as const, message: error.message };
  }

  return { state: "connected" as const, message: "Saved course content to Supabase." };
}

export async function uploadPortalAsset(file: File) {
  if (!client) {
    return { url: await fileToDataUrl(file), message: "Inserted as an embedded file because Supabase storage is not configured." };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${Date.now()}-${safeName}`;
  const { error } = await client.storage.from(ASSET_BUCKET).upload(path, file, { upsert: true });

  if (error) {
    return { url: await fileToDataUrl(file), message: `Storage upload failed, embedded locally instead: ${error.message}` };
  }

  const { data } = client.storage.from(ASSET_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, message: "Uploaded asset to Supabase storage." };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}