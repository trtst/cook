<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
  type Chart as ChartInstance
} from "chart.js";

Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Legend, LinearScale, Tooltip);

const props = defineProps<{
  title: string;
  labels: string[];
  values: number[];
  total: number;
  type?: "bar" | "doughnut";
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let chart: ChartInstance<"bar" | "doughnut"> | null = null;

const colors = ["#C7783E", "#6E9B77", "#D5A84F", "#7395B5", "#A47C9B", "#65A6A1", "#D88670", "#8E9271"];

function renderChart() {
  chart?.destroy();
  if (!canvas.value) return;

  const type = props.type ?? "bar";
  const data = {
    labels: props.labels,
    datasets: [{
      label: "菜谱数",
      data: props.values,
      backgroundColor: type === "bar" ? "#C7783E" : colors,
      borderColor: "#FFFFFF",
      borderWidth: type === "bar" ? 0 : 2,
      borderRadius: type === "bar" ? 5 : 0,
      barThickness: 14
    }]
  };

  if (type === "doughnut") {
    chart = new Chart(canvas.value, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            position: "right",
            labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, padding: 14 }
          },
          tooltip: {
            callbacks: {
              label: context => {
                const value = Number(context.raw ?? 0);
                const share = props.total ? value / props.total : 0;
                return `${context.label}: ${value.toLocaleString("zh-CN")} 道（${(share * 100).toFixed(1)}%）`;
              }
            }
          }
        }
      }
    });
    return;
  }

  chart = new Chart(canvas.value, {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => {
              const value = Number(context.raw ?? 0);
              const share = props.total ? value / props.total : 0;
              return `${value.toLocaleString("zh-CN")} 道（${(share * 100).toFixed(1)}%）`;
            }
          }
        }
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#F1EFEC" } },
        y: { grid: { display: false } }
      }
    }
  });
}

watch(() => [props.labels, props.values, props.total, props.type], renderChart, { deep: true });
onMounted(renderChart);
onBeforeUnmount(() => chart?.destroy());
</script>

<template>
  <article class="chart-card">
    <h3>{{ title }}</h3>
    <div class="chart-card__canvas" :class="{ 'chart-card__canvas--doughnut': type === 'doughnut' }">
      <canvas ref="canvas" />
    </div>
  </article>
</template>

<style scoped lang="scss">
.chart-card {
  min-width: 0;
  padding: 16px;
  border: 1px solid #e7e5e4;
  border-radius: 10px;
  background: #fff;
}

.chart-card h3 {
  margin: 0 0 14px;
  color: #44403c;
  font-size: 14px;
  font-weight: 600;
}

.chart-card__canvas {
  height: 230px;
}

.chart-card__canvas--doughnut {
  height: 250px;
}
</style>
