import React from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../theme/theme";

interface Props {
  theme: Theme;
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onMicPress: () => void;
  onMenuPress: () => void;
  micActive?: boolean;
}

export default function InputBar({ theme, value, onChangeText, onSend, onMicPress, onMenuPress, micActive }: Props) {
  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      <TouchableOpacity
        style={[styles.iconButton, { backgroundColor: theme.surfaceAlt }]}
        onPress={onMenuPress}
        accessibilityLabel="Open service menu"
        accessibilityRole="button"
      >
        <Ionicons name="grid-outline" size={19} color={theme.brand} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.iconButton, { backgroundColor: micActive ? theme.brand : theme.surfaceAlt }]}
        onPress={onMicPress}
        accessibilityLabel="Voice input"
        accessibilityRole="button"
      >
        <Ionicons name={micActive ? "mic" : "mic-outline"} size={19} color={micActive ? "#FFFFFF" : theme.textSecondary} />
      </TouchableOpacity>
      <TextInput
        style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.surfaceAlt }]}
        placeholder="Ask about routes, fares, timings…"
        placeholderTextColor={theme.textSecondary}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSend}
        returnKeyType="send"
        multiline
        accessibilityLabel="Message input"
      />
      <TouchableOpacity
        style={[styles.iconButton, { backgroundColor: value.trim() ? theme.brand : theme.surfaceAlt }]}
        onPress={onSend}
        disabled={!value.trim()}
        accessibilityLabel="Send message"
        accessibilityRole="button"
      >
        <Ionicons name="arrow-up" size={19} color={value.trim() ? "#FFFFFF" : theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    marginHorizontal: 6,
    fontSize: 15,
    maxHeight: 100,
  },
});
