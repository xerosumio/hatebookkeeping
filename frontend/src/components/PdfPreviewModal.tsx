import { Download } from 'lucide-react';

interface Props {
  blobUrl: string;
  filename: string;
}

export default function PdfInlinePreview({ blobUrl, filename }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50">
        <span className="text-sm font-medium text-gray-700">{filename}</span>
        <a
          href={blobUrl}
          download={filename}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
        >
          <Download size={14} /> Download
        </a>
      </div>
      <iframe
        src={blobUrl}
        title={filename}
        className="w-full border-0"
        style={{ height: '80vh' }}
      />
    </div>
  );
}
