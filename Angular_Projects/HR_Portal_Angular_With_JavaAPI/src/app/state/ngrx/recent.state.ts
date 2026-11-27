import { createEntityAdapter, type EntityState } from '@ngrx/entity';
import { createActionGroup, createFeature, createReducer, on, props } from '@ngrx/store';

export interface RecentRecord { id: string; kind: 'employee' | 'project' | 'customer'; title: string; link: string; at: number }
export const recentAdapter = createEntityAdapter<RecentRecord>({ sortComparer: (a, b) => b.at - a.at });
export const RecentActions = createActionGroup({ source: 'Recent', events: { Visited: props<{ record: RecentRecord }>() } });

/** Cross-feature business state: the records a user opened recently (employee / project / customer), shown in global search and quick actions. */
export const recentFeature = createFeature({
  name: 'recent',
  reducer: createReducer(
    recentAdapter.getInitialState() as EntityState<RecentRecord>,
    on(RecentActions.visited, (s, { record }) => {
      const next = recentAdapter.upsertOne(record, s);
      const ids = next.ids as string[];
      return ids.length > 8 ? recentAdapter.removeMany(ids.slice(8), next) : next;
    }),
  ),
  extraSelectors: ({ selectRecentState }) => ({ ...recentAdapter.getSelectors(selectRecentState) }),
});
