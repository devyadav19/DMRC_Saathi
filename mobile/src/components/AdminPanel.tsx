import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
  TextInput,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../theme/theme";
import { analyze, Intent } from "../lib/nlu";

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  timestamp: number;
  card?: { type: string; data: any };
}

interface Props {
  theme: Theme;
  visible: boolean;
  onClose: () => void;
  messages: Message[];
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.75;
const ANIM_DURATION = 320;

export default function AdminPanel({ theme, visible, onClose, messages }: Props) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [activeTab, setActiveTab] = useState<"stats" | "failed" | "tester" | "logs">("stats");
  const [testQuery, setTestQuery] = useState("");
  const hasOpened = useRef(false);

  useEffect(() => {
    if (visible) {
      hasOpened.current = true;
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: ANIM_DURATION,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 22,
          stiffness: 220,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (hasOpened.current) {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: ANIM_DURATION - 80,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: PANEL_HEIGHT,
          duration: ANIM_DURATION - 80,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Process session analytics
  const userMessages = messages.filter((m) => m.role === "user");
  const botMessages = messages.filter((m) => m.role === "bot");
  const totalUserCount = userMessages.length;

  // Track intent matches and unknown/failed queries
  const intentCounts: Record<Intent | "unknown", number> = {} as any;
  const failedQueries: string[] = [];

  userMessages.forEach((m) => {
    const analysis = analyze(m.text);
    const intent = analysis.intent;
    intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    if (intent === "unknown") {
      failedQueries.push(m.text);
    }
  });

  const unknownCount = intentCounts["unknown"] || 0;
  const successRate = totalUserCount > 0 
    ? Math.round(((totalUserCount - unknownCount) / totalUserCount) * 100) 
    : 100;

  // Run live NLU test query
  const testAnalysis = testQuery.trim().length > 0 ? analyze(testQuery) : null;

  if (!visible && !hasOpened.current) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? "auto" : "none"}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.55],
              }),
            },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            height: PANEL_HEIGHT + insets.bottom,
            backgroundColor: theme.menuBg,
            borderTopColor: theme.border,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handleRow}>
          <View
            style={[
              styles.handle,
              { backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)" },
            ]}
          />
        </View>

        {/* Title bar */}
        <View style={styles.titleBar}>
          <View style={styles.titleLeft}>
            <Ionicons name="shield-checkmark" size={18} color={theme.success} style={{ marginRight: 8 }} />
            <Text style={[styles.titleText, { color: theme.textPrimary }]}>DMRC Admin Panel</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.closeButton,
              {
                backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
              },
            ]}
            accessibilityLabel="Close admin panel"
          >
            <Ionicons name="close" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Navigation Tabs */}
        <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
          {(["stats", "failed", "tester", "logs"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tabButton,
                activeTab === tab && { borderBottomColor: theme.brand },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? theme.brand : theme.textSecondary },
                  activeTab === tab && { fontWeight: "700" },
                ]}
              >
                {tab === "stats" && "Stats"}
                {tab === "failed" && `Failed (${failedQueries.length})`}
                {tab === "tester" && "NLU Tester"}
                {tab === "logs" && "Chat Logs"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content Area */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, padding: 18 }}
        >
          {/* TAB 1: STATISTICS */}
          {activeTab === "stats" && (
            <View>
              <View style={styles.statsOverview}>
                <View style={[styles.statCard, { backgroundColor: theme.menuItem, borderColor: theme.border }]}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Queries</Text>
                  <Text style={[styles.statValue, { color: theme.textPrimary }]}>{totalUserCount}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.menuItem, borderColor: theme.border }]}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>NLU Accuracy</Text>
                  <Text
                    style={[
                      styles.statValue,
                      { color: successRate >= 80 ? theme.success : successRate >= 50 ? theme.warning : theme.danger },
                    ]}
                  >
                    {successRate}%
                  </Text>
                </View>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>NLU Intent Distribution</Text>
              {Object.keys(intentCounts).length === 0 ? (
                <Text style={{ color: theme.textSecondary, fontStyle: "italic", textAlign: "center", marginVertical: 20 }}>
                  No messages processed yet in this session.
                </Text>
              ) : (
                <View style={[styles.listWrapper, { borderColor: theme.border }]}>
                  {Object.entries(intentCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([intent, count], index, arr) => (
                      <View
                        key={intent}
                        style={[
                          styles.listItem,
                          { borderBottomColor: index === arr.length - 1 ? "transparent" : theme.border },
                        ]}
                      >
                        <Text style={[styles.listItemText, { color: theme.textPrimary }]}>{intent}</Text>
                        <View style={[styles.badge, { backgroundColor: theme.chip }]}>
                          <Text style={[styles.badgeText, { color: theme.chipText }]}>{count} matches</Text>
                        </View>
                      </View>
                    ))}
                </View>
              )}

              <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 24 }]}>System Status</Text>
              <View style={[styles.listWrapper, { borderColor: theme.border }]}>
                <View style={[styles.listItem, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.listItemText, { color: theme.textPrimary }]}>Database Mode</Text>
                  <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Local Memory Cache</Text>
                </View>
                <View style={[styles.listItem, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.listItemText, { color: theme.textPrimary }]}>NLU Engine</Text>
                  <Text style={{ color: theme.success, fontWeight: "600" }}>Active & Safe (Offline)</Text>
                </View>
                <View style={styles.listItem}>
                  <Text style={[styles.listItemText, { color: theme.textPrimary }]}>Active Session ID</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 11, fontFamily: "monospace" }}>DMRC-MOCK-SESSION</Text>
                </View>
              </View>
            </View>
          )}

          {/* TAB 2: FAILED QUERIES */}
          {activeTab === "failed" && (
            <View>
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                Queries sent by the user during this session that returned the "unknown" intent. Use this to identify vocabulary gaps.
              </Text>
              {failedQueries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-circle-outline" size={48} color={theme.success} />
                  <Text style={[styles.emptyStateText, { color: theme.textSecondary, marginTop: 10 }]}>
                    No failed queries! The NLU understood all messages.
                  </Text>
                </View>
              ) : (
                <View style={[styles.listWrapper, { borderColor: theme.border }]}>
                  {failedQueries.map((query, index, arr) => (
                    <View
                      key={index}
                      style={[
                        styles.listItem,
                        { borderBottomColor: index === arr.length - 1 ? "transparent" : theme.border },
                      ]}
                    >
                      <Ionicons name="warning-outline" size={16} color={theme.danger} style={{ marginRight: 8 }} />
                      <Text style={[styles.queryText, { color: theme.textPrimary }]}>"{query}"</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: NLU LIVE TESTER */}
          {activeTab === "tester" && (
            <View>
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                Type any query below to test how the NLU matches intents and extracts station details in real-time.
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.menuItem,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="e.g. Rajiv Chowk to Hauz Khas"
                placeholderTextColor={theme.textSecondary}
                value={testQuery}
                onChangeText={setTestQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {testAnalysis ? (
                <View style={[styles.analysisCard, { backgroundColor: theme.menuItem, borderColor: theme.border }]}>
                  <View style={styles.analysisRow}>
                    <Text style={[styles.analysisLabel, { color: theme.textSecondary }]}>Detected Intent:</Text>
                    <View style={[styles.badge, { backgroundColor: theme.brand }]}>
                      <Text style={[styles.badgeText, { color: "#FFF", fontWeight: "700" }]}>
                        {testAnalysis.intent.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: 12 }]} />

                  <View style={styles.analysisRow}>
                    <Text style={[styles.analysisLabel, { color: theme.textSecondary }]}>Origin Station:</Text>
                    <Text style={[styles.analysisValue, { color: theme.textPrimary }]}>
                      {testAnalysis.origin ? testAnalysis.origin.name : "None"}
                    </Text>
                  </View>

                  <View style={styles.analysisRow}>
                    <Text style={[styles.analysisLabel, { color: theme.textSecondary }]}>Destination Station:</Text>
                    <Text style={[styles.analysisValue, { color: theme.textPrimary }]}>
                      {testAnalysis.destination ? testAnalysis.destination.name : "None"}
                    </Text>
                  </View>

                  <View style={styles.analysisRow}>
                    <Text style={[styles.analysisLabel, { color: theme.textSecondary }]}>Single Station Context:</Text>
                    <Text style={[styles.analysisValue, { color: theme.textPrimary }]}>
                      {testAnalysis.station ? testAnalysis.station.name : "None"}
                    </Text>
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: 12 }]} />

                  <Text style={[styles.analysisLabel, { color: theme.textSecondary, marginBottom: 6 }]}>
                    NLU Raw Payload:
                  </Text>
                  <View style={[styles.codeBox, { backgroundColor: theme.bg }]}>
                    <Text style={[styles.codeText, { color: theme.textSecondary }]}>
                      {JSON.stringify(
                        {
                          intent: testAnalysis.intent,
                          origin: testAnalysis.origin ? { name: testAnalysis.origin.name, lines: testAnalysis.origin.linesServed } : null,
                          destination: testAnalysis.destination ? { name: testAnalysis.destination.name, lines: testAnalysis.destination.linesServed } : null,
                          station: testAnalysis.station ? { name: testAnalysis.station.name, lines: testAnalysis.station.linesServed } : null,
                        },
                        null,
                        2
                      )}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="flask-outline" size={48} color={theme.textSecondary} />
                  <Text style={[styles.emptyStateText, { color: theme.textSecondary, marginTop: 10 }]}>
                    Enter a query above to see NLU analysis.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* TAB 4: CHAT TRANSCRIPT */}
          {activeTab === "logs" && (
            <View>
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                Chronological list of all messages exchanged in the current session.
              </Text>
              <View style={[styles.listWrapper, { borderColor: theme.border }]}>
                {messages.map((m, index) => (
                  <View
                    key={m.id}
                    style={[
                      styles.logItem,
                      {
                        backgroundColor: m.role === "user" ? "transparent" : theme.menuItem,
                        borderBottomWidth: index === messages.length - 1 ? 0 : StyleSheet.hairlineWidth,
                        borderBottomColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.logHeader}>
                      <Text
                        style={[
                          styles.logRole,
                          { color: m.role === "user" ? theme.brand : theme.success },
                        ]}
                      >
                        {m.role.toUpperCase()}
                      </Text>
                      <Text style={[styles.logTime, { color: theme.textSecondary }]}>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                    <Text style={[styles.logText, { color: theme.textPrimary }]}>{m.text}</Text>
                    {m.card && (
                      <View style={[styles.badge, { backgroundColor: theme.chip, alignSelf: "flex-start", marginTop: 6 }]}>
                        <Text style={[styles.badgeText, { color: theme.chipText, fontSize: 10 }]}>
                          Card: {m.card.type}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  handleRow: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  titleBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  titleLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  statsOverview: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  listWrapper: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listItemText: {
    fontSize: 13,
    fontWeight: "500",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 13,
    textAlign: "center",
  },
  queryText: {
    fontSize: 13.5,
    fontStyle: "italic",
    flex: 1,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    fontSize: 14,
    marginBottom: 18,
  },
  analysisCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  analysisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 6,
  },
  analysisLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  analysisValue: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  codeBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 6,
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 11,
    lineHeight: 15,
  },
  logItem: {
    padding: 12,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  logRole: {
    fontSize: 10,
    fontWeight: "700",
  },
  logTime: {
    fontSize: 10,
  },
  logText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
