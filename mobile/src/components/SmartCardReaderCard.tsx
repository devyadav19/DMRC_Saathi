import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../theme/theme";

interface Props {
  theme: Theme;
  language?: "EN" | "HI";
}

interface SmartCardData {
  cardId: string;
  userName: string;
  cardNickname: string;
  balance: number;
  history: {
    label: string;
    time: string;
    amount: number; // positive for credit, negative for debit
  }[];
}

type PanelState =
  | "loading"
  | "register_name"
  | "nfc_scan_name"
  | "input"
  | "scanning"
  | "checking"
  | "active"
  | "recharging"
  | "paying"
  | "success";

export default function SmartCardReaderCard({ theme, language = "EN" }: Props) {
  const [cards, setCards] = useState<SmartCardData[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const [panelState, setPanelState] = useState<PanelState>("loading");
  const [cardNumberInput, setCardNumberInput] = useState("");
  const [userNameInput, setUserNameInput] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [rechargeAmt, setRechargeAmt] = useState(200);
  const [selectedUpi, setSelectedUpi] = useState<"gpay" | "phonepe" | "paytm" | "bhim">("gpay");
  const [activeSubTab, setActiveSubTab] = useState<"history" | "recharge">("history");
  
  const [nfcScannedId, setNfcScannedId] = useState("");
  const [nfcScannedBal, setNfcScannedBal] = useState(200);

  const [selectorExpanded, setSelectorExpanded] = useState(false);
  const [error, setError] = useState("");

  const rippleAnim = useRef(new Animated.Value(0)).current;

  // Load cards from AsyncStorage database on mount
  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      const stored = await AsyncStorage.getItem("@dmrc_smart_cards");
      const activeId = await AsyncStorage.getItem("@dmrc_active_card_id");
      if (stored) {
        const parsed: SmartCardData[] = JSON.parse(stored);
        setCards(parsed);
        if (parsed.length > 0) {
          const defaultActive = activeId && parsed.some((c) => c.cardId === activeId)
            ? activeId
            : parsed[0].cardId;
          setActiveCardId(defaultActive);
          setPanelState("active");
          return;
        }
      }
      setPanelState("register_name");
    } catch (e) {
      console.warn("Failed to load cards:", e);
      setPanelState("register_name");
    }
  };

  const handleRegisterName = async () => {
    if (!userNameInput.trim()) {
      setError(language === "HI" ? "कृपया अपना नाम दर्ज करें।" : "Please enter your name.");
      return;
    }
    setError("");
    const generatedId = String(18290000 + Math.floor(Math.random() * 9000));
    const newCard: SmartCardData = {
      cardId: generatedId,
      userName: userNameInput.trim(),
      cardNickname: language === "HI" ? `${userNameInput.trim()} का कार्ड` : `${userNameInput.trim()}'s Card`,
      balance: 200,
      history: [
        {
          label: language === "HI" ? "प्रारंभिक शेष (जारी)" : "Initial Balance (Issued)",
          time: language === "HI" ? "आज, सुबह 10:00" : "Today, 10:00 AM",
          amount: 200,
        },
      ],
    };
    const updated = [...cards, newCard];
    setCards(updated);
    setActiveCardId(generatedId);
    setUserNameInput("");
    setPanelState("active");
    await AsyncStorage.setItem("@dmrc_smart_cards", JSON.stringify(updated));
    await AsyncStorage.setItem("@dmrc_active_card_id", generatedId);
  };

  const startNfcScan = () => {
    setPanelState("scanning");
    rippleAnim.setValue(0);
    Animated.loop(
      Animated.timing(rippleAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    ).start();

    setTimeout(() => {
      const mockId = String(18290000 + Math.floor(Math.random() * 9000));
      const mockBal = 150 + Math.floor(Math.random() * 11) * 50; // ₹150 - ₹700
      setNfcScannedId(mockId);
      setNfcScannedBal(mockBal);
      setNicknameInput(language === "HI" ? "स्कैन किया गया कार्ड" : "Scanned Card");
      setPanelState("nfc_scan_name");
    }, 2400);
  };

  const handleSaveNfcCard = async () => {
    if (!nicknameInput.trim()) {
      setError(language === "HI" ? "कृपया एक उपनाम दर्ज करें।" : "Please enter a nickname.");
      return;
    }
    setError("");
    const newCard: SmartCardData = {
      cardId: nfcScannedId,
      userName: language === "HI" ? "एनएफसी यात्री" : "NFC PASSENGER",
      cardNickname: nicknameInput.trim(),
      balance: nfcScannedBal,
      history: [
        {
          label: language === "HI" ? "NFC द्वारा स्कैन किया गया" : "Scanned via NFC",
          time: language === "HI" ? "आज, अभी" : "Today, Now",
          amount: nfcScannedBal,
        },
      ],
    };
    const updated = [...cards, newCard];
    setCards(updated);
    setActiveCardId(nfcScannedId);
    setNicknameInput("");
    setPanelState("active");
    await AsyncStorage.setItem("@dmrc_smart_cards", JSON.stringify(updated));
    await AsyncStorage.setItem("@dmrc_active_card_id", nfcScannedId);
  };

  const handleCheck = () => {
    if (cardNumberInput.trim().length < 8) {
      setError(language === "HI" ? "कृपया एक मान्य 8-अंकीय कार्ड नंबर दर्ज करें।" : "Please enter a valid 8-digit card number.");
      return;
    }
    setError("");
    setPanelState("checking");
    setTimeout(async () => {
      const existing = cards.find((c) => c.cardId === cardNumberInput);
      if (existing) {
        setActiveCardId(cardNumberInput);
        setPanelState("active");
        await AsyncStorage.setItem("@dmrc_active_card_id", cardNumberInput);
      } else {
        const newCard: SmartCardData = {
          cardId: cardNumberInput,
          userName: language === "HI" ? "अतिथि यात्री" : "Guest Passenger",
          cardNickname: language === "HI" ? `अतिथि कार्ड (${cardNumberInput.slice(-4)})` : `Guest Card (${cardNumberInput.slice(-4)})`,
          balance: 240,
          history: [
            {
              label: language === "HI" ? "कार्ड आयातित (सत्यापित)" : "Card Imported (Verified)",
              time: language === "HI" ? "आज, दोपहर 12:00" : "Today, 12:00 PM",
              amount: 240,
            },
          ],
        };
        const updated = [...cards, newCard];
        setCards(updated);
        setActiveCardId(cardNumberInput);
        setCardNumberInput("");
        setPanelState("active");
        await AsyncStorage.setItem("@dmrc_smart_cards", JSON.stringify(updated));
        await AsyncStorage.setItem("@dmrc_active_card_id", cardNumberInput);
      }
    }, 1200);
  };

  const handlePay = () => {
    setPanelState("paying");
    setTimeout(async () => {
      const updated = cards.map((c) => {
        if (c.cardId === activeCardId) {
          return {
            ...c,
            balance: c.balance + rechargeAmt,
            history: [
              {
                label: language === "HI" ? "UPI रिचार्ज (सफल)" : "UPI Recharge (Success)",
                time: language === "HI" ? "आज, अभी" : "Today, Now",
                amount: rechargeAmt,
              },
              ...c.history,
            ],
          };
        }
        return c;
      });
      setCards(updated);
      setPanelState("success");
      await AsyncStorage.setItem("@dmrc_smart_cards", JSON.stringify(updated));
    }, 1500);
  };

  const resetToActive = () => {
    setPanelState("active");
    setActiveSubTab("history");
  };

  const activeCard = cards.find((c) => c.cardId === activeCardId);
  const formattedCardNumber = activeCardId
    ? activeCardId.replace(/(.{4})(.{4})/, "$1-$2")
    : "XXXX-XXXX";

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* ── CARD HEADER ── */}
      <View style={styles.headerRow}>
        <Ionicons name="card" size={20} color={theme.brand} style={{ marginRight: 8 }} />
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          {language === "HI" ? "स्मार्ट कार्ड सेवाएं" : "Smart Card Services"}
        </Text>
      </View>

      {/* ── CARD SELECTOR ACCORDION ── */}
      {panelState === "active" && cards.length > 0 && (
        <View style={styles.selectorContainer}>
          <TouchableOpacity
            onPress={() => setSelectorExpanded(!selectorExpanded)}
            style={[styles.selectorBtn, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
            activeOpacity={0.8}
          >
            <Ionicons name="wallet-outline" size={14} color={theme.brand} style={{ marginRight: 6 }} />
            <Text style={[styles.selectorBtnText, { color: theme.textPrimary }]} numberOfLines={1}>
              {activeCard ? activeCard.cardNickname : (language === "HI" ? "कार्ड चुनें" : "Select Card")}
            </Text>
            <Ionicons name={selectorExpanded ? "chevron-up" : "chevron-down"} size={14} color={theme.textSecondary} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          {selectorExpanded && (
            <View style={[styles.selectorList, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              {cards.map((c) => (
                <TouchableOpacity
                  key={c.cardId}
                  onPress={async () => {
                    setActiveCardId(c.cardId);
                    setSelectorExpanded(false);
                    await AsyncStorage.setItem("@dmrc_active_card_id", c.cardId);
                  }}
                  style={[
                    styles.selectorItem,
                    { borderBottomColor: theme.border },
                    c.cardId === activeCardId && { backgroundColor: theme.brand + "15" },
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.selectorItemName, { color: theme.textPrimary }]}>{c.cardNickname}</Text>
                    <Text style={[styles.selectorItemId, { color: theme.textSecondary }]}>DMRC-{c.cardId.replace(/(.{4})(.{4})/, "$1-$2")}</Text>
                  </View>
                  <Text style={[styles.selectorItemBalance, { color: theme.brand }]}>₹{c.balance}</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                onPress={() => {
                  setSelectorExpanded(false);
                  setPanelState("register_name");
                }}
                style={[styles.selectorAddBtn, { borderTopColor: theme.border }]}
              >
                <Ionicons name="add-circle-outline" size={16} color={theme.brand} style={{ marginRight: 6 }} />
                <Text style={{ color: theme.brand, fontWeight: "600", fontSize: 13 }}>
                  {language === "HI" ? "नया कार्ड जोड़ें" : "Add New Card"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── VISUAL SMART CARD GRAPHIC ── */}
      {panelState !== "loading" && panelState !== "register_name" && (
        <View style={[styles.metroCardGraphic, { backgroundColor: theme.brandAlt }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLogoText}>{language === "HI" ? "दिल्ली मेट्रो" : "DELHI METRO"}</Text>
            <Ionicons name="wifi" size={16} color="#FFF" style={styles.contactlessIcon} />
          </View>
          <View style={styles.chipRow}>
            <View style={styles.smartChip} />
            {activeCard && (
              <Text style={styles.cardStatusText}>{language === "HI" ? "सक्रिय" : "ACTIVE"}</Text>
            )}
          </View>
          <Text style={styles.cardNumberText}>
            {panelState === "scanning" ? "DMRC-XXXX-XXXX" : `DMRC-${formattedCardNumber}`}
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardHolderLabel} numberOfLines={1}>
              {activeCard ? activeCard.userName.toUpperCase() : (language === "HI" ? "डीएमआरसी यात्री" : "DMRC PASSENGER")}
            </Text>
            {activeCard && panelState !== "scanning" ? (
              <View style={styles.balanceContainer}>
                <Text style={styles.cardBalanceLabel}>{language === "HI" ? "बैलेंस" : "BALANCE"}</Text>
                <Text style={styles.cardBalanceValue}>₹{activeCard.balance.toFixed(2)}</Text>
              </View>
            ) : (
              <Text style={styles.cardBrandLabel}>{language === "HI" ? "स्मार्ट कार्ड" : "SMART CARD"}</Text>
            )}
          </View>
        </View>
      )}

      {/* ── STATE: LOADING ── */}
      {panelState === "loading" && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.brand} />
        </View>
      )}

      {/* ── STATE: REGISTER NAME (FIRST CARD) ── */}
      {panelState === "register_name" && (
        <View style={styles.formContainer}>
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
            {language === "HI" ? "नया स्मार्ट कार्ड जारी करें। अपना नाम दर्ज करें:" : "Issue a new Smart Card. Enter your name:"}
          </Text>
          <TextInput
            value={userNameInput}
            onChangeText={(text) => {
              setUserNameInput(text);
              if (error) setError("");
            }}
            placeholder={language === "HI" ? "जैसे राहुल यादव" : "e.g. Rahul Yadav"}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              {
                borderColor: error ? theme.danger : theme.border,
                backgroundColor: theme.menuItem,
                color: theme.textPrimary,
              },
            ]}
          />
          {error.length > 0 && (
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          )}
          <View style={{ flexDirection: "row", gap: 10 }}>
            {cards.length > 0 && (
              <TouchableOpacity
                onPress={() => setPanelState("active")}
                style={[styles.btnOutline, { borderColor: theme.border, flex: 1 }]}
              >
                <Text style={[styles.btnOutlineText, { color: theme.textSecondary }]}>
                  {language === "HI" ? "रद्द करें" : "Cancel"}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleRegisterName} style={[styles.btn, { backgroundColor: theme.brand, flex: 1.5 }]}>
              <Text style={styles.btnText}>{language === "HI" ? "जारी करें" : "Issue Card"}</Text>
            </TouchableOpacity>
          </View>

          {cards.length === 0 && (
            <TouchableOpacity
              onPress={() => setPanelState("input")}
              style={[styles.btnOutline, { borderColor: theme.brand, marginTop: 12, flexDirection: "row", justifyContent: "center", alignItems: "center" }]}
            >
              <Ionicons name="key-outline" size={14} color={theme.brand} style={{ marginRight: 6 }} />
              <Text style={{ color: theme.brand, fontWeight: "600", fontSize: 13 }}>
                {language === "HI" ? "मौजूदा कार्ड नंबर दर्ज करें" : "Enter Existing Card Number"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── STATE: NFC SCAN NAME ── */}
      {panelState === "nfc_scan_name" && (
        <View style={styles.formContainer}>
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
            {language === "HI" ? "कार्ड सफलतापूर्वक स्कैन किया गया! इस कार्ड के लिए एक उपनाम दर्ज करें:" : "Card Scanned Successfully! Enter a nickname for this card:"}
          </Text>
          <TextInput
            value={nicknameInput}
            onChangeText={(text) => {
              setNicknameInput(text);
              if (error) setError("");
            }}
            placeholder={language === "HI" ? "जैसे मेरा ऑफिस कार्ड" : "e.g. My Office Card"}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              {
                borderColor: error ? theme.danger : theme.border,
                backgroundColor: theme.menuItem,
                color: theme.textPrimary,
              },
            ]}
          />
          {error.length > 0 && (
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          )}
          <TouchableOpacity onPress={handleSaveNfcCard} style={[styles.btn, { backgroundColor: theme.brand }]}>
            <Text style={styles.btnText}>{language === "HI" ? "कार्ड सहेजें" : "Save Card"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── STATE: INPUT (MANUAL ENTRY) ── */}
      {panelState === "input" && (
        <View style={styles.formContainer}>
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
            {language === "HI" ? "8-अंकों का कार्ड आईडी डालें:" : "Enter 8-digit Card ID:"}
          </Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={8}
            value={cardNumberInput}
            onChangeText={(text) => {
              setCardNumberInput(text.replace(/[^0-9]/g, ""));
              if (error) setError("");
            }}
            placeholder={language === "HI" ? "जैसे 18293740" : "e.g. 18293740"}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              {
                borderColor: error ? theme.danger : theme.border,
                backgroundColor: theme.menuItem,
                color: theme.textPrimary,
              },
            ]}
          />
          {error.length > 0 && (
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          )}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <TouchableOpacity onPress={handleCheck} style={[styles.btn, { backgroundColor: theme.brand, flex: 1.2 }]}>
              <Text style={styles.btnText}>{language === "HI" ? "सत्यापित करें" : "Verify & Check"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={startNfcScan} style={[styles.btnOutline, { borderColor: theme.brand, flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center" }]}>
              <Ionicons name="scan-outline" size={14} color={theme.brand} style={{ marginRight: 4 }} />
              <Text style={[styles.btnOutlineText, { color: theme.brand, fontSize: 11.5 }]}>
                {language === "HI" ? "NFC स्कैन" : "NFC Scan"}
              </Text>
            </TouchableOpacity>
          </View>
          {cards.length > 0 && (
            <TouchableOpacity
              onPress={() => setPanelState("active")}
              style={[styles.btnOutline, { borderColor: theme.border, marginTop: 10 }]}
            >
              <Text style={[styles.btnOutlineText, { color: theme.textSecondary }]}>
                {language === "HI" ? "पीछे" : "Back"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── STATE: SCANNING (NFC RIPPLES) ── */}
      {panelState === "scanning" && (
        <View style={styles.nfcOverlay}>
          <View style={styles.rippleContainer}>
            <Animated.View
              style={[
                styles.ripple,
                {
                  borderColor: theme.brand,
                  opacity: rippleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 0],
                  }),
                  transform: [
                    {
                      scale: rippleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 2.5],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.ripple,
                {
                  borderColor: theme.brand,
                  opacity: rippleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 0],
                  }),
                  transform: [
                    {
                      scale: rippleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1.2, 2.8],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View style={[styles.nfcIconCircle, { backgroundColor: theme.brand }]}>
              <Ionicons name="wifi" size={28} color="#FFF" style={{ transform: [{ rotate: "90deg" }] }} />
            </View>
          </View>
          <Text style={[styles.nfcTitle, { color: theme.textPrimary }]}>
            {language === "HI" ? "कार्ड स्कैन करने के लिए तैयार" : "Ready to Scan"}
          </Text>
          <Text style={[styles.nfcSubtitle, { color: theme.textSecondary }]}>
            {language === "HI"
              ? "स्मार्ट कार्ड को फोन के पिछले हिस्से के पास रखें"
              : "Hold your physical card near the top back of your device"}
          </Text>
          <TouchableOpacity
            onPress={() => setPanelState(cards.length > 0 ? "active" : "register_name")}
            style={[styles.btnOutline, { borderColor: theme.border, marginTop: 10, paddingHorizontal: 20 }]}
          >
            <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>
              {language === "HI" ? "रद्द करें" : "Cancel"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── STATE: CHECKING ── */}
      {panelState === "checking" && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.brand} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {language === "HI" ? "डीएमआरसी डेटाबेस की जांच की जा रही है..." : "Verifying secure DMRC database..."}
          </Text>
        </View>
      )}

      {/* ── STATE: ACTIVE CARD PANEL (TABS & DETAILS) ── */}
      {panelState === "active" && activeCard && (
        <View style={styles.dataContainer}>
          <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
            <TouchableOpacity
              onPress={() => setActiveSubTab("history")}
              style={[
                styles.tabButton,
                activeSubTab === "history" && { borderBottomColor: theme.brand },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeSubTab === "history" ? theme.brand : theme.textSecondary },
                ]}
              >
                {language === "HI" ? "इतिहास" : "History"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveSubTab("recharge")}
              style={[
                styles.tabButton,
                activeSubTab === "recharge" && { borderBottomColor: theme.brand },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeSubTab === "recharge" ? theme.brand : theme.textSecondary },
                ]}
              >
                {language === "HI" ? "त्वरित रिचार्ज" : "Quick Recharge"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sub-Tab Content: HISTORY */}
          {activeSubTab === "history" && (
            <View style={styles.historyList}>
              {activeCard.history.map((hist, index) => (
                <View key={index} style={[styles.historyItem, { borderBottomColor: index === activeCard.history.length - 1 ? "transparent" : theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.histLabel, { color: theme.textPrimary }]}>{hist.label}</Text>
                    <Text style={[styles.histTime, { color: theme.textSecondary }]}>{hist.time}</Text>
                  </View>
                  <Text style={[styles.histAmt, { color: hist.amount > 0 ? theme.success : theme.danger }]}>
                    {hist.amount > 0 ? "+" : "-"}₹{Math.abs(hist.amount).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Sub-Tab Content: RECHARGE */}
          {activeSubTab === "recharge" && (
            <View style={styles.rechargeForm}>
              <Text style={[styles.rechargeHeading, { color: theme.textSecondary }]}>
                {language === "HI" ? "राशि चुनें:" : "Select Amount:"}
              </Text>
              <View style={styles.amountPresets}>
                {[100, 200, 500].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => setRechargeAmt(amt)}
                    style={[
                      styles.presetBtn,
                      {
                        backgroundColor: rechargeAmt === amt ? theme.brand : theme.menuItem,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        { color: rechargeAmt === amt ? "#FFF" : theme.textPrimary },
                      ]}
                    >
                      ₹{amt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => setPanelState("recharging")}
                style={[styles.btn, { backgroundColor: theme.brand, marginTop: 12 }]}
              >
                <Text style={styles.btnText}>
                  {language === "HI" ? "रिचार्ज के लिए आगे बढ़ें" : "Proceed to Recharge"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── STATE: RECHARGING (UPI APP SELECT) ── */}
      {panelState === "recharging" && (
        <View style={styles.upiContainer}>
          <Text style={[styles.upiTitle, { color: theme.textPrimary }]}>
            {language === "HI" ? "यूपीआई ऐप चुनें:" : "Choose UPI App:"}
          </Text>
          {(["gpay", "phonepe", "paytm", "bhim"] as const).map((app) => (
            <TouchableOpacity
              key={app}
              onPress={() => setSelectedUpi(app)}
              style={[
                styles.upiRow,
                {
                  borderColor: selectedUpi === app ? theme.brand : theme.border,
                  backgroundColor: theme.menuItem,
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={selectedUpi === app ? "radio-button-on" : "radio-button-off"}
                size={18}
                color={selectedUpi === app ? theme.brand : theme.textSecondary}
                style={{ marginRight: 12 }}
              />
              <Text style={[styles.upiLabelText, { color: theme.textPrimary }]}>
                {app === "gpay" && "Google Pay"}
                {app === "phonepe" && "PhonePe"}
                {app === "paytm" && "Paytm"}
                {app === "bhim" && "BHIM UPI"}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => setPanelState("active")}
              style={[styles.btnOutline, { borderColor: theme.border }]}
            >
              <Text style={[styles.btnOutlineText, { color: theme.textSecondary }]}>
                {language === "HI" ? "पीछे" : "Back"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePay}
              style={[styles.btnSmall, { backgroundColor: theme.brand }]}
            >
              <Text style={styles.btnText}>
                {language === "HI" ? `₹${rechargeAmt} भुगतान करें` : `Pay ₹${rechargeAmt}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── STATE: PAYING (TRANSACTION LOADING) ── */}
      {panelState === "paying" && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.brand} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {language === "HI" ? "यूपीआई लेनदेन की पुष्टि की जा रही है..." : "Verifying UPI transaction with gateway..."}
          </Text>
        </View>
      )}

      {/* ── STATE: SUCCESS (RECHARGE DONE) ── */}
      {panelState === "success" && (
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={42} color={theme.success} />
          <Text style={[styles.successTitle, { color: theme.textPrimary }]}>
            {language === "HI" ? "रिचार्ज सफल रहा!" : "Recharge Successful!"}
          </Text>
          <Text style={[styles.successSubtitle, { color: theme.textSecondary }]}>
            {language === "HI"
              ? `₹${rechargeAmt} कार्ड DMRC-${formattedCardNumber} में सफलतापूर्वक जमा कर दिए गए हैं।`
              : `₹${rechargeAmt} has been credited to Card DMRC-${formattedCardNumber}.`}
          </Text>
          <TouchableOpacity onPress={resetToActive} style={[styles.btn, { backgroundColor: theme.brand, width: "100%" }]}>
            <Text style={styles.btnText}>{language === "HI" ? "पूरा हुआ" : "Done"}</Text>
          </TouchableOpacity>
        </View>
      )}
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
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  metroCardGraphic: {
    height: 140,
    borderRadius: 12,
    padding: 12,
    justifyContent: "space-between",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    marginTop: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLogoText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  contactlessIcon: {
    transform: [{ rotate: "90deg" }],
  },
  chipRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  smartChip: {
    width: 24,
    height: 18,
    borderRadius: 3,
    backgroundColor: "#F1C40F",
  },
  cardStatusText: {
    color: "#2ECC71",
    fontSize: 9,
    fontWeight: "800",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  cardNumberText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "monospace",
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  cardHolderLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 9.5,
    fontWeight: "700",
    maxWidth: "55%",
  },
  balanceContainer: {
    alignItems: "flex-end",
  },
  cardBalanceLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 8,
    fontWeight: "600",
  },
  cardBalanceValue: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
  cardBrandLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  formContainer: {
    marginTop: 14,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    marginBottom: 8,
    lineHeight: 16,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 11.5,
    fontWeight: "600",
    marginBottom: 10,
  },
  btn: {
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    marginTop: 8,
  },
  loadingText: {
    fontSize: 12.5,
    marginTop: 8,
  },
  dataContainer: {
    marginTop: 10,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
  },
  historyList: {
    paddingVertical: 4,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  histLabel: {
    fontSize: 12.5,
    fontWeight: "500",
  },
  histTime: {
    fontSize: 10,
    marginTop: 1,
  },
  histAmt: {
    fontSize: 13,
    fontWeight: "700",
  },
  rechargeForm: {
    paddingVertical: 4,
  },
  rechargeHeading: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  amountPresets: {
    flexDirection: "row",
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  presetText: {
    fontSize: 13,
    fontWeight: "700",
  },
  upiContainer: {
    marginTop: 12,
  },
  upiTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  upiRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  upiLabelText: {
    fontSize: 13,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  btnOutline: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  btnOutlineText: {
    fontSize: 13,
    fontWeight: "600",
  },
  btnSmall: {
    flex: 2,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 14,
  },
  successTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 16,
  },
  nfcOverlay: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    marginTop: 10,
  },
  rippleContainer: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  ripple: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
  },
  nfcIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    elevation: 3,
  },
  nfcTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    marginBottom: 4,
  },
  nfcSubtitle: {
    fontSize: 11.5,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
  },

  /* Card selector styles */
  selectorContainer: {
    marginBottom: 12,
    zIndex: 10,
  },
  selectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectorBtnText: {
    fontSize: 13,
    fontWeight: "600",
    maxWidth: "80%",
  },
  selectorList: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    borderRadius: 8,
    borderWidth: 1,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 20,
  },
  selectorItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectorItemName: {
    fontSize: 13,
    fontWeight: "700",
  },
  selectorItemId: {
    fontSize: 10.5,
    marginTop: 2,
    fontFamily: "monospace",
  },
  selectorItemBalance: {
    fontSize: 13.5,
    fontWeight: "800",
    marginLeft: "auto",
  },
  selectorAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
