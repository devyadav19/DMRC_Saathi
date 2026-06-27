import React, { useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  StatusBar,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../theme/theme";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  theme: Theme;
  visible: boolean;
  onClose: () => void;
  onSelectItem: (message: string) => void;
  language?: "EN" | "HI";
}

interface ServiceItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const SERVICES: ServiceItem[] = [
  { icon: "map-outline", label: "Route Planner", message: "Plan a route" },
  { icon: "cash-outline", label: "Fare Calculator", message: "Show fare table" },
  { icon: "time-outline", label: "Train Timings", message: "Train timings" },
  { icon: "exit-outline", label: "Station Gates", message: "Station gates" },
  { icon: "warning-outline", label: "Emergency SOS", message: "Emergency SOS" },
  { icon: "help-circle-outline", label: "Help & FAQ", message: "Help" },
  { icon: "globe-outline", label: "Metro Map", message: "Metro map" },
  { icon: "card-outline", label: "Smart Card", message: "Smart card" },
  { icon: "bus-outline", label: "Feeder Bus", message: "Feeder bus" },
  { icon: "female-outline", label: "Women's Coach", message: "Women coach" },
  { icon: "call-outline", label: "Customer Support", message: "Customer support" },
  { icon: "alert-circle-outline", label: "Penalty & Fines", message: "Penalty and fines" },
  { icon: "card-outline", label: "Tourist Card", message: "Tourist card" },
  { icon: "car-outline", label: "Parking Info", message: "Parking info" },
  { icon: "megaphone-outline", label: "Notices", message: "Metro notices" },
  { icon: "pulse-outline", label: "Line Status", message: "Line status" },
];

const TRANSLATIONS: Record<"EN" | "HI", Record<string, string>> = {
  EN: {
    "Route Planner": "Route Planner",
    "Fare Calculator": "Fare Calculator",
    "Train Timings": "Train Timings",
    "Station Gates": "Station Gates",
    "Emergency SOS": "Emergency SOS",
    "Help & FAQ": "Help & FAQ",
    "Metro Map": "Metro Map",
    "Smart Card": "Smart Card",
    "Feeder Bus": "Feeder Bus",
    "Women's Coach": "Women's Coach",
    "Customer Support": "Customer Support",
    "Penalty & Fines": "Penalty & Fines",
    "Tourist Card": "Tourist Card",
    "Parking Info": "Parking Info",
    "Notices": "Notices",
    "Line Status": "Line Status",
  },
  HI: {
    "Route Planner": "रूट प्लानर",
    "Fare Calculator": "किराया तालिका",
    "Train Timings": "ट्रेन समय",
    "Station Gates": "स्टेशन गेट",
    "Emergency SOS": "आपातकालीन SOS",
    "Help & FAQ": "सहायता एवं FAQ",
    "Metro Map": "मेट्रो मैप",
    "Smart Card": "स्मार्ट कार्ड",
    "Feeder Bus": "फीडर बस",
    "Women's Coach": "महिला कोच",
    "Customer Support": "ग्राहक सहायता",
    "Penalty & Fines": "जुर्माना और चालान",
    "Tourist Card": "पर्यटक कार्ड",
    "Parking Info": "पार्किंग की जानकारी",
    "Notices": "सूचनाएं",
    "Line Status": "लाइन स्टेटस",
  },
};

const COLUMNS = 3;
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.68;
const ANIM_DURATION = 320;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ServiceMenu({ theme, visible, onClose, onSelectItem, language = "EN" }: Props) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Track mount state so we can skip the exit animation on first render
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
          damping: 20,
          stiffness: 200,
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

  const handleSelect = useCallback(
    (message: string) => {
      onSelectItem(message);
      onClose();
    },
    [onSelectItem, onClose],
  );

  // Render nothing until we've been opened at least once
  if (!visible && !hasOpened.current) return null;

  const isEmergency = (label: string) => label === "Emergency SOS";

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
            <Ionicons name="grid" size={18} color={theme.brand} style={{ marginRight: 8 }} />
            <Text style={[styles.titleText, { color: theme.textPrimary }]}>
              {language === "HI" ? "डीएमआरसी सेवाएं" : "DMRC Services"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.closeButton,
              {
                backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
              },
            ]}
            accessibilityLabel="Close services menu"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {/* Service grid wrapped in ScrollView */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <View style={styles.grid}>
            {SERVICES.map((item) => (
              <ServiceTile
                key={item.label}
                item={item}
                theme={theme}
                isEmergency={isEmergency(item.label)}
                onPress={handleSelect}
                language={language}
              />
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Grid tile                                                          */
/* ------------------------------------------------------------------ */

function ServiceTile({
  item,
  theme,
  isEmergency: emergency,
  onPress,
  language = "EN",
}: {
  item: ServiceItem;
  theme: Theme;
  isEmergency: boolean;
  onPress: (message: string) => void;
  language?: "EN" | "HI";
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      damping: 15,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      damping: 12,
      stiffness: 250,
      useNativeDriver: true,
    }).start();
  };

  const iconBg = emergency
    ? theme.emergencyBg
    : theme.menuItem;

  const iconColor = emergency
    ? theme.emergency
    : theme.menuItemIcon;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => onPress(item.message)}
      style={styles.tileOuter}
      accessibilityLabel={item.label}
      accessibilityRole="button"
    >
      <Animated.View
        style={[
          styles.tile,
          {
            backgroundColor: theme.menuItem,
            borderColor: emergency ? theme.emergency + "30" : theme.border,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
          <Ionicons name={item.icon} size={22} color={iconColor} />
        </View>
        <Text
          style={[
            styles.tileLabel,
            { color: emergency ? theme.emergency : theme.menuItemText },
          ]}
          numberOfLines={2}
        >
          {TRANSLATIONS[language][item.label] || item.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

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
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
    paddingTop: 14,
  },
  tileOuter: {
    width: `${100 / COLUMNS}%` as unknown as number,
    paddingHorizontal: 5,
    paddingVertical: 6,
  },
  tile: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  tileLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 15,
  },
});
