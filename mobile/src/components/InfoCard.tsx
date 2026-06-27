import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../theme/theme";

export interface InfoItem {
  label: string;
  detail: string;
  highlight?: boolean;
}

export interface InfoSection {
  title: string;
  icon?: string;
  items: InfoItem[];
}

export interface InfoCardData {
  title: string;
  icon: string;
  accentColor?: string;
  sections: InfoSection[];
  footer?: string;
}

interface Props {
  theme: Theme;
  data: InfoCardData;
  language?: "EN" | "HI";
}

function SectionBlock({
  section,
  theme,
  accent,
  isLast,
}: {
  section: InfoSection;
  theme: Theme;
  accent: string;
  isLast: boolean;
}) {
  return (
    <View
      style={[
        styles.section,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}
    >
      {/* Section title */}
      <View style={styles.sectionHeader}>
        {section.icon && (
          <Ionicons
            name={section.icon as keyof typeof Ionicons.glyphMap}
            size={15}
            color={accent}
            style={styles.sectionIcon}
          />
        )}
        <Text style={[styles.sectionTitle, { color: accent }]}>{section.title}</Text>
      </View>

      {/* Items */}
      {section.items.map((item, idx) => (
        <View
          key={`${item.label}-${idx}`}
          style={[
            styles.itemRow,
            idx < section.items.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.border,
            },
          ]}
        >
          {item.highlight ? (
            <View style={[styles.badge, { backgroundColor: accent + "18" }]}>
              <Text style={[styles.badgeText, { color: accent }]}>{item.label}</Text>
            </View>
          ) : (
            <Text style={[styles.itemLabel, { color: theme.textPrimary }]}>{item.label}</Text>
          )}
          <Text
            style={[
              styles.itemDetail,
              { color: item.highlight ? theme.textPrimary : theme.textSecondary },
              item.highlight && styles.itemDetailHighlight,
            ]}
          >
            {item.detail}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function InfoCard({ theme, data }: Props) {
  const accent = data.accentColor ?? theme.brand;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons
          name={data.icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={accent}
          style={styles.headerIcon}
        />
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{data.title}</Text>
      </View>

      {/* Sections */}
      {data.sections.map((section, idx) => (
        <SectionBlock
          key={`${section.title}-${idx}`}
          section={section}
          theme={theme}
          accent={accent}
          isLast={idx === data.sections.length - 1}
        />
      ))}

      {/* Footer */}
      {data.footer ? (
        <Text style={[styles.footer, { color: theme.textSecondary }]}>{data.footer}</Text>
      ) : null}
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

  /* ── Header ─────────────────────────────────────── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
  },

  /* ── Section ────────────────────────────────────── */
  section: {
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionIcon: {
    marginRight: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  /* ── Item rows ──────────────────────────────────── */
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 7,
    gap: 12,
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 0,
  },
  itemDetail: {
    fontSize: 13,
    textAlign: "right",
    flexShrink: 1,
  },
  itemDetailHighlight: {
    fontWeight: "600",
  },

  /* ── Badge (highlighted label) ──────────────────── */
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },

  /* ── Footer ─────────────────────────────────────── */
  footer: {
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 8,
    lineHeight: 16,
  },
});
