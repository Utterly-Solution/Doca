import { ChatMode } from './types';

export function getSystemPrompt(mode: ChatMode, documentText: string, qaPairs?: string): string {
  const docContext = `\n\n<document>\n${documentText}\n</document>`;
  const qaContext = qaPairs ? `\n\n<knowledge_base>\n${qaPairs}\n</knowledge_base>` : '';

  switch (mode) {
    case 'summary':
      return `You are a medical document analyst. Generate a 150-200 word summary of this document highlighting: document type, key persons (patient/caregiver names), important dates, main obligations, and any obvious issues. Be concise and professional.${docContext}`;

    case 'analysis':
      return `You are a medical document compliance analyst. Analyze this document for:
(a) missing required fields like signatures, dates, patient name
(b) any expired dates
(c) inconsistencies between sections
(d) potential compliance gaps (e.g., missing HIPAA acknowledgment)

Return findings as a JSON array with fields: severity (Critical/Warning/Info), section, and description.
Return ONLY the JSON array, no other text. Example format:
[{"severity":"Critical","section":"Header","description":"Patient name is missing"}]

If no issues found, return an empty array: []${docContext}`;

    case 'qa':
      return `You are a medical document assistant. Answer questions strictly based on the provided document. Always include which section or area your answer comes from. If the answer is not in the document, say so clearly - never fabricate information. Format citations like "Source: [relevant section/area]" at the end of your answer.${qaContext}${docContext}`;

    case 'edit':
      return `You are a medical document editor. The user wants to edit this document. Propose the exact edited version of only the changed sections. Format your response as JSON: { "original": "the exact original text that should be changed", "revised": "the new replacement text" }. Return ONLY the JSON object, no other text. Make minimal, precise changes as instructed.${docContext}`;
  }
}
