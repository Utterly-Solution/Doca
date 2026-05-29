export async function parseDocument(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'txt' || ext === 'md') {
    return await file.text();
  }

  if (ext === 'pdf') {
    const buffer = await file.arrayBuffer();
    const formData = new FormData();
    formData.append('file', new Blob([buffer]), file.name);
    const res = await fetch('/api/parse', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Failed to parse PDF');
    const data = await res.json();
    return data.text;
  }

  if (ext === 'doc' || ext === 'docx') {
    const buffer = await file.arrayBuffer();
    const formData = new FormData();
    formData.append('file', new Blob([buffer]), file.name);
    const res = await fetch('/api/parse', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Failed to parse DOCX');
    const data = await res.json();
    return data.text;
  }

  throw new Error(`Unsupported file format: .${ext}`);
}
