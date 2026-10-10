import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import Toaster from './components/Toaster.tsx';
import { daily, dayKey, newSeed } from './lib/course.ts';
import { navigate, shouldAnimateNavigation, useRoute } from './lib/route.ts';
import { plan, timedId } from './lib/run.ts';
import Brief from './screens/Brief.tsx';
import Card from './screens/Card.tsx';
import Home from './screens/Home.tsx';
import NotFound from './screens/NotFound.tsx';
import Run from './screens/Run.tsx';

export default function App() {
  const route = useRoute();
  const id = 'id' in route ? route.id : null;
  const p = useMemo(() => (id ? plan(id) : null), [id]);
  const screenRef = useRef<HTMLDivElement>(null);
  const previousRoute = useRef(route);

  useLayoutEffect(() => {
    const changed = previousRoute.current !== route;
    previousRoute.current = route;
    if (
      !changed ||
      typeof document.startViewTransition === 'function' ||
      !shouldAnimateNavigation()
    )
      return;
    const surface =
      screenRef.current?.querySelector('.split-panel') ??
      screenRef.current?.firstElementChild;
    const animation = surface?.animate(
      [
        { opacity: 0, transform: 'translateX(8px)' },
        { opacity: 1, transform: 'translateX(0)' },
      ],
      { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
    return () => animation?.cancel();
  }, [route]);

  useEffect(() => {
    if (route.name === 'today')
      navigate(`/c/${daily(dayKey()).id}${location.search}`, true);
    if (route.name === 'timed') navigate(`/c/${timedId(newSeed())}`, true);
  }, [route.name]);

  let screen: React.ReactNode = null;
  if (route.name === 'home') screen = <Home />;
  else if (route.name === 'missing' || (id && !p)) screen = <NotFound />;
  else if (p && route.name === 'brief') screen = <Brief key={p.id} plan={p} />;
  else if (p && route.name === 'run') screen = <Run key={p.id} plan={p} />;
  else if (p && route.name === 'card') screen = <Card key={p.id} plan={p} />;

  return (
    <>
      <div ref={screenRef}>{screen}</div>
      <Toaster />
    </>
  );
}
