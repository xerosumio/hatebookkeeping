import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useClients, useDeleteClient } from '../api/hooks';
import { Plus, Trash2, Pencil } from 'lucide-react';

export default function ClientList() {
  const [search, setSearch] = useState('');
  const { data: clients, isLoading } = useClients(search || undefined);
  const deleteClient = useDeleteClient();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link
          to="/clients/new"
          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> Add Client
        </Link>
      </div>

      <input
        type="text"
        placeholder="Search clients..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm border border-gray-300 rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !clients?.length ? (
        <p className="text-gray-500">No clients found.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{client.name}</td>
                  <td className="px-4 py-3 text-gray-600">{client.contactPerson}</td>
                  <td className="px-4 py-3 text-gray-600">{client.email}</td>
                  <td className="px-4 py-3 text-gray-600">{client.phone}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Link
                        to={`/clients/${client._id}/edit`}
                        className="text-gray-400 hover:text-blue-600"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm('Delete this client?')) {
                            deleteClient.mutate(client._id);
                          }
                        }}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
