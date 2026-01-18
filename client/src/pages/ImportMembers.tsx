import { useState, useRef } from 'react';
import { importsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { ImportedMemberWithDuplicate, ImportParseError, ImportCommitResult } from '../types';

type Step = 'upload' | 'preview' | 'result';

export default function ImportMembers() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [importId, setImportId] = useState<number | null>(null);
  const [filename, setFilename] = useState('');
  const [rows, setRows] = useState<ImportedMemberWithDuplicate[]>([]);
  const [parseErrors, setParseErrors] = useState<ImportParseError[]>([]);
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);

  // Editing state
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<ImportedMemberWithDuplicate | null>(null);
  const [skippedRows, setSkippedRows] = useState<Set<number>>(new Set());

  const isSuperAdmin = user?.role === 'super_admin';

  const handleDownloadTemplate = async () => {
    try {
      const response = await importsApi.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'member-import-template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download template');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setLoading(true);

    try {
      // Upload file
      const uploadRes = await importsApi.upload(file);
      setImportId(uploadRes.data.importId);
      setFilename(uploadRes.data.filename);

      // Parse file with duplicate checking
      const parseRes = await importsApi.parse(uploadRes.data.importId, true);
      setRows(parseRes.data.rows);
      setParseErrors(parseRes.data.errors);
      setSkippedRows(new Set());
      setStep('preview');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload and parse file');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCommit = async () => {
    if (!importId) return;

    setError('');
    setLoading(true);

    try {
      // Strip duplicateInfo from rows before sending
      const cleanRows = rows.map(({ duplicateInfo, ...rest }) => rest);
      const res = await importsApi.commit(importId, {
        rows: cleanRows,
        skippedIndices: Array.from(skippedRows)
      });
      setCommitResult(res.data);
      setStep('result');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to commit import');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setImportId(null);
    setFilename('');
    setRows([]);
    setParseErrors([]);
    setCommitResult(null);
    setError('');
    setEditingRow(null);
    setEditFormData(null);
    setSkippedRows(new Set());
  };

  const getRowError = (index: number): string[] => {
    const error = parseErrors.find(e => e.rowIndex === index);
    return error?.issues || [];
  };

  // Row editing functions
  const startEdit = (index: number, row: ImportedMemberWithDuplicate) => {
    setEditingRow(index);
    setEditFormData({ ...row });
  };

  const saveEdit = () => {
    if (editingRow !== null && editFormData) {
      setRows(prev => prev.map((row, i) =>
        i === editingRow ? editFormData : row
      ));
      setEditingRow(null);
      setEditFormData(null);
    }
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditFormData(null);
  };

  const toggleSkip = (index: number) => {
    setSkippedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Upload Step
  if (step === 'upload') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Import Members</h1>
          <p className="text-gray-600 mt-1">Upload an Excel, CSV, PDF, or image file to import members</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-8">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-primary-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
              disabled={loading}
            />

            {loading ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600">Processing file...</p>
              </div>
            ) : (
              <>
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-lg font-medium text-gray-700 mb-2">Click to upload a file</p>
                <p className="text-gray-500">or drag and drop</p>
                <p className="text-sm text-gray-400 mt-4">Supported formats: XLSX, XLS, CSV, PDF, JPG, PNG</p>
              </>
            )}
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-800">Expected Columns</h3>
              <button
                onClick={handleDownloadTemplate}
                className="px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors text-sm font-medium"
              >
                Download Template
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-600">
              <span className="bg-gray-100 px-2 py-1 rounded">First Name *</span>
              <span className="bg-gray-100 px-2 py-1 rounded">Last Name *</span>
              <span className="bg-gray-100 px-2 py-1 rounded">Email</span>
              <span className="bg-gray-100 px-2 py-1 rounded">Phone</span>
              <span className="bg-gray-100 px-2 py-1 rounded">Address</span>
              <span className="bg-gray-100 px-2 py-1 rounded">Birthday</span>
              <span className="bg-gray-100 px-2 py-1 rounded">Marital Status</span>
              <span className="bg-gray-100 px-2 py-1 rounded">Status</span>
              <span className="bg-gray-100 px-2 py-1 rounded">Cell Group</span>
              <span className="bg-gray-100 px-2 py-1 rounded">Brought By</span>
              <span className="bg-gray-100 px-2 py-1 rounded">Notes</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">* Required fields</p>
          </div>
        </div>
      </div>
    );
  }

  // Preview Step
  if (step === 'preview') {
    const previewRows = rows.slice(0, 50);
    const hasMore = rows.length > 50;
    const newCount = rows.filter(r => !r.duplicateInfo?.isMatch).length;
    const updateCount = rows.filter(r => r.duplicateInfo?.isMatch).length;

    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Preview Import</h1>
            <p className="text-gray-600 mt-1">
              File: {filename} | {rows.length} rows found
              {parseErrors.length > 0 && (
                <span className="text-yellow-600 ml-2">
                  ({parseErrors.length} with issues)
                </span>
              )}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              <span className="text-green-600">{newCount} new</span>
              {' | '}
              <span className="text-blue-600">{updateCount} updates</span>
              {skippedRows.size > 0 && (
                <>
                  {' | '}
                  <span className="text-gray-500">{skippedRows.size} skipped</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            {isSuperAdmin && (
              <button
                onClick={handleCommit}
                disabled={loading || rows.length === 0}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Importing...' : 'Commit Import'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {!isSuperAdmin && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6">
            Only super admins can commit imports. Please ask an admin to complete this import.
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">First Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Birthday</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issues</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewRows.map((row, index) => {
                  const rowErrors = getRowError(index);
                  const hasError = rowErrors.length > 0;
                  const isSkipped = skippedRows.has(index);

                  return (
                    <tr key={index} className={`${hasError ? 'bg-red-50' : ''} ${isSkipped ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.duplicateInfo?.isMatch ? (
                          <span
                            className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 cursor-help"
                            title={`Matches: ${row.duplicateInfo.matchedMemberName} (by ${row.duplicateInfo.matchType?.replace('_', ' ')})`}
                          >
                            Update
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                            New
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-gray-900 ${isSkipped ? 'line-through' : ''}`}>{row.firstName || '-'}</td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-gray-900 ${isSkipped ? 'line-through' : ''}`}>{row.lastName || '-'}</td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-gray-500 ${isSkipped ? 'line-through' : ''}`}>{row.email || '-'}</td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-gray-500 ${isSkipped ? 'line-through' : ''}`}>{row.phone || '-'}</td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-gray-500 ${isSkipped ? 'line-through' : ''}`}>{row.birthday || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          row.status === 'active' ? 'bg-green-100 text-green-800' :
                          row.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {row.status || 'pending_approval'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600">
                        {hasError && rowErrors.join(', ')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(index, row)}
                            className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleSkip(index)}
                            className={`text-sm font-medium ${isSkipped ? 'text-green-600 hover:text-green-800' : 'text-gray-600 hover:text-gray-800'}`}
                          >
                            {isSkipped ? 'Include' : 'Skip'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600 text-center">
              Showing first 50 rows of {rows.length} total
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editingRow !== null && editFormData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Edit Row {editingRow + 1}</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={editFormData.firstName}
                    onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={editFormData.lastName}
                    onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editFormData.email || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editFormData.phone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={editFormData.address || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
                  <input
                    type="date"
                    value={editFormData.birthday || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, birthday: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editFormData.status || 'pending_approval'}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="pending_approval">Pending Approval</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                  <select
                    value={editFormData.maritalStatus || 'undisclosed'}
                    onChange={(e) => setEditFormData({ ...editFormData, maritalStatus: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="undisclosed">Undisclosed</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cell Group</label>
                  <input
                    type="text"
                    value={editFormData.cellGroupName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, cellGroupName: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brought By</label>
                  <input
                    type="text"
                    value={editFormData.broughtBy || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, broughtBy: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={editFormData.notes || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveEdit}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                >
                  Save Changes
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Result Step
  if (step === 'result' && commitResult) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Import Complete</h1>
            <p className="text-gray-600 mt-1">File: {filename}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{commitResult.created}</p>
              <p className="text-sm text-green-800">Created</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{commitResult.updated}</p>
              <p className="text-sm text-blue-800">Updated</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-gray-600">{commitResult.skipped}</p>
              <p className="text-sm text-gray-800">Skipped</p>
            </div>
          </div>

          {commitResult.errors.length > 0 && (
            <div className="mb-8">
              <h3 className="font-medium text-gray-800 mb-2">Errors ({commitResult.errors.length})</h3>
              <div className="bg-red-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                {commitResult.errors.map((err, i) => (
                  <p key={i} className="text-sm text-red-600 mb-1">{err}</p>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Import Another File
            </button>
            <button
              onClick={() => window.location.href = '/members'}
              className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              View Members
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
