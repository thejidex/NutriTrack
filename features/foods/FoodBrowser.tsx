import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useApp } from '../../hooks/useApp';
import { useQuery } from '../../hooks/useQuery';
import { confirm, notice } from '../../hooks/useAction';
import {
  Chip,
  Empty,
  Field,
  Heading,
  QueryState,
  Row,
  Screen,
  SegmentedControl,
  TextButton,
  Txt,
} from '../../components/ui';
import { HorizontalScroll } from '../../components/PagerGestures';
import { FoodFilter, FoodSearchResult } from '../../types/models';
import { FoodListItem } from './FoodListItem';
import { s } from '../../i18n/zh-CN';
const filters: FoodFilter[] = ['all', 'favorites', 'recent', 'custom'];
export function FoodBrowser({
  mealId,
  mealName,
  date,
  picking = false,
}: {
  mealId?: string;
  mealName?: string;
  date?: string;
  picking?: boolean;
}) {
  const { repo, revision, refresh, colors, date: selectedDate } = useApp();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FoodFilter>('all');
  const [page, setPage] = useState(0);
  const [listRevision, setListRevision] = useState(0);
  const [hiddenFoodIds, setHiddenFoodIds] = useState<ReadonlySet<string>>(() => new Set());
  const [busyFoodId, setBusyFoodId] = useState<string | null>(null);
  const navigating = useRef(false);
  const listRef = useRef<FlatList<FoodSearchResult>>(null);
  const scrollOffset = useRef(0);
  const pendingScrollRestore = useRef<number | null>(null);
  const scrollRestoreFrame = useRef<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      navigating.current = false;
    }, []),
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(text);
      setPage(0);
    }, 100);
    return () => clearTimeout(timer);
  }, [text]);
  useEffect(
    () => () => {
      if (scrollRestoreFrame.current != null) cancelAnimationFrame(scrollRestoreFrame.current);
    },
    [],
  );
  const query = useQuery(
    () => repo.foods.searchWithUsage(search, filter, page * 40),
    [search, filter, page, picking ? listRevision : revision],
    { retainData: true, scope: [search, filter, page] },
  );
  const recent = useQuery(
    () => repo.foods.searchWithUsage('', 'recent'),
    [picking ? listRevision : revision],
    { retainData: true, scope: 'recent' },
  );
  const visibleFoods = useMemo(
    () => query.data?.filter((result) => !hiddenFoodIds.has(result.food.id)),
    [hiddenFoodIds, query.data],
  );
  const visibleRecent = useMemo(
    () => recent.data?.filter((result) => !hiddenFoodIds.has(result.food.id)),
    [hiddenFoodIds, recent.data],
  );
  const currentScrollOffset = () => {
    const nativeRef = listRef.current?.getNativeScrollRef() as unknown as {
      scrollTop?: number;
    } | null;
    return typeof nativeRef?.scrollTop === 'number' ? nativeRef.scrollTop : scrollOffset.current;
  };
  const restorePendingScroll = () => {
    if (pendingScrollRestore.current == null) return;
    const offset = pendingScrollRestore.current;
    pendingScrollRestore.current = null;
    listRef.current?.scrollToOffset({ offset, animated: false });
    if (scrollRestoreFrame.current != null) cancelAnimationFrame(scrollRestoreFrame.current);
    scrollRestoreFrame.current = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset, animated: false });
      scrollRestoreFrame.current = null;
    });
  };
  const targetDate = date ?? selectedDate;
  const openDetails = (result: FoodSearchResult) => {
    const params: Record<string, string> = { foodId: result.food.id };
    if (mealId) params.mealId = mealId;
    params.date = targetDate;
    if (result.lastAmount != null && result.lastUnit != null) {
      params.initialAmount = String(result.lastAmount);
      params.initialUnit = result.lastUnit;
    }
    router.push({ pathname: '/entry', params });
  };
  const choose = (result: FoodSearchResult) => {
    if (!picking || !mealId) {
      openDetails(result);
      return;
    }
    // Do not use useAction here: every rapid tap must enqueue one distinct FoodEntry.
    void repo
      .quickAddLatestEntry(result.food.id, mealId, targetDate)
      .then((entry) => {
        if (!entry) {
          // A first-time food still follows the existing amount/unit form. Guard only navigation,
          // not writes, so deliberate double taps on previously eaten foods remain two entries.
          if (!navigating.current) {
            navigating.current = true;
            openDetails(result);
          }
          return;
        }
        refresh();
        notice(s.quickAdded(entry.foodName, entry.amount, entry.unit, mealName ?? s.meal), {
          label: s.undo,
          onPress: async () => {
            await repo.deleteEntry(entry.id);
            refresh();
            notice(s.quickAddUndone(entry.foodName));
          },
        });
      })
      .catch((error) => notice(error instanceof Error ? error.message : s.unknown));
  };
  const reloadFoods = () => {
    setListRevision((value) => value + 1);
    refresh();
  };
  return (
    <Screen scroll={false}>
      <Heading
        title={picking ? s.addFood.replace('＋ ', '') : s.foods}
        right={
          <Row>
            {picking && <TextButton boxed title={s.back} onPress={() => router.back()} />}
            <TextButton boxed title={s.createFood} onPress={() => router.push('/food-edit')} />
          </Row>
        }
      />
      <Field
        hideLabel
        label={s.search}
        placeholder={s.search}
        value={text}
        onChangeText={setText}
      />
      <SegmentedControl
        options={filters.map((value) => ({ value, label: s[value] }))}
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setPage(0);
        }}
      />
      <FlatList
        ref={listRef}
        testID="food-list"
        style={{ backgroundColor: colors.background }}
        data={visibleFoods ?? []}
        keyExtractor={(result) => result.food.id}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onScroll={(event) => {
          scrollOffset.current = event.nativeEvent.contentOffset.y;
        }}
        onContentSizeChange={restorePendingScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 16 }}
        ListHeaderComponent={
          <View>
            {filter === 'all' && !search && !!visibleRecent?.length && (
              <View style={{ gap: 6, paddingBottom: 8 }}>
                <Txt size={11} muted>
                  {s.recent}
                </Txt>
                <HorizontalScroll contentContainerStyle={{ gap: 6 }}>
                  {visibleRecent.slice(0, 5).map((result) => (
                    <Chip
                      key={result.food.id}
                      title={result.food.name}
                      onPress={() => choose(result)}
                    />
                  ))}
                </HorizontalScroll>
              </View>
            )}
            <QueryState
              loading={query.loading && !query.data}
              error={query.error && !query.data}
              retry={query.reload}
            />
          </View>
        }
        renderItem={({ item }) => (
          <FoodListItem
            result={item}
            picking={picking}
            onOpen={() => choose(item)}
            onDetails={() => openDetails(item)}
            busy={busyFoodId === item.food.id}
            onFavorite={() => {
              if (busyFoodId) return;
              setBusyFoodId(item.food.id);
              void repo
                .favorite(item.food.id)
                .then(reloadFoods)
                .catch((error) => notice(error instanceof Error ? error.message : s.unknown))
                .finally(() => setBusyFoodId(null));
            }}
            onEdit={() => router.push({ pathname: '/food-edit', params: { id: item.food.id } })}
            onDelete={() =>
              confirm(s.deleteFood, s.deleteFoodHint, () => {
                const id = item.food.id;
                pendingScrollRestore.current = currentScrollOffset();
                setHiddenFoodIds((current) => new Set(current).add(id));
                void repo
                  .deleteFood(id)
                  .then(reloadFoods)
                  .catch((error) => {
                    setHiddenFoodIds((current) => {
                      const next = new Set(current);
                      next.delete(id);
                      return next;
                    });
                    notice(error instanceof Error ? error.message : s.unknown);
                  });
              })
            }
          />
        )}
        ListEmptyComponent={
          query.data && !visibleFoods?.length && !query.error ? (
            <Empty title={s.emptySearch} hint={s.emptySearchHint} />
          ) : null
        }
        ListFooterComponent={
          <View>
            <Row>
              {page > 0 && (
                <TextButton title={s.previousPage} onPress={() => setPage((p) => p - 1)} />
              )}
              {query.data?.length === 40 && (
                <TextButton title={s.nextPage} onPress={() => setPage((p) => p + 1)} />
              )}
            </Row>
            <Txt size={11} muted>
              {s.foodNote}
            </Txt>
          </View>
        }
      />
    </Screen>
  );
}
