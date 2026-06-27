import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  Share,
  Modal,
  TextInput,
  Text,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Speech from "expo-speech";
import * as Clipboard from "expo-clipboard";

import { lightTheme, darkTheme } from "./src/theme/theme";
import Header from "./src/components/Header";
import ChatBubble from "./src/components/ChatBubble";
import TypingIndicator from "./src/components/TypingIndicator";
import QuickReplyChips from "./src/components/QuickReplyChips";
import InputBar from "./src/components/InputBar";
import CardRenderer from "./src/components/CardRenderer";
import StationSuggestions from "./src/components/StationSuggestions";
import ServiceMenu from "./src/components/ServiceMenu";
import AdminPanel from "./src/components/AdminPanel";
import { getChatReply, ChatCard, PendingClarification } from "./src/lib/chatEngine";
import { autocompleteFromInput } from "./src/lib/stationSearch";
import { PhysicalStation } from "./src/lib/data";

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  timestamp: number;
  card?: ChatCard;
}

const WELCOME: Message = {
  id: "welcome",
  role: "bot",
  text:
    "Hi! I'm the DMRC Assistant 🚇\n\nI can help you with routes, fares, timings, station gates, emergency contacts, metro map, and much more.\n\nTap the ⊞ menu button below or ask me anything!",
  timestamp: Date.now(),
};

const DEFAULT_QUICK_REPLIES = [
  "🗺️ Plan a route",
  "💰 Check fare",
  "💳 Smart card",
  "🕐 Train timings",
  "🆘 Emergency SOS",
  "❓ Help & FAQ",
  "🗺️ Metro map",
];

const DEFAULT_QUICK_REPLIES_HI = [
  "🗺️ रूट प्लानर",
  "💰 किराया जांचें",
  "💳 स्मार्ट कार्ड",
  "🕐 ट्रेन समय",
  "🆘 आपातकालीन SOS",
  "❓ सहायता एवं FAQ",
  "🗺️ मेट्रो मैप",
];

let idCounter = 1;
function nextId() {
  idCounter += 1;
  return `m${idCounter}`;
}

