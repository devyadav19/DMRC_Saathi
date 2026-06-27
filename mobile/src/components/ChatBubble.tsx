import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../theme/theme";

export interface MessageBubbleProps {
  theme: Theme;
  role: "user" | "bot";
  text: string;
  timestamp: number;
  onCopy?: () => void;
  onSpeak?: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const period = h < 12 ? "AM" : "PM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

export default function ChatBubble({ theme, role, text, timestamp, onCopy, onSpeak }: MessageBubbleProps) {
  const isUser = role === "user";
  return (
    <View style={[styles.row, { justifyContent: isUser ? "flex-end" : "flex-start" }]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? theme.bubbleUser : theme.bubbleBot,
            borderColor: theme.border,
            borderWidth: isUser ? 0 : StyleSheet.hairlineWidth,
            borderBottomRightRadius: isUser ? 4 : 16,
            borderBottomLeftRadius: isUser ? 16 : 4,
          },
        ]}
      >
        <Text style={{ color: isUser ? theme.bubbleUserText : theme.bubbleBotText, fontSize: 15, lineHeight: 21 }}>
          {text}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.timestamp, { color: isUser ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>
            {formatTime(timestamp)}
          </Text>
          {!isUser && (onCopy || onSpeak) && (
            <View style={styles.actionRow}>
              {onSpeak && (
                <TouchableOpacity onPress={onSpeak} accessibilityLabel="Read aloud" style={styles.actionBtn} hitSlop={8}>
                  <Ionicons name="volume-medium-outline" size={15} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
              {onCopy && (
                <TouchableOpacity onPress={onCopy} accessibilityLabel="Copy message" style={styles.actionBtn} hitSlop={8}>
                  <Ionicons name="copy-outline" size={14} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: 14, marginVertical: 4 },
  bubble: {
    maxWidth: "84%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 1 },
    }),
  },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  timestamp: { fontSize: 10 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: { marginLeft: 10 },
  actionText: { fontSize: 11, fontWeight: "600" },
});
