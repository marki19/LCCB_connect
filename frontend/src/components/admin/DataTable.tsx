import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { Skeleton } from "../ui/Skeleton";
import {
  elevation,
  focusRing,
  RADIUS,
  SPACE,
  TYPE,
  type ThemeTokens,
} from "../../lib/tokens";

export type DataColumn = {
  key: string;
  label: string;
  flex?: number;
  width?: number;
  align?: "left" | "right" | "center";
  hideBelow?: number;
};

type DataTableProps<T> = {
  columns: DataColumn[];
  rows: T[];
  keyExtractor: (row: T) => string;
  renderCell: (row: T, column: DataColumn, colors: ThemeTokens) => ReactNode;
  onRowPress?: (row: T) => void;
  loading?: boolean;
  skeletonRows?: number;
  empty?: ReactNode;
  minWidth?: number;
  footer?: ReactNode;
  rowLabel?: (row: T) => string;
};

function cellStyle(column: DataColumn) {
  const base = {
    flex: column.flex,
    width: column.width,
    justifyContent: "center" as const,
  };
  if (column.align === "right") return { ...base, alignItems: "flex-end" as const };
  if (column.align === "center") return { ...base, alignItems: "center" as const };
  return { ...base, alignItems: "flex-start" as const };
}

function TableRow<T>({
  row,
  columns,
  renderCell,
  onRowPress,
  rowLabel,
  colors,
  last,
}: {
  row: T;
  columns: DataColumn[];
  renderCell: DataTableProps<T>["renderCell"];
  onRowPress?: (row: T) => void;
  rowLabel?: (row: T) => string;
  colors: ThemeTokens;
  last: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole={onRowPress ? "button" : undefined}
      accessibilityLabel={rowLabel?.(row)}
      onPress={onRowPress ? () => onRowPress(row) : undefined}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: SPACE.x5,
          paddingVertical: SPACE.x3,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: colors.tableRowBorder,
          backgroundColor: onRowPress
            ? hovered || focused
              ? colors.tableRowHover
              : "transparent"
            : "transparent",
        },
        focusRing(colors, focused),
      ]}
    >
      {columns.map((column) => (
        <View key={column.key} style={[cellStyle(column), { paddingRight: SPACE.x3 }]}>
          {renderCell(row, column, colors)}
        </View>
      ))}
    </Pressable>
  );
}

/**
 * Responsive table shell. On narrow screens the table scrolls inside its own
 * container, never the page. On web, column headers use `header` semantics and
 * rows are keyboard reachable when they are actionable.
 */
export default function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  renderCell,
  onRowPress,
  loading = false,
  skeletonRows = 5,
  empty,
  minWidth = 720,
  footer,
  rowLabel,
}: DataTableProps<T>) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.panel,
        overflow: "hidden",
        ...elevation("sm", colors),
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        style={{ width: "100%" }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={{ minWidth, flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: SPACE.x5,
              paddingVertical: SPACE.x3,
              backgroundColor: colors.tableHeaderBg,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            }}
          >
            {columns.map((column) => (
              <View key={column.key} style={[cellStyle(column), { paddingRight: SPACE.x3 }]}>
                <Text
                  accessibilityRole="header"
                  style={{
                    ...TYPE.micro,
                    fontSize: 9.5,
                    letterSpacing: 1.1,
                    color: colors.inkFaint,
                    textAlign: column.align === "right" ? "right" : "left",
                  }}
                >
                  {column.label}
                </Text>
              </View>
            ))}
          </View>

          {loading ? (
            <View>
              {Array.from({ length: skeletonRows }).map((_, index) => (
                <View
                  key={index}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: SPACE.x5,
                    paddingVertical: SPACE.x4,
                    borderBottomWidth: index === skeletonRows - 1 ? 0 : 1,
                    borderBottomColor: colors.tableRowBorder,
                    gap: SPACE.x4,
                  }}
                >
                  <Skeleton width={38} height={38} radius={19} />
                  <View style={{ flex: 2, gap: 7 }}>
                    <Skeleton width="58%" height={10} radius={5} />
                    <Skeleton width="34%" height={9} radius={5} />
                  </View>
                  <Skeleton width={74} height={20} radius={10} />
                  <Skeleton width="18%" height={10} radius={5} />
                  <Skeleton width={70} height={10} radius={5} />
                </View>
              ))}
            </View>
          ) : rows.length === 0 ? (
            <View>{empty}</View>
          ) : (
            <View>
              {rows.map((row, index) => (
                <TableRow
                  key={keyExtractor(row)}
                  row={row}
                  columns={columns}
                  renderCell={renderCell}
                  onRowPress={onRowPress}
                  rowLabel={rowLabel}
                  colors={colors}
                  last={index === rows.length - 1}
                />
              ))}
            </View>
          )}

          {footer ? <View>{footer}</View> : null}
        </View>
      </ScrollView>
    </View>
  );
}
