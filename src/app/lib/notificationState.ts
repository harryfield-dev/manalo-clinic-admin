const LS_DISMISSED = 'notif_dismissed_ids';
const LS_READ = 'notif_read_ids';
const NOTIFICATION_STATE_SYNC_EVENT = 'admin-notification-state-sync';

export function getDismissedNotificationIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_DISMISSED) || '[]'));
  } catch {
    return new Set();
  }
}

export function saveDismissedNotificationIds(ids: Set<string>) {
  localStorage.setItem(LS_DISMISSED, JSON.stringify([...ids]));
  emitNotificationStateSync();
}

export function getReadNotificationIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_READ) || '[]'));
  } catch {
    return new Set();
  }
}

export function saveReadNotificationIds(ids: Set<string>) {
  localStorage.setItem(LS_READ, JSON.stringify([...ids]));
  emitNotificationStateSync();
}

export function getAppointmentNotificationId(id: string) {
  return `appt-${id}`;
}

export function getMessageNotificationId(id: string) {
  return `msg-${id}`;
}

export function countUnreadAppointmentNotifications(
  appointments: Array<{ id: string; status: string }>,
  dismissedIds: Set<string>,
  readIds: Set<string>,
) {
  return appointments.filter((appointment) => {
    const notificationId = getAppointmentNotificationId(appointment.id);

    if (dismissedIds.has(notificationId) || readIds.has(notificationId)) {
      return false;
    }

    return !['approved', 'rejected', 'completed'].includes(appointment.status);
  }).length;
}

export function countUnreadMessageNotifications(
  messages: Array<{ id: string; read: boolean | null }>,
  dismissedIds: Set<string>,
  readIds: Set<string>,
) {
  return messages.filter((message) => {
    const notificationId = getMessageNotificationId(message.id);

    if (dismissedIds.has(notificationId) || readIds.has(notificationId)) {
      return false;
    }

    return message.read !== true;
  }).length;
}

export function subscribeToNotificationStateSync(onSync: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === LS_DISMISSED || event.key === LS_READ) {
      onSync();
    }
  };
  const handleCustomSync = () => onSync();

  window.addEventListener('storage', handleStorage);
  window.addEventListener(NOTIFICATION_STATE_SYNC_EVENT, handleCustomSync);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(NOTIFICATION_STATE_SYNC_EVENT, handleCustomSync);
  };
}

function emitNotificationStateSync() {
  window.dispatchEvent(new Event(NOTIFICATION_STATE_SYNC_EVENT));
}
