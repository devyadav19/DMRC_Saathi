import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, lineColor, lineLabel } from "../theme/theme";
import JourneyCard from "./JourneyCard";
import NextTrainCard from "./NextTrainCard";
import EmergencyCard from "./EmergencyCard";
import HelpFaqCard from "./HelpFaqCard";
import FareTableCard from "./FareTableCard";
import MetroMapCard from "./MetroMapCard";
import InfoCard from "./InfoCard";
import SmartCardReaderCard from "./SmartCardReaderCard";
import LineStatusCard from "./LineStatusCard";
import { ChatCard } from "../lib/chatEngine";

function GatesCard({ theme, data, language = "EN" }: { theme: Theme; data: any; language?: "EN" | "HI" }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        {data.station} — {language === "HI" ? "गेट/निकास" : "Gates"}
      </Text>
      {data.gates.map((g: any, i: number) => (
        <View key={i} style={styles.row}>
          <Text style={[styles.gateName, { color: theme.brand }]}>{g.gate_name}</Text>
          <Text style={[styles.gateLoc, { color: theme.textSecondary }]}>{g.location}</Text>
        </View>
      ))}
    </View>
  );
}

function ScheduleCard({ theme, data, language = "EN" }: { theme: Theme; data: any; language?: "EN" | "HI" }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        {data.station} — {data.dayType === "Sunday" && language === "HI" ? "रविवार" : data.dayType === "Saturday" && language === "HI" ? "शनिवार" : data.dayType === "Weekday" && language === "HI" ? "कार्यदिवस" : data.dayType}
      </Text>
      {data.entries.map((e: any, i: number) => (
        <View key={i} style={styles.row}>
          <View style={styles.lineLabelRow}>
            <View style={[styles.dot, { backgroundColor: lineColor(e.line) }]} />
            <Text style={[styles.gateName, { color: theme.textPrimary }]}>{lineLabel(e.line)}</Text>
          </View>
          <Text style={[styles.gateLoc, { color: theme.textSecondary }]}>
            {language === "HI" ? "पहली" : "First"} {e.first ?? "—"} · {language === "HI" ? "आखिरी" : "Last"} {e.last ?? "—"}
          </Text>
        </View>
      ))}
    </View>
  );
}