function AppInner() {
  const [isDark, setIsDark] = useState(false);
  const [language, setLanguage] = useState<"EN" | "HI">("EN");
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>(DEFAULT_QUICK_REPLIES);
  const [micActive, setMicActive] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [adminVisible, setAdminVisible] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const listRef = useRef<FlatList>(null);
  const prevMessagesLength = useRef(messages.length);
  const prevIsTyping = useRef(isTyping);
  
  // Tracks the bot's last clarifying question, if any
  const pendingRef = useRef<PendingClarification | undefined>(undefined);

  // Wave height anim values for 4 wave bars
  const wave1 = useRef(new Animated.Value(1)).current;
  const wave2 = useRef(new Animated.Value(1)).current;
  const wave3 = useRef(new Animated.Value(1)).current;
  const wave4 = useRef(new Animated.Value(1)).current;

  // Staggered wave loops when listening
  useEffect(() => {
    if (voiceModalVisible) {
      const animateWave = (anim: Animated.Value, delay: number) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 2.8, duration: 400, useNativeDriver: false }),
            Animated.timing(anim, { toValue: 1.0, duration: 450, useNativeDriver: false }),
            Animated.timing(anim, { toValue: 1.8, duration: 350, useNativeDriver: false }),
            Animated.timing(anim, { toValue: 1.0, duration: 400, useNativeDriver: false }),
          ])
        ).start();
      };
      animateWave(wave1, 0);
      animateWave(wave2, 120);
      animateWave(wave3, 240);
      animateWave(wave4, 360);
    } else {
      wave1.setValue(1);
      wave2.setValue(1);
      wave3.setValue(1);
      wave4.setValue(1);
    }
  }, [voiceModalVisible]);

  // Translate quick replies if they are displaying the default suggestions
  useEffect(() => {
    const isDefaultEn = quickReplies.every((r) => DEFAULT_QUICK_REPLIES.includes(r));
    const isDefaultHi = quickReplies.every((r) => DEFAULT_QUICK_REPLIES_HI.includes(r));
    if (isDefaultEn || isDefaultHi) {
      setQuickReplies(language === "HI" ? DEFAULT_QUICK_REPLIES_HI : DEFAULT_QUICK_REPLIES);
    }
  }, [language]);

  const theme = isDark ? darkTheme : lightTheme;

  const autocomplete = input.trim().length >= 2 ? autocompleteFromInput(input, 5) : null;

  const handleSuggestionSelect = useCallback(
    (station: PhysicalStation) => {
      if (!autocomplete || autocomplete.matchedWordCount === 0) return;
      const words = input.trim().split(/\s+/).filter(Boolean);
      const kept = words.slice(0, words.length - autocomplete.matchedWordCount);
      const completed = [...kept, station.name].join(" ") + " ";
      setInput(completed);
    },
    [input, autocomplete]
  );

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (messages.length !== prevMessagesLength.current || isTyping !== prevIsTyping.current) {
      prevMessagesLength.current = messages.length;
      prevIsTyping.current = isTyping;
      scrollToEnd();
    }
  }, [messages.length, isTyping, scrollToEnd]);

  const sendMessage = useCallback(
    (text: string) => {
      // Strip emoji prefixes from quick reply chips
      const cleaned = text.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]+\s*/u, "").trim();
      if (!cleaned) return;

      const userMsg: Message = { id: nextId(), role: "user", text: cleaned, timestamp: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);
      scrollToEnd();

      setTimeout(() => {
        const reply = getChatReply(cleaned, pendingRef.current, language);
        pendingRef.current = reply.pending;
        const botMsg: Message = {
          id: nextId(),
          role: "bot",
          text: reply.text,
          timestamp: Date.now(),
          card: reply.card,
        };
        setMessages((prev) => [...prev, botMsg]);
        setQuickReplies(reply.quickReplies ?? []);
        setIsTyping(false);
        scrollToEnd();
      }, 350);
    },
    [scrollToEnd, language]
  );

  const handleSpeak = useCallback((text: string) => {
    Speech.speak(text, { language: "en-IN", rate: 0.95 });
  }, []);

  const handleCopy = useCallback(async (text: string) => {
    await Clipboard.setStringAsync(text);
  }, []);

  const handleShare = useCallback(async (text: string) => {
    try {
      await Share.share({ message: text });
    } catch {
      // user cancelled or share unavailable - no-op
    }
  }, []);

  const handleMicPress = useCallback(() => {
    setMicActive(true);
    setVoiceModalVisible(true);
  }, []);

  const simulateVoiceInput = (text: string) => {
    setVoiceModalVisible(false);
    setMicActive(false);

    // Typewrite the query character by character for a high-fidelity visual STT effect
    let currentText = "";
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        currentText += text[i];
        setInput(currentText);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          sendMessage(text);
        }, 200);
      }
    }, 35);
  };

  const handleClear = useCallback(() => {
    setMessages([{ ...WELCOME, id: nextId(), timestamp: Date.now() }]);
    setQuickReplies(language === "HI" ? DEFAULT_QUICK_REPLIES_HI : DEFAULT_QUICK_REPLIES);
    pendingRef.current = undefined;
  }, [language]);

  const handleMenuSelect = useCallback(
    (message: string) => {
      sendMessage(message);
    },
    [sendMessage]
  );

  const handleHelp = useCallback(() => {
    sendMessage("Help");
  }, [sendMessage]);

  const handleCardQuickAction = useCallback(
    (message: string) => {
      sendMessage(message);
    },
    [sendMessage]
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]} edges={["left", "right", "bottom"]}>
      <StatusBar style="light" />
      <Header
        theme={theme}
        isDark={isDark}
        onToggleDark={() => setIsDark((d) => !d)}
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === "EN" ? "HI" : "EN"))}
        onClearChat={handleClear}
        onHelp={handleHelp}
        onAdminPress={() => {
          setPinInput("");
          setPinError(false);
          setPinModalVisible(true);
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View>
              <ChatBubble
                theme={theme}
                role={item.role}
                text={item.text}
                timestamp={item.timestamp}
                onCopy={() => handleCopy(item.text)}
                onSpeak={item.role === "bot" ? () => handleSpeak(item.text) : undefined}
              />
              {item.card && (
                <CardRenderer
                  theme={theme}
                  card={item.card}
                  onQuickAction={handleCardQuickAction}
                  language={language}
                />
              )}
            </View>
          )}
          ListFooterComponent={isTyping ? <TypingIndicator theme={theme} /> : null}
          onContentSizeChange={handleContentSizeChange}
        />
        {autocomplete && autocomplete.suggestions.length > 0 ? (
          <StationSuggestions theme={theme} stations={autocomplete.suggestions} onSelect={handleSuggestionSelect} />
        ) : (
          <QuickReplyChips theme={theme} items={quickReplies} onPress={sendMessage} />
        )}
        <InputBar
          theme={theme}
          value={input}
          onChangeText={setInput}
          onSend={() => sendMessage(input)}
          onMicPress={handleMicPress}
          onMenuPress={() => setMenuVisible(true)}
          micActive={micActive}
        />
      </KeyboardAvoidingView>
      <ServiceMenu
        theme={theme}
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onSelectItem={handleMenuSelect}
        language={language}
      />
      <AdminPanel
        theme={theme}
        visible={adminVisible}
        onClose={() => setAdminVisible(false)}
        messages={messages}
      />

      {/* PIN Verification Modal */}
      <Modal
        visible={pinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPinModalVisible(false)}
      >
        <View style={styles.pinOverlay}>
          <View style={[styles.pinDialog, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="lock-closed" size={32} color={theme.brand} style={{ marginBottom: 12 }} />
            <Text style={[styles.pinTitle, { color: theme.textPrimary }]}>Admin Verification</Text>
            <Text style={[styles.pinSubtitle, { color: theme.textSecondary }]}>
              Enter the 4-digit PIN to access admin tools:
            </Text>
            <TextInput
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={pinInput}
              onChangeText={(text) => {
                setPinInput(text);
                if (pinError) setPinError(false);
                if (text === "1234") {
                  setPinModalVisible(false);
                  setPinInput("");
                  setAdminVisible(true);
                } else if (text.length === 4) {
                  setTimeout(() => {
                    setPinError(true);
                    setPinInput("");
                  }, 100);
                }
              }}
              style={[
                styles.pinTextInput,
                {
                  color: theme.textPrimary,
                  borderColor: pinError ? theme.danger : theme.border,
                  backgroundColor: theme.menuItem,
                },
              ]}
              autoFocus
              placeholder="••••"
              placeholderTextColor={theme.textSecondary}
            />
            {pinError && (
              <Text style={[styles.pinErrorText, { color: theme.danger }]}>Incorrect PIN. Access Denied.</Text>
            )}
            <View style={styles.pinActions}>
              <TouchableOpacity
                onPress={() => {
                  setPinModalVisible(false);
                  setPinInput("");
                  setPinError(false);
                }}
                style={[styles.pinButton, { borderColor: theme.border }]}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (pinInput === "1234") {
                    setPinModalVisible(false);
                    setPinInput("");
                    setAdminVisible(true);
                  } else {
                    setPinError(true);
                    setPinInput("");
                  }
                }}
                style={[styles.pinButton, { backgroundColor: theme.brand, borderWidth: 0 }]}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>Unlock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Voice Dictation Simulator Modal */}
      <Modal
        visible={voiceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setVoiceModalVisible(false);
          setMicActive(false);
        }}
      >
        <View style={styles.voiceOverlay}>
          <View style={[styles.voiceDialog, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.voiceTitle, { color: theme.textPrimary }]}>
              {language === "HI" ? "बोलकर खोजें (सिम्युलेटर)" : "Voice Search Simulator"}
            </Text>
            <Text style={[styles.voiceSubtitle, { color: theme.textSecondary }]}>
              {language === "HI" ? "सुन रहा हूँ... कोई वाक्य चुनें:" : "Listening... Select a voice command to simulate:"}
            </Text>

            {/* Wave Visualizer */}
            <View style={styles.waveRow}>
              <Animated.View style={[styles.waveBar, { backgroundColor: theme.brand, height: Animated.multiply(14, wave1) }]} />
              <Animated.View style={[styles.waveBar, { backgroundColor: theme.brand, height: Animated.multiply(14, wave2) }]} />
              <Animated.View style={[styles.waveBar, { backgroundColor: theme.brand, height: Animated.multiply(14, wave3) }]} />
              <Animated.View style={[styles.waveBar, { backgroundColor: theme.brand, height: Animated.multiply(14, wave4) }]} />
            </View>

            <View style={styles.voiceSuggestionsContainer}>
              {(language === "HI"
                ? [
                    "Rajiv Chowk से Hauz Khas का किराया",
                    "Dwarka Sector 21 से पहली ट्रेन",
                    "Kashmere Gate के गेट",
                    "Noida Sector 62 का किराया",
                  ]
                : [
                    "Plan route from Rajiv Chowk to Hauz Khas",
                    "First train from Dwarka Sector 21",
                    "Exit gates at Kashmere Gate",
                    "Fares to Noida Sector 62",
                  ]
              ).map((cmd, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => simulateVoiceInput(cmd)}
                  style={[styles.voiceCmdBtn, { backgroundColor: theme.menuItem, borderColor: theme.border }]}
                >
                  <Ionicons name="mic-outline" size={14} color={theme.brand} style={{ marginRight: 8 }} />
                  <Text style={[styles.voiceCmdText, { color: theme.textPrimary }]}>{cmd}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => {
                setVoiceModalVisible(false);
                setMicActive(false);
              }}
              style={[styles.voiceCancelBtn, { borderColor: theme.border }]}
            >
              <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>
                {language === "HI" ? "रद्द करें" : "Cancel"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { paddingVertical: 10, flexGrow: 1 },
  pinOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  pinDialog: {
    width: 285,
    padding: 22,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  pinTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  pinSubtitle: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 16,
  },
  pinTextInput: {
    width: 140,
    height: 44,
    borderWidth: 1.5,
    borderRadius: 8,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 8,
    marginBottom: 12,
  },
  pinErrorText: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 12,
  },
  pinActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  pinButton: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  voiceDialog: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
  },
  voiceTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  voiceSubtitle: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
  },
  waveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    gap: 6,
    marginBottom: 20,
  },
  waveBar: {
    width: 6,
    borderRadius: 3,
  },
  voiceSuggestionsContainer: {
    width: "100%",
    gap: 8,
    marginBottom: 20,
  },
  voiceCmdBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  voiceCmdText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  voiceCancelBtn: {
    width: "100%",
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
