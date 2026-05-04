function initMonthlyChart(monthlyData) {
  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return;
  const labels = monthlyData.map(d => d.month);
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Solar (kWh)',
          data: monthlyData.map(d => d.solar_kwh),
          backgroundColor: '#10b981',
          borderRadius: 4,
        },
        {
          label: 'Battery (kWh)',
          data: monthlyData.map(d => d.battery_kwh),
          backgroundColor: '#34d399',
          borderRadius: 4,
        },
        {
          label: 'Grid (kWh)',
          data: monthlyData.map(d => d.grid_kwh),
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} kWh`,
          },
        },
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, title: { display: true, text: 'kWh' } },
      },
    },
  });
}

function initRoiChart(roiData) {
  const ctx = document.getElementById('roiChart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: roiData.map(d => `Yr ${d.year}`),
      datasets: [
        {
          label: 'Cumulative Savings (€)',
          data: roiData.map(d => d.cumulative_savings),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.12)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
        },
        {
          label: 'Net Position (€)',
          data: roiData.map(d => d.net_position),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          borderDash: [4, 4],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        annotation: {},
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: €${ctx.parsed.y.toFixed(0)}`,
          },
        },
      },
      scales: {
        y: {
          title: { display: true, text: 'EUR (€)' },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
      },
    },
  });
}

function initShapChart(shapData) {
  const ctx = document.getElementById('shapChart');
  if (!ctx) return;
  const labels = Object.keys(shapData);
  const values = Object.values(shapData).map(Math.abs);
  const colors = labels.map(l => {
    const map = { month: '#10b981', hour: '#34d399', irradiance: '#059669', temperature: '#6ee7b7' };
    return map[l] || '#10b981';
  });
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '|SHAP value|',
        data: values,
        backgroundColor: colors,
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `Impact: ${ctx.parsed.x.toFixed(4)}`,
          },
        },
      },
      scales: {
        x: { title: { display: true, text: 'Mean |SHAP| value' } },
      },
    },
  });
}

function initEnergyDonut(solar, battery, grid) {
  const ctx = document.getElementById('energyDonut');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Solar', 'Battery', 'Grid'],
      datasets: [{
        data: [solar, battery, grid],
        backgroundColor: ['#10b981', '#34d399', '#e5e7eb'],
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(1)}%`,
          },
        },
      },
      cutout: '65%',
    },
  });
}
