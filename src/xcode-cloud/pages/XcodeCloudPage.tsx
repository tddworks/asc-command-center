import { useState } from 'react';
import { useProducts, useWorkflows } from '../XcodeCloud.hooks.ts';
import { AffordanceBar } from '../../shared/components/AffordanceBar.tsx';

export default function XcodeCloudPage() {
  const { products, loading: productsLoading, error: productsError } = useProducts();
  const [selectedProductId, setSelectedProductId] = useState('');
  const { workflows, loading: workflowsLoading } = useWorkflows(selectedProductId);

  if (productsLoading) return <div className="spinner">Loading products...</div>;
  if (productsError) return <div className="error">Error: {productsError.message}</div>;

  return (
    <div>
      <h2>Xcode Cloud</h2>

      <h3>Products</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>App ID</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr
              key={p.id}
              onClick={() => setSelectedProductId(p.id)}
              style={{ cursor: 'pointer', background: selectedProductId === p.id ? 'var(--surface-hover)' : undefined }}
            >
              <td>{p.name}</td>
              <td>{p.productType}</td>
              <td>{p.appId ?? '--'}</td>
              <td><AffordanceBar affordances={p.affordances} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedProductId && (
        <>
          <h3>Workflows</h3>
          {workflowsLoading ? (
            <div className="spinner">Loading workflows...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Enabled</th>
                  <th>Locked</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((w) => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td>{w.isEnabled ? 'Yes' : 'No'}</td>
                    <td>{w.isLockedForEditing ? 'Yes' : 'No'}</td>
                    <td><AffordanceBar affordances={w.affordances} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
