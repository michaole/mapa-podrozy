import { supabase } from "./supabase";
import type { Member, NewPlace, Photo, Place, Space, Trip } from "./types";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ── spaces & members ─────────────────────────────────────────────────────────
export async function mySpaces(): Promise<Space[]> {
  return check(await supabase.from("spaces").select("id, name").order("created_at"));
}

export async function createSpace(name: string): Promise<Space> {
  return check(await supabase.from("spaces").insert({ name }).select("id, name").single());
}

export async function renameSpace(id: string, name: string): Promise<void> {
  check(await supabase.from("spaces").update({ name }).eq("id", id));
}

export async function members(spaceId: string): Promise<Member[]> {
  const rows = check(
    await supabase.from("space_members").select("user_id, role").eq("space_id", spaceId).order("joined_at"),
  );
  const ids = rows.map((r) => r.user_id);
  const profiles = ids.length
    ? check(await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids))
    : [];
  return rows.map((r) => ({
    user_id: r.user_id,
    role: r.role as Member["role"],
    profile: profiles.find((p) => p.id === r.user_id) ?? null,
  }));
}

export async function createInvite(spaceId: string): Promise<string> {
  const row = check<{ code: string }>(
    await supabase.from("space_invites").insert({ space_id: spaceId }).select("code").single(),
  );
  return row.code;
}

export async function acceptInvite(code: string): Promise<string> {
  return check(await supabase.rpc("accept_invite", { p_code: code.trim().toUpperCase() })) as string;
}

// ── places, trips, countries ─────────────────────────────────────────────────
export async function loadSpace(spaceId: string) {
  const [places, trips, extra] = await Promise.all([
    supabase.from("places").select("*").eq("space_id", spaceId).order("created_at", { ascending: false }),
    supabase.from("trips").select("*").eq("space_id", spaceId).order("start_date", { ascending: false, nullsFirst: false }),
    supabase.from("extra_countries").select("country_code").eq("space_id", spaceId),
  ]);
  return {
    places: check(places) as Place[],
    trips: check(trips) as Trip[],
    extraCountries: check(extra).map((r) => (r.country_code as string).toUpperCase()),
  };
}

export async function addPlace(spaceId: string, place: NewPlace): Promise<Place> {
  return check(await supabase.from("places").insert({ ...place, space_id: spaceId }).select().single()) as Place;
}

export async function updatePlace(id: string, patch: Partial<NewPlace>): Promise<void> {
  check(await supabase.from("places").update(patch).eq("id", id));
}

export async function deletePlace(id: string): Promise<void> {
  check(await supabase.from("places").delete().eq("id", id));
}

export async function saveTrip(spaceId: string, trip: Omit<Trip, "id" | "space_id">, id?: string): Promise<Trip> {
  const q = id
    ? supabase.from("trips").update(trip).eq("id", id).select().single()
    : supabase.from("trips").insert({ ...trip, space_id: spaceId }).select().single();
  return check(await q) as Trip;
}

export async function deleteTrip(id: string): Promise<void> {
  check(await supabase.from("trips").delete().eq("id", id));
}

export async function setExtraCountry(spaceId: string, code: string, on: boolean): Promise<void> {
  if (on) check(await supabase.from("extra_countries").upsert({ space_id: spaceId, country_code: code }));
  else check(await supabase.from("extra_countries").delete().eq("space_id", spaceId).eq("country_code", code));
}

// ── photos ───────────────────────────────────────────────────────────────────
export async function listPhotos(filter: { tripId?: string; placeId?: string }): Promise<(Photo & { url: string })[]> {
  let q = supabase.from("photos").select("*").order("created_at");
  if (filter.tripId) q = q.eq("trip_id", filter.tripId);
  if (filter.placeId) q = q.eq("place_id", filter.placeId);
  const rows = check(await q) as Photo[];
  if (!rows.length) return [];
  const signed = check(
    await supabase.storage.from("photos").createSignedUrls(rows.map((r) => r.storage_path), 3600),
  );
  return rows.map((r, i) => ({ ...r, url: signed[i]?.signedUrl ?? "" }));
}

/** Downscale big camera photos before upload (keeps storage and loading light). */
async function shrink(file: File, maxSide = 2000): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file; // e.g. HEIC in browsers that cannot decode it
  }
}

export async function uploadPhoto(
  spaceId: string, file: File, target: { tripId?: string; placeId?: string },
): Promise<void> {
  const blob = await shrink(file);
  const ext = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${spaceId}/${crypto.randomUUID()}.${ext}`;
  check(await supabase.storage.from("photos").upload(path, blob, { contentType: blob.type || file.type }));
  check(await supabase.from("photos").insert({
    space_id: spaceId, storage_path: path,
    trip_id: target.tripId ?? null, place_id: target.placeId ?? null,
  }));
}

export async function deletePhoto(photo: Photo): Promise<void> {
  check(await supabase.storage.from("photos").remove([photo.storage_path]));
  check(await supabase.from("photos").delete().eq("id", photo.id));
}
