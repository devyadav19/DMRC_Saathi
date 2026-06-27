import React from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../theme/theme";
import { PhysicalStation } from "../lib/data";

interface Props {
  theme: Theme;
  stations: PhysicalStation[];
  onSelect: (station: PhysicalStation) => void;
}

export default function StationSuggestions({ theme, stations, onSelect }: Props) {
  if (stations.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, { borderTopColor: theme.border }]}
      keyboardShouldPersistTaps="handled"
      style={[
        styles.scrollView,
        { backgroundColor: theme.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      ]}
    >
      {stations.map((s) => (
        <TouchableOpacity
          key={s.gtfsStopId ?? s.name}
          style={[styles.chip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
          onPress={() => onSelect(s)}
          accessibilityRole="button"
          accessibilityLabel={`Suggest ${s.name}`}
        >
          <Ionicons name="train-outline" size={13} color={theme.textSecondary} style={{ marginRight: 6 }} />
          <Text style={[styles.chipText, { color: theme.textPrimary }]} numberOfLines={1}>
            {s.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { height: 56, flexGrow: 0, flexShrink: 0 },
  container: { paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "flex-start",
  },
  chipText: { fontSize: 13, fontWeight: "500", maxWidth: 160 },
});
