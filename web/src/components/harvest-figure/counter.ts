import { sideMatrix } from "./kit/iso-kit";
import { DOOR, P } from "./view";

// The counter window on the vault door. Shared by the static window (geometry.ts) and the
// live digits, so the text always sits on the glass.
export const WINDOW = { x0: DOOR.x + 8, x1: DOOR.x + 34, z0: 52, z1: 62 };
export const FACE_Y = DOOR.y + DOOR.d + 0.01;
export const COUNTER_MATRIX = sideMatrix([WINDOW.x0 + 3, FACE_Y + 1.3], WINDOW.z0 + 2.4, P, "left");
