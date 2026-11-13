import { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Calendar, ChevronLeft, ChevronRight, Clock, X, Check } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE, TYPE, focusRing } from "../../lib/tokens";

export type DatePickerMode = "date" | "datetime";

type Props = {
  label?: string;
  value: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  onChange: (formatted: string) => void;
  mode?: DatePickerMode;
  placeholder?: string;
  hint?: string;
  error?: string;
  minDate?: Date;
  maxDate?: Date;
  editable?: boolean;
  compact?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * Strips non-digits and inserts dashes automatically as the user types.
 * Supports:
 * - YYYY-MM-DD (up to 10 chars)
 * - YYYY-MM-DDTHH:mm (up to 16 chars)
 */
function applyDateMask(raw: string, mode: DatePickerMode): string {
  // Strip everything except digits, 'T', and ':'
  const clean = raw.replace(/[^\dT:]/g, "");
  const digits = clean.replace(/\D/g, "");

  if (mode === "date") {
    // Format as YYYY-MM-DD
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }

  // mode === "datetime" -> YYYY-MM-DDTHH:mm
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  if (digits.length <= 10) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}T${digits.slice(8)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}T${digits.slice(8, 10)}:${digits.slice(10, 12)}`;
}

/** Parses string into year, month (0-11), day */
function parseDateParts(val: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const now = new Date();
  if (!val) {
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
    };
  }

  const [datePart, timePart] = val.split("T");
  const [y, m, d] = (datePart || "").split("-").map((n) => parseInt(n, 10));
  const [hh, mm] = (timePart || "").split(":").map((n) => parseInt(n, 10));

  return {
    year: Number.isFinite(y) && y > 1900 ? y : now.getFullYear(),
    month: Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth(),
    day: Number.isFinite(d) && d >= 1 && d <= 31 ? d : now.getDate(),
    hour: Number.isFinite(hh) && hh >= 0 && hh <= 23 ? hh : 12,
    minute: Number.isFinite(mm) && mm >= 0 && mm <= 59 ? mm : 0,
  };
}

export default function DatePickerField({
  label,
  value,
  onChange,
  mode = "date",
  placeholder,
  hint,
  error,
  minDate,
  maxDate,
  editable = true,
  compact = false,
  containerStyle,
  inputStyle,
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Calendar view navigation state
  const parts = useMemo(() => parseDateParts(value), [value]);
  const [viewYear, setViewYear] = useState<number>(parts.year);
  const [viewMonth, setViewMonth] = useState<number>(parts.month);
  const [selectedDay, setSelectedDay] = useState<number>(parts.day);
  const [selectedHour, setSelectedHour] = useState<number>(parts.hour);
  const [selectedMinute, setSelectedMinute] = useState<number>(parts.minute);
  const [selectingYear, setSelectingYear] = useState(false);

  const openCalendar = () => {
    if (!editable) return;
    const p = parseDateParts(value);
    setViewYear(p.year);
    setViewMonth(p.month);
    setSelectedDay(p.day);
    setSelectedHour(p.hour);
    setSelectedMinute(p.minute);
    setSelectingYear(false);
    setCalendarOpen(true);
  };

  const handleTextChange = (text: string) => {
    const masked = applyDateMask(text, mode);
    onChange(masked);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Days in month calculation
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: { day: number; isCurrentMonth: boolean; date: Date }[] = [];

    // Leading days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      days.push({
        day: d,
        isCurrentMonth: false,
        date: new Date(viewYear, viewMonth - 1, d),
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        isCurrentMonth: true,
        date: new Date(viewYear, viewMonth, d),
      });
    }

    // Trailing days from next month to complete 6 rows (42 cells) or 5 rows
    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        day: d,
        isCurrentMonth: false,
        date: new Date(viewYear, viewMonth + 1, d),
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  const commitDate = (y: number, m: number, d: number, hh = selectedHour, mm = selectedMinute) => {
    const yStr = String(y).padStart(4, "0");
    const mStr = String(m + 1).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");

    if (mode === "datetime") {
      const hhStr = String(hh).padStart(2, "0");
      const mmStr = String(mm).padStart(2, "0");
      onChange(`${yStr}-${mStr}-${dStr}T${hhStr}:${mmStr}`);
    } else {
      onChange(`${yStr}-${mStr}-${dStr}`);
    }
  };

  const handleSelectDay = (dayObj: { day: number; isCurrentMonth: boolean; date: Date }) => {
    const y = dayObj.date.getFullYear();
    const m = dayObj.date.getMonth();
    const d = dayObj.date.getDate();

    setSelectedDay(d);
    if (!dayObj.isCurrentMonth) {
      setViewYear(y);
      setViewMonth(m);
    }

    commitDate(y, m, d);
    if (mode === "date") {
      setCalendarOpen(false);
    }
  };

  const handleSelectToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    setViewYear(y);
    setViewMonth(m);
    setSelectedDay(d);
    commitDate(y, m, d);
    if (mode === "date") {
      setCalendarOpen(false);
    }
  };

  const handleClear = () => {
    onChange("");
    setCalendarOpen(false);
  };

  // Scrollable years from 1940 to 2035 for fast birthdate and event selection
  const yearRange = useMemo(() => {
    const years: number[] = [];
    const max = (maxDate ? maxDate.getFullYear() : new Date().getFullYear() + 10);
    const min = (minDate ? minDate.getFullYear() : 1940);
    for (let y = max; y >= min; y--) {
      years.push(y);
    }
    return years;
  }, [minDate, maxDate]);

  const borderColor = error
    ? colors.destructive
    : focused
    ? colors.inputBorderFocus
    : colors.inputBorder;

  const defaultPlaceholder = mode === "datetime" ? "YYYY-MM-DDTHH:MM" : "YYYY-MM-DD";

  return (
    <View style={[{ marginBottom: compact ? 0 : SPACE.x4 }, containerStyle]}>
      {label ? (
        <Text
          style={{
            fontSize: 13,
            lineHeight: 18,
            fontWeight: "600",
            color: colors.textSecondary,
            marginBottom: SPACE.x2,
          }}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={[
          {
            minHeight: compact ? 38 : 48,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: compact ? 8 : RADIUS.md,
            borderWidth: 1,
            borderColor,
            backgroundColor: editable ? colors.inputBg : colors.surfaceSunken,
            paddingHorizontal: compact ? 8 : SPACE.x3,
          },
          !compact && focusRing(colors, focused),
        ]}
      >
        <TextInput
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder || defaultPlaceholder}
          placeholderTextColor={colors.textMuted}
          editable={editable}
          keyboardType="numeric"
          maxLength={mode === "datetime" ? 16 : 10}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            {
              flex: 1,
              fontSize: compact ? 12 : 14,
              color: colors.textPrimary,
              paddingVertical: compact ? 4 : 8,
            },
            inputStyle,
          ]}
        />

        {value && editable ? (
          <TouchableOpacity
            onPress={() => onChange("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: 4, marginRight: 4 }}
            accessibilityLabel="Clear date"
          >
            <X size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={openCalendar}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            padding: 4,
            borderRadius: 6,
            backgroundColor: calendarOpen ? colors.primarySurface : "transparent",
          }}
          accessibilityLabel="Open calendar picker"
        >
          <Calendar size={compact ? 15 : 18} color={calendarOpen ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {error ? (
        <Text style={{ ...TYPE.caption, color: colors.destructiveText, marginTop: SPACE.x1 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ ...TYPE.caption, color: colors.textTertiary, marginTop: SPACE.x1 }}>
          {hint}
        </Text>
      ) : null}

      {/* Calendar Picker Modal */}
      <Modal
        visible={calendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.65)",
            justifyContent: "center",
            alignItems: "center",
            padding: SPACE.x4,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 380,
              backgroundColor: colors.surface,
              borderRadius: RADIUS.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: SPACE.x5,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            {/* Header: Month & Year Controls */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: SPACE.x4,
              }}
            >
              <TouchableOpacity
                onPress={() => setSelectingYear((prev) => !prev)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: RADIUS.md,
                  backgroundColor: selectingYear ? colors.primarySurface : colors.surfaceSunken,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </Text>
                <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>
                  {selectingYear ? "Close" : "Change Year"}
                </Text>
              </TouchableOpacity>

              {!selectingYear ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <TouchableOpacity
                    onPress={handlePrevMonth}
                    style={{
                      padding: 8,
                      borderRadius: RADIUS.sm,
                      backgroundColor: colors.surfaceSunken,
                    }}
                    accessibilityLabel="Previous month"
                  >
                    <ChevronLeft size={16} color={colors.textPrimary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleNextMonth}
                    style={{
                      padding: 8,
                      borderRadius: RADIUS.sm,
                      backgroundColor: colors.surfaceSunken,
                    }}
                    accessibilityLabel="Next month"
                  >
                    <ChevronRight size={16} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {/* Quick Year Selection Grid */}
            {selectingYear ? (
              <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingVertical: 4 }}>
                  {yearRange.map((yr) => {
                    const isCur = yr === viewYear;
                    return (
                      <TouchableOpacity
                        key={yr}
                        onPress={() => {
                          setViewYear(yr);
                          setSelectingYear(false);
                          commitDate(yr, viewMonth, selectedDay);
                        }}
                        style={{
                          width: "30%",
                          paddingVertical: 10,
                          alignItems: "center",
                          borderRadius: RADIUS.sm,
                          backgroundColor: isCur ? colors.primary : colors.surfaceSunken,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: isCur ? "700" : "500",
                            color: isCur ? "#FFFFFF" : colors.textPrimary,
                          }}
                        >
                          {yr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              <>
                {/* Days of week row */}
                <View style={{ flexDirection: "row", marginBottom: 6 }}>
                  {DAYS_OF_WEEK.map((d) => (
                    <Text
                      key={d}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontSize: 11,
                        fontWeight: "700",
                        color: colors.textTertiary,
                        paddingVertical: 4,
                      }}
                    >
                      {d}
                    </Text>
                  ))}
                </View>

                {/* Calendar Days Matrix */}
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {calendarDays.map((dObj, idx) => {
                    const isSelected =
                      dObj.isCurrentMonth &&
                      dObj.day === selectedDay &&
                      viewMonth === parts.month &&
                      viewYear === parts.year;

                    const isToday =
                      new Date().getFullYear() === dObj.date.getFullYear() &&
                      new Date().getMonth() === dObj.date.getMonth() &&
                      new Date().getDate() === dObj.day;

                    const isOutOfMin = minDate && dObj.date < new Date(minDate.setHours(0, 0, 0, 0));
                    const isOutOfMax = maxDate && dObj.date > new Date(maxDate.setHours(23, 59, 59, 999));
                    const isDisabled = isOutOfMin || isOutOfMax;

                    return (
                      <TouchableOpacity
                        key={idx}
                        disabled={isDisabled}
                        onPress={() => handleSelectDay(dObj)}
                        style={{
                          width: `${100 / 7}%`,
                          aspectRatio: 1,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 9999,
                          backgroundColor: isSelected ? colors.primary : "transparent",
                          opacity: isDisabled ? 0.3 : dObj.isCurrentMonth ? 1 : 0.4,
                          borderWidth: isToday && !isSelected ? 1 : 0,
                          borderColor: colors.primary,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: isSelected || isToday ? "700" : "500",
                            color: isSelected
                              ? "#FFFFFF"
                              : dObj.isCurrentMonth
                              ? colors.textPrimary
                              : colors.textMuted,
                          }}
                        >
                          {dObj.day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Time Selector for mode="datetime" */}
            {mode === "datetime" && !selectingYear ? (
              <View
                style={{
                  marginTop: SPACE.x4,
                  paddingTop: SPACE.x3,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Clock size={16} color={colors.textSecondary} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>
                    Time (24h)
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <TextInput
                    value={String(selectedHour).padStart(2, "0")}
                    keyboardType="numeric"
                    maxLength={2}
                    onChangeText={(t) => {
                      const h = Math.min(23, Math.max(0, parseInt(t, 10) || 0));
                      setSelectedHour(h);
                      commitDate(viewYear, viewMonth, selectedDay, h, selectedMinute);
                    }}
                    style={{
                      width: 44,
                      paddingVertical: 4,
                      textAlign: "center",
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceSunken,
                      color: colors.textPrimary,
                      fontWeight: "700",
                    }}
                  />
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>:</Text>
                  <TextInput
                    value={String(selectedMinute).padStart(2, "0")}
                    keyboardType="numeric"
                    maxLength={2}
                    onChangeText={(t) => {
                      const m = Math.min(59, Math.max(0, parseInt(t, 10) || 0));
                      setSelectedMinute(m);
                      commitDate(viewYear, viewMonth, selectedDay, selectedHour, m);
                    }}
                    style={{
                      width: 44,
                      paddingVertical: 4,
                      textAlign: "center",
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceSunken,
                      color: colors.textPrimary,
                      fontWeight: "700",
                    }}
                  />
                </View>
              </View>
            ) : null}

            {/* Bottom Actions */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: SPACE.x5,
                paddingTop: SPACE.x3,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={handleSelectToday}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: RADIUS.sm,
                    backgroundColor: colors.surfaceSunken,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary }}>
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleClear}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: RADIUS.sm,
                    backgroundColor: colors.surfaceSunken,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary }}>
                    Clear
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => setCalendarOpen(false)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: RADIUS.sm,
                  backgroundColor: colors.primary,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Check size={14} color="#FFFFFF" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFFFFF" }}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

