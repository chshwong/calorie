import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function MealtypeLogRedirect() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/(tabs)/mealtype-log', params }} />;
}
