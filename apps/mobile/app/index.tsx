import { Redirect } from 'expo-router';

/**
 * Always lands on login first; RouteGuard in the root layout immediately
 * redirects onward to /(app) once it resolves that the user is authenticated.
 */
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
