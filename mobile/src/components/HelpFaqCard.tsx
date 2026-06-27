import React, { useCallback, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../theme/theme";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FaqItem {
  q: string;
  a: string;
}

interface FaqSection {
  title: string;
  icon: string;
  items: FaqItem[];
}

interface Props {
  theme: Theme;
  data: {
    sections: FaqSection[];
  };
  onQuickAction?: (message: string) => void;
  language?: "EN" | "HI";
}

/* ------------------------------------------------------------------ */
/*  Enable LayoutAnimation on Android                                  */
/* ------------------------------------------------------------------ */

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ------------------------------------------------------------------ */
/*  Quick-action definitions                                           */
/* ------------------------------------------------------------------ */

const QUICK_ACTIONS: { labelEN: string; labelHI: string; icon: keyof typeof Ionicons.glyphMap; messageEN: string; messageHI: string }[] = [
  { labelEN: "Plan Route", labelHI: "रूट प्लानर", icon: "map-outline", messageEN: "Plan Route", messageHI: "रूट प्लानर" },
  { labelEN: "Check Fare", labelHI: "किराया जांचें", icon: "cash-outline", messageEN: "Check Fare", messageHI: "किराया जांचें" },
  { labelEN: "Train Timings", labelHI: "ट्रेन समय", icon: "time-outline", messageEN: "Train Timings", messageHI: "ट्रेन समय" },
  { labelEN: "Emergency SOS", labelHI: "आपातकालीन संपर्क", icon: "warning-outline", messageEN: "Emergency SOS", messageHI: "आपातकालीन संपर्क" },
];

/* ------------------------------------------------------------------ */
/*  Animated Section Header                                            */
/* ------------------------------------------------------------------ */

function SectionHeader({
  section,
  expanded,
  onToggle,
  theme,
}: {
  section: FaqSection;
  expanded: boolean;
  onToggle: () => void;
  theme: Theme;
}) {
  const [spin] = useState(() => new Animated.Value(expanded ? 1 : 0));

  React.useEffect(() => {
    Animated.timing(spin, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [expanded, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.sectionHeader,
        {
          backgroundColor: expanded ? theme.infoBg : theme.surfaceAlt,
          borderColor: expanded ? theme.info + "44" : theme.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${section.title}, ${expanded ? "collapse" : "expand"}`}
    >
      <View style={styles.sectionHeaderLeft}>
        <Ionicons
          name={section.icon as keyof typeof Ionicons.glyphMap}
          size={18}
          color={expanded ? theme.info : theme.textSecondary}
          style={{ marginRight: 10 }}
        />
        <Text
          style={[
            styles.sectionTitle,
            { color: expanded ? theme.info : theme.textPrimary },
          ]}
        >
          {section.title}
        </Text>
      </View>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons
          name="chevron-down"
          size={16}
          color={expanded ? theme.info : theme.textSecondary}
        />
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQ Item                                                           */
/* ------------------------------------------------------------------ */

function FaqItemRow({ item, theme, isLast }: { item: FaqItem; theme: Theme; isLast: boolean }) {
  return (
    <View
      style={[
        styles.faqItem,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}
    >
      <View style={styles.faqQuestion}>
        <Ionicons
          name="help-circle"
          size={15}
          color={theme.info}
          style={{ marginRight: 8, marginTop: 1 }}
        />
        <Text style={[styles.faqQuestionText, { color: theme.textPrimary }]}>
          {item.q}
        </Text>
      </View>
      <Text style={[styles.faqAnswerText, { color: theme.textSecondary }]}>
        {item.a}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function HelpFaqCard({ theme, data, onQuickAction, language = "EN" }: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = useCallback((index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  }, []);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* ---- Header ---- */}
      <View style={styles.headerRow}>
        <View style={[styles.headerIconWrap, { backgroundColor: theme.infoBg }]}>
          <Ionicons name="help-circle-outline" size={20} color={theme.info} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            {language === "HI" ? "सहायता और अक्सर पूछे जाने वाले प्रश्न" : "Help & FAQ"}
          </Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            {language === "HI" ? "सामान्य प्रश्नों के उत्तर खोजें" : "Find answers to common questions"}
          </Text>
        </View>
      </View>

      {/* ---- Divider ---- */}
      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* ---- Sections ---- */}
      <View style={styles.sectionsWrap}>
        {data.sections.map((section, idx) => {
          const isOpen = !!expanded[idx];
          return (
            <View key={idx}>
              <SectionHeader
                section={section}
                expanded={isOpen}
                onToggle={() => toggle(idx)}
                theme={theme}
              />
              {isOpen && (
                <View
                  style={[
                    styles.faqList,
                    { backgroundColor: theme.infoBg, borderColor: theme.info + "22" },
                  ]}
                >
                  {section.items.map((item, i) => (
                    <FaqItemRow
                      key={i}
                      item={item}
                      theme={theme}
                      isLast={i === section.items.length - 1}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* ---- Divider ---- */}
      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* ---- Quick actions ---- */}
      <Text style={[styles.quickLabel, { color: theme.textSecondary }]}>
        {language === "HI" ? "त्वरित कार्रवाई" : "Quick Actions"}
      </Text>
      <View style={styles.chipsRow}>
        {QUICK_ACTIONS.map((action) => {
          const isDanger = action.messageEN === "Emergency SOS";
          const labelText = language === "HI" ? action.labelHI : action.labelEN;
          const messageText = language === "HI" ? action.messageHI : action.messageEN;
          return (
            <Pressable
              key={action.labelEN}
              onPress={() => onQuickAction?.(messageText)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isDanger ? theme.emergencyBg : theme.chip,
                  borderColor: isDanger ? theme.emergency + "44" : theme.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={labelText}
            >
              <Ionicons
                name={action.icon}
                size={14}
                color={isDanger ? theme.emergency : theme.chipText}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.chipLabel,
                  { color: isDanger ? theme.emergency : theme.chipText },
                ]}
              >
                {labelText}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

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
    marginBottom: 10,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerTitle: { fontSize: 15, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 1 },

  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10 },

  /* Sections */
  sectionsWrap: { gap: 8 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  sectionTitle: { fontSize: 13, fontWeight: "600" },

  /* FAQ items */
  faqList: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  faqItem: {
    paddingVertical: 10,
  },
  faqQuestion: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  faqQuestionText: { fontSize: 13, fontWeight: "600", flex: 1 },
  faqAnswerText: { fontSize: 12.5, lineHeight: 18, marginLeft: 23 },

  /* Quick actions */
  quickLabel: { fontSize: 11, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: { fontSize: 12, fontWeight: "600" },
});
