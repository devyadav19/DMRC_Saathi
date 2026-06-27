import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Share } from "react-native";
import { Theme, lineColor, lineLabel } from "../theme/theme";
import { JourneyResult, formatDuration } from "../lib/journeyPlanner";
import { Ionicons } from "@expo/vector-icons";
import { FareEstimate } from "../lib/fare";

interface Props {
  theme: Theme;
  origin: string;
  destination: string;
  primary: JourneyResult;
  alternate?: JourneyResult | null;
  fare: FareEstimate;
  language?: "EN" | "HI";
  onQuickAction?: (message: string) => void;
}

function formatDurationHi(totalSeconds: number): string {
  const mins = Math.round(totalSeconds / 60);
  if (mins < 60) return `${mins} मिनट`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} घंटे` : `${h} घंटे ${m} मिनट`;
}

function RouteSummary({
  theme,
  journey,
  label,
  language = "EN",
  onQuickAction,
}: {
  theme: Theme;
  journey: JourneyResult;
  label?: string;
  language?: "EN" | "HI";
  onQuickAction?: (message: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const legs = journey.legs;

  const durationStr = language === "HI" ? formatDurationHi(journey.totalSeconds) : formatDuration(journey.totalSeconds);
  const stationStr = language === "HI" ? `${journey.stationCount} स्टेशन` : `${journey.stationCount} stations`;
  const interchangeStr = language === "HI"
    ? `${journey.interchanges.length} इंटरचेंज`
    : `${journey.interchanges.length} interchange${journey.interchanges.length === 1 ? "" : "s"}`;

  return (
    <View style={[styles.routeBlock, { borderColor: theme.border }]}>
      {label && <Text style={[styles.routeLabel, { color: theme.textSecondary }]}>{label}</Text>}
      <View style={styles.lineRow}>
        {journey.linesUsed.map((line, idx) => (
          <View key={line} style={styles.lineChipRow}>
            <View style={[styles.lineDot, { backgroundColor: lineColor(line) }]} />
            <Text style={[styles.lineChipText, { color: theme.textPrimary }]}>{lineLabel(line)}</Text>
            {idx < journey.linesUsed.length - 1 && (
              <Text style={[styles.arrow, { color: theme.textSecondary }]}>{"  →  "}</Text>
            )}
          </View>
        ))}
      </View>
      <View style={styles.statsRow}>
        <Text style={[styles.stat, { color: theme.textPrimary }]}>{durationStr}</Text>
        <Text style={[styles.statDivider, { color: theme.border }]}>•</Text>
        <Text style={[styles.stat, { color: theme.textPrimary }]}>{stationStr}</Text>
        <Text style={[styles.statDivider, { color: theme.border }]}>•</Text>
        <Text style={[styles.stat, { color: theme.textPrimary }]}>{interchangeStr}</Text>
      </View>
      {journey.interchanges.length > 0 && (
        <Text style={[styles.interchangeNote, { color: theme.textSecondary }]}>
          {language === "HI" ? "बदलें:" : "Change at:"} {journey.interchanges.map((i) => i.atStation).join(", ")}
        </Text>
      )}

      {/* Stations Passed Dropdown Trigger */}
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={[styles.toggleButton, { backgroundColor: theme.menuItem, borderColor: theme.border }]}
      >
        <Text style={[styles.toggleButtonText, { color: theme.chipText }]}>
          {expanded
            ? language === "HI"
              ? "रूट विवरण छुपाएं"
              : "Hide Route Details"
            : language === "HI"
            ? `स्टेशनों की सूची देखें (${legs.length})`
            : `Show Stations Passed (${legs.length})`}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={theme.chipText}
          style={{ marginLeft: 6 }}
        />
      </TouchableOpacity>

      {/* Dropdown Station List */}
      {expanded && (
        <View style={[styles.stationsList, { borderLeftColor: theme.border }]}>
          {legs.map((leg, idx) => {
            const isOrigin = idx === 0;
            const isDestination = idx === legs.length - 1;
            const isInterchange = leg.isInterchange;
            const dotColor = lineColor(leg.line ?? legs[1]?.line);

            return (
              <View key={idx} style={styles.stationItem}>
                <View style={[styles.stationDot, { backgroundColor: dotColor }]} />
                <TouchableOpacity
                  onPress={() => onQuickAction && onQuickAction(language === "HI" ? `${leg.stationName} के गेट` : `Gates at ${leg.stationName}`)}
                  style={{ flexDirection: "row", alignItems: "center", flexShrink: 1 }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.stationName,
                      {
                        color: theme.textPrimary,
                        fontWeight: isOrigin || isDestination ? "700" : "400",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {leg.stationName}
                    {isOrigin && (language === "HI" ? " (प्रस्थान)" : " (Origin)")}
                    {isDestination && (language === "HI" ? " (गंतव्य)" : " (Destination)")}
                  </Text>
                  <Ionicons
                    name="search-outline"
                    size={11}
                    color={theme.textSecondary}
                    style={{ marginLeft: 6, opacity: 0.6 }}
                  />
                </TouchableOpacity>
                {isInterchange && leg.line && (
                  <Text style={[styles.interchangeText, { color: theme.success, marginLeft: 6 }]}>
                    ↳ {language === "HI" ? `${lineLabel(leg.line)} पर बदलें` : `Change to ${lineLabel(leg.line)}`}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function JourneyCard({
  theme,
  origin,
  destination,
  primary,
  alternate,
  fare,
  language = "EN",
  onQuickAction,
}: Props) {
  const handleShare = async () => {
    try {
      const formatRouteText = (journey: JourneyResult) => {
        const duration = language === "HI" ? formatDurationHi(journey.totalSeconds) : formatDuration(journey.totalSeconds);
        const stations = language === "HI" ? `${journey.stationCount} स्टेशन` : `${journey.stationCount} stations`;
        const interchanges = language === "HI"
          ? `${journey.interchanges.length} इंटरचेंज`
          : `${journey.interchanges.length} interchange${journey.interchanges.length === 1 ? "" : "s"}`;

        let path = journey.legs
          .map((leg, idx) => {
            let text = `${idx + 1}. ${leg.stationName}`;
            if (idx === 0) text += language === "HI" ? " (प्रस्थान)" : " (Origin)";
            if (idx === journey.legs.length - 1) text += language === "HI" ? " (गंतव्य)" : " (Destination)";
            if (leg.isInterchange && leg.line) {
              text += language === "HI" ? ` -> ${lineLabel(leg.line)} में बदलें` : ` -> Change to ${lineLabel(leg.line)}`;
            }
            return text;
          })
          .join("\n");

        return `${language === "HI" ? "रूट विवरण" : "Route details"}:\n${origin} ➔ ${destination}\n\n${
          language === "HI" ? "समय" : "Time"
        }: ${duration}\n${language === "HI" ? "स्टेशन" : "Stations"}: ${stations}\n${
          language === "HI" ? "इंटरचेंज" : "Interchanges"
        }: ${interchanges}\n\n${language === "HI" ? "स्टेशनों का क्रम" : "Stations Sequence"}:\n${path}`;
      };

      const primaryText = formatRouteText(primary);
      const fareText = language === "HI"
        ? `अनुमानित किराया: ₹${fare.token} टोकन / ₹${fare.smartCard} स्मार्ट कार्ड`
        : `Estimated Fare: ₹${fare.token} Token / ₹${fare.smartCard} Smart Card`;

      const shareMessage = `🚇 DMRC Chatbot Journey Details 🚇\n\n${primaryText}\n\n${fareText}\n\nHave a safe journey!`;

      await Share.share({ message: shareMessage });
    } catch (error) {
      console.warn("Share error: ", error);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        {origin} → {destination}
      </Text>

      <RouteSummary theme={theme} journey={primary} language={language} onQuickAction={onQuickAction} />

      {alternate && (
        <RouteSummary
          theme={theme}
          journey={alternate}
          label={
            language === "HI"
              ? "एयरपोर्ट एक्सप्रेस के माध्यम से तेज़ (अलग, अधिक किराया)"
              : "Faster via Airport Express (separate, higher fare)"
          }
          language={language}
          onQuickAction={onQuickAction}
        />
      )}

      <View style={[styles.fareRow, { borderTopColor: theme.border }]}>
        <Text style={[styles.fareLabel, { color: theme.textSecondary }]}>
          {language === "HI" ? "अनुमानित किराया" : "Estimated fare"}
        </Text>
        <Text style={[styles.fareValue, { color: theme.brand }]}>
          ₹{fare.token} {language === "HI" ? "टोकन" : "token"} · ₹{fare.smartCard} {language === "HI" ? "स्मार्ट कार्ड" : "smart card"}
        </Text>
      </View>
      <Text style={[styles.disclaimer, { color: theme.textSecondary }]}>
        {language === "HI"
          ? "किराया दूरी के स्लैब के आधार पर अनुमानित है — गेट पर या आधिकारिक DMRC ऐप में पुष्टि करें।"
          : "Estimate based on station count — confirm exact fare at the gate or DMRC app."}
      </Text>

      <TouchableOpacity onPress={handleShare} style={[styles.shareBtn, { borderColor: theme.border }]}>
        <Ionicons name="share-social-outline" size={14} color={theme.brand} style={{ marginRight: 6 }} />
        <Text style={[styles.shareBtnText, { color: theme.brand }]}>
          {language === "HI" ? "रूट विवरण शेयर करें" : "Share Journey"}
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
  title: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  routeBlock: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  routeLabel: { fontSize: 11, fontWeight: "600", marginBottom: 6, textTransform: "uppercase" },
  lineRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginBottom: 8 },
  lineChipRow: { flexDirection: "row", alignItems: "center" },
  lineDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  lineChipText: { fontSize: 13, fontWeight: "600" },
  arrow: { fontSize: 12 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stat: { fontSize: 13, fontWeight: "500" },
  statDivider: { fontSize: 13, marginHorizontal: 6 },
  interchangeNote: { fontSize: 12, marginTop: 6 },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    paddingTop: 10,
  },
  fareLabel: { fontSize: 13 },
  fareValue: { fontSize: 14, fontWeight: "700" },
  disclaimer: { fontSize: 11, marginTop: 6 },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  toggleButtonText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  stationsList: {
    marginTop: 10,
    paddingLeft: 12,
    borderLeftWidth: 2,
    marginLeft: 6,
  },
  stationItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 3.5,
  },
  stationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
    marginLeft: -15,
  },
  stationName: {
    fontSize: 12.5,
  },
  interchangeText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
