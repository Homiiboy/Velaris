import { Redirect } from 'expo-router';

// Legacy Phase 1 route. Keep old links/bookmarks working, but always use the 0.2.0 tabbed UI.
export default function LibraryRedirect() {
  return <Redirect href="/(tabs)/home" />;
}
