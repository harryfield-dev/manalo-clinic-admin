export interface DoctorScheduleDay {
  day: string;
  startTime: string;
  endTime: string;
}

export const DOCTOR_SCHEDULE_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const DAY_TO_COLUMN: Record<(typeof DOCTOR_SCHEDULE_DAYS)[number], string> = {
  Monday: 'monday',
  Tuesday: 'tuesday',
  Wednesday: 'wednesday',
  Thursday: 'thursday',
  Friday: 'friday',
  Saturday: 'saturday',
};

export const DEFAULT_DOCTOR_SCHEDULE: DoctorScheduleDay[] = DOCTOR_SCHEDULE_DAYS.map((day) => ({
  day,
  startTime: '07:00',
  endTime: '15:00',
}));

export function normalizeDoctorSchedule(value: unknown): DoctorScheduleDay[] {
  if (!Array.isArray(value)) return [];

  const entries = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;

      const day = 'day' in entry && typeof entry.day === 'string' ? entry.day : '';
      const startTime = 'startTime' in entry && typeof entry.startTime === 'string' ? entry.startTime : '';
      const endTime = 'endTime' in entry && typeof entry.endTime === 'string' ? entry.endTime : '';

      if (!day || !startTime || !endTime) return null;

      return { day, startTime, endTime };
    })
    .filter((entry): entry is DoctorScheduleDay => entry !== null);

  return entries.sort(
    (left, right) =>
      DOCTOR_SCHEDULE_DAYS.indexOf(left.day as (typeof DOCTOR_SCHEDULE_DAYS)[number]) -
      DOCTOR_SCHEDULE_DAYS.indexOf(right.day as (typeof DOCTOR_SCHEDULE_DAYS)[number]),
  );
}

export function buildDoctorScheduleFromClinicSettings(settings: Record<string, unknown> | null | undefined) {
  if (!settings) return DEFAULT_DOCTOR_SCHEDULE;

  const schedule = DOCTOR_SCHEDULE_DAYS.flatMap((day) => {
    const column = DAY_TO_COLUMN[day];
    const value = typeof settings[column] === 'string' ? settings[column] : '';
    const parsed = parseClinicTimeRange(value);

    if (!parsed.open || !parsed.from || !parsed.to) {
      return [];
    }

    return [{
      day,
      startTime: parsed.from,
      endTime: parsed.to,
    }];
  });

  return schedule.length > 0 ? schedule : DEFAULT_DOCTOR_SCHEDULE;
}

export function parseClinicTimeRange(value: string) {
  if (!value || value.trim().toLowerCase() === 'closed') {
    return { open: false, from: '', to: '' };
  }

  const normalized = value.replace(/â€“/g, '-').replace(/–/g, '-').trim();
  const match = normalized.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);

  if (!match) {
    return { open: true, from: '07:00', to: '15:00' };
  }

  return {
    open: true,
    from: to24HourTime(match[1]),
    to: to24HourTime(match[2]),
  };
}

export function formatDoctorTime(value: string) {
  if (!value) return '';

  const [hoursRaw, minutesRaw] = value.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function formatDoctorScheduleRange(schedule: DoctorScheduleDay) {
  return `${formatDoctorTime(schedule.startTime)} - ${formatDoctorTime(schedule.endTime)}`;
}

function to24HourTime(value: string) {
  const [timePart, periodPart = 'AM'] = value.trim().split(/\s+/);
  const [hoursPart, minutesPart] = timePart.split(':').map(Number);
  let hours = hoursPart;

  if (periodPart.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  }

  if (periodPart.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutesPart).padStart(2, '0')}`;
}
