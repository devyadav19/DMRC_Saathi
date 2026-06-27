import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, lineColor, lineLabel } from "../theme/theme";

interface Props {
  theme: Theme;
  language?: "EN" | "HI";
}

type StatusType = "normal" | "delay" | "suspended";

interface LineStatus {
  line: string;
  status: StatusType;
  delayMsg?: string;
  delayMsgHi?: string;
}

const INITIAL_STATUSES: LineStatus[] = [
  { line: "RED", status: "normal" },
  { line: "YELLOW", status: "normal" },
  { line: "BLUE", status: "normal" },
  { line: "GREEN", status: "normal" },
  { line: "VIOLET", status: "normal" },
  { line: "PINK", status: "normal" },
  { line: "MAGENTA", status: "normal" },
  { line: "ORANGE/AIRPORT", status: "normal" },
  { line: "AQUA", status: "normal" },
  { line: "GRAY", status: "normal" },
  { line: "RAPID", status: "normal" },
];

export default function LineStatusCard({ theme, language = "EN" }: Props) {
  const [statuses, setStatuses] = useState<LineStatus[]>(INITIAL_STATUSES);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>(
    language === "HI" ? "अभी" : "Just now"
  );
  
  const spinAnim = useRef(new Animated.Value(0)).current;

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    
    // Start spin animation
    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    // Mock network request & status change
    setTimeout(() => {
      setRefreshing(false);
      
      // Randomly inject 1 delay or keep all normal
      const newStatuses = INITIAL_STATUSES.map((item) => {
        // 15% chance of delay for Red, Blue, or Yellow lines (the busiest lines)
        if ((item.line === "RED" || item.line === "BLUE" || item.line === "YELLOW") && Math.random() < 0.15) {
          return {
            ...item,
            status: "delay" as StatusType,
            delayMsg: "Signal issue causing 5-10 min delay.",
            delayMsgHi: "सिग्नल समस्या के कारण 5-10 मिनट की देरी।",
          };
        }
        return item;
      });

      setStatuses(newStatuses);

      // Update timestamp
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastUpdated(language === "HI" ? `${timeStr} बजे` : `${timeStr}`);
    }, 1100);
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <View style={[styles.iconCircle, { backgroundColor: theme.brand + "15" }]}>
          <Ionicons name="pulse-outline" size={18} color={theme.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            {language === "HI" ? "लाइन संचालन स्थिति" : "Operational Line Status"}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {language === "HI" ? `अंतिम अपडेट: ${lastUpdated}` : `Last updated: ${lastUpdated}`}
          </Text>
        </View>
      </View>

      {/* LINE STATUS LIST */}
      <View style={styles.listContainer}>
        {statuses.map((item) => {
          const lColor = lineColor(item.line);
          const isNormal = item.status === "normal";
          const isDelay = item.status === "delay";
          
          let statusText = language === "HI" ? "सामान्य सेवा" : "Normal Service";
          let statusColor = theme.success;
          
          if (isDelay) {
            statusText = language === "HI" ? "देरी" : "Minor Delay";
            statusColor = theme.warning;
          } else if (item.status === "suspended") {
            statusText = language === "HI" ? "सेवा स्थगित" : "Suspended";
            statusColor = theme.danger;
          }

          return (
            <View key={item.line} style={[styles.lineRow, { borderBottomColor: theme.border }]}>
              {/* Left: Line identifier */}
              <View style={styles.lineLeft}>
                <View style={[styles.lineBadge, { backgroundColor: lColor }]} />
                <Text style={[styles.lineName, { color: theme.textPrimary }]}>
                  {lineLabel(item.line)}
                </Text>
              </View>

              {/* Right: Operational Status */}
              <View style={styles.statusRight}>
                <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {statusText}
                </Text>
              </View>

              {/* Detailed delay message underneath if any */}
              {isDelay && (
                <View style={[styles.delayMessageBlock, { backgroundColor: theme.surfaceAlt }]}>
                  <Ionicons name="warning" size={12} color={theme.warning} style={{ marginRight: 6 }} />
                  <Text style={[styles.delayMessageText, { color: theme.textSecondary }]}>
                    {language === "HI" ? item.delayMsgHi : item.delayMsg}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* REFRESH ACTION */}
      <TouchableOpacity
        onPress={handleRefresh}
        disabled={refreshing}
        style={[styles.refreshBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
        activeOpacity={0.7}
      >
        {refreshing ? (
          <ActivityIndicator size="small" color={theme.brand} style={{ marginRight: 6 }} />
        ) : (
          <Animated.View style={{ transform: [{ rotate: spin }], marginRight: 6 }}>
            <Ionicons name="refresh-outline" size={16} color={theme.brand} />
          </Animated.View>
        )}
        <Text style={[styles.refreshBtnText, { color: theme.brand }]}>
          {refreshing 
            ? (language === "HI" ? "अपडेट हो रहा है..." : "Updating...") 
            : (language === "HI" ? "स्थिति अपडेट करें" : "Refresh Status")}
        </Text>
      </TouchableOpacity>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 14.5,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  listContainer: {
    marginBottom: 10,
  },
  lineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lineLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  lineBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  lineName: {
    fontSize: 13,
    fontWeight: "600",
  },
  statusRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  delayMessageBlock: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  delayMessageText: {
    fontSize: 11,
    lineHeight: 14,
    flex: 1,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
