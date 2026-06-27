import React from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Theme } from "../theme/theme";

interface Props {
  theme: Theme;
  items: string[];
  onPress: (item: string) => void;
}

export default function QuickReplyChips({ theme, items, onPress }: Props) {
  if (!items.length) return null;
  return (
    <ScrollView
      horizontal
      style={styles.scrollView}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {items.map((item) => (
        <TouchableOpacity
          key={item}
          style={[styles.chip, { backgroundColor: theme.chip }]}
          onPress={() => onPress(item)}
          accessibilityRole="button"
        >
          <Text style={[styles.chipText, { color: theme.chipText }]} numberOfLines={1}>
            {item}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // A fixed height (not maxHeight) reserves exact space in the parent flex
  // column regardless of how much space siblings (the message list) want -
  // maxHeight alone still let this row get squeezed/clipped under layout
  // pressure on some Android devices.
  scrollView: { height: 56, flexGrow: 0, flexShrink: 0 },
  container: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center", // prevents chips stretching to the row's full height
  },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, marginRight: 8, alignSelf: "flex-start" },
  chipText: { fontSize: 13, fontWeight: "600" },
});
