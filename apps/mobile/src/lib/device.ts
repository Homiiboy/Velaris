import { Platform } from 'react-native';

const fallbackId = `velaris-${Platform.OS}`;

export function jellyfinAuthorizationHeader(client = 'Velaris') {
  return `MediaBrowser Client="${client}", Device="${Platform.OS}", DeviceId="${fallbackId}", Version="0.1.0"`;
}
