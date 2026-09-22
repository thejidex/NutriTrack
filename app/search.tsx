import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FoodBrowser } from '../features/foods/FoodBrowser';
export default function Search() {
  const { mealId, mealName, date } = useLocalSearchParams<{
    mealId?: string;
    mealName?: string;
    date?: string;
  }>();
  return <FoodBrowser picking mealId={mealId} mealName={mealName} date={date} />;
}
