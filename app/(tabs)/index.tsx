import React, { useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, SectionList, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useApp } from '../../hooks/useApp';
import { useQuery } from '../../hooks/useQuery';
import { confirm, notice, useAction } from '../../hooks/useAction';
import { Heading, QueryState, Row, Screen, TextButton, Txt } from '../../components/ui';
import { Calendar } from '../../components/Calendar';
import { MealActions } from '../../components/MealActions';
import { MealEntryRow } from '../../components/MealEntryRow';
import { NutritionView } from '../../components/NutritionView';
import { format, sumNutrition } from '../../services/nutrition';
import { FoodEntry, MealType, Nutrition } from '../../types/models';
import { dateKey, dateLabel, shiftDate } from '../../utils/date';
import { s } from '../../i18n/zh-CN';

const noExpandedMeals: ReadonlySet<string> = new Set();

type MealSection = MealType & {
  entries: FoodEntry[];
  total: Nutrition;
  expanded: boolean;
  data: FoodEntry[];
};

function animateMealLayout() {
  LayoutAnimation.configureNext({
    duration: 120,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });
}

function MealSectionHeader({
  section,
  last,
  onToggle,
  onOpenActions,
}: {
  section: MealSection;
  last: boolean;
  onToggle: () => void;
  onOpenActions: () => void;
}) {
  const { colors } = useApp();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        marginBottom: section.expanded || last ? 0 : 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderBottomWidth: section.expanded ? 0 : 1,
        borderColor: colors.border,
        borderTopLeftRadius: 13,
        borderTopRightRadius: 13,
        borderBottomLeftRadius: section.expanded ? 0 : 13,
        borderBottomRightRadius: section.expanded ? 0 : 13,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          section.expanded ? s.collapseMeal(section.name) : s.expandMeal(section.name)
        }
        accessibilityState={{ expanded: section.expanded }}
        onPress={onToggle}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 62,
          paddingLeft: 12,
          paddingRight: 4,
          paddingVertical: 8,
          justifyContent: 'center',
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <Row style={{ gap: 8 }}>
          <Txt bold size={16}>
            {section.name}
            {section.deletedAt ? s.archived : ''}
          </Txt>
          <Txt size={13} bold={!section.entries.length} muted={!section.entries.length}>
            {section.entries.length ? `${format(section.total.calories)} kcal` : s.notRecorded}
          </Txt>
        </Row>
        <Row style={{ gap: 8, marginTop: 2 }}>
          <Txt muted size={11} style={{ flex: 1 }}>
            {s.protein} {format(section.total.protein, 'protein')}g · {s.carbs}{' '}
            {format(section.total.carbs, 'carbs')}g · {s.fat} {format(section.total.fat, 'fat')}g
          </Txt>
          <Txt muted size={18}>
            {section.expanded ? '⌄' : '›'}
          </Txt>
        </Row>
      </Pressable>
      {!section.deletedAt && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${section.name} ${s.mealActions}`}
          hitSlop={4}
          // Press-in avoids waiting for gesture release; onPress preserves keyboard/screen-reader access.
          onPressIn={onOpenActions}
          onPress={onOpenActions}
          style={({ pressed }) => ({
            width: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingTop: 8,
            opacity: pressed ? 0.55 : 1,
          })}
        >
          <Txt bold size={18} color={colors.textSecondary}>
            ···
          </Txt>
        </Pressable>
      )}
    </View>
  );
}

export default function Today() {
  const { repo, revision, date, setDate, refresh, colors, homeTitle } = useApp();
  const [calendar, setCalendar] = useState(false);
  const [actionMealId, setActionMealId] = useState<string | null>(null);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [pendingDeletedEntryIds, setPendingDeletedEntryIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [mealExpansion, setMealExpansion] = useState<{
    date: string;
    ids: ReadonlySet<string>;
  }>({ date, ids: noExpandedMeals });
  const action = useAction();
  const query = useQuery(
    async () => ({
      entries: await repo.day(date),
      meals: await repo.meals(true),
      goals: await repo.goals(),
    }),
    [date, revision],
    { retainData: true, scope: date },
  );
  const data = query.data;
  const visibleEntries = useMemo(
    () => data?.entries.filter((entry) => !pendingDeletedEntryIds.has(entry.id)) ?? [],
    [data, pendingDeletedEntryIds],
  );
  const expandedMealIds = mealExpansion.date === date ? mealExpansion.ids : noExpandedMeals;
  const sections = useMemo<MealSection[]>(() => {
    if (!data) return [];
    const entriesByMeal = new Map<string, FoodEntry[]>();
    for (const entry of visibleEntries) {
      const mealEntries = entriesByMeal.get(entry.mealTypeId);
      if (mealEntries) mealEntries.push(entry);
      else entriesByMeal.set(entry.mealTypeId, [entry]);
    }
    return data.meals
      .filter((meal) => !meal.deletedAt || entriesByMeal.has(meal.id))
      .map((meal) => {
        const entries = entriesByMeal.get(meal.id) ?? [];
        const expanded = expandedMealIds.has(meal.id);
        return {
          ...meal,
          entries,
          total: sumNutrition(entries),
          expanded,
          data: expanded ? entries : [],
        };
      });
  }, [data, expandedMealIds, visibleEntries]);

  const closeOpenEntry = useCallback(() => setOpenEntryId(null), []);
  useFocusEffect(
    useCallback(
      () => () => {
        setOpenEntryId(null);
        setActionMealId(null);
      },
      [],
    ),
  );

  const setExpanded = useCallback(
    (mealId: string, expanded: boolean) => {
      setMealExpansion((current) => {
        const next = new Set(current.date === date ? current.ids : noExpandedMeals);
        if (expanded) next.add(mealId);
        else next.delete(mealId);
        return { date, ids: next };
      });
    },
    [date],
  );
  const toggleMeal = (section: MealSection) => {
    closeOpenEntry();
    animateMealLayout();
    setExpanded(section.id, !section.expanded);
  };
  const add = (mealId?: string, mealName?: string) => {
    const meal = mealId
      ? data?.meals.find((candidate) => candidate.id === mealId)
      : data?.meals.find((candidate) => !candidate.deletedAt);
    if (!meal) return;
    closeOpenEntry();
    setExpanded(meal.id, true);
    router.push({
      pathname: '/search',
      params: { date, mealId: meal.id, mealName: mealName ?? meal.name },
    });
  };
  const copyPreviousMeal = (meal: { id: string }) => {
    closeOpenEntry();
    void action.run(async () => {
      await repo.copyPreviousMeal(date, meal.id);
      refresh();
    });
  };
  const clearMeal = (meal: { id: string }) => {
    closeOpenEntry();
    void action.run(async () => {
      await repo.deleteMealEntries(date, meal.id);
      refresh();
    });
  };
  const deleteEntry = (id: string) => {
    closeOpenEntry();
    animateMealLayout();
    setPendingDeletedEntryIds((current) => new Set(current).add(id));
    void repo
      .deleteEntry(id)
      .then(refresh)
      .catch((error) => {
        setPendingDeletedEntryIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        notice(error instanceof Error ? error.message : s.unknown);
      });
  };
  const changeDate = (nextDate: string) => {
    closeOpenEntry();
    setActionMealId(null);
    setDate(nextDate);
  };
  const openMealActions = (mealId: string) => {
    closeOpenEntry();
    setActionMealId(mealId);
  };
  const actionMeal = sections.find((section) => section.id === actionMealId);
  const hasActiveMeals = data?.meals.some((meal) => !meal.deletedAt) ?? false;
  return (
    <Screen scroll={false}>
      <SectionList<FoodEntry, MealSection>
        testID="diary-list"
        style={{ backgroundColor: colors.background }}
        sections={data ? sections : []}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        onScrollBeginDrag={closeOpenEntry}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListHeaderComponent={
          <View style={{ gap: 8 }} onTouchStart={closeOpenEntry} onPointerDown={closeOpenEntry}>
            <Heading title={homeTitle} />
            <Row style={{ gap: 4 }}>
              <TextButton
                title="‹"
                label={s.previous}
                onPress={() => changeDate(shiftDate(date, -1))}
              />
              <TextButton
                title={dateLabel(date)}
                label={s.calendar}
                onPress={() => setCalendar(true)}
              />
              <TextButton title="›" label={s.next} onPress={() => changeDate(shiftDate(date, 1))} />
              {date !== dateKey() && (
                <TextButton title={s.today} onPress={() => changeDate(dateKey())} />
              )}
            </Row>
            <QueryState
              loading={query.loading && !data}
              error={query.error && !data}
              retry={query.reload}
            />
            {data && (
              <>
                <NutritionView value={sumNutrition(visibleEntries)} goals={data.goals} hero />
                {!visibleEntries.length && (
                  <Row style={{ minHeight: 40 }}>
                    <Txt muted size={13}>
                      {s.emptyDay}
                    </Txt>
                    <TextButton
                      title={hasActiveMeals ? s.firstMeal : s.createMeal}
                      onPress={() => (hasActiveMeals ? add() : router.push('/meals'))}
                    />
                  </Row>
                )}
                <Row>
                  <Txt bold size={16}>
                    {s.app}
                  </Txt>
                  <TextButton
                    title={s.copy}
                    disabled={action.busy}
                    onPress={() =>
                      confirm(s.copyTitle, s.copyHint, () => {
                        closeOpenEntry();
                        void action.run(async () => {
                          await repo.copyPrevious(date);
                          refresh();
                        });
                      })
                    }
                  />
                </Row>
              </>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <MealSectionHeader
            section={section}
            last={section.id === sections[sections.length - 1]?.id}
            onToggle={() => toggleMeal(section)}
            onOpenActions={() => openMealActions(section.id)}
          />
        )}
        renderItem={({ item }) => (
          <MealEntryRow
            entry={item}
            onPress={() => router.push({ pathname: '/entry', params: { entryId: item.id } })}
            onDelete={() => deleteEntry(item.id)}
            open={openEntryId === item.id}
            onInteractionStart={closeOpenEntry}
            onOpen={() => setOpenEntryId(item.id)}
            onClose={() => setOpenEntryId((current) => (current === item.id ? null : current))}
          />
        )}
        renderSectionFooter={({ section }) =>
          section.expanded ? (
            <View
              style={{
                alignItems: 'flex-start',
                minHeight: section.deletedAt ? 9 : 48,
                paddingHorizontal: 12,
                paddingBottom: 8,
                marginBottom: section.id === sections[sections.length - 1]?.id ? 0 : 8,
                backgroundColor: colors.surface,
                borderBottomWidth: 1,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderColor: colors.border,
                borderBottomLeftRadius: 13,
                borderBottomRightRadius: 13,
              }}
            >
              {!section.deletedAt && (
                <Row style={{ justifyContent: 'flex-start', gap: 10 }}>
                  <TextButton title={s.addFood} onPress={() => add(section.id, section.name)} />
                  <TextButton
                    title={s.copyPreviousMeal}
                    disabled={action.busy}
                    onPress={() => copyPreviousMeal(section)}
                  />
                </Row>
              )}
            </View>
          ) : null
        }
      />
      {calendar && (
        <Calendar value={date} onChange={changeDate} onClose={() => setCalendar(false)} />
      )}
      {actionMeal && (
        <MealActions
          mealName={actionMeal.name}
          busy={action.busy}
          onCopy={() => copyPreviousMeal(actionMeal)}
          onClear={() => clearMeal(actionMeal)}
          onClose={() => setActionMealId(null)}
        />
      )}
    </Screen>
  );
}
