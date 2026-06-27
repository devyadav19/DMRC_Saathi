import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../theme/theme";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FareSlab {
  maxStations: number;
  token: number;
  smartCard: number;
}

interface TouristCard {
  name: string;
  price: number;
  validity: string;
  description: string;
}

interface Props {
  theme: Theme;
  data: {
    weekdaySlabs: FareSlab[];
    sundaySlabs: FareSlab[];
    touristCards: TouristCard[];
  };
  language?: "EN" | "HI";
}

type Tab = "weekday" | "sunday";

function stationRangeLabel(slab: FareSlab, index: number, language: "EN" | "HI" = "EN"): string {
  if (slab.maxStations >= 99 || slab.maxStations === 0) return language === "HI" ? "32+ स्टेशन" : "32+ stations";
  return language === "HI" ? `${slab.maxStations} स्टेशन तक` : `Up to ${slab.maxStations}`;
}

export default function FareTableCard({ theme, data, language = "EN" }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("weekday");
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const slabs =
    activeTab === "weekday" ? data.weekdaySlabs : data.sundaySlabs;

  useEffect(() => {
    // Slide the indicator
    Animated.spring(indicatorAnim, {
      toValue: activeTab === "weekday" ? 0 : 1,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start();

    // Fade table content in
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);

  const handleTabSwitch = (tab: Tab) => {
    if (tab === activeTab) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      {/* ─── Header ─── */}
      <View style={styles.headerRow}>
        <View
          style={[styles.iconCircle, { backgroundColor: theme.brand + "18" }]}
        >
          <Ionicons name="cash-outline" size={18} color={theme.brand} />
        </View>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          {language === "HI" ? "डीएमआरसी किराया चार्ट" : "DMRC Fare Chart"}
        </Text>
      </View>

      {/* ─── Toggle Tabs ─── */}
      <View
        style={[
          styles.toggleContainer,
          { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
        ]}
      >
        <Animated.View
          style={[
            styles.toggleIndicator,
            {
              backgroundColor: theme.brand,
              left: indicatorAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["2%", "50%"],
              }),
            },
          ]}
        />
        <Pressable
          style={styles.toggleTab}
          onPress={() => handleTabSwitch("weekday")}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "weekday" }}
        >
          <Ionicons
            name="briefcase-outline"
            size={13}
            color={activeTab === "weekday" ? "#FFFFFF" : theme.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.toggleText,
              {
                color:
                  activeTab === "weekday" ? "#FFFFFF" : theme.textSecondary,
                fontWeight: activeTab === "weekday" ? "700" : "500",
              },
            ]}
          >
            {language === "HI" ? "कार्यदिवस" : "Weekday"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.toggleTab}
          onPress={() => handleTabSwitch("sunday")}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "sunday" }}
        >
          <Ionicons
            name="sunny-outline"
            size={13}
            color={activeTab === "sunday" ? "#FFFFFF" : theme.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.toggleText,
              {
                color:
                  activeTab === "sunday" ? "#FFFFFF" : theme.textSecondary,
                fontWeight: activeTab === "sunday" ? "700" : "500",
              },
            ]}
          >
            {language === "HI" ? "रविवार / अवकाश" : "Sunday / Holiday"}
          </Text>
        </Pressable>
      </View>

      {/* ─── Table ─── */}
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* Table Header */}
        <View
          style={[
            styles.tableHeaderRow,
            { backgroundColor: theme.brand, borderColor: theme.brand },
          ]}
        >
          <Text style={[styles.tableHeaderCell, styles.cellRange]}>
            {language === "HI" ? "स्टेशन सीमा" : "Station Range"}
          </Text>
          <Text style={[styles.tableHeaderCell, styles.cellFare]}>
            {language === "HI" ? "टोकन (₹)" : "Token (₹)"}
          </Text>
          <Text style={[styles.tableHeaderCell, styles.cellFare]}>
            {language === "HI" ? "स्मार्ट कार्ड (₹)" : "Smart Card (₹)"}
          </Text>
        </View>

        {/* Table Body */}
        {slabs.map((slab, index) => {
          const isEven = index % 2 === 0;
          const isLast = index === slabs.length - 1;
          return (
            <View
              key={`${activeTab}-${index}`}
              style={[
                styles.tableRow,
                {
                  backgroundColor: isEven ? theme.surface : theme.surfaceAlt,
                  borderBottomColor: theme.border,
                  borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                },
                isLast && styles.tableRowLast,
              ]}
            >
              <View style={[styles.cellRange, styles.cellBody]}>
                <Ionicons
                  name="train-outline"
                  size={12}
                  color={theme.brand}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[styles.cellText, { color: theme.textPrimary }]}
                >
                  {stationRangeLabel(slab, index, language)}
                </Text>
              </View>
              <View style={[styles.cellFare, styles.cellBody]}>
                <Text
                  style={[
                    styles.cellTextFare,
                    { color: theme.textPrimary },
                  ]}
                >
                  ₹{slab.token}
                </Text>
              </View>
              <View style={[styles.cellFare, styles.cellBody]}>
                <Text
                  style={[
                    styles.cellTextFare,
                    { color: theme.success },
                  ]}
                >
                  ₹{slab.smartCard}
                </Text>
              </View>
            </View>
          );
        })}
      </Animated.View>

      {/* ─── Tourist Cards ─── */}
      {data.touristCards.length > 0 && (
        <View style={styles.touristSection}>
          <View style={styles.sectionTitleRow}>
            <Ionicons
              name="card-outline"
              size={15}
              color={theme.brand}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[styles.sectionTitle, { color: theme.textPrimary }]}
            >
              {language === "HI" ? "पर्यटक कार्ड" : "Tourist Cards"}
            </Text>
          </View>
          {data.touristCards.map((card, index) => (
            <View
              key={card.name}
              style={[
                styles.touristCard,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.touristHeader}>
                <View style={styles.touristNameRow}>
                  <View
                    style={[
                      styles.touristBadge,
                      { backgroundColor: theme.brand + "18" },
                    ]}
                  >
                    <Ionicons
                      name="airplane-outline"
                      size={12}
                      color={theme.brand}
                    />
                  </View>
                  <Text
                    style={[
                      styles.touristName,
                      { color: theme.textPrimary },
                    ]}
                  >
                    {card.name}
                  </Text>
                </View>
                <View
                  style={[
                    styles.priceBadge,
                    { backgroundColor: theme.brand },
                  ]}
                >
                  <Text style={styles.priceText}>₹{card.price}</Text>
                </View>
              </View>
              <Text
                style={[
                  styles.touristDesc,
                  { color: theme.textSecondary },
                ]}
              >
                {card.description}
              </Text>
              <View style={styles.validityRow}>
                <Ionicons
                  name="time-outline"
                  size={11}
                  color={theme.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.validityText,
                    { color: theme.textSecondary },
                  ]}
                >
                  {language === "HI" ? `वैधता: ${card.validity}` : `Valid for ${card.validity}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ─── Footer Note ─── */}
      <View
        style={[
          styles.noteContainer,
          { backgroundColor: theme.infoBg, borderColor: theme.info + "30" },
        ]}
      >
        <Ionicons
          name="information-circle-outline"
          size={14}
          color={theme.info}
          style={{ marginRight: 6, marginTop: 1 }}
        />
        <Text style={[styles.noteText, { color: theme.textSecondary }]}>
          {language === "HI"
            ? "स्मार्ट कार्ड पर 10% की छूट मिलती है। डीएमआरसी ऐप के माध्यम से सटीक किराए की पुष्टि करें।"
            : "Smart card gets 10% discount. Confirm exact fares via DMRC app."}
        </Text>
      </View>
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

  /* Header */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  /* Toggle */
  toggleContainer: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    position: "relative",
    height: 38,
    overflow: "hidden",
  },
  toggleIndicator: {
    position: "absolute",
    top: 3,
    bottom: 3,
    width: "47%",
    borderRadius: 8,
    zIndex: 0,
  },
  toggleTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  toggleText: {
    fontSize: 12.5,
  },

  /* Table */
  tableHeaderRow: {
    flexDirection: "row",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  tableHeaderCell: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  tableRowLast: {
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  cellRange: {
    flex: 2,
  },
  cellFare: {
    flex: 1,
    alignItems: "center" as const,
  },
  cellBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: {
    fontSize: 13,
    fontWeight: "500",
  },
  cellTextFare: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  /* Tourist Cards */
  touristSection: {
    marginTop: 14,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  touristCard: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 8,
  },
  touristHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  touristNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  touristBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  touristName: {
    fontSize: 13,
    fontWeight: "700",
  },
  priceBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priceText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  touristDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 32,
  },
  validityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 32,
    marginTop: 4,
  },
  validityText: {
    fontSize: 11,
    fontWeight: "500",
  },

  /* Note */
  noteContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  noteText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
});
