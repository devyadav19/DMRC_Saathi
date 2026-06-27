import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, lineColor } from "../theme/theme";
import { physicalStations, graph, findStationByGtfsId } from "../lib/data";

function getLineKey(name: string): string {
  const n = name.toUpperCase();
  if (n.includes("AIRPORT")) return "ORANGE/AIRPORT";
  if (n.includes("RAPID")) return "RAPID";
  return name.split(" ")[0].toUpperCase();
}

function getStationsOnLine(lineKey: string, terminalA: string): string[] {
  const startStation = physicalStations.find(
    (s) => s.name.toLowerCase() === terminalA.toLowerCase()
  );
  if (!startStation || !startStation.gtfsStopId) {
    return physicalStations
      .filter((s) => s.linesServed.includes(lineKey))
      .map((s) => s.name);
  }

  const path: string[] = [startStation.name];
  const visited = new Set<string>([startStation.gtfsStopId]);
  let currId = startStation.gtfsStopId;

  while (true) {
    const edges = graph[currId] ?? [];
    const nextEdge = edges.find(
      (e) => e.line.toUpperCase() === lineKey && !visited.has(e.to)
    );
    if (!nextEdge) break;

    const nextStation = findStationByGtfsId(nextEdge.to);
    if (!nextStation) break;

    path.push(nextStation.name);
    visited.add(nextEdge.to);
    currId = nextEdge.to;
  }

  if (path.length < 3) {
    return physicalStations
      .filter((s) => s.linesServed.includes(lineKey))
      .map((s) => s.name);
  }

  return path;
}

interface Props {
  theme: Theme;
  data: {
    lines: {
      name: string;
      color: string;
      terminals: [string, string];
      stationCount: number;
      length: string;
    }[];
    totalStations: number;
    interchangeStations: string[];
  };
  language?: "EN" | "HI";
  onQuickAction?: (message: string) => void;
}

