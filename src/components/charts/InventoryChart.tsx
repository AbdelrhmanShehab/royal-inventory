import React from 'react';
import type { InventoryStatusDistribution } from '../../types/dashboard';

interface InventoryChartProps {
  data?: InventoryStatusDistribution[];
}

export const InventoryChart: React.FC<InventoryChartProps> = ({ data = [] }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Stock': return '#10b981'; // Green
      case 'Low Stock': return '#f59e0b'; // Amber
      case 'Out of Stock': return '#ef4444'; // Red
      default: return '#6366f1';
    }
  };

  return (
    <div className="inventory-chart-card">
      <h4 className="chart-header-title">Status Distribution</h4>
      <div className="chart-bars-container">
        {data.map((item, idx) => {
          const color = getStatusColor(item.status);
          return (
            <div key={idx} className="chart-bar-row">
              <div className="chart-bar-labels">
                <span className="chart-bar-status">{item.status}</span>
                <span className="chart-bar-count">{item.count} items ({item.percentage}%)</span>
              </div>
              <div className="chart-bar-track">
                <div
                  className="chart-bar-fill"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: color,
                    boxShadow: `0 2px 8px ${color}40`
                  }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="chart-legend">
        <div className="legend-item"><span className="legend-dot" style={{ backgroundColor: '#10b981' }}></span>In Stock</div>
        <div className="legend-item"><span className="legend-dot" style={{ backgroundColor: '#f59e0b' }}></span>Low Stock</div>
        <div className="legend-item"><span className="legend-dot" style={{ backgroundColor: '#ef4444' }}></span>Out of Stock</div>
      </div>
    </div>
  );
};

export default InventoryChart;
