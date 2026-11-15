import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  TextInput,
  View,
  useWindowDimensions,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { applyOtpEdit } from "./otpEntry";

/**
 * Zero-width space. An empty TextInput emits no change event when Backspace is
 * pressed, so iOS could never route a delete on an empty box to the previous
 * one. A sentinel character gives the box something to delete; it is stripped
 * from every value the component reads.
 */
const SENTINEL = "\u200B";

export interface OtpInputHandle {
  /** Clears every digit and focuses the first box. */
  clear: () => void;
  /** Focuses the box at `index` (clamped). */
  focus: (index?: number) => void;
}

export interface OtpInputProps {
  /** Number of digit boxes. Defaults to 6. */
  length?: number;
  /** Called once per distinct fully-filled code. */
  onComplete?: (code: string) => void;
  /** Called with the joined digits after every edit. */
  onChange?: (code: string) => void;
  disabled?: boolean;
  /** Renders destructive borders, e.g. after a rejected code. */
  error?: boolean;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(
  function OtpInput(
    {
      length = 6,
      onComplete,
      onChange,
      disabled = false,
      error = false,
      autoFocus = false,
      style,
    },
    ref,
  ) {
    const { colors } = useTheme();
    const { width } = useWindowDimensions();
    const isMobile = width < 480;
    const isWeb = Platform.OS === "web";

    const boxSize = isMobile ? 44 : 52;
    const boxHeight = isMobile ? 56 : 64;
    const fontSize = isMobile ? 24 : 28;
    const gap = isMobile ? 8 : 12;
    const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const inputs = useRef<(ComponentRef<typeof TextInput> | null)[]>([]);
    const completedCode = useRef<string | null>(null);
    const onChangeRef = useRef(onChange);
    const onCompleteRef = useRef(onComplete);
    onChangeRef.current = onChange;
    onCompleteRef.current = onComplete;

    const code = digits.join("");

    const focusBox = useCallback(
      (index: number) => {
        const target = Math.min(Math.max(index, 0), length - 1);
        inputs.current[target]?.focus();
      },
      [length],
    );

    useEffect(() => {
      setDigits(Array(length).fill(""));
      completedCode.current = null;
    }, [length]);

    useEffect(() => {
      onChangeRef.current?.(code);
    }, [code]);

    useEffect(() => {
      if (code.length !== length) {
        completedCode.current = null;
        return;
      }
      if (completedCode.current === code) return;
      completedCode.current = code;
      onCompleteRef.current?.(code);
    }, [code, length]);

    useImperativeHandle(
      ref,
      () => ({
        clear: () => {
          setDigits(Array(length).fill(""));
          completedCode.current = null;
          focusBox(0);
        },
        focus: (index = 0) => focusBox(index),
      }),
      [length, focusBox],
    );

    const handleChange = useCallback(
      (value: string, index: number) => {
        if (disabled) return;
        const edit = applyOtpEdit(digits, value, index);
        if (!edit) return;
        setDigits(edit.digits);
        focusBox(edit.focus);
      },
      [digits, disabled, focusBox],
    );

    return (
          <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>
            {digits.map((digit, index) => {
              const focused = focusedIndex === index;
              return (
                <TextInput
                  key={index}
                  ref={(element) => {
                    inputs.current[index] = element;
                  }}
                  testID={`otp-input-${index}`}
                  accessibilityLabel={`Digit ${index + 1} of ${length}`}
                  accessibilityState={{ disabled }}
                  style={[
                    {
                      flex: 1,
                      width: boxSize,
                      height: boxHeight,
                      borderWidth: 1.5,
                      borderRadius: 14,
                      paddingHorizontal: 0,
                      paddingVertical: 0,
                      textAlign: "center",
                      fontSize,
                      fontWeight: "700",
                      backgroundColor: colors.surfaceSunken,
                      color: colors.textPrimary,
                      borderColor: error
                        ? colors.destructive
                        : focused
                        ? colors.primary
                        : colors.border,
                      opacity: disabled ? 0.6 : 1,
                    },
                  ]}
                  value={digit || SENTINEL}
                  onChangeText={(value) => handleChange(value, index)}
                  onFocus={() => setFocusedIndex(index)}
                  onBlur={() => {
                    setFocusedIndex((current) => (current === index ? null : current));
                  }}
                  editable={!disabled}
                  inputMode={isWeb ? undefined : "numeric"}
                  keyboardType="number-pad"
                  autoComplete={isWeb ? "one-time-code" : undefined}
                  textContentType={isWeb ? undefined : "oneTimeCode"}
                  caretHidden
                  selectTextOnFocus
                  autoFocus={autoFocus && index === 0}
                />
              );
            })}
          </View>
        );
  },
);

OtpInput.displayName = "OtpInput";