/* ── animated line row with staggered entrance ── */
function LineRow({
  theme,
  line,
  index,
  expanded,
  onPress,
  language = "EN",
  onQuickAction,
}: {
  theme: Theme;
  line: Props["data"]["lines"][number];
  index: number;
  expanded: boolean;
  onPress: () => void;
  language?: "EN" | "HI";
  onQuickAction?: (message: string) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        delay: index * 55,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 320,
        delay: index * 55,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const resolvedColor = lineColor(line.color);
  const lineKey = getLineKey(line.name);
  const stations = expanded ? getStationsOnLine(lineKey, line.terminals[0]) : [];

  return (
    <Animated.View
      style={[
        styles.lineRow,
        { borderTopColor: theme.border, opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.linePressContainer}>
        <View style={styles.lineTop}>
          {/* color dot */}
          <View style={[styles.lineDot, { backgroundColor: resolvedColor }]} />

          {/* name */}
          <Text style={[styles.lineName, { color: theme.textPrimary }]} numberOfLines={1}>
            {line.name}
          </Text>

          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={theme.textSecondary}
            style={{ marginRight: 8 }}
          />

          {/* station count badge */}
          <View style={[styles.badge, { backgroundColor: resolvedColor + "1A" }]}>
            <Text style={[styles.badgeText, { color: resolvedColor }]}>
              {line.stationCount} {language === "HI" ? "स्टेशन" : "stn"}
            </Text>
          </View>
        </View>

        {/* terminals */}
        <View style={styles.terminalRow}>
          <Ionicons name="radio-button-on" size={8} color={resolvedColor} style={{ marginTop: 2 }} />
          <Text style={[styles.terminalText, { color: theme.textSecondary }]} numberOfLines={1}>
            {line.terminals[0]}
          </Text>
          <Text style={[styles.arrow, { color: theme.textSecondary }]}>↔</Text>
          <Ionicons name="radio-button-on" size={8} color={resolvedColor} style={{ marginTop: 2 }} />
          <Text style={[styles.terminalText, { color: theme.textSecondary }]} numberOfLines={1}>
            {line.terminals[1]}
          </Text>
        </View>

        {/* length */}
        <Text style={[styles.lengthText, { color: theme.textSecondary }]}>{line.length}</Text>
      </TouchableOpacity>

      {/* Expandable Stations Sequence List */}
      {expanded && (
        <View style={[styles.stationsSequence, { borderLeftColor: resolvedColor }]}>
          {stations.map((st, sIdx) => {
            const isTerm = sIdx === 0 || sIdx === stations.length - 1;
            return (
              <TouchableOpacity
                key={sIdx}
                onPress={() => {
                  if (onQuickAction) {
                    onQuickAction(`Gates at ${st}`);
                  }
                }}
                style={styles.sequenceItem}
                activeOpacity={0.7}
              >
                <View style={[styles.sequenceDot, { backgroundColor: resolvedColor }]} />
                <Text
                  style={[
                    styles.sequenceText,
                    { color: theme.textPrimary, fontWeight: isTerm ? "700" : "400" },
                  ]}
                  numberOfLines={1}
                >
                  {st}
                </Text>
                <Ionicons
                  name="search-outline"
                  size={11.5}
                  color={theme.textSecondary}
                  style={{ marginLeft: 6, opacity: 0.6 }}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

/* ── interchange chip with pop-in animation ── */
function InterchangeChip({
  theme,
  label,
  index,
  totalLines,
}: {
  theme: Theme;
  label: string;
  index: number;
  totalLines: number;
}) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      delay: totalLines * 55 + index * 40,
      useNativeDriver: true,
      tension: 160,
      friction: 7,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.chip,
        { backgroundColor: theme.chip, transform: [{ scale }] },
      ]}
    >
      <Ionicons name="swap-horizontal" size={10} color={theme.chipText} style={{ marginRight: 4 }} />
      <Text style={[styles.chipLabel, { color: theme.chipText }]} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

/* ── main card ── */
export default function MetroMapCard({ theme, data, language = "EN", onQuickAction }: Props) {
  const headerFade = useRef(new Animated.Value(0)).current;
  const [expandedLine, setExpandedLine] = useState<string | null>(null);

  useEffect(() => {
    Animated.timing(headerFade, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* ── header ── */}
      <Animated.View style={[styles.headerRow, { opacity: headerFade }]}>
        <View style={[styles.iconCircle, { backgroundColor: theme.brand + "18" }]}>
          <Ionicons name="globe-outline" size={18} color={theme.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {language === "HI" ? "दिल्ली मेट्रो नेटवर्क" : "Delhi Metro Network"}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {language === "HI"
              ? `${data.lines.length} लाइनें • ${data.totalStations} स्टेशन • ${data.interchangeStations.length} इंटरचेंज`
              : `${data.lines.length} Lines • ${data.totalStations} Stations • ${data.interchangeStations.length} Interchanges`}
          </Text>
        </View>
      </Animated.View>

      {/* ── summary bar ── */}
      <View style={[styles.summaryBar, { backgroundColor: theme.surfaceAlt }]}>
        <SummaryStat
          icon="git-branch-outline"
          value={`${data.lines.length}`}
          label={language === "HI" ? "लाइनें" : "Lines"}
          theme={theme}
        />
        <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
        <SummaryStat
          icon="location-outline"
          value={`${data.totalStations}`}
          label={language === "HI" ? "स्टेशन" : "Stations"}
          theme={theme}
        />
        <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
        <SummaryStat
          icon="swap-horizontal"
          value={`${data.interchangeStations.length}`}
          label={language === "HI" ? "इंटरचेंज" : "Interchanges"}
          theme={theme}
        />
      </View>

      {/* ── line list ── */}
      {data.lines.map((line, idx) => (
        <LineRow
          key={line.name}
          theme={theme}
          line={line}
          index={idx}
          expanded={expandedLine === line.name}
          onPress={() => setExpandedLine(expandedLine === line.name ? null : line.name)}
          language={language}
          onQuickAction={onQuickAction}
        />
      ))}

      {/* ── interchange stations ── */}
      {data.interchangeStations.length > 0 && (
        <View style={[styles.interchangeSection, { borderTopColor: theme.border }]}>
          <View style={styles.interchangeHeader}>
            <Ionicons name="swap-horizontal" size={14} color={theme.brand} style={{ marginRight: 6 }} />
            <Text style={[styles.interchangeTitle, { color: theme.textPrimary }]}>
              {language === "HI" ? "इंटरचेंज स्टेशन" : "Interchange Stations"}
            </Text>
          </View>
          <View style={styles.chipWrap}>
            {data.interchangeStations.map((st, idx) => (
              <InterchangeChip
                key={st}
                theme={theme}
                label={st}
                index={idx}
                totalLines={data.lines.length}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

/* ── small summary stat widget ── */
function SummaryStat({
  icon,
  value,
  label,
  theme,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  value: string;
  label: string;
  theme: Theme;
}) {
  return (
    <View style={styles.summaryStatBox}>
      <Ionicons name={icon} size={14} color={theme.brand} style={{ marginBottom: 2 }} />
      <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

/* ── styles ── */
const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },

  /* header */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  title: { fontSize: 15, fontWeight: "700" },
  subtitle: { fontSize: 12, marginTop: 1 },

  /* summary bar */
  summaryBar: {
    flexDirection: "row",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  summaryStatBox: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 16, fontWeight: "700" },
  summaryLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.3 },
  summaryDivider: { width: 1, marginVertical: 4 },

  /* line rows */
  lineRow: {
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  lineTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  lineDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  lineName: { fontSize: 13, fontWeight: "700", flex: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  terminalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 18,
    marginBottom: 2,
  },
  terminalText: {
    fontSize: 11,
    marginLeft: 4,
    flexShrink: 1,
  },
  arrow: { fontSize: 11, marginHorizontal: 4 },
  lengthText: { fontSize: 10, paddingLeft: 18, marginTop: 1 },
  linePressContainer: { width: "100%" },
  stationsSequence: {
    marginTop: 8,
    marginLeft: 22,
    borderLeftWidth: 2,
    paddingLeft: 12,
    paddingVertical: 4,
  },
  sequenceItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 3,
  },
  sequenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: -16,
    marginRight: 10,
  },
  sequenceText: {
    fontSize: 12,
  },

  /* interchange section */
  interchangeSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  interchangeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  interchangeTitle: { fontSize: 13, fontWeight: "700" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipLabel: { fontSize: 11, fontWeight: "600" },
});
