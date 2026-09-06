import { formatClockTime } from "@/lib/format-id";

export interface RouteSchedule {
  departureLabel: string;
  arrivalLabel: string;
  departure: Date;
  arrival: Date;
  /** True when no departure was chosen and "now" was assumed. */
  assumedNow: boolean;
}

/**
 * Turn a duration into a departure and an arrival.
 *
 * A planner is often used the evening before, so the rider can name the hour
 * they intend to leave; with nothing chosen we assume now and say so.
 */
export function buildSchedule(
  durationSeconds: number,
  departureTime: string | null,
  now: Date = new Date(),
): RouteSchedule | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;

  const departure = parseDeparture(departureTime, now) ?? now;
  const arrival = new Date(departure.getTime() + durationSeconds * 1000);

  return {
    departure,
    arrival,
    departureLabel: formatClockTime(departure),
    arrivalLabel: formatClockTime(arrival),
    assumedNow: parseDeparture(departureTime, now) === null,
  };
}

/** "HH:MM" today, rolled to tomorrow if that hour has already passed. */
function parseDeparture(value: string | null, now: Date): Date | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const departure = new Date(now);
  departure.setHours(hours, minutes, 0, 0);
  if (departure.getTime() < now.getTime() - 60_000) {
    departure.setDate(departure.getDate() + 1);
  }
  return departure;
}
