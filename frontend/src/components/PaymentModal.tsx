import { useEffect } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { CheckCircle, X, CreditCard } from "lucide-react-native";

type Props = {
  visible: boolean;
  amount: number;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function PaymentModal({ visible, amount, title, onClose, onConfirm }: Props) {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      scale.value = withTiming(0.6, { duration: 180 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.modal, animatedStyle]}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
            <X size={20} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <CreditCard size={32} color="#1A56DB" />
          </View>

          <Text style={styles.title}>Checkout</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {title}
          </Text>

          <View style={styles.amountRow}>
            <Text style={styles.currency}>₱</Text>
            <Text style={styles.amount}>{amount.toLocaleString()}</Text>
          </View>

          <Text style={styles.paymentNote}>Mock payment gateway — prototype only</Text>

          <View style={styles.paymentMethods}>
            <View style={styles.methodChip}><Text style={styles.methodText}>💳 Card</Text></View>
            <View style={styles.methodChip}><Text style={styles.methodText}>📱 GCash</Text></View>
            <View style={styles.methodChip}><Text style={styles.methodText}>🏦 Maya</Text></View>
          </View>

          <TouchableOpacity
            onPress={onConfirm}
            activeOpacity={0.85}
            style={styles.confirmBtn}
          >
            <CheckCircle size={18} color="#FFFFFF" />
            <Text style={styles.confirmText}>Pay ₱{amount.toLocaleString()}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 30,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    padding: 4,
    zIndex: 2,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EBF5FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 6,
  },
  currency: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A56DB",
    marginRight: 4,
  },
  amount: {
    fontSize: 38,
    fontWeight: "800",
    color: "#1A56DB",
  },
  paymentNote: {
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 16,
  },
  paymentMethods: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  methodChip: {
    backgroundColor: "#F0F7FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  methodText: {
    fontSize: 12,
    color: "#1A56DB",
    fontWeight: "600",
  },
  confirmBtn: {
    backgroundColor: "#1A56DB",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cancelBtn: {
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "600",
  },
});