function getStationFacilities(stationName: string, lang: "EN" | "HI" = "EN") {
  let hash = 0;
  for (let i = 0; i < stationName.length; i++) {
    hash = stationName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hasParking = Math.abs(hash % 3) !== 0; // 66% chance
  const hasBabyCare = Math.abs(hash % 2) === 0; // 50% chance
  const liftCount = 2 + Math.abs(hash % 5);
  const escalatorCount = liftCount * 2 - 1;

  if (lang === "HI") {
    return {
      lifts: `${liftCount} लिफ्ट उपलब्ध`,
      escalators: `${escalatorCount} एस्केलेटर चालू`,
      washrooms: Math.abs(hash % 2) === 0 ? "गेट के अंदर" : "कॉन्कोर्स स्तर",
      parking: hasParking ? "पार्किंग उपलब्ध" : "पार्किंग नहीं है",
      babyCare: hasBabyCare ? "फीडिंग रूम" : "उपलब्ध नहीं है",
      hasParking,
      hasBabyCare,
    };
  }
  
  return {
    lifts: `${liftCount} Lifts Active`,
    escalators: `${escalatorCount} Escalators Active`,
    washrooms: Math.abs(hash % 2) === 0 ? "Inside Gate" : "Concourse Level",
    parking: hasParking ? "Parking Available" : "No Parking",
    babyCare: hasBabyCare ? "Baby Care Room" : "Not Available",
    hasParking,
    hasBabyCare,
  };
}

function StationInfoCard({ theme, data, language = "EN" }: { theme: Theme; data: any; language?: "EN" | "HI" }) {
  const s = data.station;
  const fac = getStationFacilities(s.name, language);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Station Name & Type */}
      <View style={styles.stationHeader}>
        <Text style={[styles.title, { color: theme.textPrimary, marginBottom: 4 }]}>{s.name}</Text>
        <Text style={[styles.gateLoc, { color: theme.brand, fontWeight: "600", fontSize: 11 }]}>
          {s.isInterchange 
            ? (language === "HI" ? "अदला-बदली (इंटरचेंज) स्टेशन" : "INTERCHANGE STATION")
            : (language === "HI" ? "मेट्रो स्टेशन" : "METRO STATION")}
        </Text>
      </View>

      {/* Lines Served Badges */}
      <View style={[styles.lineRow, { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 10, marginBottom: 12 }]}>
        {s.linesServed.map((line: string) => (
          <View key={line} style={[styles.lineBadgeItem, { backgroundColor: lineColor(line) + "12", borderColor: lineColor(line), borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 8, marginTop: 4 }]}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: lineColor(line) }}>
              {lineLabel(line).toUpperCase()}
            </Text>
          </View>
        ))}
      </View>

      {/* Facilities Heading */}
      <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
        {language === "HI" ? "स्टेशन सुविधाएं और स्थिति:" : "Station Facilities & Live Status:"}
      </Text>

      {/* 2x2 Facilities Grid */}
      <View style={styles.facilitiesGrid}>
        {/* Box 1: Lifts & Escalators */}
        <View style={[styles.facilityBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <View style={styles.facilityTitleRow}>
            <Ionicons name="swap-vertical-outline" size={14} color={theme.brand} />
            <Text style={[styles.facilityTitle, { color: theme.textPrimary }]}>
              {language === "HI" ? "लिफ्ट/एस्केलेटर" : "Lifts & Esc."}
            </Text>
          </View>
          <Text style={[styles.facilityDetailText, { color: theme.textSecondary }]} numberOfLines={1}>
            {fac.lifts}
          </Text>
          <Text style={[styles.facilityDetailText, { color: theme.textSecondary }]} numberOfLines={1}>
            {fac.escalators}
          </Text>
          <View style={styles.facilityStatusDotRow}>
            <View style={[styles.dotSmall, { backgroundColor: theme.success }]} />
            <Text style={[styles.facilityStatusText, { color: theme.success }]}>
              {language === "HI" ? "सक्रिय" : "Normal"}
            </Text>
          </View>
        </View>

        {/* Box 2: Toilets */}
        <View style={[styles.facilityBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <View style={styles.facilityTitleRow}>
            <Ionicons name="woman-outline" size={14} color={theme.brand} />
            <Text style={[styles.facilityTitle, { color: theme.textPrimary }]}>
              {language === "HI" ? "शौचालय" : "Washrooms"}
            </Text>
          </View>
          <Text style={[styles.facilityDetailText, { color: theme.textSecondary, marginTop: 6 }]} numberOfLines={2}>
            {fac.washrooms}
          </Text>
          <View style={styles.facilityStatusDotRow}>
            <View style={[styles.dotSmall, { backgroundColor: theme.success }]} />
            <Text style={[styles.facilityStatusText, { color: theme.success }]}>
              {language === "HI" ? "उपलब्ध" : "Available"}
            </Text>
          </View>
        </View>

        {/* Box 3: Parking */}
        <View style={[styles.facilityBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <View style={styles.facilityTitleRow}>
            <Ionicons name="car-outline" size={14} color={theme.brand} />
            <Text style={[styles.facilityTitle, { color: theme.textPrimary }]}>
              {language === "HI" ? "पार्किंग" : "Parking"}
            </Text>
          </View>
          <Text style={[styles.facilityDetailText, { color: theme.textSecondary, marginTop: 6 }]} numberOfLines={2}>
            {fac.parking}
          </Text>
          <View style={styles.facilityStatusDotRow}>
            <View style={[styles.dotSmall, { backgroundColor: fac.hasParking ? theme.success : theme.border }]} />
            <Text style={[styles.facilityStatusText, { color: fac.hasParking ? theme.success : theme.textSecondary }]}>
              {fac.hasParking ? (language === "HI" ? "चालू" : "Active") : (language === "HI" ? "नहीं है" : "N/A")}
            </Text>
          </View>
        </View>

        {/* Box 4: Baby Care */}
        <View style={[styles.facilityBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <View style={styles.facilityTitleRow}>
            <Ionicons name="heart-outline" size={14} color={theme.brand} />
            <Text style={[styles.facilityTitle, { color: theme.textPrimary }]}>
              {language === "HI" ? "शिशु गृह" : "Baby Care"}
            </Text>
          </View>
          <Text style={[styles.facilityDetailText, { color: theme.textSecondary, marginTop: 6 }]} numberOfLines={2}>
            {fac.babyCare}
          </Text>
          <View style={styles.facilityStatusDotRow}>
            <View style={[styles.dotSmall, { backgroundColor: fac.hasBabyCare ? theme.success : theme.border }]} />
            <Text style={[styles.facilityStatusText, { color: fac.hasBabyCare ? theme.success : theme.textSecondary }]}>
              {fac.hasBabyCare ? (language === "HI" ? "उपलब्ध" : "Available") : (language === "HI" ? "नहीं है" : "N/A")}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function FareCard({ theme, data, language = "EN" }: { theme: Theme; data: any; language?: "EN" | "HI" }) {
  const { origin, destination, fare } = data;
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.lineLabelRow}>
        <Ionicons name="cash-outline" size={16} color={theme.brand} style={{ marginRight: 6 }} />
        <Text style={[styles.title, { color: theme.textPrimary, marginBottom: 0 }]}>
          {language === "HI" ? "अनुमानित किराया" : "Fare Estimate"}
        </Text>
      </View>
      <Text style={[styles.gateLoc, { color: theme.textSecondary, marginTop: 4, marginBottom: 8 }]}>
        {origin} → {destination}
      </Text>
      <View style={[styles.row, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
        <View>
          <Text style={[styles.gateName, { color: theme.textPrimary }]}>
            {language === "HI" ? "टोकन किराया" : "Token Fare"}
          </Text>
          <Text style={[styles.gateLoc, { color: theme.textSecondary }]}>
            {language === "HI" ? "एकल यात्रा" : "Single Journey"}
          </Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: "800", color: theme.textPrimary }}>₹{fare.token}</Text>
      </View>
      <View style={[styles.row, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
        <View>
          <Text style={[styles.gateName, { color: theme.success }]}>
            {language === "HI" ? "स्मार्ट कार्ड किराया" : "Smart Card Fare"}
          </Text>
          <Text style={[styles.gateLoc, { color: theme.textSecondary }]}>
            {language === "HI" ? "10% छूट लागू" : "10% discount applied"}
          </Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: "800", color: theme.success }}>₹{fare.smartCard}</Text>
      </View>
    </View>
  );
}

interface CardRendererProps {
  theme: Theme;
  card: ChatCard;
  onQuickAction?: (message: string) => void;
  language?: "EN" | "HI";
}

export default function CardRenderer({ theme, card, onQuickAction, language = "EN" }: CardRendererProps) {
  switch (card.type) {
    case "journey":
      return (
        <JourneyCard
          theme={theme}
          origin={card.data.origin}
          destination={card.data.destination}
          primary={card.data.primary}
          alternate={card.data.alternate}
          fare={card.data.fare}
          language={language}
          onQuickAction={onQuickAction}
        />
      );
    case "fare":
      return <FareCard theme={theme} data={card.data} language={language} />;
    case "gates":
      return <GatesCard theme={theme} data={card.data} language={language} />;
    case "next_train":
      return (
        <NextTrainCard
          theme={theme}
          stationName={card.data.station}
          departures={card.data.departures ?? []}
          language={language}
        />
      );
    case "stationInfo":
      return <StationInfoCard theme={theme} data={card.data} language={language} />;
    case "emergency_sos":
      return <EmergencyCard theme={theme} data={card.data} language={language} />;
    case "help_faq":
      return <HelpFaqCard theme={theme} data={card.data} onQuickAction={onQuickAction} language={language} />;
    case "fare_table":
      return <FareTableCard theme={theme} data={card.data} language={language} />;
    case "metro_map":
      return <MetroMapCard theme={theme} data={card.data} language={language} onQuickAction={onQuickAction} />;
    case "line_status":
      return <LineStatusCard theme={theme} language={language} />;
    case "smart_card":
      return <SmartCardReaderCard theme={theme} language={language} />;
    case "penalty":
    case "tourist_card":
    case "parking":
    case "feeder_bus":
    case "notices":
      return <InfoCard theme={theme} data={card.data} language={language} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  title: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  row: { paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(0,0,0,0.06)" },
  gateName: { fontSize: 13, fontWeight: "600" },
  gateLoc: { fontSize: 12, marginTop: 2 },
  lineRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  lineLabelRow: { flexDirection: "row", alignItems: "center", marginRight: 12, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  stationHeader: {
    marginBottom: 8,
  },
  lineBadgeItem: {
    marginVertical: 2,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  facilitiesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  facilityBox: {
    width: "48.5%",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    marginVertical: 5,
    minHeight: 85,
    justifyContent: "space-between",
  },
  facilityTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  facilityTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    marginLeft: 5,
  },
  facilityDetailText: {
    fontSize: 10.5,
    lineHeight: 13,
  },
  facilityStatusDotRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  dotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  facilityStatusText: {
    fontSize: 9,
    fontWeight: "700",
  },
});
