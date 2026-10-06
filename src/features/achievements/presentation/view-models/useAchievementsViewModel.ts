import { useMemo, useState } from 'react';

import { useAchievementState } from '../queries';

export type AchievementsTab = 'challenges' | 'badges' | 'milestones';

export function useAchievementsViewModel() {
  const query = useAchievementState();
  const [tab, setTab] = useState<AchievementsTab>('challenges');
  const state = query.data;

  const groups = useMemo(() => {
    const items = state?.achievements ?? [];
    return {
      badges: [...items.filter((item) => item.def.group === 'badge')].sort(
        (a, b) => Number(b.unlocked) - Number(a.unlocked),
      ),
      milestones: [
        ...items.filter((item) => item.def.group === 'milestone' || item.def.group === 'streak'),
      ],
    };
  }, [state]);

  return {
    state,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    tab,
    setTab,
    badges: groups.badges,
    milestones: groups.milestones,
    unlockedCount: state?.achievements.filter((item) => item.unlocked).length ?? 0,
    totalCount: state?.achievements.length ?? 0,
  };
}
