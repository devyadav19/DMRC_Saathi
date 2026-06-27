import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../theme/theme";

interface Props {
  theme: Theme;
  data: {
    numbers: { label: string; number: string; icon: string }[];
    instructions: string[];
  };
  language?: "EN" | "HI";
}

export default function EmergencyCard({ theme, data, language = "EN" }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.25,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulse]);

  const pulseOpacity = pulse.interpolate({
    inputRange: [1, 1.25],
    outputRange: [1, 0.55],
  });

  const handleCall = (number: string) => {
    const cleaned = number.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleaned}`);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.emergencyBg,
          borderColor: theme.emergency + "44",
        },
      ]}
    >
      {/* ── Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <Animated.View
          style={[
            styles.iconRing,
            {
              backgroundColor: theme.emergency + "18",
              transform: [{ scale: pulse }],
              opacity: pulseOpacity,
            },
          ]}
        >
          <Ionicons name="warning-outline" size={20} color={theme.emergency} />
        </Animated.View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.emergency }]}>
            {language === "HI" ? "आपातकालीन / SOS" : "Emergency / SOS"}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {language === "HI" ? "तुरंत कॉल करने के लिए किसी नंबर पर टैप करें" : "Tap a number to call immediately"}
          </Text>
        </View>
      </View>

      {/* ── Emergency Numbers ──────────────────────── */}
      <View
        style={[
          styles.numbersSection,
          { borderTopColor: theme.emergency + "22" },
        ]}
      >
        {data.numbers.map((entry, idx) => (
          <TouchableOpacity
            key={idx}
            activeOpacity={0.65}
            onPress={() => handleCall(entry.number)}
            style={[
              styles.numberRow,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
              idx < data.numbers.length - 1 && styles.numberRowSpacing,
            ]}
          >
            <View
              style={[
                styles.numberIconWrap,
                { backgroundColor: theme.emergency + "14" },
              ]}
            >
              <Ionicons
                name={(entry.icon as any) || "call-outline"}
                size={16}
                color={theme.emergency}
              />
            </View>

            <View style={styles.numberInfo}>
              <Text
                style={[styles.numberLabel, { color: theme.textPrimary }]}
                numberOfLines={1}
              >
                {entry.label}
              </Text>
              <Text
                style={[styles.numberValue, { color: theme.textSecondary }]}
              >
                {entry.number}
              </Text>
            </View>

            <View
              style={[
                styles.callBtn,
                { backgroundColor: theme.emergency },
              ]}
            >
              <Ionicons name="call" size={13} color="#FFFFFF" />
              <Text style={styles.callBtnText}>{language === "HI" ? "कॉल" : "Call"}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Instructions ───────────────────────────── */}
      {data.instructions.length > 0 && (
        <View
          style={[
            styles.instructionsSection,
            { borderTopColor: theme.emergency + "22" },
          ]}
        >
          <View style={styles.instructionsHeader}>
            <Ionicons
              name="shield-checkmark-outline"
              size={15}
              color={theme.emergency}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.instructionsTitle,
                { color: theme.textPrimary },
              ]}
            >
              {language === "HI" ? "आपातकाल में क्या करें" : "What to do in an emergency"}
            </Text>
          </View>

          {data.instructions.map((instruction, idx) => {
            const isDanger = instruction.toUpperCase().startsWith("DO NOT") || instruction.includes("न कूदें");
            return (
              <View key={idx} style={styles.bulletRow}>
                <View
                  style={[
                    styles.bulletDot,
                    {
                      backgroundColor: isDanger
                        ? theme.emergency
                        : theme.emergency + "88",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.bulletText,
                    {
                      color: isDanger ? theme.emergency : theme.textPrimary,
                      fontWeight: isDanger ? "700" : "400",
                    },
                  ]}
                >
                  {instruction}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Footer ─────────────────────────────────── */}
      <Text style={[styles.footer, { color: theme.textSecondary }]}>
        {language === "HI" ? "शांत रहें · सहायता हमेशा उपलब्ध है" : "Stay calm · Help is always nearby"}
      </Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },

  /* Numbers */
  numbersSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  numberRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  numberRowSpacing: {
    marginBottom: 6,
  },
  numberIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  numberInfo: {
    flex: 1,
  },
  numberLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  numberValue: {
    fontSize: 12,
    marginTop: 1,
  },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  callBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  /* Instructions */
  instructionsSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 12,
  },
  instructionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  instructionsTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 5,
    marginRight: 8,
  },
  bulletText: {
    fontSize: 12.5,
    lineHeight: 17,
    flex: 1,
  },

  /* Footer */
  footer: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 12,
    letterSpacing: 0.4,
  },
});
