import React, { useState } from 'react';
import { View } from 'react-native';
import { HorizontalScroll } from './PagerGestures';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { DayTotal, Metric } from '../types/models';
import { useApp } from '../hooks/useApp';
import { chartSegments } from '../services/statistics';
import { shortDate } from '../utils/date';
import { s } from '../i18n/zh-CN';
export function TrendChart({
  rows,
  metric,
  selected,
  onSelect,
}: {
  rows: DayTotal[];
  metric: Metric;
  selected?: string;
  onSelect: (row: DayTotal) => void;
}) {
  const { colors } = useApp();
  const [containerWidth, setWidth] = useState(300);
  const width = Math.max(containerWidth, rows.length * 26);
  const height = 220;
  const chart = chartSegments(rows, metric, width, height);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <HorizontalScroll showsHorizontalScrollIndicator>
        <Svg width={width} height={height} accessibilityLabel={`${s[metric]} ${s.trends}`}>
          {[0, 0.5, 1].map((r) => {
            const y = 18 + r * (height - 52);
            return (
              <React.Fragment key={r}>
                <Line
                  x1={42}
                  y1={y}
                  x2={width - 16}
                  y2={y}
                  stroke={colors.border}
                  strokeDasharray="3 5"
                />
                <SvgText
                  x={34}
                  y={y + 4}
                  textAnchor="end"
                  fill={colors.textSecondary}
                  fontSize={10}
                >
                  {Math.round(chart.max * (1 - r))}
                </SvgText>
              </React.Fragment>
            );
          })}
          {chart.segments.map((segment, i) => (
            <Path
              key={i}
              d={segment
                .map((p, index) => {
                  if (!index) return `M${p.x},${p.y}`;
                  const prev = segment[index - 1];
                  const mid = (prev.x + p.x) / 2;
                  return `C${mid},${prev.y} ${mid},${p.y} ${p.x},${p.y}`;
                })
                .join(' ')}
              fill="none"
              stroke={colors.text}
              strokeWidth={2.5}
            />
          ))}
          {chart.points.map((p, i) => (
            <React.Fragment key={p.row.date}>
              {p.row.count > 0 && (
                <>
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={selected === p.row.date ? 6 : 3.5}
                    fill={colors.text}
                    stroke={colors.surface}
                    strokeWidth={2}
                  />
                  <Circle
                    accessibilityLabel={`${p.row.date} ${Math.round(p.row[metric])}`}
                    cx={p.x}
                    cy={p.y}
                    r={12}
                    fill="transparent"
                    onPress={() => onSelect(p.row)}
                  />
                </>
              )}
              {(rows.length <= 7 ||
                i % Math.ceil(rows.length / (width / 64)) === 0 ||
                i === rows.length - 1) && (
                <SvgText
                  x={p.x}
                  y={height - 12}
                  textAnchor="middle"
                  fill={colors.textSecondary}
                  fontSize={10}
                >
                  {shortDate(p.row.date)}
                </SvgText>
              )}
            </React.Fragment>
          ))}
        </Svg>
      </HorizontalScroll>
    </View>
  );
}
