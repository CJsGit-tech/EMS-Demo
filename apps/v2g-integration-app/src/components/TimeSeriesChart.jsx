import { useId } from "react";

import "../styles.css";

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 112;
const CHART_PADDING = 14;

function countLabel(count) {
  const names = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  return names[count] ?? String(count);
}

function chartPath(points) {
  if (!points.length) return "";

  const values = points.map(({ value }) => value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum || 1;
  const width = VIEWBOX_WIDTH - CHART_PADDING * 2;
  const height = VIEWBOX_HEIGHT - CHART_PADDING * 2;

  return points
    .map(({ value }, index) => {
      const x = CHART_PADDING + (index / Math.max(points.length - 1, 1)) * width;
      const y = CHART_PADDING + (1 - (value - minimum) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function TimeSeriesChart({ title, points = [], unit, quality }) {
  const summaryId = useId();
  const values = points.map(({ value }) => value);
  const min = values.length ? Math.min(...values) : null;
  const max = values.length ? Math.max(...values) : null;
  const summary = values.length
    ? `${title} contains ${countLabel(points.length)} samples from ${min} to ${max} ${unit}.`
    : `${title} has no simulated samples.`;

  return (
    <figure className="scada-chart" aria-describedby={summaryId}>
      <figcaption className="scada-chart__header">
        <span>
          <span className="scada-eyebrow">Simulated trend</span>
          <strong>{title}</strong>
        </span>
        {quality ? <span className="scada-quality">Data quality: {quality}</span> : null}
      </figcaption>
      <svg
        aria-label={`${title} chart`}
        className="scada-chart__plot"
        role="img"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      >
        <line className="scada-chart__baseline" x1="14" x2="306" y1="98" y2="98" />
        {points.length ? <path className="scada-chart__line" d={chartPath(points)} /> : null}
      </svg>
      <p className="scada-chart__summary" id={summaryId}>
        {summary}
      </p>
    </figure>
  );
}
