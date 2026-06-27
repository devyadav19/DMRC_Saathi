import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../theme/theme";

interface Props {
  theme: Theme;
  isDark: boolean;
  onToggleDark: () => void;
  language: "EN" | "HI";
  onToggleLanguage: () => void;
  onClearChat: () => void;
  onHelp?: () => void;
  onAdminPress?: () => void;
}

export default function Header({ theme, isDark, onToggleDark, language, onToggleLanguage, onClearChat, onHelp, onAdminPress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.brand, borderBottomColor: theme.border, paddingTop: insets.top + 10 },
      ]}
    >
      <View style={styles.titleBlock}>
        <Text style={styles.title}>DMRC Assistant</Text>
        <View style={styles.subtitleRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Online</Text>
          <Text style={styles.bullet}> • </Text>
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
            Delhi Metro Rail Corporation
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {onAdminPress && (
          <TouchableOpacity
            onPress={onAdminPress}
            style={styles.iconButton}
            accessibilityLabel="Admin panel"
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        {onHelp && (
          <TouchableOpacity
            onPress={onHelp}
            style={styles.iconButton}
            accessibilityLabel="Help and FAQ"
            accessibilityRole="button"
          >
            <Ionicons name="help-circle-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onToggleLanguage}
          style={styles.pill}
          accessibilityLabel="Toggle language"
          accessibilityRole="button"
        >
          <Text style={styles.pillText}>{language}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onToggleDark}
          style={styles.iconButton}
          accessibilityLabel="Toggle dark mode"
          accessibilityRole="button"
        >
          <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onClearChat}
          style={styles.iconButton}
          accessibilityLabel="Clear conversation"
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleBlock: { flex: 1, marginRight: 8 },
  titleRow: { flexDirection: "row", alignItems: "center" },
  title: { color: "#FFFFFF", fontSize: 17, fontWeight: "700", letterSpacing: 0.2 },
  subtitleRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4ADE80",
    marginRight: 4,
  },
  statusText: { color: "#4ADE80", fontSize: 10.5, fontWeight: "700" },
  bullet: { color: "rgba(255,255,255,0.4)", fontSize: 11, marginHorizontal: 2 },
  subtitle: { color: "rgba(255,255,255,0.78)", fontSize: 11, flex: 1 },
  actions: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  pill: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginLeft: 8,
  },
  pillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
});
