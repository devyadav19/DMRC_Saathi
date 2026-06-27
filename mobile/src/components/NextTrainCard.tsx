import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, lineColor, lineLabel } from "../theme/theme";
import { UpcomingDeparture } from "../lib/nextTrain";

interface Props {
  theme: Theme;
  stationName: string;
  departures: UpcomingDeparture[];
  language?: "EN" | "HI";
}

export default function NextTrainCard({ theme, stationName, departures, language = "EN" }: Props) {
  const [tick, setTick] = useState(0);
  const pulseAnim = React.useRef(new Animated.Value(0.3)).current;

  // Refresh the display every 30 seconds so minutesFromNow stays accurate
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Pulsing animation for Live badge
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const grouped: Record<string, UpcomingDeparture[]> = {};
  for (const d of departures) {
    if (!grouped[d.line]) grouped[d.line] = [];
    grouped[d.line].push(d);
  }

  if (departures.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{stationName}</Text>
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          {language === "HI" ? "इस समय कोई निर्धारित ट्रेन प्रस्थान नहीं मिला।" : "No scheduled departures found for this time."}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.titleRow}>
        <Ionicons name="time-outline" size={16} color={theme.brand} style={{ marginRight: 6 }} />
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          {stationName} — {language === "HI" ? "अगली ट्रेनें" : "Next trains"}
        </Text>
      </View>
      <Text style={[styles.notice, { color: theme.textSecondary }]}>
        {language === "HI" ? "निर्धारित समय · लाइव ट्रैकिंग नहीं" : "Scheduled times · not live tracking"}
      </Text>

      {Object.entries(grouped).map(([line, deps]) => (
        <View key={line} style={[styles.lineBlock, { borderTopColor: theme.border }]}>
          <View style={styles.lineHeader}>
            <View style={[styles.lineDot, { backgroundColor: lineColor(line) }]} />
            <Text style={[styles.lineName, { color: theme.textPrimary }]}>{lineLabel(line)}</Text>
          </View>
          <View style={styles.trainRow}>
            {deps.slice(0, 3).map((dep, i) => {
              const isImminent = dep.minutesFromNow <= 2;
              return (
                <View
                  key={i}
                  style={[
                    styles.trainChip,
                    {
                      backgroundColor: i === 0 ? lineColor(line) + "22" : theme.surfaceAlt,
                      borderColor: i === 0 ? lineColor(line) : theme.border,
                    },
                  ]}
                >
                  {isImminent && (
                    <View style={styles.liveIndicatorContainer}>
                      <Animated.View
                        style={[
                          styles.liveDot,
                          {
                            backgroundColor: theme.success,
                            opacity: pulseAnim,
                          },
                        ]}
                      />
                      <Text style={[styles.liveText, { color: theme.success }]}>
                        {language === "HI" ? "लाइव" : "LIVE"}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.trainTime, { color: i === 0 ? lineColor(line) : theme.textPrimary }]}>
                    {dep.formattedTime}
                  </Text>
                  <Text
                    style={[
                      styles.trainCountdown,
                      { color: i === 0 ? lineColor(line) : theme.textSecondary },
                    ]}
                  >
                    {dep.minutesFromNow === 0
                      ? (language === "HI" ? "अभी" : "Now")
                      : dep.minutesFromNow === 1
                      ? (language === "HI" ? "1 मिनट" : "1 min")
                      : `${dep.minutesFromNow} ${language === "HI" ? "मिनट" : "min"}`}
                    {dep.isNextDay ? " +" : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  title: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
  notice: { fontSize: 11, marginBottom: 10 },
  empty: { fontSize: 13, marginTop: 6 },
  lineBlock: { paddingTop: 10, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  lineHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  lineDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  lineName: { fontSize: 13, fontWeight: "600" },
  trainRow: { flexDirection: "row", gap: 8 },
  trainChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  trainTime: { fontSize: 13, fontWeight: "700" },
  trainCountdown: { fontSize: 11, marginTop: 2 },
  liveIndicatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
