/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VEHICLE IMAGES — which photo represents which pool option.
 *
 * A pool card leads with a photo so somebody scrolling can tell a keke pool
 * from a minibus pool at a glance, without reading. As the fleet grows that
 * matters more, not less.
 *
 * Where the photo comes from, in order:
 *   1. pool_products.image_path, if an admin picked one.
 *   2. A guess from the product name — so every option that already exists
 *      shows the right vehicle with nobody editing anything.
 *   3. The keke, which is what Rydvest actually runs today.
 *
 * Paths point into /public so next/image can optimise them. Adding a vehicle
 * means dropping the file in /public and adding one entry to VEHICLES.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type Vehicle = {
  /** Path under /public. Also the stored value of pool_products.image_path. */
  path: string;
  /** What the admin picker shows. */
  label: string;
  /** Lowercase fragments that identify this vehicle in a product name. */
  matches: string[];
};

export const VEHICLES: Vehicle[] = [
  {
    path: "/header_image.png",
    label: "Keke (tricycle)",
    matches: ["keke", "napep", "tricycle", "maruwa"],
  },
  {
    path: "/minibus_image.png",
    label: "Minibus",
    matches: ["bus", "minibus", "mini bus", "danfo", "korope", "coaster", "hiace"],
  },
  {
    path: "/delivery_cycle_image.png",
    label: "Motorcycle / delivery bike",
    matches: ["bike", "motorcycle", "okada", "delivery", "dispatch", "cycle"],
  },
];

/** What a pool shows when nothing else matches. */
export const DEFAULT_VEHICLE_IMAGE = VEHICLES[0].path;

/** True when `path` is one of ours — the admin form must not accept anything else. */
export function isKnownVehicleImage(path: string): boolean {
  return VEHICLES.some((v) => v.path === path);
}

/**
 * The image for a pool option.
 *
 * `imagePath` wins when it is set and recognised. Otherwise the product name
 * is matched against the catalogue, longest fragment first so "mini bus" is
 * not beaten by "bus" in a different vehicle's list.
 */
export function vehicleImage(
  productName: string | null | undefined,
  imagePath?: string | null
): string {
  if (imagePath && isKnownVehicleImage(imagePath)) return imagePath;

  const name = (productName ?? "").toLowerCase();
  if (name) {
    const candidates = VEHICLES.flatMap((v) =>
      v.matches.map((fragment) => ({ fragment, path: v.path }))
    ).sort((a, b) => b.fragment.length - a.fragment.length);

    const hit = candidates.find((c) => name.includes(c.fragment));
    if (hit) return hit.path;
  }

  return DEFAULT_VEHICLE_IMAGE;
}
